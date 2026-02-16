#!/usr/bin/env node

/**
 * Smart Document Classifier (No AI Required)
 *
 * Uses enhanced pattern matching with PDF text extraction to accurately
 * categorize documents WITHOUT requiring OpenAI API access.
 *
 * More accurate than basic filename patterns but doesn't need API costs.
 *
 * Usage: node scripts/smart-document-classifier.js [--source path]
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const pdfParse = require('pdf-parse-fork');

// Default source path - auto-detect WSL vs Windows
const getDefaultSource = () => {
  if (process.platform === 'win32') {
    return 'C:\\Users\\danie\\Dropbox\\Properties\\Austin, TX\\Liberty Hill\\708 Purple Salvia Cove';
  } else {
    return '/mnt/c/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove';
  }
};

const DEFAULT_SOURCE = getDefaultSource();

// Enhanced classification rules with content keywords
const CLASSIFICATION_RULES = [
  // TAX DOCUMENTS (high priority - check first!)
  {
    category: 'Tax Documents',
    folder: '10_ARCHIVE/Financial_Documents',
    confidence: 0.95,
    test: (filename, content, filePath) => {
      const taxKeywords = ['1040', 'tax return', 'irs', 'w-2', 'federal tax', 'income tax', 'tax year', 'department of treasury'];
      return taxKeywords.some(kw => content.toLowerCase().includes(kw)) ||
             /tax.*return|1040|w-?2/i.test(filename);
    }
  },

  // GRADING & DRAINAGE (engineering, not architecture!)
  {
    category: 'Engineering - Grading/Drainage',
    folder: '01_PLANS_AND_ENGINEERING/Engineering/Site_Work',
    confidence: 0.90,
    test: (filename, content, filePath) => {
      const keywords = ['grading plan', 'drainage plan', 'erosion control', 'swale', 'retention pond', 'site work', 'earthwork', 'topography', 'contour'];
      return keywords.some(kw => content.toLowerCase().includes(kw)) ||
             /grading|drainage|erosion|swale/i.test(filename);
    }
  },

  // FOUNDATION ENGINEERING
  {
    category: 'Engineering - Foundation',
    folder: '01_PLANS_AND_ENGINEERING/Engineering/Foundation',
    confidence: 0.90,
    test: (filename, content, filePath) => {
      const keywords = ['foundation plan', 'post-tension', 'footing', 'pier', 'bearing capacity', 'soils report', 'rebar schedule', 'foundation engineering'];
      return keywords.some(kw => content.toLowerCase().includes(kw)) ||
             (/foundation/i.test(filename) && /engineer|struct|soil/i.test(content));
    }
  },

  // STRUCTURAL ENGINEERING
  {
    category: 'Engineering - Structural',
    folder: '01_PLANS_AND_ENGINEERING/Engineering/Structural',
    confidence: 0.88,
    test: (filename, content, filePath) => {
      const keywords = ['structural plan', 'beam schedule', 'framing plan', 'load calculation', 'truss', 'joist', 'structural engineer'];
      return keywords.some(kw => content.toLowerCase().includes(kw)) ||
             (/structural|beam|framing/i.test(filename) && content.length > 100);
    }
  },

  // ROOFING ENGINEERING
  {
    category: 'Engineering - Roofing',
    folder: '01_PLANS_AND_ENGINEERING/Engineering/Roofing',
    confidence: 0.85,
    test: (filename, content, filePath) => {
      const keywords = ['roof plan', 'roofing', 'truss design', 'rafter', 'roof framing'];
      return keywords.some(kw => content.toLowerCase().includes(kw)) ||
             /roof/i.test(filename);
    }
  },

  // ARCHITECTURAL PLANS
  {
    category: 'Architectural Plans',
    folder: '01_PLANS_AND_ENGINEERING/Architectural/CURRENT',
    confidence: 0.85,
    test: (filename, content, filePath) => {
      const keywords = ['floor plan', 'elevation', 'site plan', 'architectural', 'bedroom', 'bathroom', 'square feet', 'square footage', 'living room'];
      const hasArchKeywords = keywords.some(kw => content.toLowerCase().includes(kw));
      const isArchFile = /floor[- ]?plan|elevation|architectural/i.test(filename);

      // Recent files to CURRENT, old to ARCHIVE
      const stats = fs.statSync(filePath);
      const ageMs = Date.now() - stats.mtime.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      if (hasArchKeywords || isArchFile) {
        return ageDays < 180; // CURRENT if less than 6 months old
      }
      return false;
    }
  },

  // ARCHITECTURAL PLANS - ARCHIVE
  {
    category: 'Architectural Plans - Archive',
    folder: '01_PLANS_AND_ENGINEERING/Architectural/ARCHIVE',
    confidence: 0.85,
    test: (filename, content, filePath) => {
      const keywords = ['floor plan', 'elevation', 'architectural'];
      const hasArchKeywords = keywords.some(kw => content.toLowerCase().includes(kw));

      const stats = fs.statSync(filePath);
      const ageMs = Date.now() - stats.mtime.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      return (hasArchKeywords || /floor[- ]?plan|elevation|architectural/i.test(filename)) && ageDays >= 180;
    }
  },

  // SURVEY
  {
    category: 'Survey',
    folder: '01_PLANS_AND_ENGINEERING/Survey',
    confidence: 0.95,
    test: (filename, content, filePath) => {
      const keywords = ['property survey', 'boundary', 'metes and bounds', 'topographic', 'surveyor'];
      return keywords.some(kw => content.toLowerCase().includes(kw)) ||
             /survey/i.test(filename);
    }
  },

  // BUILDING PERMITS
  {
    category: 'Building Permits',
    folder: '02_PERMITS_AND_REGULATORY/Building_Permits',
    confidence: 0.92,
    test: (filename, content, filePath) => {
      const keywords = ['building permit', 'PRN', 'permit application', 'building department', 'inspection'];
      return keywords.some(kw => content.toLowerCase().includes(kw)) ||
             /permit|PRN.*\d{2}-\d{4}/i.test(filename);
    }
  },

  // HOA DOCUMENTS
  {
    category: 'HOA Documents',
    folder: '02_PERMITS_AND_REGULATORY/HOA/Submissions',
    confidence: 0.90,
    test: (filename, content, filePath) => {
      const keywords = ['homeowner association', 'HOA', 'architectural committee', 'restrictions', 'covenants', 'Belterra'];
      return keywords.some(kw => content.toLowerCase().includes(kw)) ||
             /hoa|homeowner|belterra/i.test(filename);
    }
  },

  // UTILITIES
  {
    category: 'Utilities',
    folder: '02_PERMITS_AND_REGULATORY/Utilities',
    confidence: 0.85,
    test: (filename, content, filePath) => {
      const keywords = ['pedernales', 'electric', 'PEC', 'water', 'well', 'septic', 'utility connection'];
      const hasUtilKeyword = keywords.some(kw => content.toLowerCase().includes(kw));

      if (hasUtilKeyword) {
        // Route to specific subfolder
        if (/pedernales|electric|pec/i.test(content + filename)) {
          this.folder = '02_PERMITS_AND_REGULATORY/Utilities/Electric';
        } else if (/well|drilling/i.test(content + filename)) {
          this.folder = '02_PERMITS_AND_REGULATORY/Utilities/Water_Well';
        } else if (/septic/i.test(content + filename)) {
          this.folder = '02_PERMITS_AND_REGULATORY/Utilities/Septic';
        }
        return true;
      }
      return false;
    }
  },

  // VENDOR BID (unsigned)
  {
    category: 'Vendor Bid',
    folder: '03_BIDS_AND_ESTIMATES/BY_CATEGORY',
    confidence: 0.80,
    test: (filename, content, filePath) => {
      const bidKeywords = ['estimate', 'quote', 'proposal', 'pricing', 'bid'];
      const signedKeywords = ['signed', 'executed', 'accepted', 'contract', 'agreement'];

      const hasBidKeyword = bidKeywords.some(kw => content.toLowerCase().includes(kw)) ||
                           /bid|estimate|quote/i.test(filename);
      const hasSignedKeyword = signedKeywords.some(kw => content.toLowerCase().includes(kw));

      return hasBidKeyword && !hasSignedKeyword;
    }
  },

  // CONTRACT (signed)
  {
    category: 'Contract',
    folder: '04_CONTRACTS_AND_AGREEMENTS/Vendors',
    confidence: 0.88,
    test: (filename, content, filePath) => {
      const keywords = ['signed', 'executed', 'contract', 'agreement', 'terms and conditions', 'signature'];
      return keywords.some(kw => content.toLowerCase().includes(kw)) ||
             /contract|agreement|signed|executed/i.test(filename);
    }
  },

  // LAND PURCHASE
  {
    category: 'Land Purchase',
    folder: '04_CONTRACTS_AND_AGREEMENTS/Land_Purchase',
    confidence: 0.95,
    test: (filename, content, filePath) => {
      const keywords = ['closing statement', 'sales contract', 'purchase agreement', 'deed', 'title', 'seller', 'buyer', 'real estate'];
      return keywords.some(kw => content.toLowerCase().includes(kw)) ||
             /closing|purchase.*agreement|sales.*contract|deed/i.test(filename);
    }
  },

  // RECEIPT/INVOICE
  {
    category: 'Receipt/Invoice',
    folder: '05_EXPENSES_AND_RECEIPTS/BY_VENDOR',
    confidence: 0.85,
    test: (filename, content, filePath) => {
      const keywords = ['receipt', 'invoice', 'paid', 'payment received', 'total due', 'amount paid', 'invoice number'];
      return keywords.some(kw => content.toLowerCase().includes(kw)) ||
             /receipt|invoice/i.test(filename) ||
             /^\d{2}_/.test(path.basename(path.dirname(filePath))); // Numbered vendor folders
    }
  },

  // PROJECT BUDGET
  {
    category: 'Budget/Financial',
    folder: '00_PROJECT_ESSENTIALS/Current_Budget',
    confidence: 0.80,
    test: (filename, content, filePath) => {
      const budgetKeywords = ['budget', 'cost estimate', 'line item', 'contingency', 'total cost', 'construction cost'];
      const taxKeywords = ['1040', 'tax return', 'irs'];

      const hasBudgetKeyword = budgetKeywords.some(kw => content.toLowerCase().includes(kw)) ||
                               /budget/i.test(filename);
      const hasTaxKeyword = taxKeywords.some(kw => content.toLowerCase().includes(kw));

      return hasBudgetKeyword && !hasTaxKeyword;
    }
  },

  // DESIGN SELECTIONS
  {
    category: 'Design Selections',
    folder: '06_DESIGN_AND_SPECIFICATIONS/Final_Selections',
    confidence: 0.75,
    test: (filename, content, filePath) => {
      const keywords = ['selection', 'fixture', 'finish', 'material', 'specification', 'appliance', 'chosen', 'selected'];
      return keywords.some(kw => content.toLowerCase().includes(kw)) ||
             /selection|fixture|finish|spec/i.test(filename);
    }
  },

  // DESIGN INSPIRATION (images)
  {
    category: 'Design Inspiration',
    folder: '06_DESIGN_AND_SPECIFICATIONS/Design_Inspiration',
    confidence: 0.70,
    test: (filename, content, filePath) => {
      const ext = path.extname(filename).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.heic'].includes(ext) &&
             /inspiration|design|example|bathroom|kitchen|exterior/i.test(filePath);
    }
  },

  // PROGRESS PHOTOS
  {
    category: 'Progress Photos',
    folder: '07_SITE_PROGRESS/Photos',
    confidence: 0.75,
    test: (filename, content, filePath) => {
      const ext = path.extname(filename).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.heic'].includes(ext) &&
             /progress|construction|site|excavation|foundation/i.test(filePath);
    }
  },

  // UBUILDIT PROCESS
  {
    category: 'UBuildIt Process',
    folder: '09_REFERENCE_AND_TEMPLATES/UBuildIt_Process',
    confidence: 0.95,
    test: (filename, content, filePath) => {
      return /ubuildit.*process/i.test(filePath) ||
             /process.*\d{2}/i.test(filename) ||
             content.toLowerCase().includes('ubuildit');
    }
  }
];

/**
 * Extract text from PDF (up to 5000 chars for better accuracy)
 */
async function extractPdfText(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text.substring(0, 5000); // More text for better matching
  } catch (error) {
    // PDF extraction failed, return empty string (silent fail for compatibility)
    return '';
  }
}

/**
 * Classify a single file using smart rules
 */
async function classifyFile(filePath, baseDir) {
  const filename = path.basename(filePath);
  const relativePath = path.relative(baseDir, filePath);
  const ext = path.extname(filename).toLowerCase();

  console.log(chalk.cyan(`Classifying: ${relativePath}`));

  let content = '';

  // Extract content
  if (ext === '.pdf') {
    content = await extractPdfText(filePath);
  } else if (['.txt', '.md', '.csv'].includes(ext)) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      content = fileContent.substring(0, 5000);
    } catch (error) {
      content = '';
    }
  }

  // Try each rule until one matches
  for (const rule of CLASSIFICATION_RULES) {
    try {
      if (rule.test(filename, content, filePath)) {
        console.log(chalk.gray(`  → ${rule.category} (${(rule.confidence * 100).toFixed(0)}% confident)`));

        return {
          file: relativePath,
          filename: filename,
          category: rule.category,
          confidence: rule.confidence,
          reasoning: `Matched ${rule.category} based on content and filename analysis`,
          targetFolder: rule.folder
        };
      }
    } catch (error) {
      // Rule threw error, skip it
      continue;
    }
  }

  // No rule matched - use fallback
  console.log(chalk.yellow(`  → Uncategorized (60% confident)`));

  return {
    file: relativePath,
    filename: filename,
    category: 'Uncategorized',
    confidence: 0.60,
    reasoning: 'No classification rule matched',
    targetFolder: '10_ARCHIVE/Uncategorized'
  };
}

/**
 * Scan directory
 */
async function scanForClassification(dirPath, baseDir = dirPath) {
  const files = [];
  const skipPatterns = [/node_modules/, /\.git/, /\.DS_Store/, /Thumbs\.db/, /_ORGANIZED/];

  async function scan(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (skipPatterns.some(pattern => pattern.test(relativePath))) {
        continue;
      }

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile()) {
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
 * Main execution
 */
async function main() {
  console.log(chalk.bold.cyan('\n🧠 Smart Document Classifier (No AI API Required)\n'));

  const args = process.argv.slice(2);
  let sourceDir = DEFAULT_SOURCE;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) {
      sourceDir = args[i + 1];
      i++;
    }
  }

  if (!await fs.pathExists(sourceDir)) {
    console.error(chalk.red(`✗ Source directory not found: ${sourceDir}`));
    process.exit(1);
  }

  console.log(chalk.blue(`Source: ${sourceDir}\n`));

  // Scan files
  console.log(chalk.yellow('Step 1: Scanning for files...'));
  const files = await scanForClassification(sourceDir);
  console.log(chalk.green(`✓ Found ${files.length} files to classify\n`));

  console.log(chalk.yellow('Step 2: Classifying files with smart rules...\n'));

  const classifications = [];
  for (let i = 0; i < files.length; i++) {
    const classification = await classifyFile(files[i], sourceDir);
    classifications.push(classification);

    if ((i + 1) % 25 === 0) {
      console.log(chalk.gray(`  Progress: ${i + 1}/${files.length} files...\n`));
    }
  }

  console.log(chalk.green(`\n✓ Classified ${classifications.length} files\n`));

  // Save results
  const outputJson = path.join(process.cwd(), 'AI_CLASSIFICATIONS.json');
  const outputReport = path.join(process.cwd(), 'AI_CLASSIFICATION_REVIEW.md');

  await fs.writeJson(outputJson, classifications, { spaces: 2 });
  console.log(chalk.green(`✓ Saved to: ${outputJson}\n`));

  // Generate report
  let report = '# Smart Classification Review\n\n';
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `Classification method: Enhanced pattern matching with content extraction\n\n`;

  const byCategory = {};
  classifications.forEach(c => {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c);
  });

  report += '## Summary by Category\n\n';
  report += '| Category | Files |\n|----------|-------|\n';
  Object.entries(byCategory).forEach(([cat, items]) => {
    report += `| ${cat} | ${items.length} |\n`;
  });

  await fs.writeFile(outputReport, report);
  console.log(chalk.green(`✓ Saved report: ${outputReport}\n`));

  const avgConf = (classifications.reduce((sum, c) => sum + c.confidence, 0) / classifications.length * 100).toFixed(0);

  console.log(chalk.bold.green('✓ Classification Complete!\n'));
  console.log(chalk.cyan('Statistics:'));
  console.log(chalk.white(`  Files classified: ${classifications.length}`));
  console.log(chalk.white(`  Average confidence: ${avgConf}%`));
  console.log(chalk.white(`  Cost: $0.00 (no API required)\n`));

  console.log(chalk.cyan('Next steps:'));
  console.log(chalk.white('  1. Review AI_CLASSIFICATION_REVIEW.md'));
  console.log(chalk.white('  2. Run: npm run docs:ai-reorganize:dry-run'));
  console.log(chalk.white('  3. Run: npm run docs:ai-reorganize\n'));
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\n✗ Error:'), error);
    process.exit(1);
  });
}

module.exports = { classifyFile };
