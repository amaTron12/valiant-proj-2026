import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Edit2, Trash2, RotateCcw, PawPrint } from 'lucide-react'
import { PremiumPlan } from '../types'
import { useAuth } from '../auth/AuthContext'
import { addAuditEvent } from '../audit/audit'

const PLAN_NAMES = ['Silver', 'Gold', 'Platinum']
const SPECIES_LIST = ['Cat', 'Dog']

const PLAN_BADGE: Record<string, string> = {
  Silver:   'bg-slate-100 text-slate-600 border-slate-300',
  Gold:     'bg-amber-100 text-amber-700 border-amber-300',
  Platinum: 'bg-indigo-100 text-indigo-700 border-indigo-300',
}

const SPECIES_ICON_COLOR: Record<string, string> = {
  Cat: 'text-purple-500',
  Dog: 'text-blue-500',
}

interface FormState {
  species: string
  plan_name: string
  price: string
  coverage: string
  sort_order: string
}

const EMPTY_FORM: FormState = {
  species: 'Cat',
  plan_name: 'Silver',
  price: '',
  coverage: '',
  sort_order: '1',
}

function PlanModal({ plan, onSave, onClose }: {
  plan: PremiumPlan | null
  onSave: (data: FormState) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<FormState>(
    plan
      ? { species: plan.species, plan_name: plan.plan_name, price: String(plan.price), coverage: String(plan.coverage), sort_order: String(plan.sort_order) }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.species || !form.plan_name) { setError('Species and Plan Name are required.'); return }
    if (isNaN(Number(form.price)) || Number(form.price) < 0) { setError('Price must be a valid number.'); return }
    if (isNaN(Number(form.coverage)) || Number(form.coverage) <= 0) { setError('Coverage must be greater than 0.'); return }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">{plan ? 'Edit Plan' : 'Add Plan'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Species <span className="text-red-400">*</span></label>
              <select value={form.species} onChange={set('species')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {SPECIES_LIST.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Plan Name <span className="text-red-400">*</span></label>
              <select value={form.plan_name} onChange={set('plan_name')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {PLAN_NAMES.map(p => <option key={p}>{p}</option>)}
                <option value="Custom">Custom…</option>
              </select>
            </div>
          </div>

          {form.plan_name === 'Custom' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Custom Plan Name</label>
              <input
                type="text"
                value={form.plan_name === 'Custom' ? '' : form.plan_name}
                onChange={e => setForm(f => ({ ...f, plan_name: e.target.value }))}
                placeholder="e.g. Bronze, Diamond…"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Annual Premium Price (₱)</label>
            <input
              type="number" min="0" step="0.01"
              value={form.price} onChange={set('price')}
              placeholder="e.g. 1467.71"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Coverage Amount (₱)
              <span className="ml-2 font-normal text-slate-400">— max benefit per claim</span>
            </label>
            <input
              type="number" min="0" step="1"
              value={form.coverage} onChange={set('coverage')}
              placeholder="e.g. 200000"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 mt-1.5">
              {[200_000, 500_000, 1_000_000].map(v => (
                <button key={v} type="button"
                  onClick={() => setForm(f => ({ ...f, coverage: String(v) }))}
                  className="px-2 py-0.5 text-[10px] font-medium rounded border border-slate-200 text-slate-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                >
                  ₱{v.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sort Order</label>
            <input
              type="number" min="0"
              value={form.sort_order} onChange={set('sort_order')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">Lower = shown first. Silver=1, Gold=2, Platinum=3.</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-xs rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-40">
              {saving ? 'Saving…' : plan ? 'Save Changes' : 'Add Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PremiumsPage() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<PremiumPlan[]>([])
  const [deleted, setDeleted] = useState<PremiumPlan[]>([])
  const [editPlan, setEditPlan] = useState<PremiumPlan | null | undefined>(undefined)
  const [showTrash, setShowTrash] = useState(false)
  const [loading, setLoading] = useState(true)

  const fmt = (v: number) => `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  async function load() {
    setLoading(true)
    try {
      const [active, trash] = await Promise.all([
        window.api.getPremiumPlans(),
        window.api.getDeletedPremiumPlans(),
      ])
      setPlans(active)
      setDeleted(trash)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave(form: FormState) {
    const data = {
      species: form.species,
      plan_name: form.plan_name,
      price: Number(form.price) || 0,
      coverage: Number(form.coverage) || 0,
      sort_order: Number(form.sort_order) || 0,
    }
    if (editPlan) {
      await window.api.updatePremiumPlan(editPlan.id, data)
      if (user) addAuditEvent(user, { action: 'update', entity: 'premium_plan', entityId: editPlan.id })
    } else {
      const id = await window.api.createPremiumPlan(data)
      if (user) addAuditEvent(user, { action: 'create', entity: 'premium_plan', entityId: id })
    }
    setEditPlan(undefined)
    await load()
  }

  async function handleDelete(plan: PremiumPlan) {
    await window.api.deletePremiumPlan(plan.id)
    if (user) addAuditEvent(user, { action: 'delete', entity: 'premium_plan', entityId: plan.id })
    await load()
  }

  async function handleRestore(plan: PremiumPlan) {
    await window.api.restorePremiumPlan(plan.id)
    if (user) addAuditEvent(user, { action: 'restore', entity: 'premium_plan', entityId: plan.id })
    await load()
  }

  const catPlans = useMemo(() => plans.filter(p => p.species === 'Cat'), [plans])
  const dogPlans = useMemo(() => plans.filter(p => p.species === 'Dog'), [plans])

  function PlanTable({ species, rows }: { species: string; rows: PremiumPlan[] }) {
    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50">
          <PawPrint className={`w-4 h-4 ${SPECIES_ICON_COLOR[species] ?? 'text-slate-400'}`} />
          <span className="text-sm font-semibold text-slate-700">{species} Plans</span>
          <span className="ml-auto text-xs text-slate-400">{rows.length} plan{rows.length !== 1 ? 's' : ''}</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Plan</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Annual Premium</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Coverage</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-300">No plans — add one</td></tr>
            ) : rows.map(plan => (
              <tr key={plan.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${PLAN_BADGE[plan.plan_name] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {plan.plan_name}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-slate-700">{fmt(plan.price)}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-slate-800">{fmt(plan.coverage)}</span>
                  <span className="text-slate-400 ml-1">max</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditPlan(plan)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(plan)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Premium Plans</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage pet insurance plan tiers, prices, and coverage limits</p>
        </div>
        <button
          onClick={() => setEditPlan(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Plan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Plans', value: plans.length, color: 'text-slate-700' },
          { label: 'Cat Plans', value: catPlans.length, color: 'text-purple-600' },
          { label: 'Dog Plans', value: dogPlans.length, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Main plan tables */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-300 text-sm">Loading…</div>
        ) : (
          <div className="flex divide-x divide-slate-100">
            <PlanTable species="Cat" rows={catPlans} />
            <PlanTable species="Dog" rows={dogPlans} />
          </div>
        )}
      </div>

      {/* Trash */}
      {deleted.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowTrash(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-slate-400" />
              Archived Plans
              <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">{deleted.length}</span>
            </span>
            <span className="text-xs text-slate-400">{showTrash ? 'Hide' : 'Show'}</span>
          </button>

          {showTrash && (
            <div className="border-t border-slate-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Species</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Plan</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Price</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Coverage</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Restore</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {deleted.map(plan => (
                    <tr key={plan.id} className="opacity-60 hover:opacity-100 transition-opacity">
                      <td className="px-4 py-2.5 text-slate-500">{plan.species}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${PLAN_BADGE[plan.plan_name] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {plan.plan_name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{fmt(plan.price)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{fmt(plan.coverage)}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => handleRestore(plan)} className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="Restore">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editPlan !== undefined && (
        <PlanModal
          plan={editPlan}
          onSave={handleSave}
          onClose={() => setEditPlan(undefined)}
        />
      )}
    </div>
  )
}
