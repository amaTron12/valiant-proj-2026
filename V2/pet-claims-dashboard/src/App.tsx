import React, { useState } from 'react'
import Dashboard from './pages/Dashboard'
import { MOCK_CLAIMS } from './mockData'
import { Claim, DiagnosisType } from './types'
import { AuthProvider, useAuth } from './auth/AuthContext'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ErrorBoundary from './components/ErrorBoundary'

// In browser preview mode (no Electron), wire up an in-memory mock API
if (typeof window !== 'undefined' && !window.api) {
  const store: Claim[] = [...MOCK_CLAIMS]
  let counter = store.length + 1
  const clientsStore: Window['api'] extends { getClients(): Promise<infer T> } ? T : never = [] as never
  const petsStore: Window['api'] extends { getPets(): Promise<infer T> } ? T : never = [] as never
  const now = new Date().toISOString()
  const diagnosisStore: DiagnosisType[] = [
    { id: 'DX-0001', name: 'Urinary Tract Infection', category: 'Urinary', description: 'Bacterial infection affecting bladder/urinary tract; dysuria, frequency.', created_at: now, updated_at: now, deleted_at: null },
    { id: 'DX-0002', name: 'Kidney Disease', category: 'Urinary', description: 'Renal insufficiency; chronic or acute; may require labs and imaging.', created_at: now, updated_at: now, deleted_at: null },
    { id: 'DX-0003', name: 'Respiratory Infection', category: 'Respiratory', description: 'Upper/lower respiratory infection; coughing, sneezing, discharge.', created_at: now, updated_at: now, deleted_at: null },
    { id: 'DX-0004', name: 'Gastroenteritis', category: 'Digestive', description: 'Vomiting/diarrhea due to infection, diet, or toxins; supportive care.', created_at: now, updated_at: now, deleted_at: null },
    { id: 'DX-0005', name: 'Parvovirus', category: 'Digestive', description: 'Severe viral enteritis in dogs; dehydration, vomiting, diarrhea.', created_at: now, updated_at: now, deleted_at: null },
    { id: 'DX-0006', name: 'Dental Disease', category: 'Dental', description: 'Periodontal disease; scaling, extraction, oral medications.', created_at: now, updated_at: now, deleted_at: null },
    { id: 'DX-0007', name: 'Skin Allergy', category: 'Skin / Dermatology', description: 'Atopic dermatitis or allergy; itching, rash; may need testing.', created_at: now, updated_at: now, deleted_at: null },
    { id: 'DX-0008', name: 'Fracture', category: 'Accident', description: 'Bone fracture requiring imaging, immobilization, or surgery.', created_at: now, updated_at: now, deleted_at: null },
    { id: 'DX-0009', name: 'Hip Dysplasia', category: 'Orthopedic', description: 'Developmental joint disease; pain, lameness; may need surgery.', created_at: now, updated_at: now, deleted_at: null },
    { id: 'DX-0010', name: 'Seizure Disorder', category: 'Neurological', description: 'Recurrent seizures; workup and anticonvulsants.', created_at: now, updated_at: now, deleted_at: null },
  ]

  ;(window as unknown as { api: Window['api'] }).api = {
    getClaims: () => Promise.resolve(store.filter(c => !c.deleted_at).map(c => ({ ...c }))),
    createClaim: (data) => {
      const id = `CLM-${String(counter++).padStart(4, '0')}`
      const now = new Date().toISOString()
      store.unshift({ ...data, id, created_at: now, updated_at: now, deleted_at: null } as Claim)
      return Promise.resolve(id)
    },
    updateClaim: (id, data) => {
      const i = store.findIndex(c => c.id === id)
      if (i !== -1) store[i] = { ...store[i], ...data, updated_at: new Date().toISOString() }
      return Promise.resolve()
    },
    deleteClaim: (id) => {
      const i = store.findIndex(c => c.id === id)
      if (i !== -1) store[i] = { ...store[i], deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      return Promise.resolve()
    },
    restoreClaim: (id) => {
      const i = store.findIndex(c => c.id === id)
      if (i !== -1) store[i] = { ...store[i], deleted_at: null, updated_at: new Date().toISOString() }
      return Promise.resolve()
    },
    getClients: () => Promise.resolve([...(clientsStore as unknown as any[])]),
    createClient: () => Promise.resolve(`CLI-${Math.random().toString(36).slice(2, 8).toUpperCase()}`),
    updateClient: () => Promise.resolve(),
    deleteClient: () => Promise.resolve(),
    restoreClient: () => Promise.resolve(),
    getPets: () => Promise.resolve([...(petsStore as unknown as any[])]),
    createPet: () => Promise.resolve(`PET-${Math.random().toString(36).slice(2, 8).toUpperCase()}`),
    updatePet: () => Promise.resolve(),
    deletePet: () => Promise.resolve(),
    restorePet: () => Promise.resolve(),
    getClaimImages: () => Promise.resolve([]),
    pickClaimImages: () => Promise.resolve([]),
    deleteClaimImage: () => Promise.resolve(),
    restoreClaimImage: () => Promise.resolve(),
    gdriveSaveCreds: () => Promise.resolve(),
    gdriveStatus: () => Promise.resolve({ hasCredentials: false, connected: false }),
    gdriveConnect: () => Promise.resolve({ success: false, error: 'Not available in web mode' }),
    gdriveDisconnect: () => Promise.resolve(),
    gdriveListFiles: () => Promise.resolve([]),
    gdriveOpenFile: () => Promise.resolve(),
    gdriveLinkFile: () => Promise.resolve(),
    gdriveGetLinks: () => Promise.resolve([]),
    gdriveUnlinkFile: () => Promise.resolve(),
    gdriveListFolders: () => Promise.resolve([]),
    gdriveListFolderFiles: () => Promise.resolve([]),
    gdriveDownloadFile: () => Promise.resolve({ dataUrl: '', mimeType: '' }),
    gdriveSaveFolder: () => Promise.resolve(),
    gdriveGetFolder: () => Promise.resolve(null),
    getDiagnosisTypes: () => Promise.resolve(diagnosisStore.filter(d => !d.deleted_at).map(d => ({ ...d }))),
    getDeletedDiagnosisTypes: () => Promise.resolve(diagnosisStore.filter(d => !!d.deleted_at).map(d => ({ ...d }))),
    createDiagnosisType: (data) => {
      const lastNum = diagnosisStore
        .map(d => Number(String(d.id).split('-')[1] ?? '0'))
        .filter(n => Number.isFinite(n))
        .reduce((m, n) => Math.max(m, n), 0)
      const id = `DX-${String(lastNum + 1).padStart(4, '0')}`
      const ts = new Date().toISOString()
      const row: DiagnosisType = {
        id,
        name: String((data as any)?.name ?? ''),
        category: String((data as any)?.category ?? ''),
        description: String((data as any)?.description ?? ''),
        created_at: ts,
        updated_at: ts,
        deleted_at: null,
      }
      diagnosisStore.unshift(row)
      return Promise.resolve(id)
    },
    updateDiagnosisType: (id, data) => {
      const i = diagnosisStore.findIndex(d => d.id === id)
      if (i !== -1) {
        diagnosisStore[i] = {
          ...diagnosisStore[i],
          name: String((data as any)?.name ?? diagnosisStore[i].name),
          category: String((data as any)?.category ?? diagnosisStore[i].category),
          description: String((data as any)?.description ?? diagnosisStore[i].description),
          updated_at: new Date().toISOString(),
        }
      }
      return Promise.resolve()
    },
    deleteDiagnosisType: (id) => {
      const i = diagnosisStore.findIndex(d => d.id === id)
      if (i !== -1) diagnosisStore[i] = { ...diagnosisStore[i], deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      return Promise.resolve()
    },
    restoreDiagnosisType: (id) => {
      const i = diagnosisStore.findIndex(d => d.id === id)
      if (i !== -1) diagnosisStore[i] = { ...diagnosisStore[i], deleted_at: null, updated_at: new Date().toISOString() }
      return Promise.resolve()
    },
    getPremiumPlans: () => Promise.resolve([]),
    getDeletedPremiumPlans: () => Promise.resolve([]),
    createPremiumPlan: () => Promise.resolve('PP-0001'),
    updatePremiumPlan: () => Promise.resolve(),
    deletePremiumPlan: () => Promise.resolve(),
    restorePremiumPlan: () => Promise.resolve(),
  }
}

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
    </AuthProvider>
  )
}

function AppShell() {
  const { user } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  if (!user) {
    return mode === 'login'
      ? <LoginPage onGoSignup={() => setMode('signup')} />
      : <SignupPage onGoLogin={() => setMode('login')} />
  }

  return <Dashboard />
}
