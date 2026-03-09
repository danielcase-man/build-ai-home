#!/usr/bin/env node

/**
 * AI-Powered Document Classifier
 *
 * Uses OpenAI to read document contents and intelligently categorize them.
 * Much more accurate than filename-based pattern matching.
 *
 * Usage: node scripts/ai-document-classifier.js [--source path] [--batch-size 10]
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const pdfParse = require('pdf-parse-fork');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Default source path - auto-detect WSL vs Windows
const getDefaultSource = () => {
  if (process.platform === 'win32') {
    return 'C:\\Users\\danie\\Dropbox\\Properties\\Austin, TX\\Liberty Hill\\708 Purple Salvia Cove';
  } else {
    return '/mnt/c/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove';
  }
};

const DEFAULT_SOURCE = getDefaultSource();

// Detailed category definitions with examples
const CATEGORY_DEFINITIONS = {
  'Architectural Plans': {
    description: 'Floor plans, elevations, site plans, architectural drawings',
    keywords: ['floor plan', 'elevation', 'site plan', 'architectural', 'rooms', 'layout', 'square footage'],
    folder: '01_PLANS_AND_ENGINEERING/Architectural/CURRENT'
  },
  'Engineering - Foundation': {
    description: 'Foundation engineering, structural calculations, soils reports',
    keywords: ['foundation', 'footing', 'concrete', 'rebar', 'structural', 'soils', 'bearing capacity'],
    folder: '01_PLANS_AND_ENGINEERING/Engineering/Foundation'
  },
  'Engineering - Grading/Drainage': {
    description: 'Grading plans, drainage plans, erosion control, site work',
    keywords: ['grading', 'drainage', 'erosion', 'swale', 'retention', 'site work', 'earthwork', 'topography'],
    folder: '01_PLANS_AND_ENGINEERING/Engineering/Site_Work'
  },
  'Engineering - Structural': {
    description: 'Structural engineering, beam calculations, framing plans',
    keywords: ['structural', 'beam', 'framing', 'load', 'truss', 'joist', 'steel', 'lumber'],
    folder: '01_PLANS_AND_ENGINEERING/Engineering/Structural'
  },
  'Engineering - Roofing': {
    description: 'Roof engineering, truss design, roofing plans',
    keywords: ['roof', 'truss', 'roofing', 'shingle', 'pitch', 'rafter'],
    folder: '01_PLANS_AND_ENGINEERING/Engineering/Roofing'
  },
  'Survey': {
    description: 'Property survey, boundary survey, topographic survey',
    keywords: ['survey', 'boundary', 'property line', 'topographic', 'lot', 'metes and bounds'],
    folder: '01_PLANS_AND_ENGINEERING/Survey'
  },
  'Building Permits': {
    description: 'Building permit applications, approvals, inspection records',
    keywords: ['permit', 'building department', 'PRN', 'inspection', 'approval', 'code compliance'],
    folder: '02_PERMITS_AND_REGULATORY/Building_Permits'
  },
  'HOA Documents': {
    description: 'HOA submissions, architectural approval, restrictions',
    keywords: ['HOA', 'homeowner association', 'architectural committee', 'restrictions', 'covenants', 'Belterra'],
    folder: '02_PERMITS_AND_REGULATORY/HOA/Submissions'
  },
  'Utilities': {
    description: 'Electric, water, septic, well drilling permits and plans',
    keywords: ['electric', 'water', 'septic', 'well', 'utility', 'connection', 'Pedernales', 'PEC'],
    folder: '02_PERMITS_AND_REGULATORY/Utilities'
  },
  'Vendor Bid': {
    description: 'Vendor bids, estimates, proposals, quotes for services',
    keywords: ['bid', 'estimate', 'quote', 'proposal', 'pricing', 'cost estimate', 'scope of work'],
    folder: '03_BIDS_AND_ESTIMATES/BY_CATEGORY'
  },
  'Contract': {
    description: 'Executed contracts, agreements, signed documents',
    keywords: ['contract', 'agreement', 'signed', 'executed', 'terms and conditions', 'scope of work'],
    folder: '04_CONTRACTS_AND_AGREEMENTS/Vendors'
  },
  'Land Purchase': {
    description: 'Land purchase contract, closing documents, title, deed',
    keywords: ['purchase', 'closing', 'deed', 'title', 'sales contract', 'amendment', 'seller', 'buyer'],
    folder: '04_CONTRACTS_AND_AGREEMENTS/Land_Purchase'
  },
  'Receipt/Invoice': {
    description: 'Payment receipts, invoices, paid bills',
    keywords: ['receipt', 'invoice', 'paid', 'payment', 'bill', 'total due', 'amount paid'],
    folder: '05_EXPENSES_AND_RECEIPTS/BY_VENDOR'
  },
  'Budget/Financial': {
    description: 'Project budgets, cost estimates, financial summaries (NOT tax returns)',
    keywords: ['budget', 'cost', 'expense', 'financial', 'line item', 'contingency', 'total cost'],
    folder: '00_PROJECT_ESSENTIALS/Current_Budget'
  },
  'Tax Documents': {
    description: 'Tax returns, tax documents, IRS forms (NOT project budget)',
    keywords: ['tax return', '1040', 'IRS', 'W-2', 'income tax', 'federal tax', 'tax year'],
    folder: '10_ARCHIVE/Financial_Documents'
  },
  'Design Selections': {
    description: 'Material selections, fixture choices, design inspiration, finish schedules',
    keywords: ['selection', 'fixture', 'finish', 'material', 'color', 'style', 'specification', 'product'],
    folder: '06_DESIGN_AND_SPECIFICATIONS/Final_Selections'
  },
  'Design Inspiration': {
    description: 'Photos, images, inspiration for design choices',
    keywords: ['inspiration', 'example', 'photo', 'image', 'reference', 'similar to'],
    folder: '06_DESIGN_AND_SPECIFICATIONS/Design_Inspiration'
  },
  'Progress Photos': {
    description: 'Construction progress photos, site photos',
    keywords: ['progress', 'site photo', 'construction', 'work completed', 'current status'],
    folder: '07_SITE_PROGRESS/Photos'
  },
  'UBuildIt Process': {
    description: 'UBuildIt process documents, guides, templates',
    keywords: ['UBuildIt', 'process', 'guide', 'template', 'checklist', 'how to'],
    folder: '09_REFERENCE_AND_TEMPLATES/UBuildIt_Process'
  },
  'Old/Archive': {
    description: 'Old versions, superseded documents, outdated files',
    keywords: ['old', 'superseded', 'previous version', 'draft', 'obsolete'],
    folder: '10_ARCHIVE/Old_Versions'
  }
};

/**
 * Extract text from PDF
 */
async function extractPdfText(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    // Limit to first 3000 characters to save on API costs
    return data.text.substring(0, 3000);
  } catch (error) {
    console.error(chalk.red(`Error extracting PDF ${filePath}:`), error.message);
    return null;
  }
}

/**
 * Use OpenAI to classify document based on content
 */
async function classifyDocument(filename, content, filePath) {
  const prompt = `You are a construction document classifier. Analyze this document and determine its category.

Document filename: ${filename}
File path: ${filePath}

Document content (first 3000 chars):
${content}

Available categories:
${Object.entries(CATEGORY_DEFINITIONS).map(([cat, def]) =>
  `- ${cat}: ${def.description}`
).join('\n')}

IMPORTANT RULES:
- Grading plans, drainage plans, site work = "Engineering - Grading/Drainage" (NOT Architectural Plans)
- Tax returns, IRS forms, 1040s = "Tax Documents" (NOT Budget/Financial)
- Foundation engineering, soils reports = "Engineering - Foundation"
- Structural engineering, beams, trusses = "Engineering - Structural"
- Bids/estimates (not signed) = "Vendor Bid"
- Signed contracts = "Contract"
- Receipts/invoices = "Receipt/Invoice"
- Project budgets = "Budget/Financial"

Respond with ONLY a valid JSON object in this exact format:
{
  "category": "exact category name from list",
  "confidence": 0.95,
  "reasoning": "brief explanation",
  "subcategory": "specific trade/type if applicable"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cheaper model for classification
      messages: [
        { role: 'system', content: 'You are a construction document classification expert. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3, // Lower temperature for more consistent categorization
      max_tokens: 200
    });

    const result = response.choices[0].message.content.trim();

    // Parse JSON response
    // Handle potential markdown code blocks
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const classification = JSON.parse(jsonMatch[0]);

    return classification;
  } catch (error) {
    console.error(chalk.red(`Error classifying ${filename}:`), error.message);
    return {
      category: 'Uncategorized',
      confidence: 0.0,
      reasoning: `Error: ${error.message}`,
      subcategory: null
    };
  }
}

/**
 * Classify a single file
 */
async function classifyFile(filePath, baseDir) {
  const filename = path.basename(filePath);
  const relativePath = path.relative(baseDir, filePath);
  const ext = path.extname(filename).toLowerCase();

  console.log(chalk.cyan(`Classifying: ${relativePath}`));

  let content = '';

  // Extract content based on file type
  if (ext === '.pdf') {
    content = await extractPdfText(filePath);
    if (!content) {
      return {
        file: relativePath,
        category: 'Uncategorized',
        confidence: 0.0,
        reasoning: 'Could not extract PDF content',
        targetFolder: '10_ARCHIVE/Uncategorized'
      };
    }
  } else if (['.txt', '.md', '.csv'].includes(ext)) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      content = fileContent.substring(0, 3000);
    } catch (error) {
      console.error(chalk.red(`Error reading ${filename}:`), error.message);
      return {
        file: relativePath,
        category: 'Uncategorized',
        confidence: 0.0,
        reasoning: 'Could not read file',
        targetFolder: '10_ARCHIVE/Uncategorized'
      };
    }
  } else if (['.jpg', '.jpeg', '.png', '.heic'].includes(ext)) {
    // Images - classify based on folder/filename only
    content = `Image file in folder: ${path.dirname(relativePath)}. Filename: ${filename}`;
  } else {
    // Other files - use filename and path only
    content = `File type: ${ext}. Path: ${relativePath}. Filename: ${filename}`;
  }

  // Classify with OpenAI
  const classification = await classifyDocument(filename, content, relativePath);

  // Determine target folder
  let targetFolder = '10_ARCHIVE/Uncategorized';
  if (classification.category !== 'Uncategorized' && CATEGORY_DEFINITIONS[classification.category]) {
    targetFolder = CATEGORY_DEFINITIONS[classification.category].folder;

    // Add subcategory if provided
    if (classification.subcategory) {
      targetFolder = path.join(targetFolder, classification.subcategory);
    }
  }

  console.log(chalk.gray(`  → ${classification.category} (${(classification.confidence * 100).toFixed(0)}% confident)`));

  return {
    file: relativePath,
    filename: filename,
    category: classification.category,
    confidence: classification.confidence,
    reasoning: classification.reasoning,
    subcategory: classification.subcategory,
    targetFolder: targetFolder
  };
}

/**
 * Scan directory and find files to classify
 */
async function scanForClassification(dirPath, baseDir = dirPath) {
  const files = [];
  const skipPatterns = [/node_modules/, /\.git/, /\.DS_Store/, /Thumbs\.db/, /_ORGANIZED/];

  async function scan(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      // Skip certain patterns
      if (skipPatterns.some(pattern => pattern.test(relativePath))) {
        continue;
      }

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile()) {
        // Only classify important file types
        const ext = path.extname(entry.name).toLowerCase();
        if (['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png', '.txt', '.md'].includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  await scan(dirPath);
  return files;
}

/**
 * Save classifications to JSON for review
 */
async function saveClassifications(classifications, outputPath) {
  await fs.writeJson(outputPath, classifications, { spaces: 2 });
  console.log(chalk.green(`\n✓ Saved classifications to: ${outputPath}`));
}

/**
 * Generate review report
 */
async function generateReviewReport(classifications, outputPath) {
  let report = '# AI Document Classification Review\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `Total files classified: ${classifications.length}\n\n`;

  // Group by category
  const byCategory = {};
  const lowConfidence = [];

  classifications.forEach(item => {
    if (!byCategory[item.category]) {
      byCategory[item.category] = [];
    }
    byCategory[item.category].push(item);

    if (item.confidence < 0.7) {
      lowConfidence.push(item);
    }
  });

  // Summary by category
  report += '## Summary by Category\n\n';
  report += '| Category | Files | Avg Confidence |\n';
  report += '|----------|-------|----------------|\n';

  Object.entries(byCategory).forEach(([category, items]) => {
    const avgConf = (items.reduce((sum, item) => sum + item.confidence, 0) / items.length * 100).toFixed(0);
    report += `| ${category} | ${items.length} | ${avgConf}% |\n`;
  });

  // Low confidence items needing review
  report += '\n## ⚠️ Low Confidence Classifications (Please Review)\n\n';
  if (lowConfidence.length === 0) {
    report += '*All classifications have high confidence.*\n\n';
  } else {
    lowConfidence.forEach(item => {
      report += `### ${item.filename}\n\n`;
      report += `- **Current Path:** \`${item.file}\`\n`;
      report += `- **Proposed Category:** ${item.category}\n`;
      report += `- **Confidence:** ${(item.confidence * 100).toFixed(0)}%\n`;
      report += `- **Target Folder:** \`${item.targetFolder}\`\n`;
      report += `- **Reasoning:** ${item.reasoning}\n\n`;
    });
  }

  // Details by category
  report += '\n## Classification Details\n\n';

  Object.entries(byCategory).forEach(([category, items]) => {
    report += `### ${category} (${items.length} files)\n\n`;

    items.slice(0, 20).forEach(item => {
      const confEmoji = item.confidence >= 0.9 ? '✅' : item.confidence >= 0.7 ? '⚠️' : '❌';
      report += `${confEmoji} **${item.filename}**\n`;
      report += `  - Confidence: ${(item.confidence * 100).toFixed(0)}%\n`;
      report += `  - Target: \`${item.targetFolder}\`\n`;
      if (item.subcategory) report += `  - Subcategory: ${item.subcategory}\n`;
      report += `  - Reasoning: ${item.reasoning}\n\n`;
    });

    if (items.length > 20) {
      report += `*...and ${items.length - 20} more files*\n\n`;
    }
  });

  report += '\n---\n';
  report += '**Next Steps:**\n';
  report += '1. Review low confidence classifications above\n';
  report += '2. Edit `AI_CLASSIFICATIONS.json` to correct any mistakes\n';
  report += '3. Run reorganization with `--use-ai-classifications` flag\n';

  await fs.writeFile(outputPath, report);
  console.log(chalk.green(`✓ Saved review report to: ${outputPath}\n`));
}

/**
 * Main execution
 */
async function main() {
  console.log(chalk.bold.cyan('\n🤖 AI-Powered Document Classifier\n'));

  // Parse arguments
  const args = process.argv.slice(2);
  let sourceDir = DEFAULT_SOURCE;
  let batchSize = 10;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) {
      sourceDir = args[i + 1];
      i++;
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      batchSize = parseInt(args[i + 1]);
      i++;
    }
  }

  // Verify source exists
  if (!await fs.pathExists(sourceDir)) {
    console.error(chalk.red(`✗ Source directory not found: ${sourceDir}`));
    process.exit(1);
  }

  console.log(chalk.blue(`Source: ${sourceDir}`));
  console.log(chalk.blue(`Batch size: ${batchSize} files at a time\n`));

  // Check OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error(chalk.red('✗ OPENAI_API_KEY not found in .env.local'));
    process.exit(1);
  }

  // Step 1: Scan for files
  console.log(chalk.yellow('Step 1: Scanning for files to classify...'));
  const files = await scanForClassification(sourceDir);
  console.log(chalk.green(`✓ Found ${files.length} files to classify\n`));

  // Estimate cost
  const estimatedCost = (files.length * 0.002).toFixed(2); // ~$0.002 per file with gpt-4o-mini
  console.log(chalk.yellow(`Estimated API cost: ~$${estimatedCost}\n`));

  // Step 2: Classify files in batches
  console.log(chalk.yellow('Step 2: Classifying files with AI...\n'));

  const classifications = [];
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    console.log(chalk.cyan(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)}...\n`));

    for (const file of batch) {
      const classification = await classifyFile(file, sourceDir);
      classifications.push(classification);

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(chalk.green(`\n✓ Classified ${classifications.length} files\n`));

  // Step 3: Save results
  const outputJson = path.join(process.cwd(), 'AI_CLASSIFICATIONS.json');
  const outputReport = path.join(process.cwd(), 'AI_CLASSIFICATION_REVIEW.md');

  await saveClassifications(classifications, outputJson);
  await generateReviewReport(classifications, outputReport);

  // Summary
  const avgConfidence = (classifications.reduce((sum, c) => sum + c.confidence, 0) / classifications.length * 100).toFixed(0);
  const lowConfCount = classifications.filter(c => c.confidence < 0.7).length;

  console.log(chalk.bold.green('✓ Classification Complete!\n'));
  console.log(chalk.cyan('Statistics:'));
  console.log(chalk.white(`  Files classified: ${classifications.length}`));
  console.log(chalk.white(`  Average confidence: ${avgConfidence}%`));
  console.log(chalk.white(`  Low confidence (<70%): ${lowConfCount} files\n`));

  if (lowConfCount > 0) {
    console.log(chalk.yellow('⚠️  Please review low confidence classifications in:'));
    console.log(chalk.white(`   ${outputReport}\n`));
  }

  console.log(chalk.cyan('Next steps:'));
  console.log(chalk.white('  1. Review AI_CLASSIFICATION_REVIEW.md'));
  console.log(chalk.white('  2. Edit AI_CLASSIFICATIONS.json to correct any mistakes'));
  console.log(chalk.white('  3. Run: node scripts/reorganize-with-ai.js\n'));
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\n✗ Error:'), error);
    process.exit(1);
  });
}

module.exports = { classifyFile, classifyDocument, CATEGORY_DEFINITIONS };
