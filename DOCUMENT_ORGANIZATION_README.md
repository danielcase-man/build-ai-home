# Document Organization System

Complete automated system for organizing, analyzing, and managing the 708 Purple Salvia Cove construction project documents.

## Overview

This system provides:
- **Automated file analysis** with duplicate detection
- **Intelligent reorganization** using category-based rules
- **Database extraction** to populate the construction management app
- **Shareable packages** for vendors, lenders, HOA, and permits
- **Ongoing maintenance** with file watching and monthly audits

## Quick Start

### 1. Analyze Current Documents

First, scan your project folder to understand what you have:

```bash
npm run docs:analyze
```

This generates:
- `INVENTORY_2026-02-13.csv` - Complete file list with metadata
- `DUPLICATES_REPORT.md` - Groups of duplicate files
- `CATEGORY_ANALYSIS.md` - File distribution by category

**Review these reports before proceeding!**

### 2. Plan the Reorganization (Dry Run)

Create the new folder structure and see what would happen:

```bash
npm run docs:reorganize:dry-run
```

This generates:
- New folder structure in `708 Purple Salvia Cove_ORGANIZED/`
- `REORGANIZATION_PLAN.md` showing all proposed file moves

**Review REORGANIZATION_PLAN.md to verify the organization makes sense!**

### 3. Execute Reorganization

Once you're happy with the plan, execute it:

```bash
npm run docs:reorganize
```

This:
- Copies all files to the new organized structure
- Removes duplicate versions (keeps newest)
- Renames files for clarity
- Creates INDEX.md in each folder
- **Preserves your original folder as backup**

Result: Two folder structures exist side-by-side. Original is untouched.

### 4. Extract Data to Database

Populate the Supabase database with structured data from your documents:

```bash
# Dry run first to see what would be extracted
npm run docs:extract:dry-run

# Execute extraction
npm run docs:extract
```

This:
- Extracts bid data from PDFs
- Updates expense tracking from receipts
- Links documents to database records
- Creates project status snapshot

### 5. Generate Shareable Packages

Create ZIP packages for different audiences:

```bash
npm run docs:packages
```

This creates in `_SHAREABLE_PACKAGES/`:
- `FOR_VENDORS/Vendor_Package_2026-02-13.zip`
- `FOR_LENDER/Lender_Draw_Request_2026-02-13.zip`
- `FOR_HOA/HOA_Submission_2026-02-13.zip`
- `FOR_PERMITS/Permit_Application_2026-02-13.zip`

Each package includes a professional cover sheet PDF.

## Organized Folder Structure

After reorganization, your documents are organized as:

```
708 Purple Salvia Cove_ORGANIZED/
├── 00_PROJECT_ESSENTIALS/         # Quick access to critical documents
│   ├── Current_Plans/
│   ├── Current_Budget/
│   └── Active_Contracts/
│
├── 01_PLANS_AND_ENGINEERING/
│   ├── Architectural/
│   │   ├── CURRENT/              # Latest plans
│   │   └── ARCHIVE/              # Previous versions
│   ├── Engineering/
│   │   ├── Foundation/
│   │   ├── Structural/
│   │   └── Roofing/
│   └── Survey/
│
├── 02_PERMITS_AND_REGULATORY/
│   ├── Building_Permits/
│   ├── HOA/
│   └── Utilities/
│
├── 03_BIDS_AND_ESTIMATES/
│   ├── BY_CATEGORY/              # Organized by trade
│   ├── SELECTED_BIDS/
│   └── REJECTED_BIDS/
│
├── 04_CONTRACTS_AND_AGREEMENTS/
│   ├── Land_Purchase/
│   ├── Vendors/
│   └── Financial/
│
├── 05_EXPENSES_AND_RECEIPTS/
│   ├── BY_VENDOR/
│   └── BY_MONTH/
│
├── 06_DESIGN_AND_SPECIFICATIONS/
│   ├── Design_Inspiration/
│   └── Final_Selections/
│
├── 07_SITE_PROGRESS/
│   ├── Photos/
│   ├── Daily_Logs/
│   └── Inspections/
│
├── 08_COMMUNICATIONS/
│
├── 09_REFERENCE_AND_TEMPLATES/
│   └── UBuildIt_Process/
│
├── 10_ARCHIVE/
│   ├── Old_Versions/
│   └── Duplicates/
│
└── _SHAREABLE_PACKAGES/
    ├── FOR_VENDORS/
    ├── FOR_LENDER/
    ├── FOR_HOA/
    └── FOR_PERMITS/
```

Each folder includes an `INDEX.md` explaining its contents.

## Maintenance Commands

### File Watcher

Monitor a folder for new files and get auto-categorization suggestions:

```bash
npm run docs:watch
```

This watches `708 Purple Salvia Cove/_INBOX/` and:
- Detects new files
- Suggests appropriate folder
- Logs to `PENDING_CATEGORIZATION.jsonl`
- Optionally auto-organizes files

### Monthly Audit

Generate a comprehensive health check report:

```bash
npm run docs:audit
```

This generates `AUDIT_REPORT_[date].md` with:
- File count and size by category
- New duplicate detection
- Archive candidates (>90 days old)
- Broken symlinks
- Database sync verification
- Actionable recommendations

Run this monthly to keep your document system healthy.

## Advanced Usage

### Custom Source Path

All scripts accept a `--source` parameter:

```bash
node scripts/analyze-documents.js --source "/path/to/folder"
node scripts/reorganize-documents.js --source "/path/to/folder" --dry-run
```

### Individual Package Generation

Generate just one package type:

```bash
node scripts/create-shareable-packages.js --package vendors
node scripts/create-shareable-packages.js --package lender
```

### Auto-Organize New Files

Enable automatic organization when watching:

```bash
node scripts/watch-folder.js --auto-organize
```

## Files Generated

### Analysis Phase
- `INVENTORY_[date].csv` - Complete file inventory with metadata
- `DUPLICATES_REPORT.md` - Duplicate file analysis
- `CATEGORY_ANALYSIS.md` - File distribution statistics

### Reorganization Phase
- `REORGANIZATION_PLAN.md` - Preview of all file moves
- `REORGANIZATION_LOG.md` - Record of all operations performed
- `[folder]/INDEX.md` - Description of each folder's contents

### Maintenance Phase
- `PENDING_CATEGORIZATION.jsonl` - New files awaiting organization
- `AUDIT_REPORT_[date].md` - Monthly system health check

### Shareable Packages
- `Vendor_Package_[date].zip` - For general contractors
- `Lender_Draw_Request_[date].zip` - For construction financing
- `HOA_Submission_[date].zip` - For architectural approval
- `Permit_Application_[date].zip` - For building department

## Safety Features

### Zero Risk of Data Loss
- All operations are **copy-based** by default
- Original folder is never modified
- `--preserve-originals` flag ensures backup
- Dry-run modes for all major operations

### Duplicate Handling
- Keeps newest version based on modification date
- Archives older versions to `10_ARCHIVE/Duplicates/`
- Logs all duplicate decisions
- Never auto-deletes without review

### Smart Categorization
- Critical documents (contracts, current plans) never auto-archived
- Recent files (<90 days) prioritized
- Manual review recommended for old files (2019-2023)

## Troubleshooting

### "Source directory not found"
**Solution:** Check the path in the script or provide `--source` parameter.

### "Database connection failed"
**Solution:** Verify `.env.local` has correct Supabase credentials.

### "Permission denied" errors
**Solution:** On Windows/WSL, some operations may require elevated permissions. Run from WSL terminal.

### Symlinks not working on Windows
**Solution:** This is expected. Symlinks require admin permissions on Windows and are automatically skipped.

### PDF extraction returning empty text
**Solution:** Some PDFs are image-based and need OCR. These will be tracked by filename only.

## Workflow Integration

### Weekly Routine
1. Drop new files into `_INBOX/` folder
2. Run `npm run docs:watch` or manually organize
3. Regenerate packages if needed: `npm run docs:packages`

### Monthly Routine
1. Run `npm run docs:audit`
2. Review audit report recommendations
3. Archive old files as suggested
4. Re-run database extraction if needed

### For Major Milestones
1. Update budget and bids in organized folders
2. Run `npm run docs:extract` to sync database
3. Generate fresh packages: `npm run docs:packages`
4. Share with stakeholders

## Integration with Construction App

The organized documents feed directly into the construction management application:

- **Documents** → Linked in `documents` table with file paths
- **Bids** → Extracted to `bids` table with amounts and vendors
- **Expenses** → Update `budget_items` table with paid amounts
- **Project Status** → Creates snapshots in `project_status` table

Access via the app's dashboard at http://localhost:3000/projects/[project-id]

## Architecture

### Script Responsibilities

| Script | Purpose | Reads | Writes |
|--------|---------|-------|--------|
| `analyze-documents.js` | Scan and analyze files | Original folder | CSV + MD reports |
| `reorganize-documents.js` | Create organized structure | Original folder | Organized folder + logs |
| `extract-to-database.js` | Populate Supabase | Organized folder | Database tables |
| `create-shareable-packages.js` | Generate ZIP packages | Organized folder | ZIP files + PDFs |
| `watch-folder.js` | Monitor for new files | Inbox folder | JSONL log |
| `monthly-audit.js` | Health check | Organized folder | Audit report |

### Dependencies

Key packages used:
- `fs-extra` - Enhanced file system operations
- `csv-writer` - CSV export
- `xlsx` - Spreadsheet parsing
- `pdf-parse` - PDF text extraction
- `pdfkit` - PDF generation for cover sheets
- `archiver` - ZIP archive creation
- `chokidar` - File system watching
- `chalk` - Colored console output

## Future Enhancements

Potential additions:
- [ ] AI-powered file categorization using OpenAI
- [ ] Automatic OCR for image-based PDFs
- [ ] Cloud sync to Supabase Storage
- [ ] Web interface for manual categorization
- [ ] Email attachment auto-import
- [ ] Version control integration (Git)
- [ ] Document diff viewer
- [ ] Budget variance tracking from receipts

## Support

For issues or questions:
1. Check this README
2. Review generated reports (especially `REORGANIZATION_PLAN.md`)
3. Run with `--dry-run` first to preview changes
4. Contact: danielcase.info@gmail.com

---

**Last Updated:** 2026-02-13
**Version:** 1.0.0
**Project:** 708 Purple Salvia Cove Construction Management
