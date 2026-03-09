#!/usr/bin/env node

/**
 * Shareable Package Generator
 *
 * Creates audience-specific document bundles:
 * - FOR_VENDORS: Plans, specs, site access info
 * - FOR_LENDER: Budget, contracts, receipts, progress photos
 * - FOR_HOA: Architectural plans and material specs
 * - FOR_PERMITS: Engineering plans, survey, contractor info
 *
 * Usage:
 *   node scripts/create-shareable-packages.js --all
 *   node scripts/create-shareable-packages.js --package vendors
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const archiver = require('archiver');
const PDFDocument = require('pdfkit');

// Default organized path - auto-detect WSL vs Windows
const getDefaultOrganizedPath = () => {
  if (process.platform === 'win32') {
    return 'C:\\Users\\danie\\Dropbox\\Properties\\Austin, TX\\Liberty Hill\\708 Purple Salvia Cove_ORGANIZED';
  } else {
    return '/mnt/c/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove_ORGANIZED';
  }
};

const DEFAULT_ORGANIZED_PATH = getDefaultOrganizedPath();

// Package definitions
const PACKAGE_CONFIGS = {
  vendors: {
    name: 'General Contractor Package',
    filename: 'Vendor_Package',
    description: 'Complete package for general contractors and subcontractors',
    includes: [
      {
        source: '00_PROJECT_ESSENTIALS/Current_Plans',
        description: 'Current architectural plans'
      },
      {
        source: '01_PLANS_AND_ENGINEERING/Engineering',
        description: 'Engineering plans (foundation, structural, roofing)'
      },
      {
        source: '01_PLANS_AND_ENGINEERING/Survey',
        description: 'Property survey'
      },
      {
        source: '06_DESIGN_AND_SPECIFICATIONS/Final_Selections',
        description: 'Final material and fixture selections'
      },
      {
        source: '02_PERMITS_AND_REGULATORY/HOA/Rules_and_Restrictions',
        description: 'HOA rules and restrictions'
      }
    ],
    coverInfo: {
      title: 'General Contractor Package',
      project: '708 Purple Salvia Cove',
      subtitle: 'Liberty Hill, TX 78642',
      notes: [
        'This package contains all current plans and specifications.',
        'All engineering plans are stamped and approved.',
        'Refer to Final Selections document for material specifications.',
        'Contact Daniel Case at danielcase.info@gmail.com with questions.'
      ]
    }
  },

  lender: {
    name: 'Construction Lender Package',
    filename: 'Lender_Draw_Request',
    description: 'Draw request documentation with budget and progress',
    includes: [
      {
        source: '00_PROJECT_ESSENTIALS/Current_Budget',
        description: 'Current project budget'
      },
      {
        source: '00_PROJECT_ESSENTIALS/Active_Contracts',
        description: 'Executed vendor contracts'
      },
      {
        source: '04_CONTRACTS_AND_AGREEMENTS/Land_Purchase',
        description: 'Land purchase documentation'
      },
      {
        source: '03_BIDS_AND_ESTIMATES/SELECTED_BIDS',
        description: 'Selected vendor bids'
      },
      {
        source: '05_EXPENSES_AND_RECEIPTS',
        description: 'Paid receipts and invoices'
      },
      {
        source: '07_SITE_PROGRESS/Photos',
        description: 'Construction progress photos'
      }
    ],
    coverInfo: {
      title: 'Construction Draw Request',
      project: '708 Purple Salvia Cove',
      subtitle: 'Liberty Hill, TX 78642',
      notes: [
        'This package documents completed work and expenses.',
        'All receipts are organized by vendor.',
        'Photos show current construction progress.',
        'Budget reflects all committed and paid amounts.'
      ]
    }
  },

  hoa: {
    name: 'HOA Architectural Submission',
    filename: 'HOA_Submission',
    description: 'Architectural plans and exterior specifications for HOA approval',
    includes: [
      {
        source: '00_PROJECT_ESSENTIALS/Current_Plans',
        description: 'Site plan and elevations'
      },
      {
        source: '01_PLANS_AND_ENGINEERING/Architectural/CURRENT',
        description: 'Current architectural plans'
      },
      {
        source: '06_DESIGN_AND_SPECIFICATIONS/Design_Inspiration/Exterior',
        description: 'Exterior material samples and colors'
      },
      {
        source: '06_DESIGN_AND_SPECIFICATIONS/Design_Inspiration/Garage_Doors',
        description: 'Garage door selections'
      }
    ],
    coverInfo: {
      title: 'HOA Architectural Submission',
      project: '708 Purple Salvia Cove',
      subtitle: 'Belterra Community, Liberty Hill, TX',
      notes: [
        'This submission includes all exterior architectural details.',
        'Plans are current as of the date on this cover sheet.',
        'Material samples and specifications are included.',
        'We comply with all Belterra architectural guidelines.'
      ]
    }
  },

  permits: {
    name: 'Building Permit Application',
    filename: 'Permit_Application',
    description: 'Complete documentation for building department submission',
    includes: [
      {
        source: '00_PROJECT_ESSENTIALS/Current_Plans',
        description: 'Current site plan'
      },
      {
        source: '01_PLANS_AND_ENGINEERING',
        description: 'All engineering plans (stamped)'
      },
      {
        source: '01_PLANS_AND_ENGINEERING/Survey',
        description: 'Property survey'
      },
      {
        source: '02_PERMITS_AND_REGULATORY/HOA',
        description: 'HOA approval documentation'
      }
    ],
    coverInfo: {
      title: 'Building Permit Application',
      project: '708 Purple Salvia Cove',
      subtitle: 'Williamson County, TX',
      notes: [
        'All engineering plans are stamped by licensed professionals.',
        'Property survey is current and accurate.',
        'HOA approval has been obtained.',
        'Contractor: Daniel Case (Owner-Builder via UBuildIt)'
      ]
    }
  }
};

/**
 * Generate cover sheet PDF
 */
async function generateCoverSheet(config, outputPath, date) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 72 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    // Header
    doc.fontSize(24)
      .font('Helvetica-Bold')
      .text(config.title, { align: 'center' });

    doc.moveDown(0.5);

    doc.fontSize(16)
      .font('Helvetica')
      .text(config.project, { align: 'center' });

    doc.fontSize(12)
      .text(config.subtitle, { align: 'center' });

    doc.moveDown(1);

    // Date
    doc.fontSize(10)
      .font('Helvetica-Oblique')
      .text(`Generated: ${date}`, { align: 'center' });

    doc.moveDown(2);

    // Horizontal line
    doc.moveTo(72, doc.y)
      .lineTo(540, doc.y)
      .stroke();

    doc.moveDown(1);

    // Notes section
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .text('PACKAGE CONTENTS');

    doc.moveDown(0.5);

    doc.fontSize(10)
      .font('Helvetica');

    config.notes.forEach(note => {
      doc.text(`• ${note}`, { indent: 20 });
      doc.moveDown(0.3);
    });

    doc.moveDown(2);

    // Footer
    doc.fontSize(8)
      .font('Helvetica-Oblique')
      .text('Generated automatically by UBuildIt Construction Management System', {
        align: 'center'
      });

    doc.moveDown(0.5);

    doc.text('708 Purple Salvia Cove | Liberty Hill, TX 78642', {
      align: 'center'
    });

    doc.text('Contact: danielcase.info@gmail.com | (512) 828-3187', {
      align: 'center'
    });

    doc.end();

    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
}

/**
 * Create ZIP archive with selected files
 */
async function createPackage(packageType, organizedPath) {
  const config = PACKAGE_CONFIGS[packageType];

  if (!config) {
    throw new Error(`Unknown package type: ${packageType}`);
  }

  console.log(chalk.yellow(`\nCreating ${config.name}...`));

  const today = new Date().toISOString().split('T')[0];
  const outputDir = path.join(organizedPath, '_SHAREABLE_PACKAGES', `FOR_${packageType.toUpperCase()}`);
  const zipFilename = `${config.filename}_${today}.zip`;
  const zipPath = path.join(outputDir, zipFilename);

  // Ensure output directory exists
  await fs.ensureDir(outputDir);

  // Generate cover sheet
  const coverSheetPath = path.join(outputDir, 'COVER_SHEET.pdf');
  console.log(chalk.gray('  Generating cover sheet...'));
  await generateCoverSheet(config.coverInfo, coverSheetPath, today);

  // Create archive
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(chalk.green(`✓ Created ${zipFilename} (${sizeMB} MB)`));
      resolve(zipPath);
    });

    archive.on('error', reject);
    archive.pipe(output);

    // Add cover sheet first
    archive.file(coverSheetPath, { name: 'COVER_SHEET.pdf' });

    // Add included folders/files
    let fileCount = 0;

    const addFiles = async () => {
      for (const include of config.includes) {
        const sourcePath = path.join(organizedPath, include.source);

        if (!await fs.pathExists(sourcePath)) {
          console.log(chalk.gray(`  Skipping ${include.source} (not found)`));
          continue;
        }

        const stats = await fs.stat(sourcePath);

        if (stats.isDirectory()) {
          // Add entire directory
          archive.directory(sourcePath, path.basename(include.source));
          const files = await fs.readdir(sourcePath);
          fileCount += files.length;
          console.log(chalk.gray(`  Added folder: ${include.source} (${files.length} files)`));
        } else {
          // Add single file
          archive.file(sourcePath, { name: path.basename(include.source) });
          fileCount++;
          console.log(chalk.gray(`  Added file: ${include.source}`));
        }
      }

      console.log(chalk.cyan(`  Total files: ${fileCount}`));
      archive.finalize();
    };

    addFiles().catch(reject);
  });
}

/**
 * Generate README for each package folder
 */
async function generatePackageReadme(packageType, organizedPath) {
  const config = PACKAGE_CONFIGS[packageType];
  const outputDir = path.join(organizedPath, '_SHAREABLE_PACKAGES', `FOR_${packageType.toUpperCase()}`);
  const readmePath = path.join(outputDir, 'README.md');

  let content = `# ${config.name}\n\n`;
  content += `${config.description}\n\n`;
  content += `## Contents\n\n`;

  config.includes.forEach(include => {
    content += `- **${path.basename(include.source)}**: ${include.description}\n`;
  });

  content += `\n## Usage\n\n`;
  content += `1. Extract the ZIP file with today's date\n`;
  content += `2. Review the COVER_SHEET.pdf for package details\n`;
  content += `3. All included documents are organized by category\n\n`;
  content += `## Updates\n\n`;
  content += `This package is regenerated automatically. Always use the most recent dated file.\n\n`;
  content += `---\n`;
  content += `*Generated by UBuildIt Construction Management System*\n`;

  await fs.writeFile(readmePath, content);
}

/**
 * Main execution
 */
async function main() {
  console.log(chalk.bold.cyan('\n📦 Shareable Package Generator\n'));

  // Parse arguments
  const args = process.argv.slice(2);
  let organizedPath = DEFAULT_ORGANIZED_PATH;
  let packages = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) {
      organizedPath = args[i + 1];
      i++;
    } else if (args[i] === '--all') {
      packages = Object.keys(PACKAGE_CONFIGS);
    } else if (args[i] === '--package' && args[i + 1]) {
      packages.push(args[i + 1]);
      i++;
    }
  }

  if (packages.length === 0) {
    packages = Object.keys(PACKAGE_CONFIGS);  // Default to all
  }

  // Verify organized folder exists
  if (!await fs.pathExists(organizedPath)) {
    console.error(chalk.red(`✗ Organized folder not found: ${organizedPath}`));
    console.log(chalk.yellow('Run reorganize-documents.js first to create organized structure'));
    process.exit(1);
  }

  console.log(chalk.blue(`Source: ${organizedPath}`));
  console.log(chalk.blue(`Packages: ${packages.join(', ')}\n`));

  // Create packages
  const results = [];

  for (const packageType of packages) {
    try {
      const zipPath = await createPackage(packageType, organizedPath);
      await generatePackageReadme(packageType, organizedPath);
      results.push({ package: packageType, success: true, path: zipPath });
    } catch (error) {
      console.error(chalk.red(`✗ Error creating ${packageType}:`), error.message);
      results.push({ package: packageType, success: false, error: error.message });
    }
  }

  // Summary
  console.log(chalk.bold.green('\n✓ Package Generation Complete!\n'));
  console.log(chalk.cyan('Results:'));

  results.forEach(result => {
    if (result.success) {
      console.log(chalk.green(`  ✓ ${result.package}: ${result.path}`));
    } else {
      console.log(chalk.red(`  ✗ ${result.package}: ${result.error}`));
    }
  });

  const successCount = results.filter(r => r.success).length;
  console.log(chalk.white(`\n  ${successCount}/${results.length} packages created successfully\n`));
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\n✗ Error:'), error);
    process.exit(1);
  });
}

module.exports = { createPackage, generateCoverSheet };
