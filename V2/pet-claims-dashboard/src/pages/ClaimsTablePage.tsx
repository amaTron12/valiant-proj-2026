import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, Plus, RotateCcw, CalendarDays, ChevronDown } from 'lucide-react'
import { Claim } from '../types'
import ClaimsTable from '../components/ClaimsTable'
import ClaimModal from '../components/ClaimModal'
import DeleteConfirm from '../components/DeleteConfirm'
import ClaimImagesModal from '../components/ClaimImagesModal'
import { SidebarFilters, DEFAULT_FILTERS } from '../components/FilterSidebar'
import { useAuth } from '../auth/AuthContext'
import { addAuditEvent } from '../audit/audit'

interface Props {
  claims: Claim[]
  onRefresh: () => void
}

export default function ClaimsTablePage({ claims, onRefresh }: Props) {
  const { user } = useAuth()
  const [editClaim, setEditClaim] = useState<Claim | null | undefined>(undefined)
  const [deleteClaim, setDeleteClaim] = useState<Claim | null>(null)
  const [imagesClaim, setImagesClaim] = useState<Claim | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activePreset, setActivePreset] = useState<string>('')
  const [monthPick, setMonthPick] = useState('')   // "YYYY-MM"
  const [yearPick, setYearPick] = useState('')     // "YYYY"
  const [dateDropOpen, setDateDropOpen] = useState(false)
  const dateDropRef = useRef<HTMLDivElement>(null)

  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  function applyPreset(label: string, from: Date, to: Date) {
    setDateFrom(fmt(from))
    setDateTo(fmt(to))
    setActivePreset(label)
    setMonthPick('')
    setYearPick('')
  }

  function clearDates() {
    setDateFrom(''); setDateTo(''); setActivePreset(''); setMonthPick(''); setYearPick('')
  }

  // Derive available years from claims data
  const availableYears = useMemo(() => {
    const years = new Set(claims.map(c => c.created_at?.slice(0, 4)).filter(Boolean))
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [claims])

  // Listen for "New Claim" button in header
  useEffect(() => {
    const handler = () => setEditClaim(null)
    document.addEventListener('new-claim', handler)
    return () => document.removeEventListener('new-claim', handler)
  }, [])

  // Close date dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dateDropRef.current && !dateDropRef.current.contains(e.target as Node)) setDateDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleSave(data: Omit<Claim, 'id' | 'created_at' | 'updated_at'>) {
    if (editClaim) {
      await window.api.updateClaim(editClaim.id, data)
      if (user) addAuditEvent(user, { action: 'update', entity: 'claim', entityId: editClaim.id })
    } else {
      const id = await window.api.createClaim(data)
      if (user) addAuditEvent(user, { action: 'create', entity: 'claim', entityId: id })
    }
    setEditClaim(undefined)
    onRefresh()
  }

  async function handleDelete() {
    if (!deleteClaim) return
    await window.api.deleteClaim(deleteClaim.id)
    if (user) addAuditEvent(user, { action: 'delete', entity: 'claim', entityId: deleteClaim.id })
    setDeleteClaim(null)
    onRefresh()
  }

  const activeFilters = [statusFilter, dateFrom, dateTo].filter(Boolean).length

  return (
    <div className="p-6 space-y-4">
      {/* Local filter bar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
          />
        </div>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {['Open', 'Pending', 'Approved', 'Denied'].map(s => <option key={s}>{s}</option>)}
        </select>

        {/* Date range dropdown */}
        <div ref={dateDropRef} className="relative">
          <button
            onClick={() => setDateDropOpen(o => !o)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              dateFrom || dateTo
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {dateFrom || dateTo
              ? `${dateFrom || '…'} → ${dateTo || '…'}`
              : 'Date Range'}
            <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${dateDropOpen ? 'rotate-180' : ''}`} />
          </button>

          {dateDropOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-xl w-64 p-4 space-y-4">

              {/* Quick presets */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quick select</p>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { label: 'Last 7 days',  days: 7  },
                    { label: 'Last 30 days', days: 30 },
                    { label: 'Last 90 days', days: 90 },
                  ] as { label: string; days: number }[]).map(p => (
                    <button
                      key={p.label}
                      onClick={() => {
                        const now = new Date()
                        const from = new Date(now); from.setDate(now.getDate() - p.days)
                        applyPreset(p.label, from, now)
                        setDateDropOpen(false)
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                        activePreset === p.label
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Month picker */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">By month</p>
                <input
                  type="month"
                  value={monthPick}
                  onChange={e => {
                    const v = e.target.value
                    setMonthPick(v)
                    if (v) {
                      const [y, m] = v.split('-').map(Number)
                      applyPreset('month:' + v, new Date(y, m - 1, 1), new Date(y, m, 0))
                      setDateDropOpen(false)
                    }
                  }}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Year picker */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">By year</p>
                <select
                  value={yearPick}
                  onChange={e => {
                    const v = e.target.value
                    setYearPick(v)
                    if (v) {
                      const y = Number(v)
                      applyPreset('year:' + v, new Date(y, 0, 1), new Date(y, 11, 31))
                      setDateDropOpen(false)
                    }
                  }}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select year…</option>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {/* Custom range */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Custom range</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 w-8">From</label>
                    <input
                      type="date" value={dateFrom}
                      onChange={e => { setDateFrom(e.target.value); setActivePreset(''); setMonthPick(''); setYearPick('') }}
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 w-8">To</label>
                    <input
                      type="date" value={dateTo}
                      onChange={e => { setDateTo(e.target.value); setActivePreset(''); setMonthPick(''); setYearPick('') }}
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Clear */}
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { clearDates(); setDateDropOpen(false) }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear date filter
                </button>
              )}
            </div>
          )}
        </div>

        {/* Clear all filters */}
        {activeFilters > 0 && (
          <button
            onClick={() => { setStatusFilter(''); clearDates() }}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Clear all
          </button>
        )}

        {/* New Claim */}
        <button
          onClick={() => setEditClaim(null)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Claim
        </button>
      </div>

      <ClaimsTable
        claims={claims}
        onEdit={setEditClaim}
        onDelete={setDeleteClaim}
        onImages={setImagesClaim}
        search={search}
        statusFilter={statusFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        sidebarFilters={DEFAULT_FILTERS}
      />

      {editClaim !== undefined && (
        <ClaimModal claim={editClaim} onSave={handleSave} onClose={() => setEditClaim(undefined)} />
      )}
      {deleteClaim && (
        <DeleteConfirm claim={deleteClaim} onConfirm={handleDelete} onCancel={() => setDeleteClaim(null)} />
      )}
      {imagesClaim && (
        <ClaimImagesModal claim={imagesClaim} onClose={() => setImagesClaim(null)} />
      )}
    </div>
  )
}
