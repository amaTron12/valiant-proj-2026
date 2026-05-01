import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Search, ChevronUp, ChevronDown, Upload, Download } from 'lucide-react'
import { Claim, Client } from '../types'
import { useAuth } from '../auth/AuthContext'
import { addAuditEvent } from '../audit/audit'

interface Props { claims: Claim[] }

interface ClientRow {
  id: string
  name: string
  card_number: string
  age: number
  gender: string
  location: string
  claim_count: number
  total_paid: number
  statuses: string[]
  created_at: string
  updated_at: string
}

type SortKey = keyof ClientRow

function fmtDate(s: string) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString()
}

export default function ClientsPage({ claims }: Props) {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setClients(await window.api.getClients())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Refresh when Profiles page or claims change
  useEffect(() => {
    const handler = () => load()
    document.addEventListener('refresh-profiles', handler)
    document.addEventListener('refresh-claims', handler)
    return () => {
      document.removeEventListener('refresh-profiles', handler)
      document.removeEventListener('refresh-claims', handler)
    }
  }, [load])

  // Build rows from real DB records; join claims only for counts/totals
  const rows = useMemo<ClientRow[]>(() => {
    return clients.map(client => {
      const matching = claims.filter(
        c => c.client_name === client.name && c.location_of_residence === client.location
      )
      return {
        id: client.id,
        name: client.name,
        card_number: client.card_number || '',
        age: client.age,
        gender: client.gender,
        location: client.location,
        claim_count: matching.length,
        total_paid: matching.reduce((sum, c) => sum + (c.total_amount_paid || 0), 0),
        statuses: [...new Set(matching.map(c => c.status))],
        created_at: client.created_at,
        updated_at: client.updated_at,
      }
    })
  }, [clients, claims])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(c =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q) ||
      c.gender.toLowerCase().includes(q) ||
      c.card_number.toLowerCase().includes(q)
    )
  }, [rows, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = String(a[sortKey] ?? '')
      const bv = String(b[sortKey] ?? '')
      const cmp = av.localeCompare(bv, undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  // id is hidden from export per policy
  const EXPORT_COLS: { key: SortKey; label: string }[] = [
    { key: 'name',       label: 'Client Name' },
    { key: 'card_number',label: 'Card ID Number' },
    { key: 'age',        label: 'Age' },
    { key: 'gender',     label: 'Gender' },
    { key: 'location',   label: 'Location' },
    { key: 'created_at', label: 'Created At' },
    { key: 'updated_at', label: 'Updated At' },
    { key: 'claim_count',label: 'Claims' },
    { key: 'total_paid', label: 'Total Paid' },
    { key: 'statuses',   label: 'Statuses' },
  ]

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  function exportCSV() {
    const headers = EXPORT_COLS.map(c => c.label)
    const rowsData = sorted.map(r =>
      EXPORT_COLS.map(c => {
        const v = r[c.key]
        if (Array.isArray(v)) return v.join('; ')
        return v === null || v === undefined ? '' : String(v)
      })
    )
    const csv = [headers, ...rowsData].map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), 'clients.csv')
    if (user) addAuditEvent(user, { action: 'export', entity: 'client', details: { format: 'csv', rows: sorted.length, cols: EXPORT_COLS.length } })
  }

  function exportExcel() {
    const sheetData = sorted.map(r => {
      const row: Record<string, unknown> = {}
      EXPORT_COLS.forEach(c => {
        const v = r[c.key]
        row[c.label] = Array.isArray(v) ? v.join('; ') : (v ?? '')
      })
      return row
    })
    const ws = XLSX.utils.json_to_sheet(sheetData)
    ws['!cols'] = EXPORT_COLS.map(c => ({ wch: Math.max(c.label.length, 14) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clients')
    XLSX.writeFile(wb, 'clients.xlsx')
    if (user) addAuditEvent(user, { action: 'export', entity: 'client', details: { format: 'xlsx', rows: sorted.length, cols: EXPORT_COLS.length } })
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  const IMPORT_FIELDS: { key: keyof Omit<Client, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>; label: string }[] = [
    { key: 'name',        label: 'Client Name' },
    { key: 'card_number', label: 'Card ID Number' },
    { key: 'age',         label: 'Age' },
    { key: 'gender',      label: 'Gender' },
    { key: 'location',    label: 'Location' },
  ]

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([IMPORT_FIELDS.map(f => f.label)])
    ws['!cols'] = IMPORT_FIELDS.map(f => ({ wch: Math.max(f.label.length, 16) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clients Import Template')
    XLSX.writeFile(wb, 'clients-import-template.xlsx')
    if (user) addAuditEvent(user, { action: 'download_template', entity: 'template', details: { name: 'clients-import-template.xlsx' } })
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg('')
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

      const labelToKey = Object.fromEntries(IMPORT_FIELDS.map(f => [f.label.toLowerCase(), f.key]))
      const keyAliases: Record<string, string> = {
        client_name: 'name',
        card_id_number: 'card_number',
      }

      const existingById = new Map(clients.map(c => [c.id, c]))
      const existingByMatch = new Map(clients.map(c => [`${c.name}||${c.location}`.toLowerCase(), c]))

      let created = 0
      let updated = 0
      let skipped = 0

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i]
        const mapped: Record<string, unknown> = {}
        for (const [rawKey, val] of Object.entries(raw)) {
          const norm = rawKey.toLowerCase().trim().replace(/\s+/g, '_')
          const key = labelToKey[norm.replace(/_/g, ' ')] ?? labelToKey[norm] ?? keyAliases[norm] ?? norm
          mapped[key] = val
        }

        const name = String(mapped.name ?? '').trim()
        const location = String(mapped.location ?? '').trim()
        if (!name) { skipped++; continue }

        const data: Omit<Client, 'id' | 'created_at' | 'updated_at'> = {
          name,
          card_number: String(mapped.card_number ?? '').trim(),
          age: Number(mapped.age ?? 0),
          gender: String(mapped.gender ?? '').trim(),
          location,
        }

        const incomingId = String(mapped.id ?? '').trim()
        const matchKey = `${name}||${location}`.toLowerCase()

        const existing =
          (incomingId && existingById.get(incomingId)) ||
          (location && existingByMatch.get(matchKey))

        if (existing) {
          await window.api.updateClient(existing.id, data, { name: existing.name, location: existing.location })
          updated++
        } else {
          await window.api.createClient(data)
          created++
        }
      }

      setImportMsg(`✓ Imported: ${created} created · ${updated} updated · ${skipped} skipped`)
      if (user) addAuditEvent(user, { action: 'import', entity: 'client', details: { file: file.name, created, updated, skipped, rows: rows.length } })
      await load()
      document.dispatchEvent(new Event('refresh-claims'))
    } catch (err) {
      setImportMsg(`✗ Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />)
      : null

  const STATUS_BADGE: Record<string, string> = {
    Open:     'bg-blue-100 text-blue-700',
    Pending:  'bg-yellow-100 text-yellow-700',
    Approved: 'bg-green-100 text-green-700',
    Denied:   'bg-red-100 text-red-700',
  }

  // Table columns (includes id for display, but id is hidden from export)
  const TABLE_COLS: { key: SortKey; label: string }[] = [
    { key: 'id',         label: 'Client ID' },
    { key: 'name',       label: 'Client Name' },
    { key: 'card_number',label: 'Card ID Number' },
    { key: 'age',        label: 'Age' },
    { key: 'gender',     label: 'Gender' },
    { key: 'location',   label: 'Location' },
    { key: 'created_at', label: 'Created At' },
    { key: 'updated_at', label: 'Updated At' },
    { key: 'claim_count',label: 'Claims' },
    { key: 'total_paid', label: 'Total Paid' },
    { key: 'statuses',   label: 'Status' },
  ]

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-slate-400">{sorted.length} of {rows.length} clients</span>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            disabled={importing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${importing ? 'opacity-50 cursor-wait' : 'border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'}`}
            title="Import clients"
          >
            <Upload className="w-3.5 h-3.5" />
            {importing ? 'Importing…' : 'Import'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={handleImport} disabled={importing} />

          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
            title="Download import template"
          >
            <Download className="w-3.5 h-3.5" />
            Template
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={exportExcel}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            Export Excel
          </button>
        </div>
        {importMsg && (
          <p className={`w-full text-xs font-medium px-1 ${importMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
            {importMsg}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                {TABLE_COLS.map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => key !== 'statuses' && handleSort(key)}
                    className={`px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${key !== 'statuses' ? 'cursor-pointer hover:text-slate-700' : ''}`}
                  >
                    {label}<SortIcon k={key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={TABLE_COLS.length} className="px-4 py-12 text-center text-slate-400">Loading…</td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLS.length} className="px-4 py-12 text-center text-slate-400">No clients found</td>
                </tr>
              ) : sorted.map(c => (
                <tr key={c.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{c.id}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">{c.name}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{c.card_number || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{c.age || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{c.gender || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{c.location || '—'}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(c.updated_at)}</td>
                  <td className="px-3 py-2 text-slate-500">{c.claim_count}</td>
                  <td className="px-3 py-2 text-slate-500">₱{c.total_paid.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {c.statuses.map(s => (
                        <span key={s} className={`px-2 py-0.5 rounded-full font-medium text-xs ${STATUS_BADGE[s] ?? 'bg-slate-100 text-slate-600'}`}>{s}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400 flex-shrink-0">
          {sorted.length} client{sorted.length !== 1 ? 's' : ''} · Click column headers to sort · IDs hidden from export
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImportModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 flex flex-col gap-4" onClick={ev => ev.stopPropagation()}>
            <h2 className="text-sm font-semibold text-slate-800">Import Clients</h2>
            <button
              onClick={() => { downloadTemplate(); setShowImportModal(false) }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-left"
            >
              <Download className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-700">Download Template</p>
                <p className="text-xs text-slate-400">Get the Excel template with correct headers</p>
              </div>
            </button>
            <button
              onClick={() => { setShowImportModal(false); fileRef.current?.click() }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-left"
            >
              <Upload className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-700">Upload File</p>
                <p className="text-xs text-slate-400">Import from .xlsx, .xls, or .csv</p>
              </div>
            </button>
            <button
              onClick={() => setShowImportModal(false)}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
