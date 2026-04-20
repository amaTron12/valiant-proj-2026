import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db: Database.Database

export function initDB(): void {
  const dbPath = path.join(app.getPath('userData'), 'claims.db')
  db = new Database(dbPath)

  db.exec(`
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      client_name TEXT,
      client_age INTEGER,
      client_gender TEXT,
      location_of_residence TEXT,
      pet_name TEXT,
      species TEXT,
      breed TEXT,
      breed_type TEXT,
      gender TEXT,
      neutering_status TEXT,
      color TEXT,
      age INTEGER,
      weight REAL,
      place_of_loss TEXT,
      diagnosis TEXT,
      medications TEXT,
      medicine_cost REAL,
      veterinary_services TEXT,
      service_cost REAL,
      vet_clinic TEXT,
      claim_type TEXT,
      status TEXT,
      missing_documents TEXT,
      stage TEXT,
      total_amount_paid REAL,
      created_at TEXT,
      updated_at TEXT
    )
  `)

  seedData()
}

function getNextId(): string {
  const stmt = db.prepare("SELECT id FROM claims ORDER BY id DESC LIMIT 1")
  const last = stmt.get() as { id: string } | undefined
  if (!last) return 'CLM-0001'
  const num = parseInt(last.id.replace('CLM-', ''), 10) + 1
  return `CLM-${String(num).padStart(4, '0')}`
}

export function getClaims() {
  return db.prepare('SELECT * FROM claims ORDER BY created_at DESC').all()
}

export function createClaim(data: Record<string, unknown>) {
  const id = getNextId()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO claims VALUES (
      @id,@client_name,@client_age,@client_gender,@location_of_residence,
      @pet_name,@species,@breed,@breed_type,@gender,@neutering_status,
      @color,@age,@weight,@place_of_loss,@diagnosis,@medications,
      @medicine_cost,@veterinary_services,@service_cost,@vet_clinic,
      @claim_type,@status,@missing_documents,@stage,@total_amount_paid,
      @created_at,@updated_at
    )
  `).run({ ...data, id, created_at: now, updated_at: now })
  return id
}

export function updateClaim(id: string, data: Record<string, unknown>) {
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE claims SET
      client_name=@client_name, client_age=@client_age, client_gender=@client_gender,
      location_of_residence=@location_of_residence, pet_name=@pet_name, species=@species,
      breed=@breed, breed_type=@breed_type, gender=@gender, neutering_status=@neutering_status,
      color=@color, age=@age, weight=@weight, place_of_loss=@place_of_loss,
      diagnosis=@diagnosis, medications=@medications, medicine_cost=@medicine_cost,
      veterinary_services=@veterinary_services, service_cost=@service_cost,
      vet_clinic=@vet_clinic, claim_type=@claim_type, status=@status,
      missing_documents=@missing_documents, stage=@stage,
      total_amount_paid=@total_amount_paid, updated_at=@updated_at
    WHERE id=@id
  `).run({ ...data, id, updated_at: now })
}

export function deleteClaim(id: string) {
  db.prepare('DELETE FROM claims WHERE id = ?').run(id)
}

function seedData() {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM claims').get() as { count: number }
  if (count > 0) return

  const samples = [
    { client_name: 'Maria Santos', client_age: 34, client_gender: 'Female', location_of_residence: 'Makati City', pet_name: 'Buddy', species: 'Dog', breed: 'Labrador', breed_type: 'Pure', gender: 'Male', neutering_status: 'Neutered', color: 'Yellow', age: 3, weight: 28.5, place_of_loss: 'Home', diagnosis: 'Hip Dysplasia', medications: 'Carprofen, Glucosamine', medicine_cost: 3500, veterinary_services: 'X-ray, Physical Therapy', service_cost: 8000, vet_clinic: 'Animal Medical Center', claim_type: 'Illness', status: 'Approved', missing_documents: '', stage: 'Completed', total_amount_paid: 11500 },
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
    INSERT INTO claims VALUES (
      @id,@client_name,@client_age,@client_gender,@location_of_residence,
      @pet_name,@species,@breed,@breed_type,@gender,@neutering_status,
      @color,@age,@weight,@place_of_loss,@diagnosis,@medications,
      @medicine_cost,@veterinary_services,@service_cost,@vet_clinic,
      @claim_type,@status,@missing_documents,@stage,@total_amount_paid,
      @created_at,@updated_at
    )
  `)

  db.transaction(() => {
    samples.forEach((s, i) => {
      const id = `CLM-${String(i + 1).padStart(4, '0')}`
      const d = new Date()
      d.setDate(d.getDate() - Math.floor(Math.random() * 180))
      const ts = d.toISOString()
      stmt.run({ ...s, id, created_at: ts, updated_at: ts })
    })
  })()
}
