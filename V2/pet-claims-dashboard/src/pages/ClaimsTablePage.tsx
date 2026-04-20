import React, { useState, useEffect } from 'react'
import { Search, Plus } from 'lucide-react'
import { Claim } from '../types'
import ClaimsTable from '../components/ClaimsTable'
import ClaimModal from '../components/ClaimModal'
import DeleteConfirm from '../components/DeleteConfirm'
import { SidebarFilters, DEFAULT_FILTERS } from '../components/FilterSidebar'

interface Props {
  claims: Claim[]
  onRefresh: () => void
}

export default function ClaimsTablePage({ claims, onRefresh }: Props) {
  const [editClaim, setEditClaim] = useState<Claim | null | undefined>(undefined)
  const [deleteClaim, setDeleteClaim] = useState<Claim | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Listen for "New Claim" button in header
  useEffect(() => {
    const handler = () => setEditClaim(null)
    document.addEventListener('new-claim', handler)
    return () => document.removeEventListener('new-claim', handler)
  }, [])

  async function handleSave(data: Omit<Claim, 'id' | 'created_at' | 'updated_at'>) {
    if (editClaim) {
      await window.api.updateClaim(editClaim.id, data)
    } else {
      await window.api.createClaim(data)
    }
    setEditClaim(undefined)
    onRefresh()
  }

  async function handleDelete() {
    if (!deleteClaim) return
    await window.api.deleteClaim(deleteClaim.id)
    setDeleteClaim(null)
    onRefresh()
  }

  const activeFilters = [statusFilter, dateFrom, dateTo].filter(Boolean).length

  return (
    <div className="p-6 space-y-4">
      {/* Local filter bar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
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

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {['Open', 'Pending', 'Approved', 'Denied'].map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {activeFilters > 0 && (
          <button
            onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo('') }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Clear filters
          </button>
        )}

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
    </div>
  )
}
