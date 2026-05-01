import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import type { Client, Pet } from '../types'
import ClientModal from '../components/ClientModal'
import PetModal from '../components/PetModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'
import { addAuditEvent } from '../audit/audit'

type Tab = 'clients' | 'pets'

export default function ProfilesPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('clients')

  const [clients, setClients] = useState<Client[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')

  const [editClient, setEditClient] = useState<Client | null | undefined>(undefined)
  const [deleteClient, setDeleteClient] = useState<Client | null>(null)
  const [editPet, setEditPet] = useState<Pet | null | undefined>(undefined)
  const [deletePet, setDeletePet] = useState<Pet | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [c, p] = await Promise.all([window.api.getClients(), window.api.getPets()])
      setClients(c)
      setPets(p)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Allow Audit Trail to request a refresh after restore.
  useEffect(() => {
    const handler = () => { load() }
    document.addEventListener('refresh-profiles', handler)
    return () => document.removeEventListener('refresh-profiles', handler)
  }, [])

  const filteredClients = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return clients
    return clients.filter(c =>
      [c.id, c.name, c.card_number, c.gender, c.location].join(' ').toLowerCase().includes(query)
    )
  }, [clients, q])

  const filteredPets = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return pets
    return pets.filter(p =>
      [p.id, p.name, p.pedigree_number, p.species, p.breed, p.gender].join(' ').toLowerCase().includes(query)
    )
  }, [pets, q])

  async function saveClient(data: Omit<Client, 'id' | 'created_at' | 'updated_at'>) {
    if (editClient) await window.api.updateClient(editClient.id, data, { name: editClient.name, location: editClient.location })
    else await window.api.createClient(data)
    setEditClient(undefined)
    await load()
    document.dispatchEvent(new Event('refresh-claims'))
  }

  async function savePet(data: Omit<Pet, 'id' | 'created_at' | 'updated_at'>) {
    if (editPet) await window.api.updatePet(editPet.id, data, { name: editPet.name, species: editPet.species, breed: editPet.breed })
    else await window.api.createPet(data)
    setEditPet(undefined)
    await load()
    document.dispatchEvent(new Event('refresh-claims'))
  }

  async function confirmDeleteClient() {
    if (!deleteClient) return
    await window.api.deleteClient(deleteClient.id)
    if (user) addAuditEvent(user, { action: 'delete', entity: 'client', entityId: deleteClient.id, details: { name: deleteClient.name } })
    setDeleteClient(null)
    await load()
    document.dispatchEvent(new Event('refresh-claims'))
  }

  async function confirmDeletePet() {
    if (!deletePet) return
    await window.api.deletePet(deletePet.id)
    if (user) addAuditEvent(user, { action: 'delete', entity: 'pet', entityId: deletePet.id, details: { name: deletePet.name } })
    setDeletePet(null)
    await load()
    document.dispatchEvent(new Event('refresh-claims'))
  }

  return (
    <div className="p-6 space-y-4">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
        <h1 className="text-lg font-semibold text-slate-800">Profiles</h1>
        <p className="text-sm text-slate-500 mt-1">Manage Clients and Pets (add, edit, delete).</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 px-4 items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('clients')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === 'clients' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Clients
          </button>
          <button
            type="button"
            onClick={() => setTab('pets')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === 'pets' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Pets
          </button>

          <div className="ml-auto flex items-center gap-2 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder={`Search ${tab}…`}
                className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
              />
            </div>
            <button
              type="button"
              onClick={() => tab === 'clients' ? setEditClient(null) : setEditPet(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>
        </div>

        <div className="p-5">
          {tab === 'clients' && (
            <div className="overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Client ID', 'Name', 'Card ID Number', 'Age', 'Gender', 'Location', 'Updated', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
                  ) : filteredClients.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No clients</td></tr>
                  ) : filteredClients.map(c => (
                    <tr key={c.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{c.id}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">{c.name}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{c.card_number || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{c.age || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{c.gender || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{c.location || '—'}</td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{new Date(c.updated_at).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setEditClient(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setDeleteClient(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'pets' && (
            <div className="overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Pet ID', 'Name', 'Owner (Client ID)', 'Pedigree #', 'Species', 'Breed', 'Gender', 'Age', 'Updated', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
                  ) : filteredPets.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">No pets</td></tr>
                  ) : filteredPets.map(p => (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{p.id}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">{p.name}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{p.client_id || '—'}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{p.pedigree_number || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{p.species || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{p.breed || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{p.gender || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{p.age || '—'}</td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{new Date(p.updated_at).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setEditPet(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setDeletePet(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editClient !== undefined && tab === 'clients' && (
        <ClientModal client={editClient} onSave={saveClient} onClose={() => setEditClient(undefined)} />
      )}
      {deleteClient && (
        <ConfirmDialog
          title="Delete client?"
          message={`This will delete ${deleteClient.name}.`}
          onCancel={() => setDeleteClient(null)}
          onConfirm={confirmDeleteClient}
        />
      )}

      {editPet !== undefined && tab === 'pets' && (
        <PetModal pet={editPet} onSave={savePet} onClose={() => setEditPet(undefined)} />
      )}
      {deletePet && (
        <ConfirmDialog
          title="Delete pet?"
          message={`This will delete ${deletePet.name}.`}
          onCancel={() => setDeletePet(null)}
          onConfirm={confirmDeletePet}
        />
      )}
    </div>
  )
}

