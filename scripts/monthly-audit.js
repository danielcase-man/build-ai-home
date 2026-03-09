#!/usr/bin/env node

/**
 * Monthly Audit Script
 *
 * Generates comprehensive audit report with:
 * - Files older than 90 days (archive candidates)
 * - New duplicate detection
 * - Broken symlinks
 * - Database sync verification
 * - Cleanup recommendations
 *
 * Usage: node scripts/monthly-audit.js [--source path]
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { scanDirectory, findDuplicates } = require('./analyze-documents');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Default organized path - auto-detect WSL vs Windows
const getDefaultOrganizedPath = () => {
  if (process.platform === 'win32') {
    return 'C:\\Users\\danie\\Dropbox\\Properties\\Austin, TX\\Liberty Hill\\708 Purple Salvia Cove_ORGANIZED';
  } else {
    return '/mnt/c/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove_ORGANIZED';
  }
};

const DEFAULT_ORGANIZED_PATH = getDefaultOrganizedPath();
const PROJECT_ID = '7e936406-e8bc-4f50-8a84-3fec6c7d79e9';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Find archive candidates (>90 days old with no recent access)
 */
function findArchiveCandidates(files) {
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  return files.filter(file => {
    // Don't archive files in essentials or current folders
    if (file.path.includes('00_PROJECT_ESSENTIALS') ||
        file.path.includes('CURRENT') ||
        file.path.includes('Active_Contracts')) {
      return false;
    }

    const modifiedAge = now - file.modified.getTime();
    const accessedAge = now - file.accessed.getTime();

    // File hasn't been modified in 90 days and not accessed recently
    return modifiedAge > ninetyDaysMs && accessedAge > ninetyDaysMs;
  });
}

/**
 * Find broken symlinks
 */
async function findBrokenSymlinks(organizedPath) {
  const broken = [];

  async function checkSymlinks(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isSymbolicLink()) {
        try {
          await fs.access(fullPath);
          // Symlink is valid
        } catch (error) {
          // Symlink is broken
          broken.push({
            link: path.relative(organizedPath, fullPath),
            error: 'Target does not exist'
          });
        }
      } else if (entry.isDirectory()) {
        await checkSymlinks(fullPath);
      }
    }
  }

  await checkSymlinks(organizedPath);
  return broken;
}

/**
 * Verify database sync
 */
async function verifyDatabaseSync(files) {
  const issues = [];

  // Check if important documents are tracked in database
  const criticalDocs = files.filter(f =>
    f.path.includes('00_PROJECT_ESSENTIALS') ||
    f.path.includes('Active_Contracts') ||
    f.path.includes('Current_Plans')
  );

  // Query documents table
  const { data: dbDocs, error } = await supabase
    .from('documents')
    .select('file_path')
    .eq('project_id', PROJECT_ID);

  if (error) {
    issues.push({
      type: 'database_error',
      message: `Failed to query documents: ${error.message}`
    });
    return issues;
  }

  const dbPaths = new Set(dbDocs.map(d => d.file_path));

  // Find critical files not in database
  criticalDocs.forEach(file => {
    const relativePath = file.path.replace(/_ORGANIZED[\/\\]/, '');
    if (!dbPaths.has(relativePath)) {
      issues.push({
        type: 'missing_in_db',
        file: file.path,
        message: 'Critical document not tracked in database'
      });
    }
  });

  // Find database entries with missing files
  const filePaths = new Set(files.map(f => f.path));
  dbDocs.forEach(doc => {
    const fullPath = doc.file_path;
    if (!filePaths.has(fullPath)) {
      issues.push({
        type: 'file_missing',
        dbPath: doc.file_path,
        message: 'Database references missing file'
      });
    }
  });

  return issues;
}

/**
 * Calculate folder statistics
 */
function calculateFolderStats(files) {
  const stats = {};

  files.forEach(file => {
    const topFolder = file.path.split(path.sep)[0];

    if (!stats[topFolder]) {
      stats[topFolder] = {
        fileCount: 0,
        totalSize: 0,
        oldestFile: file.modified,
        newestFile: file.modified
      };
    }

    stats[topFolder].fileCount++;
    stats[topFolder].totalSize += file.size;

    if (file.modified < stats[topFolder].oldestFile) {
      stats[topFolder].oldestFile = file.modified;
    }

    if (file.modified > stats[topFolder].newestFile) {
      stats[topFolder].newestFile = file.modified;
    }
  });

  return stats;
}

/**
 * Generate audit report
 */
async function generateAuditReport(organizedPath) {
  const report = {
    timestamp: new Date().toISOString(),
    files: [],
    duplicates: [],
    archiveCandidates: [],
    brokenSymlinks: [],
    databaseIssues: [],
    folderStats: {},
    recommendations: []
  };

  // Scan files
  console.log(chalk.yellow('Scanning files...'));
  report.files = await scanDirectory(organizedPath);
  console.log(chalk.green(`✓ Scanned ${report.files.length} files\n`));

  // Find duplicates
  console.log(chalk.yellow('Checking for new duplicates...'));
  const duplicates = findDuplicates(report.files);
  report.duplicates = Array.from(duplicates.byHash.values()).filter(g => g.length > 1);
  console.log(chalk.green(`✓ Found ${report.duplicates.length} duplicate groups\n`));

  // Archive candidates
  console.log(chalk.yellow('Finding archive candidates...'));
  report.archiveCandidates = findArchiveCandidates(report.files);
  console.log(chalk.green(`✓ Found ${report.archiveCandidates.length} archive candidates\n`));

  // Broken symlinks
  console.log(chalk.yellow('Checking symlinks...'));
  report.brokenSymlinks = await findBrokenSymlinks(organizedPath);
  console.log(chalk.green(`✓ Found ${report.brokenSymlinks.length} broken symlinks\n`));

  // Database sync
  console.log(chalk.yellow('Verifying database sync...'));
  report.databaseIssues = await verifyDatabaseSync(report.files);
  console.log(chalk.green(`✓ Found ${report.databaseIssues.length} sync issues\n`));

  // Folder stats
  console.log(chalk.yellow('Calculating folder statistics...'));
  report.folderStats = calculateFolderStats(report.files);
  console.log(chalk.green(`✓ Analyzed ${Object.keys(report.folderStats).length} folders\n`));

  // Generate recommendations
  if (report.duplicates.length > 0) {
    report.recommendations.push({
      priority: 'high',
      action: 'Remove duplicates',
      details: `${report.duplicates.length} duplicate groups found. Run consolidation script.`
    });
  }

  if (report.archiveCandidates.length > 10) {
    report.recommendations.push({
      priority: 'medium',
      action: 'Archive old files',
      details: `${report.archiveCandidates.length} files older than 90 days. Review and archive.`
    });
  }

  if (report.brokenSymlinks.length > 0) {
    report.recommendations.push({
      priority: 'high',
      action: 'Fix broken symlinks',
      details: `${report.brokenSymlinks.length} broken symlinks found. Recreate or remove.`
    });
  }

  if (report.databaseIssues.length > 0) {
    report.recommendations.push({
      priority: 'high',
      action: 'Sync database',
      details: `${report.databaseIssues.length} database sync issues. Re-run extraction script.`
    });
  }

  return report;
}

/**
 * Write report to markdown
 */
async function writeAuditReport(report, outputPath) {
  const date = new Date().toISOString().split('T')[0];
  let md = `# Monthly Audit Report - ${date}\n\n`;
  md += `Generated: ${report.timestamp}\n\n`;

  // Executive Summary
  md += '## Executive Summary\n\n';
  md += `- **Total Files:** ${report.files.length}\n`;
  md += `- **Duplicate Groups:** ${report.duplicates.length}\n`;
  md += `- **Archive Candidates:** ${report.archiveCandidates.length}\n`;
  md += `- **Broken Symlinks:** ${report.brokenSymlinks.length}\n`;
  md += `- **Database Issues:** ${report.databaseIssues.length}\n\n`;

  // Recommendations
  md += '## Recommendations\n\n';
  if (report.recommendations.length === 0) {
    md += '*No actions required. System is healthy.*\n\n';
  } else {
    report.recommendations.forEach((rec, i) => {
      const icon = rec.priority === 'high' ? '🔴' : '🟡';
      md += `${i + 1}. ${icon} **${rec.action}** (${rec.priority} priority)\n`;
      md += `   ${rec.details}\n\n`;
    });
  }

  // Folder Statistics
  md += '## Folder Statistics\n\n';
  md += '| Folder | Files | Size (MB) | Oldest File | Newest File |\n';
  md += '|--------|-------|-----------|-------------|-------------|\n';

  Object.entries(report.folderStats).forEach(([folder, stats]) => {
    const sizeMB = (stats.totalSize / 1024 / 1024).toFixed(2);
    const oldest = stats.oldestFile.toISOString().split('T')[0];
    const newest = stats.newestFile.toISOString().split('T')[0];
    md += `| ${folder} | ${stats.fileCount} | ${sizeMB} | ${oldest} | ${newest} |\n`;
  });

  md += '\n## Details\n\n';

  // Duplicates
  if (report.duplicates.length > 0) {
    md += '### Duplicates\n\n';
    report.duplicates.slice(0, 10).forEach((group, i) => {
      md += `#### Group ${i + 1}\n\n`;
      group.forEach(file => {
        md += `- \`${file.path}\` (${(file.size / 1024).toFixed(2)} KB, modified ${file.modified.toISOString()})\n`;
      });
      md += '\n';
    });

    if (report.duplicates.length > 10) {
      md += `*...and ${report.duplicates.length - 10} more duplicate groups*\n\n`;
    }
  }

  // Archive Candidates
  if (report.archiveCandidates.length > 0) {
    md += '### Archive Candidates (>90 days old)\n\n';
    report.archiveCandidates.slice(0, 20).forEach(file => {
      const ageDays = Math.floor((Date.now() - file.modified.getTime()) / (1000 * 60 * 60 * 24));
      md += `- \`${file.path}\` (${ageDays} days old)\n`;
    });

    if (report.archiveCandidates.length > 20) {
      md += `\n*...and ${report.archiveCandidates.length - 20} more files*\n\n`;
    }
  }

  // Broken Symlinks
  if (report.brokenSymlinks.length > 0) {
    md += '### Broken Symlinks\n\n';
    report.brokenSymlinks.forEach(link => {
      md += `- \`${link.link}\`: ${link.error}\n`;
    });
    md += '\n';
  }

  // Database Issues
  if (report.databaseIssues.length > 0) {
    md += '### Database Sync Issues\n\n';
    report.databaseIssues.forEach(issue => {
      md += `- **${issue.type}**: ${issue.message}\n`;
      if (issue.file) md += `  File: \`${issue.file}\`\n`;
      if (issue.dbPath) md += `  DB Path: \`${issue.dbPath}\`\n`;
    });
    md += '\n';
  }

  md += '---\n';
  md += '*Generated by Monthly Audit Script*\n';

  await fs.writeFile(outputPath, md);
}

/**
 * Main execution
 */
async function main() {
  console.log(chalk.bold.cyan('\n📋 Monthly Audit Script\n'));

  // Parse arguments
  const args = process.argv.slice(2);
  let organizedPath = DEFAULT_ORGANIZED_PATH;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) {
      organizedPath = args[i + 1];
      i++;
    }
  }

  // Verify path exists
  if (!await fs.pathExists(organizedPath)) {
    console.error(chalk.red(`✗ Path not found: ${organizedPath}`));
    process.exit(1);
  }

  console.log(chalk.blue(`Auditing: ${organizedPath}\n`));

  // Generate report
  const report = await generateAuditReport(organizedPath);

  // Write report
  const date = new Date().toISOString().split('T')[0];
  const outputPath = path.join(process.cwd(), `AUDIT_REPORT_${date}.md`);
  await writeAuditReport(report, outputPath);

  console.log(chalk.bold.green('\n✓ Audit Complete!\n'));
  console.log(chalk.cyan(`Report saved to: ${outputPath}\n`));

  // Summary
  if (report.recommendations.length > 0) {
    console.log(chalk.yellow('⚠ Action Items:\n'));
    report.recommendations.forEach((rec, i) => {
      const icon = rec.priority === 'high' ? chalk.red('●') : chalk.yellow('●');
      console.log(`  ${icon} ${rec.action}`);
    });
    console.log('');
  } else {
    console.log(chalk.green('✓ No action items. System is healthy!\n'));
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\n✗ Error:'), error);
    process.exit(1);
  });
}

module.exports = { generateAuditReport, findArchiveCandidates, findBrokenSymlinks };
