#!/usr/bin/env node

/**
 * Database Extraction Script
 *
 * Extracts structured data from organized documents and populates Supabase:
 * - Bid data from PDFs and spreadsheets
 * - Expense tracking from receipts
 * - Vendor information from contracts
 * - Document references and metadata
 *
 * Usage: node scripts/extract-to-database.js [--dry-run] [--source path]
 */

// Polyfill fetch for Node.js compatibility
require('cross-fetch/polyfill');

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { createClient } = require('@supabase/supabase-js');
const pdfParse = require('pdf-parse-fork');
const xlsx = require('xlsx');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PROJECT_ID = '7e936406-e8bc-4f50-8a84-3fec6c7d79e9'; // 708 Purple Salvia Cove

// Default organized path - auto-detect WSL vs Windows
const getDefaultOrganizedPath = () => {
  if (process.platform === 'win32') {
    return 'C:\\Users\\danie\\Dropbox\\Properties\\Austin, TX\\Liberty Hill\\708 Purple Salvia Cove_ORGANIZED';
  } else {
    return '/mnt/c/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove_ORGANIZED';
  }
};

const DEFAULT_ORGANIZED_PATH = getDefaultOrganizedPath();

/**
 * Extract text from PDF
 */
async function extractPdfText(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(chalk.red(`Error extracting PDF ${filePath}:`), error.message);
    return '';
  }
}

/**
 * Parse spreadsheet (Excel, CSV)
 */
function parseSpreadsheet(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheets = {};

    workbook.SheetNames.forEach(sheetName => {
      sheets[sheetName] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    });

    return sheets;
  } catch (error) {
    console.error(chalk.red(`Error parsing spreadsheet ${filePath}:`), error.message);
    return {};
  }
}

/**
 * Extract bid information from text
 */
function extractBidInfo(text, filename) {
  const info = {
    vendor: null,
    amount: null,
    date: null,
    category: null
  };

  // Extract vendor name (usually at top of bid)
  const vendorPatterns = [
    /(?:from|by|vendor):\s*([A-Z][A-Za-z\s&]+?)(?:\n|$)/i,
    /^([A-Z][A-Za-z\s&]{3,30})\n/m,  // First line capitalized name
  ];

  for (const pattern of vendorPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.vendor = match[1].trim();
      break;
    }
  }

  // Extract amount
  const amountPatterns = [
    /total[:\s]+\$?([0-9,]+(?:\.\d{2})?)/i,
    /amount[:\s]+\$?([0-9,]+(?:\.\d{2})?)/i,
    /\$([0-9,]+(?:\.\d{2})?)\s*(?:total|estimate)/i,
    /grand\s+total[:\s]+\$?([0-9,]+(?:\.\d{2})?)/i
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.amount = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  // Extract date
  const datePatterns = [
    /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/,
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i,
    /date[:\s]+([^\n]+)/i
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        info.date = new Date(match[1]);
        if (!isNaN(info.date.getTime())) break;
      } catch (e) {
        // Invalid date, continue
      }
    }
  }

  // Infer category from filename/path
  const categoryMap = {
    'appliance': 'Appliances',
    'electrical': 'Electrical',
    'engineering': 'Engineering',
    'excavat': 'Excavation',
    'septic': 'Excavation & Septic',
    'flooring': 'Flooring',
    'garage': 'Garage Doors',
    'plumbing': 'Plumbing',
    'pool': 'Pool',
    'stone': 'Stone Fabrication',
    'counter': 'Countertops',
    'well': 'Well Drilling',
    'window': 'Windows & Doors',
    'door': 'Windows & Doors'
  };

  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (filename.toLowerCase().includes(keyword)) {
      info.category = category;
      break;
    }
  }

  return info;
}

/**
 * Scan bids folder and extract data
 */
async function extractBids(organizedPath, dryRun = false) {
  console.log(chalk.yellow('Extracting bid data...'));

  const bidsPath = path.join(organizedPath, '03_BIDS_AND_ESTIMATES');
  const bids = [];

  if (!await fs.pathExists(bidsPath)) {
    console.log(chalk.gray('  No bids folder found, skipping'));
    return bids;
  }

  // Recursively find all PDFs in bids folder
  async function findBidFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await findBidFiles(fullPath);
      } else if (entry.isFile() && /\.pdf$/i.test(entry.name)) {
        try {
          const text = await extractPdfText(fullPath);
          const info = extractBidInfo(text, entry.name);
          const category = path.basename(path.dirname(fullPath));

          bids.push({
            project_id: PROJECT_ID,
            vendor_name: info.vendor || 'Unknown Vendor',
            category: info.category || category,
            amount: info.amount,
            bid_date: info.date,
            file_path: path.relative(organizedPath, fullPath),
            status: 'received',
            notes: `Extracted from ${entry.name}`
          });

          console.log(chalk.gray(`  Extracted: ${entry.name} - ${info.vendor} - $${info.amount}`));
        } catch (error) {
          console.error(chalk.red(`  Error processing ${entry.name}:`), error.message);
        }
      }
    }
  }

  await findBidFiles(bidsPath);

  if (!dryRun && bids.length > 0) {
    // Insert into database
    console.log(chalk.cyan(`  Inserting ${bids.length} bids into database...`));

    for (const bid of bids) {
      const { data, error } = await supabase
        .from('bids')
        .upsert(bid, { onConflict: 'vendor_name,project_id', ignoreDuplicates: false });

      if (error) {
        console.error(chalk.red(`  Error inserting bid:`), error.message);
      }
    }

    console.log(chalk.green(`✓ Inserted ${bids.length} bids\n`));
  } else {
    console.log(chalk.yellow(`  DRY RUN: Would insert ${bids.length} bids\n`));
  }

  return bids;
}

/**
 * Extract expense/receipt data
 */
async function extractExpenses(organizedPath, dryRun = false) {
  console.log(chalk.yellow('Extracting expense data...'));

  const expensesPath = path.join(organizedPath, '05_EXPENSES_AND_RECEIPTS/BY_VENDOR');
  const expenses = [];

  if (!await fs.pathExists(expensesPath)) {
    console.log(chalk.gray('  No expenses folder found, skipping'));
    return expenses;
  }

  // Scan vendor folders
  const vendorFolders = await fs.readdir(expensesPath, { withFileTypes: true });

  for (const folder of vendorFolders) {
    if (!folder.isDirectory()) continue;

    const vendorPath = path.join(expensesPath, folder.name);
    const files = await fs.readdir(vendorPath);

    // Extract vendor name from folder (e.g., "01_Prince Development" -> "Prince Development")
    const vendorName = folder.name.replace(/^\d{2}_/, '');

    for (const file of files) {
      if (/\.(pdf|jpg|jpeg|png)$/i.test(file)) {
        // Try to extract amount and date from filename or PDF
        const filePath = path.join(vendorPath, file);
        let amount = null;
        let date = null;

        if (/\.pdf$/i.test(file)) {
          const text = await extractPdfText(filePath);
          const amountMatch = text.match(/(?:total|amount|paid)[:\s]+\$?([0-9,]+(?:\.\d{2})?)/i);
          if (amountMatch) {
            amount = parseFloat(amountMatch[1].replace(/,/g, ''));
          }

          const dateMatch = text.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/);
          if (dateMatch) {
            try {
              date = new Date(dateMatch[1]);
            } catch (e) {
              // Invalid date
            }
          }
        }

        // Also try to extract from filename
        if (!amount) {
          const filenameAmountMatch = file.match(/\$?([0-9,]+(?:\.\d{2})?)/);
          if (filenameAmountMatch) {
            amount = parseFloat(filenameAmountMatch[1].replace(/,/g, ''));
          }
        }

        if (!date) {
          const filenameDateMatch = file.match(/(\d{4}[-_]\d{2}[-_]\d{2})/);
          if (filenameDateMatch) {
            try {
              date = new Date(filenameDateMatch[1].replace(/_/g, '-'));
            } catch (e) {
              // Invalid date
            }
          }
        }

        expenses.push({
          project_id: PROJECT_ID,
          vendor_name: vendorName,
          amount: amount,
          date: date,
          file_path: path.relative(organizedPath, filePath),
          description: `Receipt from ${vendorName}`
        });

        console.log(chalk.gray(`  Found receipt: ${vendorName} - $${amount}`));
      }
    }
  }

  if (!dryRun && expenses.length > 0) {
    console.log(chalk.cyan(`  Updating budget items with paid amounts...`));

    // Group by vendor and sum amounts
    const vendorTotals = {};
    expenses.forEach(exp => {
      if (exp.amount) {
        vendorTotals[exp.vendor_name] = (vendorTotals[exp.vendor_name] || 0) + exp.amount;
      }
    });

    // Update budget items
    for (const [vendor, total] of Object.entries(vendorTotals)) {
      const { data, error } = await supabase
        .from('budget_items')
        .update({ paid_amount: total })
        .eq('project_id', PROJECT_ID)
        .ilike('vendor', `%${vendor}%`);

      if (error) {
        console.error(chalk.red(`  Error updating budget for ${vendor}:`), error.message);
      }
    }

    console.log(chalk.green(`✓ Updated expenses for ${Object.keys(vendorTotals).length} vendors\n`));
  } else {
    console.log(chalk.yellow(`  DRY RUN: Would update ${expenses.length} expense records\n`));
  }

  return expenses;
}

/**
 * Extract and link documents
 */
async function extractDocuments(organizedPath, dryRun = false) {
  console.log(chalk.yellow('Extracting document metadata...'));

  const documents = [];

  // Key document categories to track
  const categories = {
    '00_PROJECT_ESSENTIALS/Current_Plans': 'Current Plans',
    '00_PROJECT_ESSENTIALS/Active_Contracts': 'Contracts',
    '01_PLANS_AND_ENGINEERING/Architectural/CURRENT': 'Architectural Plans',
    '01_PLANS_AND_ENGINEERING/Engineering/Foundation': 'Foundation Engineering',
    '02_PERMITS_AND_REGULATORY/Building_Permits': 'Building Permits',
    '04_CONTRACTS_AND_AGREEMENTS/Land_Purchase': 'Land Purchase'
  };

  for (const [folder, category] of Object.entries(categories)) {
    const folderPath = path.join(organizedPath, folder);

    if (!await fs.pathExists(folderPath)) {
      console.log(chalk.gray(`  Folder not found: ${folder}`));
      continue;
    }

    const files = await fs.readdir(folderPath);

    for (const file of files) {
      if (!/\.(pdf|jpg|jpeg|png|xlsx|xls|docx?)$/i.test(file)) continue;

      const filePath = path.join(folderPath, file);
      const stats = await fs.stat(filePath);

      documents.push({
        project_id: PROJECT_ID,
        document_name: file,
        document_type: category,
        file_path: path.relative(organizedPath, filePath),
        file_url: null,  // Would be populated if uploaded to Supabase Storage
        uploaded_date: stats.mtime,
        notes: `Extracted from ${folder}`
      });

      console.log(chalk.gray(`  Found document: ${category} - ${file}`));
    }
  }

  if (!dryRun && documents.length > 0) {
    console.log(chalk.cyan(`  Inserting ${documents.length} documents into database...`));

    const { data, error } = await supabase
      .from('documents')
      .upsert(documents, { onConflict: 'project_id,document_name', ignoreDuplicates: true });

    if (error) {
      console.error(chalk.red(`  Error inserting documents:`), error.message);
    } else {
      console.log(chalk.green(`✓ Inserted ${documents.length} documents\n`));
    }
  } else {
    console.log(chalk.yellow(`  DRY RUN: Would insert ${documents.length} documents\n`));
  }

  return documents;
}

/**
 * Create project status snapshot
 */
async function createProjectSnapshot(bids, expenses, documents, dryRun = false) {
  console.log(chalk.yellow('Creating project status snapshot...'));

  const snapshot = {
    project_id: PROJECT_ID,
    status_date: new Date(),
    overall_status: 'Site Preparation & Foundation',
    hot_topics: [
      {
        topic: 'Site Preparation',
        description: 'Excavation and foundation work in progress',
        priority: 'high'
      }
    ],
    action_items: [
      {
        item: 'Complete foundation engineering plans',
        owner: 'UBuildIt',
        due_date: '2026-03-01'
      }
    ],
    recent_decisions: [
      {
        decision: 'Selected flooring vendor',
        date: '2026-02-01',
        rationale: 'Best pricing and timeline'
      }
    ],
    budget_summary: {
      total_bids: bids.length,
      total_expenses: expenses.length,
      total_documents: documents.length
    },
    ai_summary: `Project contains ${documents.length} documents across ${bids.length} bids and ${expenses.length} expenses. Currently in active site preparation phase.`
  };

  if (!dryRun) {
    const { data, error } = await supabase
      .from('project_status')
      .insert(snapshot);

    if (error) {
      console.error(chalk.red(`  Error creating snapshot:`), error.message);
    } else {
      console.log(chalk.green(`✓ Created project snapshot\n`));
    }
  } else {
    console.log(chalk.yellow(`  DRY RUN: Would create project snapshot\n`));
  }

  return snapshot;
}

/**
 * Main execution
 */
async function main() {
  console.log(chalk.bold.cyan('\n💾 Database Extraction Script\n'));

  // Parse arguments
  const args = process.argv.slice(2);
  let organizedPath = DEFAULT_ORGANIZED_PATH;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) {
      organizedPath = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  // Verify organized folder exists
  if (!await fs.pathExists(organizedPath)) {
    console.error(chalk.red(`✗ Organized folder not found: ${organizedPath}`));
    console.log(chalk.yellow('Run reorganize-documents.js first to create organized structure'));
    process.exit(1);
  }

  console.log(chalk.blue(`Source: ${organizedPath}`));
  console.log(chalk.blue(`Mode: ${dryRun ? 'DRY RUN (read-only)' : 'EXECUTE (will write to database)'}\n`));

  // Verify database connection
  const { data: testData, error: testError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', PROJECT_ID)
    .single();

  if (testError) {
    console.error(chalk.red('✗ Database connection failed:'), testError.message);
    process.exit(1);
  }

  console.log(chalk.green(`✓ Connected to database\n`));

  // Extract data
  const bids = await extractBids(organizedPath, dryRun);
  const expenses = await extractExpenses(organizedPath, dryRun);
  const documents = await extractDocuments(organizedPath, dryRun);

  // Create snapshot
  await createProjectSnapshot(bids, expenses, documents, dryRun);

  // Summary
  console.log(chalk.bold.green('\n✓ Extraction Complete!\n'));
  console.log(chalk.cyan('Summary:'));
  console.log(chalk.white(`  Bids extracted: ${bids.length}`));
  console.log(chalk.white(`  Expenses tracked: ${expenses.length}`));
  console.log(chalk.white(`  Documents linked: ${documents.length}`));

  if (dryRun) {
    console.log(chalk.yellow('\n⚠ DRY RUN - No changes made to database'));
    console.log(chalk.white('Run without --dry-run to execute\n'));
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\n✗ Error:'), error);
    process.exit(1);
  });
}

module.exports = { extractBidInfo, extractPdfText, parseSpreadsheet };
