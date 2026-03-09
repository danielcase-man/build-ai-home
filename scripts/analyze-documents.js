#!/usr/bin/env node

/**
 * Document Analysis Script
 *
 * Scans the project folder structure and generates:
 * - Complete file inventory with metadata
 * - Duplicate detection report
 * - Category distribution analysis
 *
 * Usage: node scripts/analyze-documents.js --source "path/to/folder"
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { createObjectCsvWriter } = require('csv-writer');
const chalk = require('chalk');

// Default source path - auto-detect WSL vs Windows
const getDefaultSource = () => {
  if (process.platform === 'win32') {
    return 'C:\\Users\\danie\\Dropbox\\Properties\\Austin, TX\\Liberty Hill\\708 Purple Salvia Cove';
  } else {
    return '/mnt/c/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove';
  }
};

const DEFAULT_SOURCE = getDefaultSource();

// Category patterns for inference
const CATEGORY_PATTERNS = {
  'Plans': /\b(plan|drawing|elevation|floor[- ]plan|site[- ]plan|architectural)\b/i,
  'Engineering': /\b(engineering|structural|foundation|beam|truss|calc|load)\b/i,
  'Permits': /\b(permit|PRN|building[- ]dept|inspection|approval)\b/i,
  'HOA': /\b(hoa|homeowner|restriction|covenant|architectural[- ]committee)\b/i,
  'Bids': /\b(bid|estimate|quote|proposal|pricing)\b/i,
  'Contracts': /\b(contract|agreement|signed|executed|amendment)\b/i,
  'Receipts': /\b(receipt|invoice|paid|payment)\b/i,
  'Budget': /\b(budget|cost|expense|financial|spreadsheet)\b/i,
  'Design': /\b(design|inspiration|selection|spec|fixture|appliance)\b/i,
  'Survey': /\b(survey|property[- ]line|boundary|topographic)\b/i,
  'Utilities': /\b(electric|water|septic|well|utility|pedernales)\b/i,
  'Communications': /\b(email|correspondence|letter|memo)\b/i,
  'UBuildIt Process': /ubuildit.*process|process.*\d{2}/i,
  'Land Purchase': /\b(closing|purchase|sales[- ]contract|deed|title)\b/i,
  'Photos': /\.(jpg|jpeg|png|heic|gif)$/i,
  'Spreadsheets': /\.(xlsx|xls|csv)$/i,
  'PDFs': /\.pdf$/i,
  'Documents': /\.(doc|docx|txt|rtf)$/i
};

// Files/folders to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.DS_Store/,
  /Thumbs\.db/,
  /desktop\.ini/,
  /~\$/  // Temp Office files
];

/**
 * Calculate MD5 hash of file
 */
async function calculateHash(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('md5').update(buffer).digest('hex');
  } catch (error) {
    console.error(chalk.red(`Error hashing ${filePath}:`), error.message);
    return null;
  }
}

/**
 * Infer category from file path and name
 */
function inferCategory(filePath, fileName) {
  const fullPath = `${filePath}/${fileName}`;

  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(fullPath)) {
      return category;
    }
  }

  return 'Uncategorized';
}

/**
 * Check if file should be skipped
 */
function shouldSkip(filePath) {
  return SKIP_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Detect if filename suggests it's a duplicate
 */
function getDuplicatePattern(fileName) {
  // Check for (1), (2), etc.
  const numberCopyMatch = fileName.match(/\((\d+)\)/);
  if (numberCopyMatch) {
    return {
      type: 'numbered_copy',
      number: parseInt(numberCopyMatch[1]),
      baseName: fileName.replace(/\s*\(\d+\)/, '')
    };
  }

  // Check for "copy" in name
  if (/\bcopy\b/i.test(fileName)) {
    return {
      type: 'named_copy',
      baseName: fileName.replace(/\s*-?\s*copy\s*\d*/i, '')
    };
  }

  // Check for version numbers
  const versionMatch = fileName.match(/[vV](\d+)|version\s*(\d+)/i);
  if (versionMatch) {
    return {
      type: 'versioned',
      version: parseInt(versionMatch[1] || versionMatch[2]),
      baseName: fileName.replace(/[vV]\d+|version\s*\d+/i, '').trim()
    };
  }

  return null;
}

/**
 * Recursively scan directory and collect file metadata
 */
async function scanDirectory(dirPath, baseDir = dirPath) {
  const files = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (shouldSkip(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recursively scan subdirectory
        const subFiles = await scanDirectory(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(fullPath);
          const hash = await calculateHash(fullPath);
          const category = inferCategory(path.dirname(relativePath), entry.name);
          const duplicatePattern = getDuplicatePattern(entry.name);

          files.push({
            path: relativePath,
            fullPath: fullPath,
            name: entry.name,
            extension: path.extname(entry.name).toLowerCase(),
            size: stats.size,
            sizeKB: (stats.size / 1024).toFixed(2),
            sizeMB: (stats.size / 1024 / 1024).toFixed(2),
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime,
            hash: hash,
            category: category,
            duplicatePattern: duplicatePattern ? JSON.stringify(duplicatePattern) : '',
            directory: path.dirname(relativePath)
          });

          // Log progress every 100 files
          if (files.length % 100 === 0) {
            console.log(chalk.gray(`Scanned ${files.length} files...`));
          }
        } catch (error) {
          console.error(chalk.red(`Error processing ${fullPath}:`), error.message);
        }
      }
    }
  } catch (error) {
    console.error(chalk.red(`Error reading directory ${dirPath}:`), error.message);
  }

  return files;
}

/**
 * Find duplicate files
 */
function findDuplicates(files) {
  const duplicates = {
    byHash: new Map(),      // Identical files (byte-for-byte)
    byName: new Map(),      // Similar names in same directory
    byPattern: new Map()    // Files with (1), (2), copy, etc.
  };

  // Group by hash (byte-identical duplicates)
  files.forEach(file => {
    if (file.hash) {
      if (!duplicates.byHash.has(file.hash)) {
        duplicates.byHash.set(file.hash, []);
      }
      duplicates.byHash.get(file.hash).push(file);
    }
  });

  // Group by base name in same directory (pattern-based duplicates)
  files.forEach(file => {
    const pattern = getDuplicatePattern(file.name);
    if (pattern) {
      const key = `${file.directory}::${pattern.baseName}`;
      if (!duplicates.byPattern.has(key)) {
        duplicates.byPattern.set(key, []);
      }
      duplicates.byPattern.get(key).push(file);
    }
  });

  return duplicates;
}

/**
 * Generate duplicate report
 */
function generateDuplicateReport(duplicates, outputPath) {
  let report = '# Duplicate Files Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  // Byte-identical duplicates
  report += '## Byte-Identical Duplicates (Same MD5 Hash)\n\n';
  let hashDupeCount = 0;
  duplicates.byHash.forEach((files, hash) => {
    if (files.length > 1) {
      hashDupeCount++;
      report += `### Group ${hashDupeCount} (${files.length} copies)\n\n`;
      report += `**Hash:** \`${hash}\`\n\n`;

      // Sort by modification date (newest first)
      files.sort((a, b) => b.modified - a.modified);

      files.forEach((file, index) => {
        const tag = index === 0 ? '**[KEEP - Newest]**' : '**[ARCHIVE]**';
        report += `${tag}\n`;
        report += `- **Path:** \`${file.path}\`\n`;
        report += `- **Modified:** ${file.modified.toISOString()}\n`;
        report += `- **Size:** ${file.sizeMB} MB\n\n`;
      });
    }
  });

  if (hashDupeCount === 0) {
    report += '*No byte-identical duplicates found.*\n\n';
  } else {
    report += `\n**Total groups:** ${hashDupeCount}\n\n`;
  }

  // Pattern-based duplicates (numbered copies, versions)
  report += '## Pattern-Based Duplicates\n\n';
  report += 'Files with (1), (2), "copy", or version numbers in the same directory.\n\n';

  let patternDupeCount = 0;
  duplicates.byPattern.forEach((files, key) => {
    if (files.length > 1) {
      patternDupeCount++;
      const [directory, baseName] = key.split('::');
      report += `### Group ${patternDupeCount}: ${baseName}\n\n`;
      report += `**Directory:** \`${directory}\`\n\n`;

      // Sort by modification date (newest first)
      files.sort((a, b) => b.modified - a.modified);

      files.forEach((file, index) => {
        const tag = index === 0 ? '**[KEEP - Newest]**' : '**[ARCHIVE]**';
        report += `${tag}\n`;
        report += `- **Name:** \`${file.name}\`\n`;
        report += `- **Modified:** ${file.modified.toISOString()}\n`;
        report += `- **Size:** ${file.sizeMB} MB\n\n`;
      });
    }
  });

  if (patternDupeCount === 0) {
    report += '*No pattern-based duplicates found.*\n\n';
  } else {
    report += `\n**Total groups:** ${patternDupeCount}\n\n`;
  }

  // Summary
  report += '## Summary\n\n';
  report += `- Byte-identical duplicate groups: ${hashDupeCount}\n`;
  report += `- Pattern-based duplicate groups: ${patternDupeCount}\n`;

  // Calculate potential space savings
  let spaceToSave = 0;
  duplicates.byHash.forEach(files => {
    if (files.length > 1) {
      // Sum all but the newest file
      files.slice(1).forEach(f => spaceToSave += f.size);
    }
  });

  report += `- Potential space savings: ${(spaceToSave / 1024 / 1024).toFixed(2)} MB\n`;

  fs.writeFileSync(outputPath, report);
  console.log(chalk.green(`✓ Duplicate report saved to: ${outputPath}`));
}

/**
 * Generate category analysis
 */
function generateCategoryAnalysis(files, outputPath) {
  let report = '# Category Distribution Analysis\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  // Count files by category
  const categoryCounts = {};
  const categorySize = {};

  files.forEach(file => {
    const cat = file.category;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    categorySize[cat] = (categorySize[cat] || 0) + file.size;
  });

  // Sort by count
  const sortedCategories = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a);

  report += '## File Count by Category\n\n';
  report += '| Category | Files | Total Size (MB) | Avg Size (KB) |\n';
  report += '|----------|-------|-----------------|---------------|\n';

  sortedCategories.forEach(([category, count]) => {
    const sizeMB = (categorySize[category] / 1024 / 1024).toFixed(2);
    const avgKB = (categorySize[category] / count / 1024).toFixed(2);
    report += `| ${category} | ${count} | ${sizeMB} | ${avgKB} |\n`;
  });

  report += '\n## File Type Distribution\n\n';

  // Count by extension
  const extCounts = {};
  files.forEach(file => {
    const ext = file.extension || 'no-extension';
    extCounts[ext] = (extCounts[ext] || 0) + 1;
  });

  const sortedExts = Object.entries(extCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);  // Top 20

  report += '| Extension | Count |\n';
  report += '|-----------|-------|\n';

  sortedExts.forEach(([ext, count]) => {
    report += `| ${ext} | ${count} |\n`;
  });

  // Age distribution
  report += '\n## File Age Distribution\n\n';

  const now = new Date();
  const ageGroups = {
    'Last 7 days': 0,
    'Last 30 days': 0,
    'Last 90 days': 0,
    'Last 6 months': 0,
    'Last year': 0,
    'Older than 1 year': 0
  };

  files.forEach(file => {
    const ageMs = now - file.modified;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays <= 7) ageGroups['Last 7 days']++;
    else if (ageDays <= 30) ageGroups['Last 30 days']++;
    else if (ageDays <= 90) ageGroups['Last 90 days']++;
    else if (ageDays <= 180) ageGroups['Last 6 months']++;
    else if (ageDays <= 365) ageGroups['Last year']++;
    else ageGroups['Older than 1 year']++;
  });

  report += '| Age | Files |\n';
  report += '|-----|-------|\n';
  Object.entries(ageGroups).forEach(([age, count]) => {
    report += `| ${age} | ${count} |\n`;
  });

  fs.writeFileSync(outputPath, report);
  console.log(chalk.green(`✓ Category analysis saved to: ${outputPath}`));
}

/**
 * Main execution
 */
async function main() {
  console.log(chalk.bold.cyan('\n📊 Document Analysis Script\n'));

  // Parse command line arguments
  const args = process.argv.slice(2);
  let sourceDir = DEFAULT_SOURCE;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) {
      sourceDir = args[i + 1];
      i++;
    }
  }

  // Verify source exists
  if (!await fs.pathExists(sourceDir)) {
    console.error(chalk.red(`✗ Source directory not found: ${sourceDir}`));
    process.exit(1);
  }

  console.log(chalk.blue(`Source: ${sourceDir}\n`));

  // Step 1: Scan directory
  console.log(chalk.yellow('Step 1: Scanning directory structure...'));
  const startTime = Date.now();
  const files = await scanDirectory(sourceDir);
  const scanDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(chalk.green(`✓ Scanned ${files.length} files in ${scanDuration}s\n`));

  // Step 2: Generate inventory CSV
  console.log(chalk.yellow('Step 2: Generating inventory CSV...'));
  const today = new Date().toISOString().split('T')[0];
  const inventoryPath = path.join(process.cwd(), `INVENTORY_${today}.csv`);

  const csvWriter = createObjectCsvWriter({
    path: inventoryPath,
    header: [
      { id: 'path', title: 'Path' },
      { id: 'name', title: 'Filename' },
      { id: 'extension', title: 'Extension' },
      { id: 'sizeKB', title: 'Size (KB)' },
      { id: 'sizeMB', title: 'Size (MB)' },
      { id: 'modified', title: 'Modified Date' },
      { id: 'created', title: 'Created Date' },
      { id: 'hash', title: 'MD5 Hash' },
      { id: 'category', title: 'Category' },
      { id: 'directory', title: 'Directory' },
      { id: 'duplicatePattern', title: 'Duplicate Pattern' }
    ]
  });

  await csvWriter.writeRecords(files);
  console.log(chalk.green(`✓ Inventory saved to: ${inventoryPath}\n`));

  // Step 3: Find duplicates
  console.log(chalk.yellow('Step 3: Analyzing duplicates...'));
  const duplicates = findDuplicates(files);
  const duplicateReportPath = path.join(process.cwd(), 'DUPLICATES_REPORT.md');
  generateDuplicateReport(duplicates, duplicateReportPath);
  console.log('');

  // Step 4: Category analysis
  console.log(chalk.yellow('Step 4: Generating category analysis...'));
  const categoryAnalysisPath = path.join(process.cwd(), 'CATEGORY_ANALYSIS.md');
  generateCategoryAnalysis(files, categoryAnalysisPath);
  console.log('');

  // Summary
  console.log(chalk.bold.green('\n✓ Analysis Complete!\n'));
  console.log(chalk.cyan('Generated files:'));
  console.log(chalk.white(`  1. ${inventoryPath}`));
  console.log(chalk.white(`  2. ${duplicateReportPath}`));
  console.log(chalk.white(`  3. ${categoryAnalysisPath}\n`));

  // Statistics
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  console.log(chalk.cyan('Statistics:'));
  console.log(chalk.white(`  Total files: ${files.length}`));
  console.log(chalk.white(`  Total size: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`));
  console.log(chalk.white(`  Scan duration: ${scanDuration}s\n`));
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\n✗ Error:'), error);
    process.exit(1);
  });
}

module.exports = { scanDirectory, findDuplicates, inferCategory };
