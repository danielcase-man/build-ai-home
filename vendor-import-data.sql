-- UBuildIt Recommended Vendors Import
-- Data extracted from UBuildIt Shopping List (Updated 9/26/24) and official documents

-- Insert project record (assuming Liberty Hill project)
-- You'll need to replace the project_id with your actual project UUID
DO $$
DECLARE
    project_uuid UUID := 'YOUR_PROJECT_UUID_HERE'; -- Replace with actual project UUID
BEGIN

-- Insert Cabinet Vendors (Primary focus)
INSERT INTO vendors (project_id, company_name, category, status, notes, auto_track_emails) VALUES
(project_uuid, 'Kent Moore Cabinets Ltd', 'Cabinets', 'potential', 'UBuildIt Recommended - Cabinet specialist only', true),
(project_uuid, 'ProSource', 'Multi-Service', 'potential', 'UBuildIt Recommended - Cabinets, Hardware, Flooring, Countertops, Bath Hardware', true),
(project_uuid, 'High-Tech Flooring & Design', 'Multi-Service', 'potential', 'UBuildIt Recommended - Cabinets, Flooring, Countertops', true),
(project_uuid, 'Parrish & Company Inc.', 'Multi-Service', 'potential', 'UBuildIt Recommended - Appliances, Grill, Fireplace, Cabinets, Hardware', true);

-- Insert all other UBuildIt recommended vendors
INSERT INTO vendors (project_id, company_name, category, status, notes, auto_track_emails) VALUES
-- Lighting
(project_uuid, 'Builder Benefits Lighting Inc.', 'Lighting', 'potential', 'UBuildIt Recommended - Multiple locations, builder pricing, volume discounts', true),

-- Appliances
(project_uuid, 'FBS Appliance', 'Appliances', 'potential', 'UBuildIt Recommended - Statewide locations, dedicated teams', true),
(project_uuid, 'K&N Appliance Gallery', 'Appliances', 'potential', 'UBuildIt Recommended - Austin location', true),

-- Windows & Doors
(project_uuid, '84 Lumber', 'Windows/Doors', 'potential', 'UBuildIt Recommended - Windows, Interior-Exterior Doors, Trim', true),
(project_uuid, 'McCoy''s Building Supply', 'Building Materials', 'potential', 'UBuildIt Recommended - Windows, Doors, Trim, Lumber', true),
(project_uuid, 'Texas Door and Trim', 'Doors/Trim', 'potential', 'UBuildIt Recommended - Molding/Trim, Int/Ext Doors, Stairs', true),

-- Flooring
(project_uuid, 'Floor & Décor', 'Flooring', 'potential', 'UBuildIt Recommended - Over 1M sq ft in-stock, pro rewards', true),
(project_uuid, 'Craftsman Concrete Floors', 'Concrete Flooring', 'potential', 'UBuildIt Recommended - Concrete floor specialist', true),

-- Fireplaces
(project_uuid, 'Austin Contractor Services (ACS)', 'Fireplace/Outdoor', 'potential', 'UBuildIt Recommended - Fireplace, Gutters, Garage Doors, Outdoor Kitchen', true),
(project_uuid, 'Webco Fireplace Distributing', 'Fireplace', 'potential', 'UBuildIt Recommended - Fireplace specialist', true),

-- Masonry/Stone/Brick
(project_uuid, 'Acme Brick Company', 'Masonry', 'potential', 'UBuildIt Recommended - Brick supplier', true),
(project_uuid, 'South Texas Brick and Stone', 'Masonry', 'potential', 'UBuildIt Recommended - Brick and stone supplier', true),

-- Paint
(project_uuid, 'Sherwin-Williams', 'Paint', 'potential', 'UBuildIt Recommended - Paint supplier', true),

-- Specialty Glass
(project_uuid, 'Anchor Ventana', 'Specialty Glass', 'potential', 'UBuildIt Recommended - Builder pricing, shower doors, mirrors', true),

-- Fencing
(project_uuid, 'Viking Fence', 'Fencing', 'potential', 'UBuildIt Recommended - Fence and deck specialist', true),
(project_uuid, 'Nailhead Spur Company', 'Metal Fencing', 'potential', 'UBuildIt Recommended - Metal fencing and stairs', true),

-- Insulation/Garage Doors
(project_uuid, 'IBP Installed Building Products', 'Insulation/Garage Doors', 'potential', 'UBuildIt Recommended - Garage doors and insulation', true),

-- Home Automation
(project_uuid, 'Mesa Home Systems', 'Home Automation', 'potential', 'UBuildIt Recommended - Home automation, low voltage, AV, security', true),

-- Big Box Stores
(project_uuid, 'Home Depot', 'Building Materials', 'potential', 'UBuildIt Recommended - Multiple services, ProDesk account available', true);

END $$;

-- Insert contact details for all vendors
DO $$
DECLARE
    project_uuid UUID := 'YOUR_PROJECT_UUID_HERE'; -- Replace with actual project UUID
    vendor_uuid UUID;
BEGIN

-- Cabinet Vendors Contacts
SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Kent Moore Cabinets Ltd' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Kent Moore Cabinets Ltd', 'Contact Person', '512-836-0130', 'Sales', '8403 Cross Park Dr. 1A, Austin, Texas 78754');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'ProSource' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, email, phone, role, notes) VALUES
(project_uuid, 'vendor', 'ProSource', 'Brandi Norris', NULL, '512-836-7888 ext. 1488', 'Sales Representative', '2315 Rutland Ste 104, Austin, Texas 78758');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'High-Tech Flooring & Design' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'High-Tech Flooring & Design', 'Louis El-Deir', '512-834-0110', 'Contact', '15408 Long Vista Dr., Austin, Texas 78758');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Parrish & Company Inc.' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Parrish & Company Inc.', 'Rhonda Lewis', '512-835-0937', 'Sales', '3600 E. Old Settlers, Round Rock, Texas 78665');

-- Other Vendor Contacts
SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Builder Benefits Lighting Inc.' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Builder Benefits Lighting Inc.', 'Scott Baily', '512-491-0481', 'Austin Assigned Rep', '10401 N Burnet Rd., Austin, TX 78758');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'FBS Appliance' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'FBS Appliance', 'Adam Pina', '512-834-1442', 'Sales', '7816 Burnet Road, Austin, Texas 78758');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'K&N Appliance Gallery' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'K&N Appliance Gallery', 'Jared Parker', '512-566-4648', 'Sales', '7719 Burnet Rd. Ste A, Austin, TX 78757');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = '84 Lumber' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', '84 Lumber', 'Tim McPherron', '512-844-1458', 'Sales', '108 Madison Oaks Ave, Georgetown, TX 78626'),
(project_uuid, 'vendor', '84 Lumber', 'Jesus Garcia', '512-868-4484', 'Sales Coordinator', '108 Madison Oaks Ave, Georgetown, TX 78626');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'McCoy''s Building Supply' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'McCoy''s Building Supply', 'Justin Bernethy', '512-863-0865', 'Sales', '100 Leander Rd., Georgetown, TX 78626');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Texas Door and Trim' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Texas Door and Trim', 'Daniel Evans', '214-342-9393', 'Sales', '2120 Denton Drive 109, Austin, TX 78758');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Floor & Décor' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Floor & Décor', 'Kevin McDonald', '512-820-0785', 'Sales', '12901 N I35, Austin, TX 78753');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Craftsman Concrete Floors' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Craftsman Concrete Floors', 'Jeremy Cox', '512-593-0030', 'Contact', '312 Ashley Dawn Lane, Austin, TX 78704');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Austin Contractor Services (ACS)' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Austin Contractor Services (ACS)', 'Todd Weaver', '512-927-5045', 'Sales', '4300 Nixon Lane, Austin, TX 78725');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Webco Fireplace Distributing' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Webco Fireplace Distributing', 'Randy Pettis', '512-836-8476', 'Sales', '12012 N Lamar Blvd, Austin, TX 78753');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Acme Brick Company' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Acme Brick Company', 'Shawn McElroy', '512-244-7600', 'Sales', '631 Round Rock West Dr, Round Rock, Texas 78681');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'South Texas Brick and Stone' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'South Texas Brick and Stone', 'Hunter May', '737-205-5003', 'Sales', '2900 Oak Springs Dr, Austin, TX 78702');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Sherwin-Williams' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Sherwin-Williams', 'Kyle Rhodes', '512-639-1677', 'Sales', '2423 Williams Dr Ste 121, Georgetown, TX 78628');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Anchor Ventana' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Anchor Ventana', 'Carol George', '512-388-9400', 'Sales', '1609 Chisholm Trail #100, Round Rock, TX 78681');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Viking Fence' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Viking Fence', 'Ryan Frank', '512-294-3700', 'Sales', '9602 Gray Blvd, Austin, TX 78758');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Nailhead Spur Company' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Nailhead Spur Company', 'Robert', '512-588-6112', 'Sales', '1840 E. Polk St., Burnet, TX');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'IBP Installed Building Products' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'IBP Installed Building Products', 'Contact Person', '737-345-8076', 'Sales', '2013 Centimeter Circle B, Austin, TX 78758');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Mesa Home Systems' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Mesa Home Systems', 'Lloyd Bjorgo', '512-258-2599', 'Sales', '7304 Mcneil Dr Ste 504, Austin, TX 78729');

SELECT id INTO vendor_uuid FROM vendors WHERE company_name = 'Home Depot' AND project_id = project_uuid;
INSERT INTO contacts (project_id, type, company, name, phone, role, notes) VALUES
(project_uuid, 'vendor', 'Home Depot', 'ProDesk', '620-240-0901', 'ProDesk Account', 'Account #4057159000 - Nationwide locations');

END $$;
