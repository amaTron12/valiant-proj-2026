import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Edit2, Trash2, Images } from 'lucide-react'
import { Claim } from '../types'
import { SidebarFilters, DEFAULT_FILTERS } from './FilterSidebar'

interface Props {
  claims: Claim[]
  onEdit: (claim: Claim) => void
  onDelete: (claim: Claim) => void
  onImages: (claim: Claim) => void
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

type SortKey =
  | 'id' | 'policy_number' | 'client_name' | 'status'
  | 'total_amount_paid' | 'total_claim' | 'sum_insured'
  | 'created_at' | 'updated_at' | 'date_of_loss' | 'date_reported'
  | 'branch' | 'line_of_business' | 'handler_name' | 'agent_name'

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
    if (
      q &&
      !c.client_name.toLowerCase().includes(q) &&
      !c.id.toLowerCase().includes(q) &&
      !c.pet_name.toLowerCase().includes(q) &&
      !c.policy_number.toLowerCase().includes(q) &&
      !(c.handler_name ?? '').toLowerCase().includes(q) &&
      !(c.agent_name ?? '').toLowerCase().includes(q) &&
      !(c.branch ?? '').toLowerCase().includes(q) &&
      !(c.claim_reason ?? '').toLowerCase().includes(q) &&
      !(c.diagnosis ?? '').toLowerCase().includes(q)
    ) return false
    if (statusFilter && c.status !== statusFilter) return false
    if (dateFrom && c.created_at < dateFrom) return false
    if (dateTo && c.created_at > dateTo + 'T23:59:59') return false

    // Sidebar: species
    if (sf.species.length && !sf.species.includes(c.species)) return false

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

function fmtDate(val?: string | null) {
  if (!val) return '—'
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  return d.toLocaleDateString()
}

function fmtMoney(val?: number | null) {
  if (val == null || val === 0) return '—'
  return `₱${Number(val).toLocaleString()}`
}

export default function ClaimsTable({ claims, onEdit, onDelete, onImages, search, statusFilter, dateFrom, dateTo, sidebarFilters }: Props) {
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
      const av = (a as unknown as Record<string, unknown>)[sortKey] ?? ''
      const bv = (b as unknown as Record<string, unknown>)[sortKey] ?? ''
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

  function ThStatic({ label }: { label: string }) {
    return (
      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
        {label}
      </th>
    )
  }

  const COL_SPAN = 22

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {/* Identity */}
              <Th label="Claim ID" k="id" />
              <Th label="Policy #" k="policy_number" />
              <Th label="Line of Business" k="line_of_business" />
              <Th label="Branch" k="branch" />

              {/* People */}
              <Th label="Client" k="client_name" />
              <ThStatic label="Claimant" />
              <ThStatic label="Handler" />
              <Th label="Agent" k="agent_name" />

              {/* Pet */}
              <ThStatic label="Pet" />
              <ThStatic label="Diagnosis" />
              <ThStatic label="Claim Reason" />
              <ThStatic label="Catastrophe" />

              {/* Claim meta */}
              <ThStatic label="Type" />
              <Th label="Status" k="status" />
              <ThStatic label="Stage" />
              <ThStatic label="Missing Docs" />

              {/* Dates */}
              <Th label="Date of Loss" k="date_of_loss" />
              <Th label="Date Reported" k="date_reported" />

              {/* Financials */}
              <Th label="Sum Insured" k="sum_insured" />
              <Th label="Total Claim" k="total_claim" />
              <Th label="Amount Paid" k="total_amount_paid" />

              {/* Timestamps & actions */}
              <Th label="Created" k="created_at" />
              <Th label="Updated" k="updated_at" />
              <ThStatic label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={COL_SPAN} className="px-4 py-12 text-center text-slate-400 text-sm">
                  No claims match the current filters
                </td>
              </tr>
            ) : paginated.map(claim => (
              <tr key={claim.id} className="hover:bg-slate-50 transition-colors">
                {/* Identity */}
                <td className="px-4 py-3 font-mono text-xs text-slate-600 font-medium whitespace-nowrap">{claim.id}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{claim.policy_number || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{claim.line_of_business || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{claim.branch || '—'}</td>

                {/* People */}
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800 whitespace-nowrap">{claim.client_name}</div>
                  <div className="text-xs text-slate-400">{claim.location_of_residence}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{claim.claimant || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{claim.handler_name || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{claim.agent_name || '—'}</td>

                {/* Pet */}
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-700 whitespace-nowrap">{claim.pet_name}</div>
                  <div className="text-xs text-slate-400">{claim.species} · {claim.breed}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px]">
                  {claim.diagnosis
                    ? <div className="flex flex-wrap gap-1">
                        {claim.diagnosis.split(',').map(d => d.trim()).filter(Boolean).map(d => (
                          <span key={d} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] whitespace-nowrap">{d}</span>
                        ))}
                      </div>
                    : <span className="text-slate-300">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{claim.claim_reason || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{claim.catastrophe || '—'}</td>

                {/* Claim meta */}
                <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{claim.claim_type}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[claim.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {claim.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{claim.stage || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate" title={claim.missing_documents}>
                  {claim.missing_documents || <span className="text-green-500">Complete</span>}
                </td>

                {/* Dates */}
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(claim.date_of_loss)}</td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(claim.date_reported)}</td>

                {/* Financials */}
                <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtMoney(claim.sum_insured)}</td>
                <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtMoney(claim.total_claim)}</td>
                <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                  {fmtMoney(claim.total_amount_paid)}
                </td>

                {/* Timestamps */}
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                  {new Date(claim.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                  {new Date(claim.updated_at).toLocaleString()}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onImages(claim)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Images"
                    >
                      <Images className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(claim)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
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
