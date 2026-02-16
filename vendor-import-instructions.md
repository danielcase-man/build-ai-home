# UBuildIt Vendor Database Import Instructions

## Overview
This guide helps you import all UBuildIt recommended vendors into your UBuildIt Manager application database. The data includes **5 cabinet vendors** plus 15+ additional vendors across all construction categories.

## Cabinet Vendors Summary
Your project now has these UBuildIt-recommended cabinet vendors:

1. **Kent Moore Cabinets Ltd** - Cabinet specialist only
2. **ProSource** - Cabinets, Hardware, Flooring, Countertops, Bath Hardware  
3. **High-Tech Flooring & Design** - Cabinets, Flooring, Countertops
4. **Parrish & Company Inc.** - Appliances, Grill, Fireplace, Cabinets, Hardware
5. **Home Depot** - Multiple services including cabinets

## Before You Import

### Step 1: Get Your Project UUID
You need to find your actual project UUID from your database. Run this query:

```sql
SELECT id, name, address FROM projects WHERE name LIKE '%Purple Salvia%' OR address LIKE '%Liberty Hill%';
```

### Step 2: Update the Import File
1. Open `vendor-import-data.sql`
2. Replace **both instances** of `'YOUR_PROJECT_UUID_HERE'` with your actual project UUID
3. Save the file

## Import Process

### Method 1: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `vendor-import-data.sql`
4. Click "Run" to execute the import

### Method 2: Command Line (if you have psql access)
```bash
psql -h your-supabase-host -U postgres -d postgres -f vendor-import-data.sql
```

## What Gets Imported

### Vendor Records (22 total)
- **Categories**: Cabinets, Multi-Service, Lighting, Appliances, Windows/Doors, Building Materials, etc.
- **Status**: All set to "potential" (you can update as you contact them)
- **Email Tracking**: Enabled for automatic email organization
- **Notes**: Include UBuildIt recommendation status

### Contact Records (25+ total)
- Complete contact information for each vendor
- Primary contact names, phones, addresses
- Sales representative details where available
- Special account information (like Home Depot ProDesk)

## After Import

### Verify the Import
Run these queries to confirm successful import:

```sql
-- Check vendor count
SELECT category, COUNT(*) as vendor_count 
FROM vendors 
WHERE project_id = 'YOUR_PROJECT_UUID' 
GROUP BY category;

-- Check cabinet vendors specifically
SELECT company_name, category, status 
FROM vendors 
WHERE project_id = 'YOUR_PROJECT_UUID' 
AND (category = 'Cabinets' OR category = 'Multi-Service');

-- Check contact details
SELECT v.company_name, c.name, c.phone 
FROM vendors v 
LEFT JOIN contacts c ON c.company = v.company_name 
WHERE v.project_id = 'YOUR_PROJECT_UUID' 
AND v.category IN ('Cabinets', 'Multi-Service')
ORDER BY v.company_name;
```

### Next Steps
1. **Update vendor status** as you contact them (potential → approved → active)
2. **Add budget estimates** for each vendor category
3. **Schedule meetings** with cabinet vendors for quotes
4. **Enable email tracking** to automatically organize vendor communications
5. **Add additional vendors** you find outside the UBuildIt network

## Categories Imported

| Category | Count | Examples |
|----------|-------|----------|
| Cabinets | 1 | Kent Moore Cabinets Ltd |
| Multi-Service | 3 | ProSource, High-Tech Flooring, Parrish & Company |
| Appliances | 2 | FBS Appliance, K&N Appliance Gallery |
| Lighting | 1 | Builder Benefits Lighting Inc. |
| Windows/Doors | 2 | 84 Lumber, Texas Door and Trim |
| Building Materials | 2 | McCoy's Building Supply, Home Depot |
| Flooring | 2 | Floor & Décor, Craftsman Concrete Floors |
| Fireplace/Outdoor | 2 | Austin Contractor Services, Webco Fireplace |
| Masonry | 2 | Acme Brick Company, South Texas Brick and Stone |
| Specialty Glass | 1 | Anchor Ventana |
| Fencing | 2 | Viking Fence, Nailhead Spur Company |
| Paint | 1 | Sherwin-Williams |
| Home Automation | 1 | Mesa Home Systems |
| Insulation/Garage Doors | 1 | IBP Installed Building Products |

## Troubleshooting

### If Import Fails
1. **Check project UUID**: Ensure it matches exactly (with hyphens)
2. **Database permissions**: Verify you have INSERT permissions
3. **Duplicate vendors**: If re-running, delete existing vendors first:
   ```sql
   DELETE FROM contacts WHERE project_id = 'YOUR_PROJECT_UUID' AND type = 'vendor';
   DELETE FROM vendors WHERE project_id = 'YOUR_PROJECT_UUID';
   ```

### If Some Vendors Don't Import
- Check for special characters in company names
- Verify the SQL syntax is correct
- Run the vendor INSERT and contact INSERT sections separately

## Benefits of This Import

✅ **Complete UBuildIt Network**: All officially recommended vendors  
✅ **Cabinet Focus**: 5 cabinet vendors ready for quotes  
✅ **Contact Details**: Phone numbers, addresses, rep names  
✅ **Email Integration**: Automatic tracking of vendor emails  
✅ **Categorization**: Easy filtering and organization  
✅ **Project Specific**: Tied to your Liberty Hill project  
✅ **Status Tracking**: Monitor vendor relationships  

## Support
If you encounter issues with the import, check:
1. Supabase logs for error details
2. Project UUID is correct
3. Database schema matches expected structure

Your UBuildIt Manager is now loaded with the complete vendor network to efficiently manage your Liberty Hill construction project!
