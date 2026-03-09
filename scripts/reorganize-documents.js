#!/usr/bin/env node

/**
 * Document Reorganization Script
 *
 * Creates organized folder structure and copies files based on:
 * - File type and content analysis
 * - Category inference from paths/names
 * - Duplicate detection (keeps newest)
 * - Intelligent renaming for clarity
 *
 * Usage:
 *   node scripts/reorganize-documents.js --dry-run     # Plan only, no changes
 *   node scripts/reorganize-documents.js --execute     # Execute the plan
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

// Import analysis functions
const { scanDirectory, findDuplicates, inferCategory } = require('./analyze-documents');

// Default source - auto-detect WSL vs Windows
const getDefaultSource = () => {
  if (process.platform === 'win32') {
    return 'C:\\Users\\danie\\Dropbox\\Properties\\Austin, TX\\Liberty Hill\\708 Purple Salvia Cove';
  } else {
    return '/mnt/c/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove';
  }
};

const DEFAULT_SOURCE = getDefaultSource();
const DEFAULT_TARGET_SUFFIX = '_ORGANIZED';

// Folder structure definition
const FOLDER_STRUCTURE = {
  '00_PROJECT_ESSENTIALS': {
    description: 'Quick access to most critical documents',
    subdirs: ['Current_Plans', 'Current_Budget', 'Active_Contracts']
  },
  '01_PLANS_AND_ENGINEERING': {
    description: 'Architectural plans, engineering drawings, and surveys',
    subdirs: ['Architectural/CURRENT', 'Architectural/ARCHIVE', 'Engineering/Foundation', 'Engineering/Structural', 'Engineering/Roofing', 'Survey']
  },
  '02_PERMITS_AND_REGULATORY': {
    description: 'Building permits, HOA submissions, and utility connections',
    subdirs: ['Building_Permits', 'HOA/Submissions', 'HOA/Rules_and_Restrictions', 'Utilities/Electric', 'Utilities/Water_Well', 'Utilities/Septic']
  },
  '03_BIDS_AND_ESTIMATES': {
    description: 'All vendor bids organized by category',
    subdirs: ['BY_CATEGORY/Appliances', 'BY_CATEGORY/Electrical', 'BY_CATEGORY/Engineering', 'BY_CATEGORY/Excavation_and_Septic',
              'BY_CATEGORY/Flooring', 'BY_CATEGORY/Garage_Doors', 'BY_CATEGORY/Plumbing_Fixtures', 'BY_CATEGORY/Pool',
              'BY_CATEGORY/Stone_Fabrication', 'BY_CATEGORY/Well_Drilling', 'BY_CATEGORY/Windows_and_Doors',
              'SELECTED_BIDS', 'REJECTED_BIDS']
  },
  '04_CONTRACTS_AND_AGREEMENTS': {
    description: 'Executed contracts and legal agreements',
    subdirs: ['Land_Purchase', 'Vendors', 'Financial/Construction_Loan', 'Financial/Appraisals']
  },
  '05_EXPENSES_AND_RECEIPTS': {
    description: 'Paid receipts organized by vendor and month',
    subdirs: ['BY_VENDOR', 'BY_MONTH']
  },
  '06_DESIGN_AND_SPECIFICATIONS': {
    description: 'Design inspiration and final selections',
    subdirs: ['Design_Inspiration/Bathrooms', 'Design_Inspiration/Countertops', 'Design_Inspiration/Exterior',
              'Design_Inspiration/Fireplace', 'Design_Inspiration/Garage_Doors', 'Final_Selections']
  },
  '07_SITE_PROGRESS': {
    description: 'Construction progress photos and logs',
    subdirs: ['Photos', 'Daily_Logs', 'Inspections']
  },
  '08_COMMUNICATIONS': {
    description: 'Email threads and vendor correspondence',
    subdirs: ['Email_Threads', 'Vendor_Correspondence', 'Design_Consultations']
  },
  '09_REFERENCE_AND_TEMPLATES': {
    description: 'UBuildIt process documents and templates',
    subdirs: ['UBuildIt_Process', 'Construction_Management', 'Vendor_Resources']
  },
  '10_ARCHIVE': {
    description: 'Old versions and superseded documents',
    subdirs: ['Old_Versions', 'Duplicates']
  },
  '_SHAREABLE_PACKAGES': {
    description: 'Auto-generated packages for sharing',
    subdirs: ['FOR_VENDORS', 'FOR_LENDER', 'FOR_HOA', 'FOR_PERMITS']
  }
};

// Category routing rules
const ROUTING_RULES = [
  // Current Plans (high priority)
  {
    test: (file) => /site[- ]plan.*2026-01-28/i.test(file.name) || /current.*plan/i.test(file.name),
    target: '00_PROJECT_ESSENTIALS/Current_Plans',
    also: '01_PLANS_AND_ENGINEERING/Architectural/CURRENT'
  },

  // Active Contracts
  {
    test: (file) => /\b(executed|signed|contract|agreement)\b/i.test(file.name) &&
                    file.modified > new Date('2025-01-01'),
    target: '00_PROJECT_ESSENTIALS/Active_Contracts',
    also: '04_CONTRACTS_AND_AGREEMENTS/Vendors'
  },

  // Architectural Plans
  {
    test: (file) => /\b(plan|floor[- ]plan|elevation|architectural)\b/i.test(file.name) && /\.pdf$/i.test(file.name),
    target: (file) => {
      // Recent plans go to CURRENT, older to ARCHIVE
      const age = Date.now() - file.modified.getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      return daysOld < 90 ? '01_PLANS_AND_ENGINEERING/Architectural/CURRENT' : '01_PLANS_AND_ENGINEERING/Architectural/ARCHIVE';
    }
  },

  // Engineering Plans
  {
    test: (file) => /\b(foundation|structural|beam|truss|roofing)\b/i.test(file.name) && /engineering/i.test(file.path),
    target: (file) => {
      if (/foundation/i.test(file.name)) return '01_PLANS_AND_ENGINEERING/Engineering/Foundation';
      if (/structural|beam|truss/i.test(file.name)) return '01_PLANS_AND_ENGINEERING/Engineering/Structural';
      if (/roofing|roof/i.test(file.name)) return '01_PLANS_AND_ENGINEERING/Engineering/Roofing';
      return '01_PLANS_AND_ENGINEERING/Engineering';
    }
  },

  // Survey
  {
    test: (file) => /\b(survey|property[- ]line|boundary|topographic)\b/i.test(file.name),
    target: '01_PLANS_AND_ENGINEERING/Survey'
  },

  // Building Permits
  {
    test: (file) => /\b(permit|PRN|building[- ]dept)\b/i.test(file.name) || /PRN.*25-0058/i.test(file.path),
    target: '02_PERMITS_AND_REGULATORY/Building_Permits'
  },

  // HOA
  {
    test: (file) => /\b(hoa|homeowner|architectural[- ]committee|restriction|covenant)\b/i.test(file.name),
    target: '02_PERMITS_AND_REGULATORY/HOA/Submissions'
  },

  // Utilities
  {
    test: (file) => /\b(pedernales|electric|pec)\b/i.test(file.name),
    target: '02_PERMITS_AND_REGULATORY/Utilities/Electric'
  },
  {
    test: (file) => /\b(well|water|drilling)\b/i.test(file.name) && !/septic/i.test(file.name),
    target: '02_PERMITS_AND_REGULATORY/Utilities/Water_Well'
  },
  {
    test: (file) => /\b(septic|wastewater)\b/i.test(file.name),
    target: '02_PERMITS_AND_REGULATORY/Utilities/Septic'
  },

  // Bids by category
  {
    test: (file) => /\b(bid|estimate|quote|proposal)\b/i.test(file.name) && /appliance/i.test(file.name),
    target: '03_BIDS_AND_ESTIMATES/BY_CATEGORY/Appliances'
  },
  {
    test: (file) => /\b(bid|estimate|quote)\b/i.test(file.name) && /electrical/i.test(file.name),
    target: '03_BIDS_AND_ESTIMATES/BY_CATEGORY/Electrical'
  },
  {
    test: (file) => /\b(bid|estimate|quote)\b/i.test(file.name) && /engineering/i.test(file.name),
    target: '03_BIDS_AND_ESTIMATES/BY_CATEGORY/Engineering'
  },
  {
    test: (file) => /\b(bid|estimate|quote)\b/i.test(file.name) && /(excavat|septic|dirt)/i.test(file.name),
    target: '03_BIDS_AND_ESTIMATES/BY_CATEGORY/Excavation_and_Septic'
  },
  {
    test: (file) => /\b(bid|estimate|quote)\b/i.test(file.name) && /flooring/i.test(file.name),
    target: '03_BIDS_AND_ESTIMATES/BY_CATEGORY/Flooring'
  },
  {
    test: (file) => /\b(bid|estimate|quote)\b/i.test(file.name) && /garage[- ]door/i.test(file.name),
    target: '03_BIDS_AND_ESTIMATES/BY_CATEGORY/Garage_Doors'
  },
  {
    test: (file) => /\b(bid|estimate|quote)\b/i.test(file.name) && /plumbing/i.test(file.name),
    target: '03_BIDS_AND_ESTIMATES/BY_CATEGORY/Plumbing_Fixtures'
  },
  {
    test: (file) => /\b(bid|estimate|quote)\b/i.test(file.name) && /pool/i.test(file.name),
    target: '03_BIDS_AND_ESTIMATES/BY_CATEGORY/Pool'
  },
  {
    test: (file) => /\b(bid|estimate|quote)\b/i.test(file.name) && /(stone|counter|granite|quartz)/i.test(file.name),
    target: '03_BIDS_AND_ESTIMATES/BY_CATEGORY/Stone_Fabrication'
  },
  {
    test: (file) => /\b(bid|estimate|quote)\b/i.test(file.name) && /well/i.test(file.name),
    target: '03_BIDS_AND_ESTIMATES/BY_CATEGORY/Well_Drilling'
  },
  {
    test: (file) => /\b(bid|estimate|quote)\b/i.test(file.name) && /(window|door)/i.test(file.name),
    target: '03_BIDS_AND_ESTIMATES/BY_CATEGORY/Windows_and_Doors'
  },

  // Land Purchase
  {
    test: (file) => /\b(closing|purchase|sales[- ]contract|deed|title)\b/i.test(file.name),
    target: '04_CONTRACTS_AND_AGREEMENTS/Land_Purchase'
  },

  // Receipts (existing numbered vendor structure)
  {
    test: (file) => /\b(receipt|invoice|paid)\b/i.test(file.name) || /^\d{2}_/i.test(path.basename(path.dirname(file.path))),
    target: '05_EXPENSES_AND_RECEIPTS/BY_VENDOR'
  },

  // Design Inspiration
  {
    test: (file) => /\.(jpg|jpeg|png|heic)$/i.test(file.name) && /bathroom/i.test(file.path),
    target: '06_DESIGN_AND_SPECIFICATIONS/Design_Inspiration/Bathrooms'
  },
  {
    test: (file) => /\.(jpg|jpeg|png|heic)$/i.test(file.name) && /(counter|stone|granite|quartz)/i.test(file.path),
    target: '06_DESIGN_AND_SPECIFICATIONS/Design_Inspiration/Countertops'
  },
  {
    test: (file) => /\.(jpg|jpeg|png|heic)$/i.test(file.name) && /exterior/i.test(file.path),
    target: '06_DESIGN_AND_SPECIFICATIONS/Design_Inspiration/Exterior'
  },
  {
    test: (file) => /\.(jpg|jpeg|png|heic)$/i.test(file.name) && /fireplace/i.test(file.path),
    target: '06_DESIGN_AND_SPECIFICATIONS/Design_Inspiration/Fireplace'
  },
  {
    test: (file) => /\.(jpg|jpeg|png|heic)$/i.test(file.name) && /garage[- ]door/i.test(file.path),
    target: '06_DESIGN_AND_SPECIFICATIONS/Design_Inspiration/Garage_Doors'
  },

  // Final Selections
  {
    test: (file) => /\b(final|selected|spec)\b/i.test(file.name) && /(plumbing|fixture|appliance|flooring)/i.test(file.name),
    target: '06_DESIGN_AND_SPECIFICATIONS/Final_Selections'
  },

  // Site Progress Photos
  {
    test: (file) => /\.(jpg|jpeg|png|heic)$/i.test(file.name) && /\b(site|progress|construction|excavation)\b/i.test(file.path),
    target: '07_SITE_PROGRESS/Photos'
  },

  // UBuildIt Process
  {
    test: (file) => /ubuildit.*process/i.test(file.name) || /process.*\d{2}/i.test(file.name),
    target: '09_REFERENCE_AND_TEMPLATES/UBuildIt_Process'
  },

  // Old files (pre-2024) or files with old dates in name
  {
    test: (file) => {
      const age = Date.now() - file.modified.getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      return daysOld > 365 || /201\d|202[0-3]/i.test(file.name);  // 2019-2023
    },
    target: '10_ARCHIVE/Old_Versions'
  }
];

/**
 * Determine target folder for a file
 */
function determineTarget(file) {
  for (const rule of ROUTING_RULES) {
    if (rule.test(file)) {
      const target = typeof rule.target === 'function' ? rule.target(file) : rule.target;
      const also = rule.also || null;
      return { primary: target, also };
    }
  }

  // Default: categorize by inferred category
  const category = inferCategory(path.dirname(file.path), file.name);

  // Map categories to folders
  const categoryMap = {
    'Plans': '01_PLANS_AND_ENGINEERING/Architectural/ARCHIVE',
    'Engineering': '01_PLANS_AND_ENGINEERING/Engineering',
    'Permits': '02_PERMITS_AND_REGULATORY/Building_Permits',
    'HOA': '02_PERMITS_AND_REGULATORY/HOA/Submissions',
    'Bids': '03_BIDS_AND_ESTIMATES/BY_CATEGORY',
    'Contracts': '04_CONTRACTS_AND_AGREEMENTS/Vendors',
    'Receipts': '05_EXPENSES_AND_RECEIPTS/BY_VENDOR',
    'Budget': '00_PROJECT_ESSENTIALS/Current_Budget',
    'Design': '06_DESIGN_AND_SPECIFICATIONS/Design_Inspiration',
    'Survey': '01_PLANS_AND_ENGINEERING/Survey',
    'Utilities': '02_PERMITS_AND_REGULATORY/Utilities',
    'Communications': '08_COMMUNICATIONS/Vendor_Correspondence',
    'UBuildIt Process': '09_REFERENCE_AND_TEMPLATES/UBuildIt_Process',
    'Land Purchase': '04_CONTRACTS_AND_AGREEMENTS/Land_Purchase',
    'Photos': '07_SITE_PROGRESS/Photos'
  };

  return {
    primary: categoryMap[category] || '10_ARCHIVE/Uncategorized',
    also: null
  };
}

/**
 * Clean filename for clarity
 */
function cleanFilename(filename) {
  let cleaned = filename;

  // Remove (1), (2), etc.
  cleaned = cleaned.replace(/\s*\(\d+\)\s*/g, ' ');

  // Remove "copy" variations
  cleaned = cleaned.replace(/\s*-?\s*copy\s*\d*/gi, '');

  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Trim
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Create folder structure
 */
async function createFolderStructure(targetRoot) {
  console.log(chalk.yellow('Creating folder structure...'));

  for (const [folder, config] of Object.entries(FOLDER_STRUCTURE)) {
    const folderPath = path.join(targetRoot, folder);
    await fs.ensureDir(folderPath);

    // Create INDEX.md
    const indexPath = path.join(folderPath, 'INDEX.md');
    let indexContent = `# ${folder.replace(/_/g, ' ')}\n\n`;
    indexContent += `${config.description}\n\n`;
    indexContent += `## Subdirectories\n\n`;

    for (const subdir of config.subdirs) {
      const subdirPath = path.join(folderPath, subdir);
      await fs.ensureDir(subdirPath);
      indexContent += `- \`${subdir}\`\n`;
    }

    indexContent += `\n---\n*Auto-generated by reorganization script*\n`;
    await fs.writeFile(indexPath, indexContent);
  }

  console.log(chalk.green('✓ Folder structure created\n'));
}

/**
 * Generate reorganization plan
 */
function generatePlan(files, duplicates) {
  console.log(chalk.yellow('Analyzing files and generating plan...'));

  const plan = {
    copy: [],      // Files to copy
    symlink: [],   // Symlinks to create
    archive: [],   // Duplicates to archive
    skip: []       // Files to skip
  };

  // Get files to keep (remove duplicates)
  const filesToProcess = new Map();

  // First pass: identify all files
  files.forEach(file => {
    filesToProcess.set(file.path, file);
  });

  // Second pass: remove duplicate versions (keep newest)
  duplicates.byHash.forEach((dupeGroup) => {
    if (dupeGroup.length > 1) {
      // Sort by modification date, keep newest
      dupeGroup.sort((a, b) => b.modified - a.modified);
      const [keep, ...archive] = dupeGroup;

      // Mark others for archival
      archive.forEach(file => {
        plan.archive.push({
          from: file.path,
          to: path.join('10_ARCHIVE/Duplicates', path.basename(file.path)),
          reason: `Duplicate of ${keep.name} (older version)`
        });
        filesToProcess.delete(file.path);
      });
    }
  });

  // Third pass: route remaining files
  filesToProcess.forEach(file => {
    const target = determineTarget(file);
    const cleanedName = cleanFilename(file.name);

    plan.copy.push({
      from: file.path,
      to: path.join(target.primary, cleanedName),
      originalName: file.name,
      cleanedName: cleanedName,
      modified: file.modified
    });

    // If also target specified, create symlink
    if (target.also) {
      plan.symlink.push({
        target: path.join(target.primary, cleanedName),
        link: path.join(target.also, cleanedName)
      });
    }
  });

  return plan;
}

/**
 * Write plan to markdown
 */
async function writePlanReport(plan, outputPath) {
  let report = '# Document Reorganization Plan\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  report += '## Summary\n\n';
  report += `- Files to copy: ${plan.copy.length}\n`;
  report += `- Symlinks to create: ${plan.symlink.length}\n`;
  report += `- Files to archive (duplicates): ${plan.archive.length}\n`;
  report += `- Files to skip: ${plan.skip.length}\n\n`;

  report += '## Files to Copy\n\n';
  plan.copy.slice(0, 50).forEach((item, index) => {
    report += `${index + 1}. **From:** \`${item.from}\`\n`;
    report += `   **To:** \`${item.to}\`\n`;
    if (item.originalName !== item.cleanedName) {
      report += `   **Renamed:** ${item.originalName} → ${item.cleanedName}\n`;
    }
    report += '\n';
  });

  if (plan.copy.length > 50) {
    report += `\n*...and ${plan.copy.length - 50} more files*\n\n`;
  }

  report += '## Duplicates to Archive\n\n';
  plan.archive.forEach((item, index) => {
    report += `${index + 1}. **From:** \`${item.from}\`\n`;
    report += `   **To:** \`${item.to}\`\n`;
    report += `   **Reason:** ${item.reason}\n\n`;
  });

  report += '## Symlinks\n\n';
  plan.symlink.forEach((item, index) => {
    report += `${index + 1}. **Target:** \`${item.target}\`\n`;
    report += `   **Link:** \`${item.link}\`\n\n`;
  });

  await fs.writeFile(outputPath, report);
  console.log(chalk.green(`✓ Plan saved to: ${outputPath}\n`));
}

/**
 * Execute plan
 */
async function executePlan(plan, sourceRoot, targetRoot) {
  console.log(chalk.yellow('Executing reorganization plan...\n'));

  // Copy files
  console.log(chalk.cyan(`Copying ${plan.copy.length} files...`));
  for (let i = 0; i < plan.copy.length; i++) {
    const item = plan.copy[i];
    const sourcePath = path.join(sourceRoot, item.from);
    const targetPath = path.join(targetRoot, item.to);

    try {
      await fs.ensureDir(path.dirname(targetPath));
      await fs.copy(sourcePath, targetPath, { overwrite: true });

      if ((i + 1) % 50 === 0) {
        console.log(chalk.gray(`  Copied ${i + 1}/${plan.copy.length} files...`));
      }
    } catch (error) {
      console.error(chalk.red(`Error copying ${item.from}:`), error.message);
    }
  }
  console.log(chalk.green(`✓ Copied ${plan.copy.length} files\n`));

  // Archive duplicates
  if (plan.archive.length > 0) {
    console.log(chalk.cyan(`Archiving ${plan.archive.length} duplicates...`));
    for (const item of plan.archive) {
      const sourcePath = path.join(sourceRoot, item.from);
      const targetPath = path.join(targetRoot, item.to);

      try {
        await fs.ensureDir(path.dirname(targetPath));
        await fs.copy(sourcePath, targetPath, { overwrite: true });
      } catch (error) {
        console.error(chalk.red(`Error archiving ${item.from}:`), error.message);
      }
    }
    console.log(chalk.green(`✓ Archived ${plan.archive.length} duplicates\n`));
  }

  // Create symlinks (skip on Windows for now due to permissions)
  if (plan.symlink.length > 0 && process.platform !== 'win32') {
    console.log(chalk.cyan(`Creating ${plan.symlink.length} symlinks...`));
    for (const item of plan.symlink) {
      const targetPath = path.join(targetRoot, item.target);
      const linkPath = path.join(targetRoot, item.link);

      try {
        await fs.ensureDir(path.dirname(linkPath));
        // Create relative symlink
        const relativePath = path.relative(path.dirname(linkPath), targetPath);
        await fs.ensureSymlink(relativePath, linkPath);
      } catch (error) {
        console.error(chalk.red(`Error creating symlink ${item.link}:`), error.message);
      }
    }
    console.log(chalk.green(`✓ Created ${plan.symlink.length} symlinks\n`));
  } else if (plan.symlink.length > 0) {
    console.log(chalk.yellow(`⚠ Skipping ${plan.symlink.length} symlinks (Windows platform)\n`));
  }

  // Generate log
  const logPath = path.join(targetRoot, 'REORGANIZATION_LOG.md');
  let log = '# Reorganization Log\n\n';
  log += `Executed: ${new Date().toISOString()}\n\n`;
  log += `Files copied: ${plan.copy.length}\n`;
  log += `Duplicates archived: ${plan.archive.length}\n`;
  log += `Symlinks created: ${plan.symlink.length}\n\n`;
  log += '## All Operations\n\n';

  plan.copy.forEach((item, i) => {
    log += `${i + 1}. COPY: ${item.from} → ${item.to}\n`;
  });

  await fs.writeFile(logPath, log);
  console.log(chalk.green(`✓ Log saved to: ${logPath}\n`));
}

/**
 * Main execution
 */
async function main() {
  console.log(chalk.bold.cyan('\n📁 Document Reorganization Script\n'));

  // Parse arguments
  const args = process.argv.slice(2);
  let sourceDir = DEFAULT_SOURCE;
  let dryRun = true;
  let preserveOriginals = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) {
      sourceDir = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--execute') {
      dryRun = false;
    } else if (args[i] === '--preserve-originals') {
      preserveOriginals = true;
    }
  }

  // Verify source exists
  if (!await fs.pathExists(sourceDir)) {
    console.error(chalk.red(`✗ Source directory not found: ${sourceDir}`));
    process.exit(1);
  }

  const targetDir = sourceDir + DEFAULT_TARGET_SUFFIX;

  console.log(chalk.blue(`Source: ${sourceDir}`));
  console.log(chalk.blue(`Target: ${targetDir}`));
  console.log(chalk.blue(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'EXECUTE (will create files)'}\n`));

  // Step 1: Scan source directory
  console.log(chalk.yellow('Step 1: Scanning source directory...'));
  const files = await scanDirectory(sourceDir);
  console.log(chalk.green(`✓ Found ${files.length} files\n`));

  // Step 2: Find duplicates
  console.log(chalk.yellow('Step 2: Detecting duplicates...'));
  const duplicates = findDuplicates(files);
  const dupeCount = Array.from(duplicates.byHash.values()).filter(g => g.length > 1).length;
  console.log(chalk.green(`✓ Found ${dupeCount} duplicate groups\n`));

  // Step 3: Generate plan
  const plan = generatePlan(files, duplicates);

  // Step 4: Write plan report
  const planPath = path.join(process.cwd(), 'REORGANIZATION_PLAN.md');
  await writePlanReport(plan, planPath);

  if (dryRun) {
    // Dry run: create structure but don't copy files
    console.log(chalk.yellow('DRY RUN MODE - Creating folder structure only\n'));
    await createFolderStructure(targetDir);

    console.log(chalk.bold.green('\n✓ Dry Run Complete!\n'));
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.white('  1. Review REORGANIZATION_PLAN.md'));
    console.log(chalk.white('  2. Run with --execute to perform reorganization\n'));
  } else {
    // Execute: create structure and copy files
    console.log(chalk.yellow('EXECUTE MODE - Performing reorganization\n'));

    // Create structure
    await createFolderStructure(targetDir);

    // Execute plan
    await executePlan(plan, sourceDir, targetDir);

    console.log(chalk.bold.green('\n✓ Reorganization Complete!\n'));
    console.log(chalk.cyan('Summary:'));
    console.log(chalk.white(`  Files copied: ${plan.copy.length}`));
    console.log(chalk.white(`  Duplicates archived: ${plan.archive.length}`));
    console.log(chalk.white(`  Target directory: ${targetDir}`));
    console.log(chalk.white(`  Original preserved: ${preserveOriginals ? 'Yes' : 'No'}\n`));
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\n✗ Error:'), error);
    process.exit(1);
  });
}

module.exports = { determineTarget, cleanFilename };
