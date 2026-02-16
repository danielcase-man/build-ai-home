# Database Import Scripts

This directory contains scripts to populate the ubuildit-manager database with your project data.

## Quick Start

### Prerequisites

1. **Supabase Database Setup**
   - Make sure you have run the `supabase-schema.sql` to create all tables
   - Verify `.env.local` has your Supabase credentials:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your-project-url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     ```

2. **Dependencies**
   - All dependencies are already in `package.json`
   - If needed: `npm install`

### Running the Import

```bash
# From the project root directory
node scripts/import-project-data.js
```

### What Gets Imported

The script will populate your database with:

✅ **1 Project Record**
- 708 Purple Salvia Cove
- Budget: $1.2M
- Phase: Planning (Step 4 of 6)

✅ **6 Planning Phase Steps**
- Steps 1-3: Completed
- Steps 4-5: In Progress
- Step 6: Not Started

✅ **24 Contacts**
- Architects, Engineers, Consultants
- UBuildIt team members
- Contractors and vendors

✅ **12 Vendor Companies**
- Contracted: 6 vendors
- Potential: 6 vendors
- Email tracking enabled where applicable

✅ **30+ Budget Items**
- Paid: $289,196 (8 items)
- Contracted: $66,941+ (2 items)
- Bids Received: 9 items
- Estimated: 12 items

✅ **3 Permits**
- HOA Architectural Review
- Building Permit
- Septic Permit

✅ **1 Project Status Snapshot**
- Hot topics
- Action items
- Recent decisions
- Budget status

### Expected Output

```
============================================================
🏗️  DATABASE IMPORT: 708 Purple Salvia Cove
============================================================
📅 Date: 2026-02-11
🔗 Supabase URL: https://your-project.supabase.co

📁 Inserting project record...
✅ Project created with ID: xxx-xxx-xxx

📋 Inserting planning phase steps...
✅ Inserted 6 planning phase steps

👥 Inserting contacts...
✅ Inserted 24 contacts

🏢 Inserting vendors...
✅ Inserted 12 vendors

💰 Inserting budget items...
✅ Inserted 30 budget items
   Total Paid: $289,195

📜 Inserting permits...
✅ Inserted 3 permits

📊 Inserting project status snapshot...
✅ Inserted project status snapshot

============================================================
✅ IMPORT COMPLETE!
============================================================

📊 Summary:
   Projects: 1
   Planning Steps: 6
   Contacts: 24
   Vendors: 12
   Budget Items: 30
   Permits: 3
   Project Status: 1

   Project ID: xxx-xxx-xxx

✨ Database is ready! You can now:
   1. Run the app: npm run dev
   2. Connect Gmail for email sync
   3. Review data in dashboard
```

## After Import

### 1. Verify Data in Dashboard

Start the development server:
```bash
npm run dev
```

Open http://localhost:3000 and verify:
- Project name and budget display correctly
- Planning phase progress shows 4 of 6 steps
- Budget shows $289,196 spent
- Contacts are listed

### 2. Connect Gmail (Optional)

To enable email tracking:
1. Go to the Emails page
2. Click "Connect Gmail"
3. Authorize the app to read your Gmail
4. Emails from vendors will sync automatically

### 3. Update Data as Needed

Use the app UI to:
- Accept pending bids
- Mark tasks as complete
- Update budget items
- Add new vendors/contacts

## Troubleshooting

### Error: "Missing Supabase credentials"

**Solution:** Add credentials to `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Error: "relation does not exist"

**Solution:** Run the database schema first:
```sql
-- In Supabase SQL Editor, run:
supabase-schema.sql
```

### Error: "duplicate key value"

**Solution:** The script has already been run. To re-run:
1. Clear the existing data in Supabase
2. Or modify the script to skip existing records

### Partial Import

If the import fails partway:
- Check the console output for the specific error
- The script logs which section failed
- You can manually fix the issue and re-run

## Data Source

All data imported from:
- **Dropbox Folder:** `/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove`
- **Latest Update:** February 6, 2026
- **Key Documents:**
  - VENDOR_DIRECTORY.md
  - ACTION_ITEMS.md
  - PROJECT_SPECIFICATIONS.json
  - Budget files and expense tracking

## Need Help?

- Review `database-import-plan.md` for detailed data mapping
- Check Supabase dashboard for error logs
- Verify all table columns exist (run schema SQL)

---

**Last Updated:** 2026-02-11
**Script Version:** 1.0
