import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db: Database.Database

export function initDB(): void {
  const dbPath = path.join(app.getPath('userData'), 'claims.db')
  db = new Database(dbPath)

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      card_number TEXT,
      age INTEGER,
      gender TEXT,
      location TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS pets (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      name TEXT NOT NULL,
      pedigree_number TEXT,
      species TEXT,
      breed TEXT,
      breed_type TEXT,
      gender TEXT,
      neutering_status TEXT,
      color TEXT,
      age INTEGER,
      weight REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS claim_images (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      doc_type TEXT,
      created_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      policy_number TEXT, card_number TEXT,
      client_name TEXT, client_age INTEGER, client_gender TEXT, location_of_residence TEXT,
      pet_name TEXT, pedigree_number TEXT, species TEXT, breed TEXT, breed_type TEXT,
      gender TEXT, neutering_status TEXT, color TEXT, age INTEGER, weight REAL,
      place_of_loss TEXT, diagnosis TEXT, medications TEXT, medicine_cost REAL,
      veterinary_services TEXT, service_cost REAL, vet_clinic TEXT,
      claim_type TEXT, status TEXT, missing_documents TEXT, stage TEXT, total_amount_paid REAL,
      -- Policy & Branch
      line_of_business TEXT, branch_code TEXT, branch TEXT, external_policy TEXT,
      date_issued TEXT, date_of_loss TEXT, date_reported TEXT, date_registered TEXT,
      inception_date TEXT, expiry_date TEXT, local_global TEXT, country TEXT,
      original_currency TEXT, year INTEGER,
      -- People & Agents
      client_no TEXT, master_client TEXT, claimant TEXT, payee TEXT,
      handler_code TEXT, handler_name TEXT, agent_code TEXT, agent_name TEXT,
      sub_agent_code TEXT, adj_provider_code TEXT, adj_provider_name TEXT, birthday TEXT,
      -- Financials
      basic_premium REAL, sum_insured REAL, net_reserve REAL, ri_reserve REAL,
      total_reserve REAL, insured_net_payment REAL, adj_provider_net_payment REAL,
      tp_claim_payment REAL, ri_payment REAL, total_payment REAL,
      total_net REAL, total_ri REAL, total_claim REAL,
      date_first_payment TEXT, date_last_payment TEXT,
      -- Filterable extras
      claim_reason TEXT, catastrophe TEXT, narrative TEXT,
      -- Misc JSON blob
      misc TEXT,
      created_at TEXT, updated_at TEXT, deleted_at TEXT
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS drive_links (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      web_view_link TEXT NOT NULL,
      mime_type TEXT,
      created_at TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS diagnosis_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS premium_plans (
      id TEXT PRIMARY KEY,
      species TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      coverage REAL NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `)

  migrate()
  seedData()
  seedDiagnosisTypesIfEmpty()
  seedPremiumPlansIfEmpty()
  seedProfilesFromClaimsIfEmpty()
}

function hasColumn(table: string, col: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return rows.some(r => r.name === col)
}

function migrate() {
  // Original migrations
  if (!hasColumn('claims', 'policy_number'))   db.exec(`ALTER TABLE claims ADD COLUMN policy_number TEXT`)
  if (!hasColumn('claims', 'card_number'))     db.exec(`ALTER TABLE claims ADD COLUMN card_number TEXT`)
  if (!hasColumn('claims', 'pedigree_number')) db.exec(`ALTER TABLE claims ADD COLUMN pedigree_number TEXT`)
  if (!hasColumn('claims', 'deleted_at'))      db.exec(`ALTER TABLE claims ADD COLUMN deleted_at TEXT`)
  if (!hasColumn('claim_images', 'doc_type'))  db.exec(`ALTER TABLE claim_images ADD COLUMN doc_type TEXT`)
  if (!hasColumn('claim_images', 'deleted_at'))db.exec(`ALTER TABLE claim_images ADD COLUMN deleted_at TEXT`)
  if (!hasColumn('clients', 'deleted_at'))     db.exec(`ALTER TABLE clients ADD COLUMN deleted_at TEXT`)
  if (!hasColumn('pets', 'deleted_at'))        db.exec(`ALTER TABLE pets ADD COLUMN deleted_at TEXT`)

  // Policy & Branch
  const textCols = [
    'line_of_business','branch_code','branch','external_policy','date_issued','date_of_loss',
    'date_reported','date_registered','inception_date','expiry_date','local_global','country',
    'original_currency','client_no','master_client','claimant','payee','handler_code',
    'handler_name','agent_code','agent_name','sub_agent_code','adj_provider_code',
    'adj_provider_name','birthday','date_first_payment','date_last_payment',
    'claim_reason','catastrophe','narrative','misc',
  ]
  const realCols = [
    'basic_premium','sum_insured','net_reserve','ri_reserve','total_reserve',
    'insured_net_payment','adj_provider_net_payment','tp_claim_payment','ri_payment',
    'total_payment','total_net','total_ri','total_claim',
  ]
  for (const col of textCols) {
    if (!hasColumn('claims', col)) db.exec(`ALTER TABLE claims ADD COLUMN ${col} TEXT`)
  }
  for (const col of realCols) {
    if (!hasColumn('claims', col)) db.exec(`ALTER TABLE claims ADD COLUMN ${col} REAL`)
  }
  if (!hasColumn('claims', 'year')) db.exec(`ALTER TABLE claims ADD COLUMN year INTEGER`)
}

function getNextId(): string {
  const stmt = db.prepare("SELECT id FROM claims ORDER BY id DESC LIMIT 1")
  const last = stmt.get() as { id: string } | undefined
  if (!last) return 'CLM-0001'
  const num = parseInt(last.id.replace('CLM-', ''), 10) + 1
  return `CLM-${String(num).padStart(4, '0')}`
}

export function getClaims() {
  return db.prepare('SELECT * FROM claims WHERE deleted_at IS NULL ORDER BY created_at DESC').all()
}

// All writable claim columns (excludes id, created_at, updated_at, deleted_at)
const CLAIM_COLS = [
  'policy_number','card_number','client_name','client_age','client_gender','location_of_residence',
  'pet_name','pedigree_number','species','breed','breed_type','gender','neutering_status',
  'color','age','weight','place_of_loss','diagnosis','medications','medicine_cost',
  'veterinary_services','service_cost','vet_clinic','claim_type','status',
  'missing_documents','stage','total_amount_paid',
  'line_of_business','branch_code','branch','external_policy','date_issued','date_of_loss',
  'date_reported','date_registered','inception_date','expiry_date','local_global','country',
  'original_currency','year','client_no','master_client','claimant','payee',
  'handler_code','handler_name','agent_code','agent_name','sub_agent_code',
  'adj_provider_code','adj_provider_name','birthday','basic_premium','sum_insured',
  'net_reserve','ri_reserve','total_reserve','insured_net_payment','adj_provider_net_payment',
  'tp_claim_payment','ri_payment','total_payment','total_net','total_ri','total_claim',
  'date_first_payment','date_last_payment','claim_reason','catastrophe','narrative','misc',
] as const

export function createClaim(data: Record<string, unknown>) {
  const id = getNextId()
  const now = new Date().toISOString()
  const row: Record<string, unknown> = { id, ...data, created_at: (data.created_at as string) || now, updated_at: now, deleted_at: null }
  const cols = ['id', ...CLAIM_COLS, 'created_at', 'updated_at', 'deleted_at']
  db.prepare(
    `INSERT INTO claims (${cols.join(', ')}) VALUES (${cols.map(c => `@${c}`).join(', ')})`
  ).run(row)
  return id
}

export function updateClaim(id: string, data: Record<string, unknown>) {
  const now = new Date().toISOString()
  const row: Record<string, unknown> = { id, ...data, updated_at: now }
  const set = CLAIM_COLS.map(c => `${c}=@${c}`).join(', ')
  db.prepare(`UPDATE claims SET ${set}, updated_at=@updated_at WHERE id=@id`).run(row)
}

export function deleteClaim(id: string) {
  const now = new Date().toISOString()
  db.prepare('UPDATE claims SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, id)
  // Soft-delete images too (keep files so we can restore)
  db.prepare('UPDATE claim_images SET deleted_at = ? WHERE claim_id = ?').run(now, id)
}

export function restoreClaim(id: string) {
  const now = new Date().toISOString()
  const info = db.prepare('UPDATE claims SET deleted_at = NULL, updated_at = ? WHERE id = ?').run(now, id)
  if (info.changes === 0) throw new Error(`Claim not found: ${id}`)
  db.prepare('UPDATE claim_images SET deleted_at = NULL WHERE claim_id = ?').run(id)
}

export function getClients() {
  return db.prepare('SELECT * FROM clients WHERE deleted_at IS NULL ORDER BY updated_at DESC').all()
}

export function createClient(data: Record<string, unknown>) {
  const id = cryptoId('CLI')
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO clients (id, name, card_number, age, gender, location, created_at, updated_at, deleted_at)
    VALUES (@id, @name, @card_number, @age, @gender, @location, @created_at, @updated_at, NULL)
  `).run({
    id,
    name: data.name ?? '',
    card_number: data.card_number ?? '',
    age: data.age ?? 0,
    gender: data.gender ?? '',
    location: data.location ?? '',
    created_at: now,
    updated_at: now,
  })
  return id
}

export function updateClient(id: string, data: Record<string, unknown>, prevMatch?: { name?: string; location?: string }) {
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE clients SET
      name=@name,
      card_number=@card_number,
      age=@age,
      gender=@gender,
      location=@location,
      updated_at=@updated_at
    WHERE id=@id
  `).run({
    id,
    name: data.name ?? '',
    card_number: data.card_number ?? '',
    age: data.age ?? 0,
    gender: data.gender ?? '',
    location: data.location ?? '',
    updated_at: now,
  })

  // Keep claims-derived masterlists in sync when editing profile clients.
  if (prevMatch?.name && prevMatch?.location) {
    db.prepare(`
      UPDATE claims SET
        client_name=@client_name,
        card_number=@card_number,
        client_age=@client_age,
        client_gender=@client_gender,
        location_of_residence=@location_of_residence,
        updated_at=@updated_at
      WHERE client_name=@prev_name AND location_of_residence=@prev_location
    `).run({
      client_name: data.name ?? '',
      card_number: data.card_number ?? '',
      client_age: data.age ?? 0,
      client_gender: data.gender ?? '',
      location_of_residence: data.location ?? '',
      updated_at: now,
      prev_name: prevMatch.name,
      prev_location: prevMatch.location,
    })
  }
}

export function deleteClient(id: string) {
  const now = new Date().toISOString()
  db.prepare('UPDATE clients SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, id)
}

export function restoreClient(id: string) {
  const now = new Date().toISOString()
  const info = db.prepare('UPDATE clients SET deleted_at = NULL, updated_at = ? WHERE id = ?').run(now, id)
  if (info.changes === 0) throw new Error(`Client not found: ${id}`)
}

export function getPets() {
  return db.prepare('SELECT * FROM pets WHERE deleted_at IS NULL ORDER BY updated_at DESC').all()
}

export function createPet(data: Record<string, unknown>) {
  const id = cryptoId('PET')
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO pets (
      id, client_id, name, pedigree_number, species, breed, breed_type, gender,
      neutering_status, color, age, weight, created_at, updated_at, deleted_at
    ) VALUES (
      @id, @client_id, @name, @pedigree_number, @species, @breed, @breed_type, @gender,
      @neutering_status, @color, @age, @weight, @created_at, @updated_at, NULL
    )
  `).run({
    id,
    client_id: data.client_id ?? null,
    name: data.name ?? '',
    pedigree_number: data.pedigree_number ?? '',
    species: data.species ?? '',
    breed: data.breed ?? '',
    breed_type: data.breed_type ?? '',
    gender: data.gender ?? '',
    neutering_status: data.neutering_status ?? '',
    color: data.color ?? '',
    age: data.age ?? 0,
    weight: data.weight ?? 0,
    created_at: now,
    updated_at: now,
  })
  return id
}

export function updatePet(id: string, data: Record<string, unknown>, prevMatch?: { name?: string; species?: string; breed?: string }) {
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE pets SET
      client_id=@client_id,
      name=@name,
      pedigree_number=@pedigree_number,
      species=@species,
      breed=@breed,
      breed_type=@breed_type,
      gender=@gender,
      neutering_status=@neutering_status,
      color=@color,
      age=@age,
      weight=@weight,
      updated_at=@updated_at
    WHERE id=@id
  `).run({
    id,
    client_id: data.client_id ?? null,
    name: data.name ?? '',
    pedigree_number: data.pedigree_number ?? '',
    species: data.species ?? '',
    breed: data.breed ?? '',
    breed_type: data.breed_type ?? '',
    gender: data.gender ?? '',
    neutering_status: data.neutering_status ?? '',
    color: data.color ?? '',
    age: data.age ?? 0,
    weight: data.weight ?? 0,
    updated_at: now,
  })

  // Keep claims-derived masterlists in sync when editing profile pets.
  if (prevMatch?.name && prevMatch?.species && prevMatch?.breed) {
    db.prepare(`
      UPDATE claims SET
        pet_name=@pet_name,
        pedigree_number=@pedigree_number,
        species=@species,
        breed=@breed,
        breed_type=@breed_type,
        gender=@gender,
        neutering_status=@neutering_status,
        color=@color,
        age=@age,
        weight=@weight,
        updated_at=@updated_at
      WHERE pet_name=@prev_name AND species=@prev_species AND breed=@prev_breed
    `).run({
      pet_name: data.name ?? '',
      pedigree_number: data.pedigree_number ?? '',
      species: data.species ?? '',
      breed: data.breed ?? '',
      breed_type: data.breed_type ?? '',
      gender: data.gender ?? '',
      neutering_status: data.neutering_status ?? '',
      color: data.color ?? '',
      age: data.age ?? 0,
      weight: data.weight ?? 0,
      updated_at: now,
      prev_name: prevMatch.name,
      prev_species: prevMatch.species,
      prev_breed: prevMatch.breed,
    })
  }
}

export function deletePet(id: string) {
  const now = new Date().toISOString()
  db.prepare('UPDATE pets SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, id)
}

export function restorePet(id: string) {
  const now = new Date().toISOString()
  const info = db.prepare('UPDATE pets SET deleted_at = NULL, updated_at = ? WHERE id = ?').run(now, id)
  if (info.changes === 0) throw new Error(`Pet not found: ${id}`)
}

export function addClaimImage(data: { id: string; claim_id: string; filename: string; filepath: string; doc_type?: string }) {
  db.prepare('INSERT INTO claim_images (id, claim_id, filename, filepath, doc_type, created_at, deleted_at) VALUES (@id, @claim_id, @filename, @filepath, @doc_type, @created_at, NULL)')
    .run({ ...data, created_at: new Date().toISOString() })
}

export function getClaimImages(claimId: string) {
  return db.prepare('SELECT * FROM claim_images WHERE claim_id = ? AND deleted_at IS NULL ORDER BY created_at ASC').all(claimId) as { id: string; claim_id: string; filename: string; filepath: string; doc_type?: string; created_at: string }[]
}

export function deleteClaimImage(id: string): string | undefined {
  const row = db.prepare('SELECT filepath FROM claim_images WHERE id = ?').get(id) as { filepath: string } | undefined
  const now = new Date().toISOString()
  db.prepare('UPDATE claim_images SET deleted_at = ? WHERE id = ?').run(now, id)
  return row?.filepath
}

export function deleteClaimImagesByClaim(claimId: string): string[] {
  const rows = db.prepare('SELECT filepath FROM claim_images WHERE claim_id = ? AND deleted_at IS NULL').all(claimId) as { filepath: string }[]
  const now = new Date().toISOString()
  db.prepare('UPDATE claim_images SET deleted_at = ? WHERE claim_id = ?').run(now, claimId)
  return rows.map(r => r.filepath)
}

export function restoreClaimImage(id: string) {
  const info = db.prepare('UPDATE claim_images SET deleted_at = NULL WHERE id = ?').run(id)
  if (info.changes === 0) throw new Error(`Image not found: ${id}`)
}

export function addDriveLink(data: { id: string; claim_id: string; file_id: string; file_name: string; web_view_link: string; mime_type?: string }) {
  db.prepare('INSERT OR REPLACE INTO drive_links (id, claim_id, file_id, file_name, web_view_link, mime_type, created_at) VALUES (@id, @claim_id, @file_id, @file_name, @web_view_link, @mime_type, @created_at)')
    .run({ ...data, mime_type: data.mime_type ?? '', created_at: new Date().toISOString() })
}

export function getDriveLinks(claimId: string) {
  return db.prepare('SELECT * FROM drive_links WHERE claim_id = ? ORDER BY created_at ASC').all(claimId) as { id: string; claim_id: string; file_id: string; file_name: string; web_view_link: string; mime_type: string; created_at: string }[]
}

export function removeDriveLink(id: string) {
  db.prepare('DELETE FROM drive_links WHERE id = ?').run(id)
}

// ── Diagnosis Types ───────────────────────────────────────────────────────────

function getNextDiagnosisId(): string {
  const last = db.prepare("SELECT id FROM diagnosis_types ORDER BY id DESC LIMIT 1").get() as { id: string } | undefined
  if (!last) return 'DX-0001'
  const num = parseInt(last.id.replace('DX-', ''), 10) + 1
  return `DX-${String(num).padStart(4, '0')}`
}

export function getDiagnosisTypes() {
  return db.prepare('SELECT * FROM diagnosis_types WHERE deleted_at IS NULL ORDER BY category ASC, name ASC').all()
}

export function createDiagnosisType(data: { name: string; category?: string; description?: string }) {
  const id = getNextDiagnosisId()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO diagnosis_types (id, name, category, description, created_at, updated_at, deleted_at)
    VALUES (@id, @name, @category, @description, @created_at, @updated_at, NULL)
  `).run({ id, name: data.name, category: data.category ?? '', description: data.description ?? '', created_at: now, updated_at: now })
  return id
}

export function updateDiagnosisType(id: string, data: { name: string; category?: string; description?: string }) {
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE diagnosis_types SET name=@name, category=@category, description=@description, updated_at=@updated_at
    WHERE id=@id
  `).run({ id, name: data.name, category: data.category ?? '', description: data.description ?? '', updated_at: now })
}

export function deleteDiagnosisType(id: string) {
  const now = new Date().toISOString()
  db.prepare('UPDATE diagnosis_types SET deleted_at=?, updated_at=? WHERE id=?').run(now, now, id)
}

export function restoreDiagnosisType(id: string) {
  const now = new Date().toISOString()
  const info = db.prepare('UPDATE diagnosis_types SET deleted_at=NULL, updated_at=? WHERE id=?').run(now, id)
  if (info.changes === 0) throw new Error(`Diagnosis type not found: ${id}`)
}

export function getDeletedDiagnosisTypes() {
  return db.prepare('SELECT * FROM diagnosis_types WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all()
}

// ── Premium Plans ─────────────────────────────────────────────────────────────

function getNextPremiumPlanId(): string {
  const last = db.prepare("SELECT id FROM premium_plans ORDER BY id DESC LIMIT 1").get() as { id: string } | undefined
  if (!last) return 'PP-0001'
  const num = parseInt(last.id.replace('PP-', ''), 10) + 1
  return `PP-${String(num).padStart(4, '0')}`
}

export function getPremiumPlans() {
  return db.prepare('SELECT * FROM premium_plans WHERE deleted_at IS NULL ORDER BY species ASC, sort_order ASC, coverage ASC').all()
}

export function getDeletedPremiumPlans() {
  return db.prepare('SELECT * FROM premium_plans WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all()
}

export function createPremiumPlan(data: { species: string; plan_name: string; price: number; coverage: number; sort_order?: number }) {
  const id = getNextPremiumPlanId()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO premium_plans (id, species, plan_name, price, coverage, sort_order, created_at, updated_at, deleted_at)
    VALUES (@id, @species, @plan_name, @price, @coverage, @sort_order, @created_at, @updated_at, NULL)
  `).run({ id, species: data.species, plan_name: data.plan_name, price: data.price, coverage: data.coverage, sort_order: data.sort_order ?? 0, created_at: now, updated_at: now })
  return id
}

export function updatePremiumPlan(id: string, data: { species: string; plan_name: string; price: number; coverage: number; sort_order?: number }) {
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE premium_plans SET species=@species, plan_name=@plan_name, price=@price, coverage=@coverage, sort_order=@sort_order, updated_at=@updated_at
    WHERE id=@id
  `).run({ id, species: data.species, plan_name: data.plan_name, price: data.price, coverage: data.coverage, sort_order: data.sort_order ?? 0, updated_at: now })
}

export function deletePremiumPlan(id: string) {
  const now = new Date().toISOString()
  db.prepare('UPDATE premium_plans SET deleted_at=?, updated_at=? WHERE id=?').run(now, now, id)
}

export function restorePremiumPlan(id: string) {
  const now = new Date().toISOString()
  const info = db.prepare('UPDATE premium_plans SET deleted_at=NULL, updated_at=? WHERE id=?').run(now, id)
  if (info.changes === 0) throw new Error(`Premium plan not found: ${id}`)
}

function seedPremiumPlansIfEmpty() {
  const { c } = db.prepare('SELECT COUNT(*) as c FROM premium_plans').get() as { c: number }
  if (c > 0) return

  const now = new Date().toISOString()
  const plans = [
    { species: 'Cat', plan_name: 'Silver',   price: 1_467.71, coverage: 200_000, sort_order: 1 },
    { species: 'Cat', plan_name: 'Gold',     price: 2_637.45, coverage: 500_000, sort_order: 2 },
    { species: 'Cat', plan_name: 'Platinum', price: 3_187.45, coverage: 1_000_000, sort_order: 3 },
    { species: 'Dog', plan_name: 'Silver',   price: 1_467.71, coverage: 200_000, sort_order: 1 },
    { species: 'Dog', plan_name: 'Gold',     price: 3_874.70, coverage: 500_000, sort_order: 2 },
    { species: 'Dog', plan_name: 'Platinum', price: 6_908.02, coverage: 1_000_000, sort_order: 3 },
  ]

  const insert = db.prepare(`
    INSERT INTO premium_plans (id, species, plan_name, price, coverage, sort_order, created_at, updated_at, deleted_at)
    VALUES (@id, @species, @plan_name, @price, @coverage, @sort_order, @created_at, @updated_at, NULL)
  `)

  db.transaction(() => {
    plans.forEach((p, i) => {
      insert.run({ id: `PP-${String(i + 1).padStart(4, '0')}`, ...p, created_at: now, updated_at: now })
    })
  })()
}

function seedData() {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM claims').get() as { count: number }
  if (count > 0) return

  const samples = [
    { policy_number: 'POL-100001', card_number: 'CARD-900001', pedigree_number: 'PED-0001', client_name: 'Maria Santos', client_age: 34, client_gender: 'Female', location_of_residence: 'Makati City', pet_name: 'Buddy', species: 'Dog', breed: 'Labrador', breed_type: 'Pure', gender: 'Male', neutering_status: 'Neutered', color: 'Yellow', age: 3, weight: 28.5, place_of_loss: 'Home', diagnosis: 'Hip Dysplasia', medications: 'Carprofen, Glucosamine', medicine_cost: 3500, veterinary_services: 'X-ray, Physical Therapy', service_cost: 8000, vet_clinic: 'Animal Medical Center', claim_type: 'Illness', status: 'Approved', missing_documents: '', stage: 'Completed', total_amount_paid: 11500,
      line_of_business: 'Pet Insurance', branch_code: 'BR-021', branch: 'Ortigas Branch', external_policy: 'EXT-POL-77881', date_issued: '2026-01-05', date_of_loss: '2026-02-10', date_reported: '2026-02-11', date_registered: '2026-02-11', inception_date: '2026-01-05', expiry_date: '2027-01-05', local_global: 'Local', country: 'Philippines', original_currency: 'PHP', year: 2026,
      client_no: 'CLI-120044', master_client: 'MC-90012', claimant: 'Maria Santos', payee: 'Animal Medical Center', handler_code: 'HND-0038', handler_name: 'Marvin Santos', agent_code: 'AG-1182', agent_name: 'Ana Reyes', sub_agent_code: 'SUB-044', adj_provider_code: 'ADJ-009', adj_provider_name: 'Prime Adjusters Inc', birthday: '1992-08-14',
      basic_premium: 6500, sum_insured: 100000, net_reserve: 15000, ri_reserve: 5000, total_reserve: 20000, insured_net_payment: 0, adj_provider_net_payment: 0, tp_claim_payment: 0, ri_payment: 0, total_payment: 0, total_net: 0, total_ri: 0, total_claim: 0,
      date_first_payment: '', date_last_payment: '', claim_reason: 'Illness', catastrophe: 'No', narrative: 'Hip discomfort and reduced mobility over 2 weeks.',
      misc: JSON.stringify({ imei_number: '358240051111110', airline: '', aon_event: 'AON-REF-2026-11', travel_sum_insured: 0, catastrophe_code: '', claimant_count: 1, last_diary_entry: '2026-02-14', diary_description: 'Follow up scheduled; awaiting rehab plan.' }),
    },
    { client_name: 'Jose Reyes', client_age: 45, client_gender: 'Male', location_of_residence: 'Quezon City', pet_name: 'Whiskers', species: 'Cat', breed: 'Persian', breed_type: 'Pure', gender: 'Female', neutering_status: 'Spayed', color: 'White', age: 5, weight: 4.2, place_of_loss: 'Vet Clinic', diagnosis: 'Urinary Tract Infection', medications: 'Antibiotics, Urinary Support', medicine_cost: 1800, veterinary_services: 'Urinalysis, Ultrasound', service_cost: 3500, vet_clinic: 'Pasig Veterinary Clinic', claim_type: 'Illness', status: 'Pending', missing_documents: 'Lab Results', stage: 'Under Review', total_amount_paid: 0 },
    { client_name: 'Ana Cruz', client_age: 28, client_gender: 'Female', location_of_residence: 'Taguig City', pet_name: 'Max', species: 'Dog', breed: 'German Shepherd', breed_type: 'Pure', gender: 'Male', neutering_status: 'Intact', color: 'Black and Tan', age: 2, weight: 32.0, place_of_loss: 'Park', diagnosis: 'Fracture - Right Foreleg', medications: 'Pain Medication, Calcium', medicine_cost: 5000, veterinary_services: 'Surgery, Cast, X-ray', service_cost: 25000, vet_clinic: 'BGC Pet Hospital', claim_type: 'Accident', status: 'Open', missing_documents: 'Surgical Report, Receipt', stage: 'Document Collection', total_amount_paid: 0 },
    { client_name: 'Pedro Lim', client_age: 52, client_gender: 'Male', location_of_residence: 'Mandaluyong', pet_name: 'Luna', species: 'Dog', breed: 'Shih Tzu', breed_type: 'Pure', gender: 'Female', neutering_status: 'Spayed', color: 'Brown and White', age: 7, weight: 5.8, place_of_loss: 'Home', diagnosis: 'Dental Disease', medications: 'Antibiotics', medicine_cost: 1200, veterinary_services: 'Dental Cleaning, Extraction', service_cost: 6500, vet_clinic: 'Mandaluyong Pet Clinic', claim_type: 'Dental', status: 'Approved', missing_documents: '', stage: 'Completed', total_amount_paid: 7700 },
    { client_name: 'Rosa Garcia', client_age: 31, client_gender: 'Female', location_of_residence: 'Pasig City', pet_name: 'Nemo', species: 'Cat', breed: 'Siamese', breed_type: 'Pure', gender: 'Male', neutering_status: 'Neutered', color: 'Cream with Dark Points', age: 4, weight: 3.8, place_of_loss: 'Vet Clinic', diagnosis: 'Respiratory Infection', medications: 'Antibiotics, Nebulization', medicine_cost: 2200, veterinary_services: 'Chest X-ray, Nebulization', service_cost: 4500, vet_clinic: 'Pasig Animal Clinic', claim_type: 'Illness', status: 'Denied', missing_documents: 'Pre-existing Condition', stage: 'Closed', total_amount_paid: 0 },
    { client_name: 'Carlo Mendoza', client_age: 39, client_gender: 'Male', location_of_residence: 'Paranaque', pet_name: 'Rocky', species: 'Dog', breed: 'Bulldog', breed_type: 'Pure', gender: 'Male', neutering_status: 'Neutered', color: 'Brindle', age: 4, weight: 22.0, place_of_loss: 'Park', diagnosis: 'Skin Allergy', medications: 'Antihistamine, Medicated Shampoo', medicine_cost: 900, veterinary_services: 'Skin Test, Consultation', service_cost: 2500, vet_clinic: 'South Vet Clinic', claim_type: 'Illness', status: 'Pending', missing_documents: 'Allergy Test Results', stage: 'Under Review', total_amount_paid: 0 },
    { client_name: 'Diana Torres', client_age: 26, client_gender: 'Female', location_of_residence: 'Las Pinas', pet_name: 'Mochi', species: 'Dog', breed: 'Pomeranian', breed_type: 'Pure', gender: 'Female', neutering_status: 'Spayed', color: 'Orange', age: 1, weight: 2.5, place_of_loss: 'Home', diagnosis: 'Parvovirus', medications: 'IV Fluids, Antiviral', medicine_cost: 8000, veterinary_services: 'Hospitalization, IV Therapy', service_cost: 15000, vet_clinic: 'Las Pinas Pet Hospital', claim_type: 'Illness', status: 'Approved', missing_documents: '', stage: 'Completed', total_amount_paid: 23000 },
    { client_name: 'Ryan Dela Cruz', client_age: 44, client_gender: 'Male', location_of_residence: 'Muntinlupa', pet_name: 'Cleo', species: 'Cat', breed: 'Domestic Shorthair', breed_type: 'Mixed', gender: 'Female', neutering_status: 'Spayed', color: 'Tabby', age: 6, weight: 4.0, place_of_loss: 'Home', diagnosis: 'Kidney Disease', medications: 'Renal Diet, Phosphate Binder', medicine_cost: 3500, veterinary_services: 'Blood Work, Ultrasound, Consultation', service_cost: 7500, vet_clinic: 'Alabang Vet Clinic', claim_type: 'Illness', status: 'Open', missing_documents: 'Blood Work Results', stage: 'Document Collection', total_amount_paid: 0 },
    { client_name: 'Lisa Aquino', client_age: 37, client_gender: 'Female', location_of_residence: 'Caloocan', pet_name: 'Benji', species: 'Dog', breed: 'Beagle', breed_type: 'Pure', gender: 'Male', neutering_status: 'Intact', color: 'Tricolor', age: 5, weight: 12.0, place_of_loss: 'Street', diagnosis: 'Dog Bite Wound', medications: 'Antibiotics, Rabies Vaccine', medicine_cost: 2800, veterinary_services: 'Wound Care, Sutures', service_cost: 5500, vet_clinic: 'Caloocan Animal Clinic', claim_type: 'Accident', status: 'Approved', missing_documents: '', stage: 'Completed', total_amount_paid: 8300 },
    { client_name: 'Mark Villanueva', client_age: 48, client_gender: 'Male', location_of_residence: 'Valenzuela', pet_name: 'Simba', species: 'Cat', breed: 'Maine Coon', breed_type: 'Pure', gender: 'Male', neutering_status: 'Neutered', color: 'Brown Tabby', age: 3, weight: 6.5, place_of_loss: 'Home', diagnosis: 'Feline Infectious Peritonitis', medications: 'GS-441524, Immunosuppressants', medicine_cost: 45000, veterinary_services: 'Multiple Consultations, Blood Work', service_cost: 12000, vet_clinic: 'Valenzuela Pet Center', claim_type: 'Illness', status: 'Pending', missing_documents: 'FIP Test Results', stage: 'Under Review', total_amount_paid: 0 },
    { client_name: 'Grace Bautista', client_age: 29, client_gender: 'Female', location_of_residence: 'Marikina', pet_name: 'Daisy', species: 'Dog', breed: 'Golden Retriever', breed_type: 'Pure', gender: 'Female', neutering_status: 'Spayed', color: 'Golden', age: 4, weight: 26.0, place_of_loss: 'Park', diagnosis: 'ACL Tear', medications: 'Anti-inflammatory, Pain Meds', medicine_cost: 4200, veterinary_services: 'MRI, TPLO Surgery', service_cost: 45000, vet_clinic: 'Marikina Vet Specialists', claim_type: 'Accident', status: 'Open', missing_documents: 'MRI Report', stage: 'Document Collection', total_amount_paid: 0 },
    { client_name: 'Victor Ong', client_age: 55, client_gender: 'Male', location_of_residence: 'San Juan', pet_name: 'Pepper', species: 'Dog', breed: 'Dachshund', breed_type: 'Pure', gender: 'Male', neutering_status: 'Intact', color: 'Black and Tan', age: 8, weight: 8.5, place_of_loss: 'Home', diagnosis: 'IVDD - Intervertebral Disc Disease', medications: 'Steroids, Pain Meds', medicine_cost: 6800, veterinary_services: 'MRI, Spinal Surgery', service_cost: 55000, vet_clinic: 'San Juan Animal Hospital', claim_type: 'Illness', status: 'Approved', missing_documents: '', stage: 'Completed', total_amount_paid: 61800 }
  ]

  const stmt = db.prepare(`
    INSERT INTO claims (
      id, policy_number, card_number,
      client_name, client_age, client_gender, location_of_residence,
      pet_name, pedigree_number, species, breed, breed_type, gender, neutering_status, color, age, weight,
      place_of_loss, diagnosis, medications, medicine_cost, veterinary_services, service_cost,
      vet_clinic, claim_type, status, missing_documents, stage, total_amount_paid,
      line_of_business, branch_code, branch, external_policy,
      date_issued, date_of_loss, date_reported, date_registered,
      inception_date, expiry_date, local_global, country, original_currency, year,
      client_no, master_client, claimant, payee,
      handler_code, handler_name, agent_code, agent_name, sub_agent_code,
      adj_provider_code, adj_provider_name, birthday,
      basic_premium, sum_insured, net_reserve, ri_reserve, total_reserve,
      insured_net_payment, adj_provider_net_payment, tp_claim_payment, ri_payment,
      total_payment, total_net, total_ri, total_claim,
      date_first_payment, date_last_payment, claim_reason, catastrophe, narrative, misc,
      created_at, updated_at
    ) VALUES (
      @id, @policy_number, @card_number,
      @client_name, @client_age, @client_gender, @location_of_residence,
      @pet_name, @pedigree_number, @species, @breed, @breed_type, @gender, @neutering_status, @color, @age, @weight,
      @place_of_loss, @diagnosis, @medications, @medicine_cost, @veterinary_services, @service_cost,
      @vet_clinic, @claim_type, @status, @missing_documents, @stage, @total_amount_paid,
      @line_of_business, @branch_code, @branch, @external_policy,
      @date_issued, @date_of_loss, @date_reported, @date_registered,
      @inception_date, @expiry_date, @local_global, @country, @original_currency, @year,
      @client_no, @master_client, @claimant, @payee,
      @handler_code, @handler_name, @agent_code, @agent_name, @sub_agent_code,
      @adj_provider_code, @adj_provider_name, @birthday,
      @basic_premium, @sum_insured, @net_reserve, @ri_reserve, @total_reserve,
      @insured_net_payment, @adj_provider_net_payment, @tp_claim_payment, @ri_payment,
      @total_payment, @total_net, @total_ri, @total_claim,
      @date_first_payment, @date_last_payment, @claim_reason, @catastrophe, @narrative, @misc,
      @created_at, @updated_at
    )
  `)

  db.transaction(() => {
    samples.forEach((s, i) => {
      const id = `CLM-${String(i + 1).padStart(4, '0')}`
      const d = new Date()
      d.setDate(d.getDate() - Math.floor(Math.random() * 180))
      const ts = d.toISOString()
      stmt.run({
        // defaults for optional columns so the sample rows look filled in Data Downloads
        line_of_business: 'Pet Insurance',
        branch_code: '',
        branch: '',
        external_policy: '',
        date_issued: '',
        date_of_loss: '',
        date_reported: '',
        date_registered: '',
        inception_date: '',
        expiry_date: '',
        local_global: 'Local',
        country: 'Philippines',
        original_currency: 'PHP',
        year: new Date().getFullYear(),
        client_no: '',
        master_client: '',
        claimant: '',
        payee: '',
        handler_code: '',
        handler_name: '',
        agent_code: '',
        agent_name: '',
        sub_agent_code: '',
        adj_provider_code: '',
        adj_provider_name: '',
        birthday: '',
        basic_premium: 0,
        sum_insured: 0,
        net_reserve: 0,
        ri_reserve: 0,
        total_reserve: 0,
        insured_net_payment: 0,
        adj_provider_net_payment: 0,
        tp_claim_payment: 0,
        ri_payment: 0,
        total_payment: 0,
        total_net: 0,
        total_ri: 0,
        total_claim: 0,
        date_first_payment: '',
        date_last_payment: '',
        claim_reason: '',
        catastrophe: '',
        narrative: '',
        misc: '',
        ...s,
        id,
        created_at: ts,
        updated_at: ts,
      })
    })
  })()
}

function seedDiagnosisTypesIfEmpty() {
  // Seed a baseline set if there are no ACTIVE diagnosis types.
  // This is safer than checking total rows because users may have deleted everything.
  const { a } = db.prepare('SELECT COUNT(*) as a FROM diagnosis_types WHERE deleted_at IS NULL').get() as { a: number }
  if (a > 0) return

  const now = new Date().toISOString()
  const samples: { name: string; category: string; description: string }[] = [
    { name: 'Urinary Tract Infection', category: 'Urinary', description: 'Bacterial infection affecting bladder/urinary tract; dysuria, frequency.' },
    { name: 'Kidney Disease', category: 'Urinary', description: 'Renal insufficiency; chronic or acute; may require labs and imaging.' },
    { name: 'Respiratory Infection', category: 'Respiratory', description: 'Upper/lower respiratory infection; coughing, sneezing, discharge.' },
    { name: 'Gastroenteritis', category: 'Digestive', description: 'Vomiting/diarrhea due to infection, diet, or toxins; supportive care.' },
    { name: 'Parvovirus', category: 'Digestive', description: 'Severe viral enteritis in dogs; dehydration, vomiting, diarrhea.' },
    { name: 'Dental Disease', category: 'Dental', description: 'Periodontal disease; scaling, extraction, oral medications.' },
    { name: 'Skin Allergy', category: 'Skin / Dermatology', description: 'Atopic dermatitis or allergy; itching, rash; may need testing.' },
    { name: 'Ear Infection (Otitis)', category: 'Skin / Dermatology', description: 'External ear canal infection/inflammation; cleaning and meds.' },
    { name: 'Fracture', category: 'Accident', description: 'Bone fracture requiring imaging, immobilization, or surgery.' },
    { name: 'Laceration / Wound', category: 'Accident', description: 'Cuts/bites requiring wound care, sutures, antibiotics.' },
    { name: 'Dog Bite Wound', category: 'Accident', description: 'Traumatic bite wound; cleaning, antibiotics, possible surgery.' },
    { name: 'Hip Dysplasia', category: 'Orthopedic', description: 'Developmental joint disease; pain, lameness; may need surgery.' },
    { name: 'ACL / CCL Tear', category: 'Orthopedic', description: 'Ligament rupture in knee; instability; surgical repair often indicated.' },
    { name: 'Arthritis / Osteoarthritis', category: 'Orthopedic', description: 'Degenerative joint disease; long-term pain management.' },
    { name: 'Seizure Disorder', category: 'Neurological', description: 'Recurrent seizures; workup and anticonvulsants.' },
    { name: 'Heartworm Disease', category: 'Parasitic', description: 'Parasitic infection; diagnostics and staged treatment.' },
    { name: 'Tick-borne Disease', category: 'Parasitic', description: 'Ehrlichia/Anaplasma etc.; fever, thrombocytopenia; antibiotics.' },
    { name: 'Heat Stroke', category: 'Accident', description: 'Hyperthermia emergency; cooling and supportive treatment.' },
    { name: 'Pyometra', category: 'Reproductive', description: 'Uterine infection; urgent surgery often required.' },
    { name: 'Cataract', category: 'Ophthalmologic', description: 'Lens opacity; may require ophthalmology and surgery.' },
    { name: 'Conjunctivitis', category: 'Ophthalmologic', description: 'Eye inflammation/infection; topical meds and evaluation.' },
    { name: 'Cardiac Murmur', category: 'Cardiac', description: 'Heart murmur; evaluation and possible chronic meds.' },
    { name: 'Pancreatitis', category: 'Digestive', description: 'Inflammation of pancreas; vomiting, pain; hospitalization possible.' },
    { name: 'Diabetes Mellitus', category: 'Other', description: 'Endocrine disorder; insulin therapy and monitoring.' },
  ]

  const findByName = db.prepare('SELECT id, deleted_at FROM diagnosis_types WHERE name = ? LIMIT 1')
  const restoreById = db.prepare('UPDATE diagnosis_types SET deleted_at = NULL, updated_at = ? WHERE id = ?')
  const insert = db.prepare(`
    INSERT INTO diagnosis_types (id, name, category, description, created_at, updated_at, deleted_at)
    VALUES (@id, @name, @category, @description, @created_at, @updated_at, NULL)
  `)

  db.transaction(() => {
    samples.forEach(s => {
      const existing = findByName.get(s.name) as { id: string; deleted_at: string | null } | undefined
      if (existing?.id) {
        if (existing.deleted_at) restoreById.run(now, existing.id)
        return
      }

      const id = getNextDiagnosisId()
      insert.run({ id, ...s, created_at: now, updated_at: now })
    })
  })()
}

function cryptoId(prefix: string) {
  // Avoid importing crypto in this file; sqlite ids can be simple.
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`
}

function seedProfilesFromClaimsIfEmpty() {
  const { c } = db.prepare('SELECT COUNT(*) as c FROM clients').get() as { c: number }
  const { p } = db.prepare('SELECT COUNT(*) as p FROM pets').get() as { p: number }
  if (c > 0 && p > 0) return

  const now = new Date().toISOString()

  // Seed clients
  if (c === 0) {
    const rows = db.prepare(`
      SELECT
        client_name as name,
        MAX(COALESCE(card_number, '')) as card_number,
        MAX(COALESCE(client_age, 0)) as age,
        MAX(COALESCE(client_gender, '')) as gender,
        MAX(COALESCE(location_of_residence, '')) as location
      FROM claims
      WHERE COALESCE(client_name, '') <> ''
      GROUP BY client_name, location_of_residence
    `).all() as { name: string; card_number: string; age: number; gender: string; location: string }[]

    const insert = db.prepare(`
      INSERT INTO clients (id, name, card_number, age, gender, location, created_at, updated_at)
      VALUES (@id, @name, @card_number, @age, @gender, @location, @created_at, @updated_at)
    `)

    db.transaction(() => {
      rows.forEach(r => {
        insert.run({
          id: cryptoId('CLI'),
          name: r.name,
          card_number: r.card_number || '',
          age: r.age || 0,
          gender: r.gender || '',
          location: r.location || '',
          created_at: now,
          updated_at: now,
        })
      })
    })()
  }

  // Seed pets
  if (p === 0) {
    const rows = db.prepare(`
      SELECT
        pet_name as name,
        MAX(COALESCE(pedigree_number, '')) as pedigree_number,
        MAX(COALESCE(species, '')) as species,
        MAX(COALESCE(breed, '')) as breed,
        MAX(COALESCE(breed_type, '')) as breed_type,
        MAX(COALESCE(gender, '')) as gender,
        MAX(COALESCE(neutering_status, '')) as neutering_status,
        MAX(COALESCE(color, '')) as color,
        MAX(COALESCE(age, 0)) as age,
        MAX(COALESCE(weight, 0)) as weight
      FROM claims
      WHERE COALESCE(pet_name, '') <> ''
      GROUP BY pet_name, client_name, species, breed
    `).all() as {
      name: string
      pedigree_number: string
      species: string
      breed: string
      breed_type: string
      gender: string
      neutering_status: string
      color: string
      age: number
      weight: number
    }[]

    const insert = db.prepare(`
      INSERT INTO pets (
        id, client_id, name, pedigree_number, species, breed, breed_type, gender,
        neutering_status, color, age, weight, created_at, updated_at
      ) VALUES (
        @id, @client_id, @name, @pedigree_number, @species, @breed, @breed_type, @gender,
        @neutering_status, @color, @age, @weight, @created_at, @updated_at
      )
    `)

    db.transaction(() => {
      rows.forEach(r => {
        insert.run({
          id: cryptoId('PET'),
          client_id: null,
          name: r.name,
          pedigree_number: r.pedigree_number || '',
          species: r.species || '',
          breed: r.breed || '',
          breed_type: r.breed_type || '',
          gender: r.gender || '',
          neutering_status: r.neutering_status || '',
          color: r.color || '',
          age: r.age || 0,
          weight: r.weight || 0,
          created_at: now,
          updated_at: now,
        })
      })
    })()
  }
}
