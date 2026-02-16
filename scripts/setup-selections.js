/**
 * Selections Table Setup Script
 * Creates the selections table and populates with verified fixture data
 *
 * Usage: node scripts/setup-selections.js
 */

const { Client } = require('pg')

const CONNECTION_STRING = 'postgresql://postgres.gyhrvtwtptcxedhokplv:IloveD%40lache1@aws-0-us-east-1.pooler.supabase.com:6543/postgres'

async function run() {
  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected to Supabase')

  // Step 1: Create selections table
  console.log('\n--- Step 1: Create selections table ---')
  await client.query(`
    CREATE TABLE IF NOT EXISTS selections (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      room VARCHAR(100) NOT NULL,
      location_detail VARCHAR(255),
      category VARCHAR(50) NOT NULL,
      subcategory VARCHAR(100),
      product_name VARCHAR(255) NOT NULL,
      brand VARCHAR(100),
      collection VARCHAR(100),
      model_number VARCHAR(100),
      finish VARCHAR(100),
      color VARCHAR(100),
      material VARCHAR(100),
      quantity INTEGER DEFAULT 1,
      unit_price DECIMAL(10, 2),
      total_price DECIMAL(10, 2),
      price_source VARCHAR(255),
      status VARCHAR(30) DEFAULT 'selected',
      lead_time VARCHAR(50),
      order_date DATE,
      expected_delivery DATE,
      product_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  selections table created')

  // Step 2: Indexes
  console.log('\n--- Step 2: Indexes ---')
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_selections_project_id ON selections(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_selections_category ON selections(category)',
    'CREATE INDEX IF NOT EXISTS idx_selections_room ON selections(room)',
    'CREATE INDEX IF NOT EXISTS idx_selections_status ON selections(status)',
  ]
  for (const idx of indexes) {
    await client.query(idx)
  }
  console.log(`  Created ${indexes.length} indexes`)

  // Step 3: Trigger
  console.log('\n--- Step 3: Trigger ---')
  await client.query(`DROP TRIGGER IF EXISTS update_selections_updated_at ON selections`)
  await client.query(`
    CREATE TRIGGER update_selections_updated_at
    BEFORE UPDATE ON selections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `)
  console.log('  Trigger created')

  // Step 4: RLS
  console.log('\n--- Step 4: RLS ---')
  await client.query(`ALTER TABLE selections ENABLE ROW LEVEL SECURITY`)
  await client.query(`DROP POLICY IF EXISTS "Allow all access" ON selections`)
  await client.query(`CREATE POLICY "Allow all access" ON selections FOR ALL USING (true) WITH CHECK (true)`)
  console.log('  RLS configured')

  // Step 5: Get project ID
  console.log('\n--- Step 5: Populate data ---')
  const projectResult = await client.query(`SELECT id FROM projects LIMIT 1`)
  if (projectResult.rows.length === 0) {
    console.error('No project found! Run setup-database.js first.')
    await client.end()
    process.exit(1)
  }
  const projectId = projectResult.rows[0].id
  console.log(`  Project ID: ${projectId}`)

  // Clear existing selections for idempotency
  await client.query(`DELETE FROM selections WHERE project_id = $1`, [projectId])
  console.log('  Cleared existing selections')

  // Helper to insert a selection
  async function insert(sel) {
    const totalPrice = sel.total_price ?? (sel.unit_price ? sel.unit_price * (sel.quantity || 1) : null)
    await client.query(`
      INSERT INTO selections (
        project_id, room, location_detail, category, subcategory,
        product_name, brand, collection, model_number, finish, color, material,
        quantity, unit_price, total_price, price_source, status, lead_time,
        product_url, notes
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20
      )
    `, [
      projectId, sel.room, sel.location_detail || null, sel.category, sel.subcategory || null,
      sel.product_name, sel.brand || null, sel.collection || null, sel.model_number || null,
      sel.finish || null, sel.color || null, sel.material || null,
      sel.quantity || 1, sel.unit_price || null, totalPrice, sel.price_source || null,
      sel.status || 'selected', sel.lead_time || null,
      sel.product_url || null, sel.notes || null,
    ])
  }

  let count = 0

  // ============================================================
  // PLUMBING — NEWPORT BRASS JACOBEAN COLLECTION
  // Source: CONTRACTOR_Plumbing_Fixtures_List.csv
  // ============================================================

  // --- Kitchen Faucets ---
  await insert({ room: 'Kitchen', category: 'plumbing', subcategory: 'faucet', product_name: 'Pull-Down Kitchen Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2470-5103/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 754.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Kitchen', category: 'plumbing', subcategory: 'faucet', product_name: 'Pot Filler - Wall Mount', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2940-5503/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 987.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Pantry', category: 'plumbing', subcategory: 'faucet', product_name: 'Prep/Bar Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2470-5223/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 688.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  // --- Master Bath Shower (5 components) ---
  await insert({ room: 'Master Bath', location_detail: 'Shower', category: 'plumbing', subcategory: 'hand shower', product_name: 'Multifunction Hand Shower', brand: 'Newport Brass', collection: 'Jacobean', model_number: '280J/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 262.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Master Bath', location_detail: 'Shower', category: 'plumbing', subcategory: 'thermostatic rough', product_name: '1/2" Thermostatic Rough Valve', brand: 'Newport Brass', model_number: '1-595', quantity: 1, unit_price: 246.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Master Bath', location_detail: 'Shower', category: 'plumbing', subcategory: 'thermostatic trim', product_name: 'Thermostatic Trim Plate', brand: 'Newport Brass', collection: 'Jacobean', model_number: '3-2574TS/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 517.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Master Bath', location_detail: 'Shower', category: 'plumbing', subcategory: 'showerhead', product_name: 'Showerhead', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2144/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 182.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Master Bath', location_detail: 'Shower', category: 'plumbing', subcategory: 'shower arm', product_name: 'Shower Arm with Flange', brand: 'Newport Brass', model_number: '200-8101/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 105.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  // --- Bath 2 Shower (5 components) ---
  await insert({ room: 'Bath 2', location_detail: 'Shower', category: 'plumbing', subcategory: 'hand shower', product_name: 'Multifunction Hand Shower', brand: 'Newport Brass', collection: 'Jacobean', model_number: '280J/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 262.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 2', location_detail: 'Shower', category: 'plumbing', subcategory: 'thermostatic rough', product_name: '1/2" Thermostatic Rough Valve', brand: 'Newport Brass', model_number: '1-595', quantity: 1, unit_price: 246.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 2', location_detail: 'Shower', category: 'plumbing', subcategory: 'thermostatic trim', product_name: 'Thermostatic Trim Plate', brand: 'Newport Brass', collection: 'Jacobean', model_number: '3-2574TS/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 517.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 2', location_detail: 'Shower', category: 'plumbing', subcategory: 'showerhead', product_name: 'Showerhead', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2144/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 182.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 2', location_detail: 'Shower', category: 'plumbing', subcategory: 'shower arm', product_name: 'Shower Arm with Flange', brand: 'Newport Brass', model_number: '200-8101/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 105.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  // --- Bath 3 Shower (5 components) ---
  await insert({ room: 'Bath 3', location_detail: 'Shower', category: 'plumbing', subcategory: 'hand shower', product_name: 'Multifunction Hand Shower', brand: 'Newport Brass', collection: 'Jacobean', model_number: '280J/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 262.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 3', location_detail: 'Shower', category: 'plumbing', subcategory: 'thermostatic rough', product_name: '1/2" Thermostatic Rough Valve', brand: 'Newport Brass', model_number: '1-595', quantity: 1, unit_price: 246.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 3', location_detail: 'Shower', category: 'plumbing', subcategory: 'thermostatic trim', product_name: 'Thermostatic Trim Plate', brand: 'Newport Brass', collection: 'Jacobean', model_number: '3-2574TS/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 517.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 3', location_detail: 'Shower', category: 'plumbing', subcategory: 'showerhead', product_name: 'Showerhead', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2144/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 182.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 3', location_detail: 'Shower', category: 'plumbing', subcategory: 'shower arm', product_name: 'Shower Arm with Flange', brand: 'Newport Brass', model_number: '200-8101/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 105.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  // --- Bath 4 Shower (5 components) ---
  await insert({ room: 'Bath 4', location_detail: 'Shower', category: 'plumbing', subcategory: 'hand shower', product_name: 'Multifunction Hand Shower', brand: 'Newport Brass', collection: 'Jacobean', model_number: '280J/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 262.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 4', location_detail: 'Shower', category: 'plumbing', subcategory: 'thermostatic rough', product_name: '1/2" Thermostatic Rough Valve', brand: 'Newport Brass', model_number: '1-595', quantity: 1, unit_price: 246.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 4', location_detail: 'Shower', category: 'plumbing', subcategory: 'thermostatic trim', product_name: 'Thermostatic Trim Plate', brand: 'Newport Brass', collection: 'Jacobean', model_number: '3-2574TS/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 517.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 4', location_detail: 'Shower', category: 'plumbing', subcategory: 'showerhead', product_name: 'Showerhead', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2144/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 182.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 4', location_detail: 'Shower', category: 'plumbing', subcategory: 'shower arm', product_name: 'Shower Arm with Flange', brand: 'Newport Brass', model_number: '200-8101/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 105.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  // --- Powder Bath Shower (5 components) ---
  await insert({ room: 'Powder Bath', location_detail: 'Shower', category: 'plumbing', subcategory: 'hand shower', product_name: 'Multifunction Hand Shower', brand: 'Newport Brass', collection: 'Jacobean', model_number: '280J/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 262.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected', notes: 'Verify if powder bath has shower' })
  count++

  await insert({ room: 'Powder Bath', location_detail: 'Shower', category: 'plumbing', subcategory: 'thermostatic rough', product_name: '1/2" Thermostatic Rough Valve', brand: 'Newport Brass', model_number: '1-595', quantity: 1, unit_price: 246.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Powder Bath', location_detail: 'Shower', category: 'plumbing', subcategory: 'thermostatic trim', product_name: 'Thermostatic Trim Plate', brand: 'Newport Brass', collection: 'Jacobean', model_number: '3-2574TS/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 517.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Powder Bath', location_detail: 'Shower', category: 'plumbing', subcategory: 'showerhead', product_name: 'Showerhead', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2144/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 182.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Powder Bath', location_detail: 'Shower', category: 'plumbing', subcategory: 'shower arm', product_name: 'Shower Arm with Flange', brand: 'Newport Brass', model_number: '200-8101/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 105.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  console.log(`  ${count} shower components inserted`)

  // --- Vanity Faucets ---
  // Master Bath wall-mount x2
  await insert({ room: 'Master Bath', location_detail: 'Vanity - His', category: 'plumbing', subcategory: 'faucet', product_name: 'Wall Mount Lavatory Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '3-2561/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 574.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Master Bath', location_detail: 'Vanity - Hers', category: 'plumbing', subcategory: 'faucet', product_name: 'Wall Mount Lavatory Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '3-2561/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 574.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  // Master bath wall-mount rough-ins x2
  await insert({ room: 'Master Bath', location_detail: 'Vanity - His', category: 'plumbing', subcategory: 'rough-in valve', product_name: 'Wall Mount Lav Rough-In Valve', brand: 'Newport Brass', model_number: '1-684', quantity: 1, unit_price: 104.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Master Bath', location_detail: 'Vanity - Hers', category: 'plumbing', subcategory: 'rough-in valve', product_name: 'Wall Mount Lav Rough-In Valve', brand: 'Newport Brass', model_number: '1-684', quantity: 1, unit_price: 104.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  // Master bath stabilizer kit
  await insert({ room: 'Master Bath', category: 'plumbing', subcategory: 'accessory', product_name: 'Wall Mount Stabilizer Kit', brand: 'Newport Brass', model_number: '2-029/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 148.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  // Powder bath wall-mount faucet + rough-in
  await insert({ room: 'Powder Bath', location_detail: 'Vanity', category: 'plumbing', subcategory: 'faucet', product_name: 'Wall Mount Lavatory Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '3-2561/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 574.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Powder Bath', location_detail: 'Vanity', category: 'plumbing', subcategory: 'rough-in valve', product_name: 'Wall Mount Lav Rough-In Valve', brand: 'Newport Brass', model_number: '1-684', quantity: 1, unit_price: 104.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  // Bath 2, 3, 4 deck-mount faucets
  await insert({ room: 'Bath 2', location_detail: 'Vanity', category: 'plumbing', subcategory: 'faucet', product_name: 'Widespread Lavatory Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2420/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 449.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 3', location_detail: 'Vanity', category: 'plumbing', subcategory: 'faucet', product_name: 'Widespread Lavatory Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2420/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 449.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Bath 4', location_detail: 'Vanity', category: 'plumbing', subcategory: 'faucet', product_name: 'Widespread Lavatory Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2420/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 449.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  // --- Master Tub Filler ---
  await insert({ room: 'Master Bath', location_detail: 'Tub', category: 'plumbing', subcategory: 'tub filler', product_name: 'Floor Mount Tub Filler', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2480-4261/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 2155.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  await insert({ room: 'Master Bath', location_detail: 'Tub', category: 'plumbing', subcategory: 'tub filler riser', product_name: 'Floor Riser Kit', brand: 'Newport Brass', model_number: '282-01/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 474.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  count++

  console.log(`  ${count} plumbing fixtures inserted (NB faucets + tub)`)

  // ============================================================
  // SINKS
  // Source: Complete_Plumbing_Specification_with_Pricing.md
  // ============================================================

  // TOTO undermount lavatory sinks
  const totoLavRooms = ['Master Bath - His', 'Master Bath - Hers', 'Bath 2', 'Bath 3', 'Bath 4', 'Powder Bath']
  for (const room of totoLavRooms) {
    await insert({ room: room.includes('Master') ? 'Master Bath' : room, location_detail: room.includes('-') ? room.split(' - ')[1] + ' Vanity' : 'Vanity', category: 'plumbing', subcategory: 'sink', product_name: 'Undermount Lavatory Sink', brand: 'TOTO', model_number: 'LT193G#01', finish: 'Cotton White', quantity: 1, unit_price: 172.20, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: '17" x 14" undermount with CeFiONtect' })
    count++
  }

  // TOTO upgrade option
  await insert({ room: 'Master Bath', location_detail: 'Vanity Upgrade Option', category: 'plumbing', subcategory: 'sink', product_name: 'Undermount Lavatory Sink (Upgrade)', brand: 'TOTO', model_number: 'LT546G#01', finish: 'Cotton White', quantity: 2, unit_price: 273.00, price_source: 'TOTO_Lavatory_Sink_Options.md', status: 'considering', notes: '19" x 12-3/8" ADA compliant option' })
  count++

  // Franke farmhouse sinks
  await insert({ room: 'Kitchen', category: 'plumbing', subcategory: 'sink', product_name: 'Farmhouse Apron Front Sink', brand: 'Franke', model_number: 'SK18K62', finish: 'Stainless Steel', quantity: 1, unit_price: 1371.50, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: '18-gauge stainless farmhouse' })
  count++

  await insert({ room: 'Pantry', category: 'plumbing', subcategory: 'sink', product_name: 'Farmhouse Apron Front Sink', brand: 'Franke', model_number: 'SK18K62', finish: 'Stainless Steel', quantity: 1, unit_price: 1371.50, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: '18-gauge stainless farmhouse' })
  count++

  // Kingston Brass utility sinks
  await insert({ room: 'Laundry', category: 'plumbing', subcategory: 'sink', product_name: 'Utility Sink', brand: 'Kingston Brass', model_number: '?"', quantity: 1, unit_price: 1644.95, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: 'Laundry room utility sink' })
  count++

  await insert({ room: 'Classroom', category: 'plumbing', subcategory: 'sink', product_name: 'Utility Sink', brand: 'Kingston Brass', model_number: 'TBD', quantity: 1, unit_price: 1425.00, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: 'Classroom/craft room sink' })
  count++

  console.log(`  ${count} total (sinks added)`)

  // ============================================================
  // TOILETS
  // Source: Complete_Plumbing_Specification_with_Pricing.md
  // ============================================================

  // Master wall-hung TOTO + Washlet
  await insert({ room: 'Master Bath', category: 'plumbing', subcategory: 'toilet', product_name: 'Wall-Hung Toilet + Washlet S7A', brand: 'TOTO', model_number: 'CWT4284736CMFGA#MS', quantity: 1, unit_price: 3071.00, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: 'Includes in-wall tank system + S7A Washlet bidet seat' })
  count++

  // Floor-mount TOTO toilets
  const toiletRooms = ['Bath 2', 'Bath 3', 'Bath 4', 'Powder Bath']
  for (const room of toiletRooms) {
    await insert({ room, category: 'plumbing', subcategory: 'toilet', product_name: 'Two-Piece Elongated Toilet', brand: 'TOTO', model_number: 'CST642CEFGAT40#01', finish: 'Cotton White', quantity: 1, unit_price: 820.13, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: '1.28 GPF,DERA/WaterSense, ADA' })
    count++
  }

  console.log(`  ${count} total (toilets added)`)

  // ============================================================
  // TUB
  // ============================================================

  await insert({ room: 'Master Bath', category: 'plumbing', subcategory: 'bathtub', product_name: 'Coletta Freestanding Bathtub', brand: 'Aquatica', model_number: 'Coletta', material: 'Solid Surface', color: 'White', quantity: 1, unit_price: 8780.00, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: '71" freestanding soaking tub' })
  count++

  // ============================================================
  // WATER HEATER & UTILITY
  // ============================================================

  await insert({ room: 'Utility', category: 'plumbing', subcategory: 'water heater', product_name: 'Tankless Water Heater', brand: 'Rinnai', model_number: 'RXP199iN', quantity: 1, unit_price: 2500.00, price_source: 'Estimate', status: 'considering', notes: '199,000 BTU natural gas, indoor/outdoor' })
  count++

  await insert({ room: 'Utility', category: 'plumbing', subcategory: 'water softener', product_name: 'Water Softener System', brand: 'TBD', quantity: 1, status: 'considering', notes: 'Sizing depends on water hardness test results' })
  count++

  console.log(`  ${count} total (utility added)`)

  // ============================================================
  // LIGHTING
  // Source: CASE_Itemized_Plumbing_Lighting.csv
  // ============================================================

  await insert({ room: 'Kitchen', location_detail: 'Island', category: 'lighting', subcategory: 'chandelier', product_name: 'Vetivene 46.5" 8-Light Linear Chandelier', brand: 'Kichler', collection: 'Vetivene', finish: 'Natural Brass', quantity: 1, unit_price: 775.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'selected' })
  count++

  await insert({ room: 'Dining Room', category: 'lighting', subcategory: 'chandelier', product_name: 'Vetivene 29" 6-Light Chandelier', brand: 'Kichler', collection: 'Vetivene', finish: 'Natural Brass', quantity: 1, unit_price: 455.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'selected' })
  count++

  await insert({ room: 'Foyer', category: 'lighting', subcategory: 'chandelier', product_name: 'Vetivene 20" 3-Light Chandelier', brand: 'Kichler', collection: 'Vetivene', finish: 'Natural Brass', quantity: 1, unit_price: 270.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'selected' })
  count++

  await insert({ room: 'Master Bath', location_detail: 'Vanity Sconces', category: 'lighting', subcategory: 'sconce', product_name: 'Bisque 1-Light Wall Sconce', brand: 'Visual Comfort', finish: 'Satin Brass', quantity: 4, unit_price: 84.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'selected', notes: '2 per vanity, 4 total' })
  count++

  await insert({ room: 'Bath 2', location_detail: 'Vanity', category: 'lighting', subcategory: 'vanity light', product_name: 'Aiken 4-Light Bath Vanity', brand: 'Progress Lighting', collection: 'Aiken', finish: 'Vintage Brass', quantity: 1, unit_price: 210.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'selected' })
  count++

  // Bath 3 options
  await insert({ room: 'Bath 3', location_detail: 'Vanity - Option 1', category: 'lighting', subcategory: 'vanity light', product_name: 'Hansford 3-Light Bath Vanity', brand: 'Progress Lighting', collection: 'Hansford', finish: 'Vintage Brass', quantity: 1, unit_price: 186.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'considering', notes: 'Option 1 for Bath 3' })
  count++

  await insert({ room: 'Bath 3', location_detail: 'Vanity - Option 2', category: 'lighting', subcategory: 'vanity light', product_name: 'Aiken 4-Light Bath Vanity', brand: 'Progress Lighting', collection: 'Aiken', finish: 'Vintage Brass', quantity: 1, unit_price: 210.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'considering', notes: 'Option 2 for Bath 3' })
  count++

  // Bath 4 options
  await insert({ room: 'Bath 4', location_detail: 'Vanity - Option 1', category: 'lighting', subcategory: 'vanity light', product_name: 'Hansford 3-Light Bath Vanity', brand: 'Progress Lighting', collection: 'Hansford', finish: 'Vintage Brass', quantity: 1, unit_price: 186.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'considering', notes: 'Option 1 for Bath 4' })
  count++

  await insert({ room: 'Bath 4', location_detail: 'Vanity - Option 2', category: 'lighting', subcategory: 'vanity light', product_name: 'Aiken 4-Light Bath Vanity', brand: 'Progress Lighting', collection: 'Aiken', finish: 'Vintage Brass', quantity: 1, unit_price: 210.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'considering', notes: 'Option 2 for Bath 4' })
  count++

  // Powder bath sconces
  await insert({ room: 'Powder Bath', location_detail: 'Vanity', category: 'lighting', subcategory: 'sconce', product_name: 'Aiken 1-Light Wall Sconce', brand: 'Progress Lighting', collection: 'Aiken', finish: 'Vintage Brass', quantity: 2, unit_price: 145.50, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'selected', notes: '1 per side of mirror' })
  count++

  console.log(`  ${count} total (lighting added)`)

  // ============================================================
  // NOT YET SELECTED — Placeholder rows (status: 'considering')
  // ============================================================

  await insert({ room: 'Whole House', category: 'lighting', subcategory: 'recessed', product_name: 'Interior Recessed Cans', quantity: 72, status: 'considering', notes: 'Model TBD — 72 total per lighting plan' })
  count++

  await insert({ room: 'Exterior', category: 'lighting', subcategory: 'recessed', product_name: 'Outdoor Recessed Cans', quantity: 8, status: 'considering', notes: 'Model TBD — soffit/porch areas' })
  count++

  await insert({ room: 'Whole House', category: 'lighting', subcategory: 'sconce', product_name: 'Indoor Wall Sconces', quantity: 22, status: 'considering', notes: 'Model TBD — hallways, stairways, bedrooms' })
  count++

  await insert({ room: 'Exterior', category: 'lighting', subcategory: 'sconce', product_name: 'Outdoor Wall Sconces', quantity: 14, status: 'considering', notes: 'Model TBD — entry, patio, garage' })
  count++

  await insert({ room: 'Garage', category: 'lighting', subcategory: 'ceiling light', product_name: 'Garage Ceiling Lights', quantity: 4, status: 'considering', notes: 'Model TBD — LED shop/flush mount' })
  count++

  await insert({ room: 'Master Bath', category: 'plumbing', subcategory: 'towel warmer', product_name: 'Towel Warmer', quantity: 1, status: 'considering', notes: 'Brand/model TBD' })
  count++

  await insert({ room: 'Bath 2', category: 'plumbing', subcategory: 'towel warmer', product_name: 'Towel Warmer', quantity: 1, status: 'considering', notes: 'Brand/model TBD' })
  count++

  await insert({ room: 'Bath 3', category: 'plumbing', subcategory: 'towel warmer', product_name: 'Towel Warmer', quantity: 1, status: 'considering', notes: 'Brand/model TBD' })
  count++

  await insert({ room: 'Bath 4', category: 'plumbing', subcategory: 'towel warmer', product_name: 'Towel Warmer', quantity: 1, status: 'considering', notes: 'Brand/model TBD' })
  count++

  await insert({ room: 'Master Bath', category: 'plumbing', subcategory: 'steam generator', product_name: 'Steam Shower Generator', quantity: 1, status: 'considering', notes: 'Sizing depends on shower volume' })
  count++

  await insert({ room: 'Master Bath', category: 'plumbing', subcategory: 'heated floor', product_name: 'Heated Floor System', quantity: 1, status: 'considering', notes: 'Electric radiant mat' })
  count++

  await insert({ room: 'Bath 2', category: 'plumbing', subcategory: 'heated floor', product_name: 'Heated Floor System', quantity: 1, status: 'considering', notes: 'Electric radiant mat' })
  count++

  await insert({ room: 'Bath 3', category: 'plumbing', subcategory: 'heated floor', product_name: 'Heated Floor System', quantity: 1, status: 'considering', notes: 'Electric radiant mat' })
  count++

  await insert({ room: 'Bath 4', category: 'plumbing', subcategory: 'heated floor', product_name: 'Heated Floor System', quantity: 1, status: 'considering', notes: 'Electric radiant mat' })
  count++

  // Laundry/classroom faucets
  await insert({ room: 'Laundry', category: 'plumbing', subcategory: 'faucet', product_name: 'Laundry Faucet', brand: 'Kingston Brass', status: 'considering', notes: 'Considering Kingston Brass options' })
  count++

  await insert({ room: 'Classroom', category: 'plumbing', subcategory: 'faucet', product_name: 'Classroom Faucet', brand: 'Kingston Brass', status: 'considering', notes: 'Considering Kingston Brass options' })
  count++

  await insert({ room: 'Dog Wash', category: 'plumbing', subcategory: 'hand shower', product_name: 'Dog Wash Hand Shower', status: 'considering', notes: 'Need to select model — wall-mount hand shower recommended' })
  count++

  console.log(`\n  TOTAL: ${count} selections inserted`)

  // Verification
  console.log('\n--- Verification ---')
  const result = await client.query(`
    SELECT category, status, COUNT(*) as cnt, SUM(COALESCE(total_price, 0)) as total
    FROM selections WHERE project_id = $1
    GROUP BY category, status ORDER BY category, status
  `, [projectId])
  for (const row of result.rows) {
    console.log(`  ${row.category} [${row.status}]: ${row.cnt} items, $${parseFloat(row.total).toLocaleString()}`)
  }

  const totalResult = await client.query(`
    SELECT COUNT(*) as cnt, SUM(COALESCE(total_price, 0)) as total
    FROM selections WHERE project_id = $1
  `, [projectId])
  console.log(`\n  Grand total: ${totalResult.rows[0].cnt} selections, $${parseFloat(totalResult.rows[0].total).toLocaleString()}`)

  await client.end()
  console.log('\nSelections setup complete!')
}

run().catch(err => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
