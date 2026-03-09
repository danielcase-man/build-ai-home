#!/usr/bin/env node

/**
 * Folder Watcher
 *
 * Monitors a designated inbox folder for new files and suggests categorization.
 * Optionally integrates with AI for intelligent file categorization.
 *
 * Usage: node scripts/watch-folder.js [--inbox path] [--auto-organize]
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const chokidar = require('chokidar');
const { inferCategory } = require('./analyze-documents');
const { determineTarget } = require('./reorganize-documents');

// Default paths - auto-detect WSL vs Windows
const getDefaultPaths = () => {
  if (process.platform === 'win32') {
    return {
      inbox: 'C:\\Users\\danie\\Dropbox\\Properties\\Austin, TX\\Liberty Hill\\708 Purple Salvia Cove\\_INBOX',
      organized: 'C:\\Users\\danie\\Dropbox\\Properties\\Austin, TX\\Liberty Hill\\708 Purple Salvia Cove_ORGANIZED'
    };
  } else {
    return {
      inbox: '/mnt/c/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove/_INBOX',
      organized: '/mnt/c/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove_ORGANIZED'
    };
  }
};

const defaultPaths = getDefaultPaths();
const DEFAULT_INBOX = defaultPaths.inbox;
const DEFAULT_ORGANIZED = defaultPaths.organized;

/**
 * Suggest categorization for a new file
 */
async function categorizeFile(filePath, filename) {
  const stats = await fs.stat(filePath);

  const fileInfo = {
    path: filePath,
    name: filename,
    extension: path.extname(filename).toLowerCase(),
    size: stats.size,
    modified: stats.mtime,
    created: stats.birthtime
  };

  // Infer category
  const category = inferCategory(path.dirname(filePath), filename);
  const target = determineTarget(fileInfo);

  return {
    category,
    suggestedFolder: target.primary,
    alsoIn: target.also,
    fileInfo
  };
}

/**
 * Log categorization suggestion
 */
function logSuggestion(filename, suggestion) {
  console.log(chalk.cyan(`\n📄 New file detected: ${filename}`));
  console.log(chalk.gray(`   Category: ${suggestion.category}`));
  console.log(chalk.green(`   Suggested: ${suggestion.suggestedFolder}`));

  if (suggestion.alsoIn) {
    console.log(chalk.yellow(`   Also link to: ${suggestion.alsoIn}`));
  }

  console.log(chalk.gray(`   Size: ${(suggestion.fileInfo.size / 1024).toFixed(2)} KB`));
  console.log('');
}

/**
 * Write suggestion to pending log
 */
async function logToPendingFile(suggestion, logPath) {
  const entry = {
    timestamp: new Date().toISOString(),
    filename: suggestion.fileInfo.name,
    category: suggestion.category,
    suggestedFolder: suggestion.suggestedFolder,
    alsoIn: suggestion.alsoIn,
    size: suggestion.fileInfo.size,
    processed: false
  };

  // Append to JSONL file
  await fs.appendFile(logPath, JSON.stringify(entry) + '\n');
}

/**
 * Auto-organize file if enabled
 */
async function autoOrganizeFile(filePath, suggestion, organizedPath) {
  const targetPath = path.join(organizedPath, suggestion.suggestedFolder, suggestion.fileInfo.name);

  try {
    await fs.ensureDir(path.dirname(targetPath));
    await fs.move(filePath, targetPath);

    console.log(chalk.green(`✓ Auto-organized to: ${suggestion.suggestedFolder}`));

    // If also target, create symlink
    if (suggestion.alsoIn && process.platform !== 'win32') {
      const symlinkPath = path.join(organizedPath, suggestion.alsoIn, suggestion.fileInfo.name);
      await fs.ensureDir(path.dirname(symlinkPath));
      const relativePath = path.relative(path.dirname(symlinkPath), targetPath);
      await fs.ensureSymlink(relativePath, symlinkPath);
      console.log(chalk.gray(`  Created symlink in: ${suggestion.alsoIn}`));
    }

    return true;
  } catch (error) {
    console.error(chalk.red(`✗ Error organizing file:`), error.message);
    return false;
  }
}

/**
 * Main watcher
 */
async function main() {
  console.log(chalk.bold.cyan('\n👁️  Folder Watcher\n'));

  // Parse arguments
  const args = process.argv.slice(2);
  let inboxPath = DEFAULT_INBOX;
  let organizedPath = DEFAULT_ORGANIZED;
  let autoOrganize = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--inbox' && args[i + 1]) {
      inboxPath = args[i + 1];
      i++;
    } else if (args[i] === '--organized' && args[i + 1]) {
      organizedPath = args[i + 1];
      i++;
    } else if (args[i] === '--auto-organize') {
      autoOrganize = true;
    }
  }

  // Ensure inbox exists
  await fs.ensureDir(inboxPath);

  console.log(chalk.blue(`Watching: ${inboxPath}`));
  console.log(chalk.blue(`Auto-organize: ${autoOrganize ? 'Enabled' : 'Disabled'}`));
  console.log(chalk.gray('Press Ctrl+C to stop\n'));

  const logPath = path.join(path.dirname(inboxPath), 'PENDING_CATEGORIZATION.jsonl');

  // Initialize watcher
  const watcher = chokidar.watch(inboxPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true, // Don't trigger for existing files
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });

  // Handle new files
  watcher.on('add', async (filePath) => {
    const filename = path.basename(filePath);

    try {
      const suggestion = await categorizeFile(filePath, filename);
      logSuggestion(filename, suggestion);

      // Log to pending file
      await logToPendingFile(suggestion, logPath);

      // Auto-organize if enabled
      if (autoOrganize) {
        await autoOrganizeFile(filePath, suggestion, organizedPath);
      } else {
        console.log(chalk.yellow(`To organize: Move to ${suggestion.suggestedFolder}`));
        console.log(chalk.gray(`Or run: node scripts/organize-new-files.js\n`));
      }
    } catch (error) {
      console.error(chalk.red(`Error processing ${filename}:`), error.message);
    }
  });

  // Handle file changes
  watcher.on('change', (filePath) => {
    console.log(chalk.gray(`File changed: ${path.basename(filePath)}`));
  });

  // Handle errors
  watcher.on('error', (error) => {
    console.error(chalk.red('Watcher error:'), error);
  });

  // Ready message
  console.log(chalk.green('✓ Watcher started successfully\n'));
  console.log(chalk.cyan('Drop files into the inbox folder to categorize them automatically.\n'));
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\n✗ Error:'), error);
    process.exit(1);
  });
}

module.exports = { categorizeFile };
