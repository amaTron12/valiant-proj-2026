import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Edit2, Trash2 } from 'lucide-react'
import { Claim } from '../types'
import { SidebarFilters, DEFAULT_FILTERS } from './FilterSidebar'

interface Props {
  claims: Claim[]
  onEdit: (claim: Claim) => void
  onDelete: (claim: Claim) => void
  search: string
  statusFilter: string
  dateFrom: string
  dateTo: string
  sidebarFilters: SidebarFilters
}

const STATUS_BADGE: Record<string, string> = {
  Open: 'bg-blue-100 text-blue-700 border-blue-200',
  Pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Approved: 'bg-green-100 text-green-700 border-green-200',
  Denied: 'bg-red-100 text-red-700 border-red-200'
}

type SortKey = 'id' | 'client_name' | 'status' | 'total_amount_paid' | 'created_at'

function applyFilters(
  claims: Claim[],
  search: string,
  statusFilter: string,
  dateFrom: string,
  dateTo: string,
  sf: SidebarFilters
): Claim[] {
  const q = search.toLowerCase()
  const d = DEFAULT_FILTERS

  return claims.filter(c => {
    // Top-bar filters
    if (q && !c.client_name.toLowerCase().includes(q) && !c.id.toLowerCase().includes(q) && !c.pet_name.toLowerCase().includes(q)) return false
    if (statusFilter && c.status !== statusFilter) return false
    if (dateFrom && c.created_at < dateFrom) return false
    if (dateTo && c.created_at > dateTo + 'T23:59:59') return false

    // Sidebar: species
    if (sf.species.length && !sf.species.includes(c.species)) return false

    // Sidebar: claim types
    if (sf.claimTypes.length && !sf.claimTypes.includes(c.claim_type)) return false

    // Sidebar: pet gender
    if (sf.petGender && c.gender !== sf.petGender) return false

    // Sidebar: pet age range
    if (c.age < sf.petAgeRange[0] || c.age > sf.petAgeRange[1]) return false

    // Sidebar: weight range
    if (c.weight < sf.weightRange[0] || c.weight > sf.weightRange[1]) return false

    // Sidebar: breed text search
    if (sf.breed && !c.breed.toLowerCase().includes(sf.breed.toLowerCase())) return false

    // Sidebar: diagnosis text search
    if (sf.diagnosis && !c.diagnosis.toLowerCase().includes(sf.diagnosis.toLowerCase())) return false

    // Sidebar: client age range
    if (c.client_age < sf.clientAgeRange[0] || c.client_age > sf.clientAgeRange[1]) return false

    // Sidebar: claim value / premium (medicine + service)
    const claimValue = (c.medicine_cost || 0) + (c.service_cost || 0)
    if (claimValue < sf.premiumRange[0] || claimValue > sf.premiumRange[1]) return false

    return true
  })
}

export default function ClaimsTable({ claims, onEdit, onDelete, search, statusFilter, dateFrom, dateTo, sidebarFilters }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const perPage = 10

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  const filtered = useMemo(
    () => applyFilters(claims, search, statusFilter, dateFrom, dateTo, sidebarFilters),
    [claims, search, statusFilter, dateFrom, dateTo, sidebarFilters]
  )

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / perPage)
  const paginated = sorted.slice((page - 1) * perPage, page * perPage)

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp className="w-3 h-3 text-slate-300" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-slate-600" />
      : <ChevronDown className="w-3 h-3 text-slate-600" />
  }

  function Th({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 whitespace-nowrap"
        onClick={() => handleSort(k)}
      >
        <span className="flex items-center gap-1">{label}<SortIcon k={k} /></span>
      </th>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <Th label="Claim ID" k="id" />
              <Th label="Client" k="client_name" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Pet</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
              <Th label="Status" k="status" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Stage</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Missing Docs</th>
              <Th label="Amount Paid" k="total_amount_paid" />
              <Th label="Date" k="created_at" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-slate-400 text-sm">
                  No claims match the current filters
                </td>
              </tr>
            ) : paginated.map(claim => (
              <tr key={claim.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-600 font-medium">{claim.id}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{claim.client_name}</div>
                  <div className="text-xs text-slate-400">{claim.location_of_residence}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-700">{claim.pet_name}</div>
                  <div className="text-xs text-slate-400">{claim.species} · {claim.breed}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{claim.claim_type}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[claim.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {claim.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{claim.stage}</td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate" title={claim.missing_documents}>
                  {claim.missing_documents || <span className="text-green-500">Complete</span>}
                </td>
                <td className="px-4 py-3 font-medium text-slate-700">
                  {claim.total_amount_paid > 0 ? `₱${Number(claim.total_amount_paid).toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                  {new Date(claim.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEdit(claim)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(claim)}
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

      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>{filtered.length} claim{filtered.length !== 1 ? 's' : ''}</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            <span className="px-2">Page {page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
