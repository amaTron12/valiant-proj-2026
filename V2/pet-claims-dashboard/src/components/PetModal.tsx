import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Pet } from '../types'

const EMPTY: Omit<Pet, 'id' | 'created_at' | 'updated_at'> = {
  client_id: null,
  name: '',
  pedigree_number: '',
  species: '',
  breed: '',
  breed_type: 'Pure',
  gender: 'Male',
  neutering_status: 'Intact',
  color: '',
  age: 0,
  weight: 0,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

export default function PetModal({
  pet,
  onSave,
  onClose,
}: {
  pet?: Pet | null
  onSave: (data: Omit<Pet, 'id' | 'created_at' | 'updated_at'>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Omit<Pet, 'id' | 'created_at' | 'updated_at'>>(EMPTY)

  useEffect(() => {
    if (pet) {
      const { id, created_at, updated_at, ...rest } = pet
      setForm(rest)
    } else {
      setForm(EMPTY)
    }
  }, [pet])

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">{pet ? `Edit Pet ${pet.id}` : 'New Pet'}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSave(form) }} className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pet Name">
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <Field label="Pedigree #">
              <input
                value={form.pedigree_number}
                onChange={e => setForm(f => ({ ...f, pedigree_number: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <Field label="Species">
              <input
                value={form.species}
                onChange={e => setForm(f => ({ ...f, species: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <Field label="Breed">
              <input
                value={form.breed}
                onChange={e => setForm(f => ({ ...f, breed: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <Field label="Breed Type">
              <select
                value={form.breed_type}
                onChange={e => setForm(f => ({ ...f, breed_type: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {['Pure', 'Mixed', 'Unknown'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Gender">
              <select
                value={form.gender}
                onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {['Male', 'Female'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Neutering Status">
              <select
                value={form.neutering_status}
                onChange={e => setForm(f => ({ ...f, neutering_status: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {['Intact', 'Neutered', 'Spayed'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Color">
              <input
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <Field label="Age (yr)">
              <input
                type="number"
                value={form.age}
                onChange={e => setForm(f => ({ ...f, age: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <Field label="Weight (kg)">
              <input
                type="number"
                value={form.weight}
                onChange={e => setForm(f => ({ ...f, weight: parseFloat(e.target.value) || 0 }))}
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
              {pet ? 'Save Changes' : 'Create Pet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

