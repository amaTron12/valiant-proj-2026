import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Client } from '../types'

const EMPTY: Omit<Client, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  card_number: '',
  age: 0,
  gender: 'Male',
  location: '',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

export default function ClientModal({
  client,
  onSave,
  onClose,
}: {
  client?: Client | null
  onSave: (data: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Omit<Client, 'id' | 'created_at' | 'updated_at'>>(EMPTY)

  useEffect(() => {
    if (client) {
      const { id, created_at, updated_at, ...rest } = client
      setForm(rest)
    } else {
      setForm(EMPTY)
    }
  }, [client])

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">{client ? `Edit Client ${client.id}` : 'New Client'}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); onSave(form) }}
          className="px-6 py-5 space-y-4"
        >
          <Field label="Client Name">
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Card ID Number">
              <input
                value={form.card_number}
                onChange={e => setForm(f => ({ ...f, card_number: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <Field label="Age">
              <input
                type="number"
                value={form.age}
                onChange={e => setForm(f => ({ ...f, age: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <Field label="Gender">
              <select
                value={form.gender}
                onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {['Male', 'Female', 'Other'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Location">
              <input
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {client ? 'Save Changes' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

