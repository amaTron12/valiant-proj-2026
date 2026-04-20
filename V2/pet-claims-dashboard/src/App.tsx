import React from 'react'
import Dashboard from './pages/Dashboard'
import { MOCK_CLAIMS } from './mockData'
import { Claim } from './types'

// In browser preview mode (no Electron), wire up an in-memory mock API
if (typeof window !== 'undefined' && !window.api) {
  const store: Claim[] = [...MOCK_CLAIMS]
  let counter = store.length + 1

  ;(window as unknown as { api: Window['api'] }).api = {
    getClaims: () => Promise.resolve([...store]),
    createClaim: (data) => {
      const id = `CLM-${String(counter++).padStart(4, '0')}`
      const now = new Date().toISOString()
      store.unshift({ ...data, id, created_at: now, updated_at: now } as Claim)
      return Promise.resolve(id)
    },
    updateClaim: (id, data) => {
      const i = store.findIndex(c => c.id === id)
      if (i !== -1) store[i] = { ...store[i], ...data, updated_at: new Date().toISOString() }
      return Promise.resolve()
    },
    deleteClaim: (id) => {
      const i = store.findIndex(c => c.id === id)
      if (i !== -1) store.splice(i, 1)
      return Promise.resolve()
    }
  }
}

export default function App() {
  return <Dashboard />
}
