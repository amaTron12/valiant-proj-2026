import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Edit2, Trash2, RotateCcw, X, Search, Stethoscope, Tag } from 'lucide-react'
import { DiagnosisType } from '../types'
import { useAuth } from '../auth/AuthContext'
import { addAuditEvent } from '../audit/audit'

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Illness',
  'Accident',
  'Dental',
  'Orthopedic',
  'Respiratory',
  'Urinary',
  'Skin / Dermatology',
  'Digestive',
  'Cardiac',
  'Neurological',
  'Parasitic',
  'Reproductive',
  'Ophthalmologic',
  'Other',
]

const CATEGORY_COLORS: Record<string, string> = {
  'Illness':           'bg-blue-100 text-blue-700 border-blue-200',
  'Accident':          'bg-orange-100 text-orange-700 border-orange-200',
  'Dental':            'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Orthopedic':        'bg-purple-100 text-purple-700 border-purple-200',
  'Respiratory':       'bg-sky-100 text-sky-700 border-sky-200',
  'Urinary':           'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Skin / Dermatology':'bg-pink-100 text-pink-700 border-pink-200',
  'Digestive':         'bg-lime-100 text-lime-700 border-lime-200',
  'Cardiac':           'bg-red-100 text-red-700 border-red-200',
  'Neurological':      'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Parasitic':         'bg-amber-100 text-amber-700 border-amber-200',
  'Reproductive':      'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  'Ophthalmologic':    'bg-teal-100 text-teal-700 border-teal-200',
  'Other':             'bg-slate-100 text-slate-600 border-slate-200',
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  initial?: DiagnosisType | null
  onSave: (data: { name: string; category: string; description: string }) => Promise<void>
  onClose: () => void
}

function DiagnosisModal({ initial, onSave, onClose }: ModalProps) {
  const [name, setName]         = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [desc, setDesc]         = useState(initial?.description ?? '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), category, description: desc.trim() })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                {initial ? 'Edit Diagnosis Type' : 'New Diagnosis Type'}
              </h2>
              <p className="text-xs text-slate-400">{initial ? `Editing ${initial.id}` : 'Add to the diagnosis reference list'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Diagnosis Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="e.g. Urinary Tract Infection, Hip Dysplasia…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select category —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              placeholder="Optional notes or clinical description…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : (initial ? 'Save Changes' : 'Add Diagnosis Type')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DiagnosisTypesPage() {
  const { user } = useAuth()
  const [items, setItems]               = useState<DiagnosisType[]>([])
  const [deleted, setDeleted]           = useState<DiagnosisType[]>([])
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing]           = useState<DiagnosisType | null>(null)
  const [search, setSearch]             = useState('')
  const [catFilter, setCatFilter]       = useState('')
  const [showDeleted, setShowDeleted]   = useState(false)
  const [toast, setToast]               = useState('')
  const [sortKey, setSortKey]           = useState<'id' | 'name' | 'category' | 'created_at'>('name')
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('asc')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function load() {
    setLoading(true)
    try {
      const [active, trash] = await Promise.all([
        window.api.getDiagnosisTypes(),
        window.api.getDeletedDiagnosisTypes(),
      ])
      setItems(active)
      setDeleted(trash)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave(data: { name: string; category: string; description: string }) {
    if (editing) {
      await window.api.updateDiagnosisType(editing.id, data)
      showToast(`Updated "${data.name}"`)
      if (user) addAuditEvent(user, { action: 'update', entity: 'diagnosis_type', entityId: editing.id, details: { name: data.name, category: data.category } })
    } else {
      const id = await window.api.createDiagnosisType(data)
      showToast(`Added "${data.name}"`)
      if (user) addAuditEvent(user, { action: 'create', entity: 'diagnosis_type', entityId: id, details: { name: data.name, category: data.category } })
    }
    await load()
  }

  async function handleDelete(item: DiagnosisType) {
    await window.api.deleteDiagnosisType(item.id)
    showToast(`Deleted "${item.name}"`)
    if (user) addAuditEvent(user, { action: 'delete', entity: 'diagnosis_type', entityId: item.id, details: { name: item.name, category: item.category } })
    await load()
  }

  async function handleRestore(item: DiagnosisType) {
    await window.api.restoreDiagnosisType(item.id)
    showToast(`Restored "${item.name}"`)
    if (user) addAuditEvent(user, { action: 'restore', entity: 'diagnosis_type', entityId: item.id, details: { name: item.name, category: item.category } })
    await load()
  }

  // All unique categories in the active list
  const allCategories = useMemo(() => {
    const cats = new Set(items.map(i => i.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [items])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(i => {
      if (catFilter && i.category !== catFilter) return false
      if (q && !i.name.toLowerCase().includes(q) && !i.description.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, search, catFilter])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = String(a[sortKey] ?? '')
      const bv = String(b[sortKey] ?? '')
      return av.localeCompare(bv, undefined, { numeric: true }) * dir
    })
  }, [filtered, sortKey, sortDir])

  function handleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 mr-1">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <Stethoscope className="w-4.5 h-4.5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-800">Diagnosis Types</h1>
            <p className="text-xs text-slate-400">{items.length} total</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-52 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search diagnosis name or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category filter */}
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {toast && (
          <span className="text-xs text-green-600 font-medium bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
            {toast}
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setShowDeleted(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${showDeleted ? 'bg-red-50 border-red-200 text-red-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Trash {deleted.length > 0 && `(${deleted.length})`}
          </button>
          <button
            onClick={() => { setEditing(null); setModal('add') }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Summary stats row */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['Illness', 'Accident', 'Orthopedic', 'Urinary'] as const).map(cat => {
            const count = items.filter(i => i.category === cat).length
            return (
              <div key={cat} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3">
                <div className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${CATEGORY_COLORS[cat]}`}>{cat}</div>
                <span className="text-lg font-bold text-slate-700">{count}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Active list */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                <th onClick={() => handleSort('id')} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-slate-700 w-24">ID</th>
                <th onClick={() => handleSort('name')} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-slate-700">Name</th>
                <th onClick={() => handleSort('category')} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-slate-700">Category</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Description</th>
                <th onClick={() => handleSort('created_at')} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-slate-700">Added</th>
                <th className="px-3 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Loading…</td></tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    {search || catFilter ? 'No diagnosis types match your filter' : 'No diagnosis types yet — add your first one'}
                  </td>
                </tr>
              ) : sorted.map(item => (
                <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{item.id}</td>
                  <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{item.name}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS['Other']}`}>
                      {item.category || 'Uncategorized'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500 max-w-md truncate" title={item.description}>
                    {item.description || <span className="text-slate-300 italic">No description</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{new Date(item.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditing(item); setModal('edit') }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400 flex-shrink-0 flex items-center justify-between">
          <span>{sorted.length} diagnosis type{sorted.length !== 1 ? 's' : ''}</span>
          <span>Click column headers to sort</span>
        </div>
      </div>

      {/* Trash / deleted section */}
      {showDeleted && (
        <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-red-100 bg-red-50 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-red-700">Deleted Diagnosis Types</h3>
            <span className="text-xs text-red-400 ml-auto">{deleted.length} item{deleted.length !== 1 ? 's' : ''}</span>
          </div>
          {deleted.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-slate-400">Trash is empty</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-red-50">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide w-24">ID</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Category</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Deleted</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {deleted.map(item => (
                  <tr key={item.id} className="opacity-60 hover:opacity-100 transition-opacity">
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{item.id}</td>
                    <td className="px-5 py-3 text-slate-500 line-through">{item.name}</td>
                    <td className="px-5 py-3">
                      {item.category && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS['Other']}`}>
                          {item.category}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {item.deleted_at ? new Date(item.deleted_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => handleRestore(item)}
                          className="flex items-center gap-1 p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors text-xs"
                          title="Restore"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <DiagnosisModal
          initial={modal === 'edit' ? editing : null}
          onSave={handleSave}
          onClose={() => { setModal(null); setEditing(null) }}
        />
      )}
    </div>
  )
}
