import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Claim } from '../types'

interface Props {
  claim?: Claim | null
  onSave: (data: Omit<Claim, 'id' | 'created_at' | 'updated_at'>) => void
  onClose: () => void
}

const EMPTY: Omit<Claim, 'id' | 'created_at' | 'updated_at'> = {
  client_name: '', client_age: 0, client_gender: 'Male', location_of_residence: '',
  pet_name: '', species: 'Dog', breed: '', breed_type: 'Pure', gender: 'Male',
  neutering_status: 'Intact', color: '', age: 0, weight: 0,
  place_of_loss: '', diagnosis: '', medications: '', medicine_cost: 0,
  veterinary_services: '', service_cost: 0,
  vet_clinic: '', claim_type: 'Illness', status: 'Open',
  missing_documents: '', stage: 'Document Collection', total_amount_paid: 0
}

type Tab = 'client' | 'pet' | 'claim' | 'admin'

const TABS: { key: Tab; label: string }[] = [
  { key: 'client', label: 'Client' },
  { key: 'pet', label: 'Pet' },
  { key: 'claim', label: 'Medical' },
  { key: 'admin', label: 'Admin' }
]

export default function ClaimModal({ claim, onSave, onClose }: Props) {
  const [form, setForm] = useState<Omit<Claim, 'id' | 'created_at' | 'updated_at'>>(EMPTY)
  const [tab, setTab] = useState<Tab>('client')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (claim) {
      const { id, created_at, updated_at, ...rest } = claim
      setForm(rest)
    } else {
      setForm(EMPTY)
    }
    setTab('client')
    setErrors({})
  }, [claim])

  const set = (k: keyof typeof form, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }))

  const num = (v: string) => parseFloat(v) || 0
  const int = (v: string) => parseInt(v) || 0

  function validate() {
    const e: Record<string, string> = {}
    if (!form.client_name.trim()) e.client_name = 'Required'
    if (!form.pet_name.trim()) e.pet_name = 'Required'
    if (!form.diagnosis.trim()) e.diagnosis = 'Required'
    if (!form.vet_clinic.trim()) e.vet_clinic = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    onSave(form)
  }

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )

  const inp = (k: keyof typeof form, type = 'text', placeholder = '') => (
    <input
      type={type}
      value={form[k] as string | number}
      onChange={e => set(k, type === 'number' ? (k === 'age' || k === 'client_age' ? int(e.target.value) : num(e.target.value)) : e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 text-sm rounded-lg border ${errors[k] ? 'border-red-300 bg-red-50' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
    />
  )

  const sel = (k: keyof typeof form, opts: string[]) => (
    <select
      value={form[k] as string}
      onChange={e => set(k, e.target.value)}
      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
    >
      {opts.map(o => <option key={o}>{o}</option>)}
    </select>
  )

  const textarea = (k: keyof typeof form, rows = 2) => (
    <textarea
      value={form[k] as string}
      onChange={e => set(k, e.target.value)}
      rows={rows}
      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
    />
  )

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            {claim ? `Edit ${claim.id}` : 'New Claim'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-6">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === 'client' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Client Name *" error={errors.client_name}>{inp('client_name', 'text', 'Full name')}</Field>
                </div>
                <Field label="Age">{inp('client_age', 'number')}</Field>
                <Field label="Gender">{sel('client_gender', ['Male', 'Female', 'Other'])}</Field>
                <div className="col-span-2">
                  <Field label="Location of Residence">{inp('location_of_residence', 'text', 'City / Address')}</Field>
                </div>
              </div>
            )}

            {tab === 'pet' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Pet Name *" error={errors.pet_name}>{inp('pet_name', 'text', 'Pet name')}</Field>
                <Field label="Species">{sel('species', ['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'])}</Field>
                <Field label="Breed">{inp('breed', 'text', 'Breed')}</Field>
                <Field label="Breed Type">{sel('breed_type', ['Pure', 'Mixed', 'Unknown'])}</Field>
                <Field label="Gender">{sel('gender', ['Male', 'Female'])}</Field>
                <Field label="Neutering Status">{sel('neutering_status', ['Intact', 'Neutered', 'Spayed'])}</Field>
                <Field label="Color">{inp('color', 'text', 'Color / Markings')}</Field>
                <Field label="Age (years)">{inp('age', 'number')}</Field>
                <Field label="Weight (kg)">{inp('weight', 'number')}</Field>
              </div>
            )}

            {tab === 'claim' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Diagnosis *" error={errors.diagnosis}>{inp('diagnosis', 'text', 'Primary diagnosis')}</Field>
                </div>
                <div className="col-span-2">
                  <Field label="Medications">{textarea('medications')}</Field>
                </div>
                <Field label="Medicine Cost (₱)">{inp('medicine_cost', 'number')}</Field>
                <div className="col-span-2">
                  <Field label="Veterinary Services">{textarea('veterinary_services')}</Field>
                </div>
                <Field label="Service Cost (₱)">{inp('service_cost', 'number')}</Field>
                <Field label="Place of Loss">{inp('place_of_loss', 'text', 'Where incident occurred')}</Field>
                <div className="col-span-2">
                  <Field label="Vet Clinic *" error={errors.vet_clinic}>{inp('vet_clinic', 'text', 'Clinic name')}</Field>
                </div>
              </div>
            )}

            {tab === 'admin' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Claim Type">{sel('claim_type', ['Illness', 'Accident', 'Dental', 'Wellness', 'Emergency', 'Other'])}</Field>
                <Field label="Status">{sel('status', ['Open', 'Pending', 'Approved', 'Denied'])}</Field>
                <Field label="Stage">{sel('stage', ['Document Collection', 'Under Review', 'Approved', 'Completed', 'Closed'])}</Field>
                <Field label="Total Amount Paid (₱)">{inp('total_amount_paid', 'number')}</Field>
                <div className="col-span-2">
                  <Field label="Missing Documents">{textarea('missing_documents')}</Field>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex gap-1">
              {TABS.map((t, i) => (
                <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className={`w-2 h-2 rounded-full transition-colors ${tab === t.key ? 'bg-blue-600' : 'bg-slate-200'}`}
                />
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                {claim ? 'Save Changes' : 'Create Claim'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
