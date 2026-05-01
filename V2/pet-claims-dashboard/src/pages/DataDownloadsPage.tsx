import React, { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Download, FileSpreadsheet, FileText, Search, ChevronUp, ChevronDown, SlidersHorizontal, X, Upload } from 'lucide-react'
import { Claim } from '../types'
import { useAuth } from '../auth/AuthContext'
import { addAuditEvent } from '../audit/audit'

interface Props {
  claims: Claim[]
  onRefresh: () => void
}

function humanizeKey(k: string) {
  return k
    .replace(/_/g, ' ')
    .replace(/\b\w/g, m => m.toUpperCase())
}

type MiscObj = {
  imei_number?: string
  airline?: string
  aon_event?: string
  travel_sum_insured?: number
  catastrophe_code?: string
  claimant_count?: number
  last_diary_entry?: string
  diary_description?: string
}

function parseMisc(misc: unknown): MiscObj {
  if (!misc) return {}
  if (typeof misc === 'object') return misc as MiscObj
  if (typeof misc !== 'string') return {}
  try { return (JSON.parse(misc) ?? {}) as MiscObj } catch { return {} }
}

type ColumnDef = {
  key: string
  label: string
  width: string
  group: string
  get: (c: Claim) => unknown
}

const CLAIM_KEY_COLUMNS: ColumnDef[] = ([
  'id',
  'policy_number',
  'card_number',
  'client_name',
  'client_age',
  'client_gender',
  'location_of_residence',
  'pet_name',
  'pedigree_number',
  'species',
  'breed',
  'breed_type',
  'gender',
  'neutering_status',
  'color',
  'age',
  'weight',
  'place_of_loss',
  'diagnosis',
  'medications',
  'medicine_cost',
  'veterinary_services',
  'service_cost',
  'vet_clinic',
  'claim_type',
  'status',
  'missing_documents',
  'stage',
  'total_amount_paid',
  'created_at',
  'updated_at',
  'deleted_at',
  'line_of_business',
  'branch_code',
  'branch',
  'external_policy',
  'date_issued',
  'date_of_loss',
  'date_reported',
  'date_registered',
  'inception_date',
  'expiry_date',
  'local_global',
  'country',
  'original_currency',
  'year',
  'client_no',
  'master_client',
  'claimant',
  'payee',
  'handler_code',
  'handler_name',
  'agent_code',
  'agent_name',
  'sub_agent_code',
  'adj_provider_code',
  'adj_provider_name',
  'birthday',
  'basic_premium',
  'sum_insured',
  'net_reserve',
  'ri_reserve',
  'total_reserve',
  'insured_net_payment',
  'adj_provider_net_payment',
  'tp_claim_payment',
  'ri_payment',
  'total_payment',
  'total_net',
  'total_ri',
  'total_claim',
  'date_first_payment',
  'date_last_payment',
  'claim_reason',
  'catastrophe',
  'narrative',
] as (keyof Claim)[]).map((k) => ({
  key: String(k),
  label: humanizeKey(String(k)),
  width: 'w-44',
  group: 'Other',
  get: (c: Claim) => (c as any)[k],
}))

const BUSINESS_ALIAS_COLUMNS: ColumnDef[] = [
  { key: '__claim_number', label: 'Claim Number', width: 'w-32', group: 'Identifiers', get: (c) => c.id },
  { key: '__policy_no', label: 'Policy No', width: 'w-32', group: 'Identifiers', get: (c) => c.policy_number },
  { key: '__product', label: 'Product', width: 'w-32', group: 'Policy & Branch', get: (c) => c.line_of_business },
  { key: '__assured_name', label: 'Assured Name/Assignee', width: 'w-44', group: 'Client', get: (c) => c.client_name },
  { key: '__cause_description', label: 'Cause Description', width: 'w-56', group: 'Claim & Medical', get: (c) => c.diagnosis },
  { key: '__claim_status', label: 'Claim Status', width: 'w-28', group: 'Claim & Medical', get: (c) => c.status },
  { key: '__local_global', label: 'Local/Global', width: 'w-28', group: 'Policy & Branch', get: (c) => c.local_global },
  { key: '__handler', label: 'Handler', width: 'w-24', group: 'People & Agents', get: (c) => c.handler_code },
  { key: '__adjuster_provider_code', label: 'Adjuster/Provider Code', width: 'w-36', group: 'People & Agents', get: (c) => c.adj_provider_code },
  { key: '__adjuster_provider_name', label: 'Adjuster/Provider Name', width: 'w-44', group: 'People & Agents', get: (c) => c.adj_provider_name },
  { key: '__travel_sum_insured', label: 'Travel protect Sum Insured', width: 'w-40', group: 'Misc', get: (c) => parseMisc(c.misc).travel_sum_insured },
  { key: '__catastrophe_code', label: 'Catastrophe Code', width: 'w-36', group: 'Misc', get: (c) => parseMisc(c.misc).catastrophe_code },
  { key: '__last_diary_entry', label: 'Last Diary Entry', width: 'w-36', group: 'Misc', get: (c) => parseMisc(c.misc).last_diary_entry },
  { key: '__diary_description', label: 'Diary Description', width: 'w-56', group: 'Misc', get: (c) => parseMisc(c.misc).diary_description },
  { key: '__imei_number', label: 'IMEI Number', width: 'w-36', group: 'Misc', get: (c) => parseMisc(c.misc).imei_number },
  { key: '__aon_event', label: 'AON Event', width: 'w-28', group: 'Misc', get: (c) => parseMisc(c.misc).aon_event },
  { key: '__claimant_count', label: 'Claimant Count', width: 'w-28', group: 'Misc', get: (c) => parseMisc(c.misc).claimant_count },
  { key: '__airline', label: 'Airline', width: 'w-28', group: 'Misc', get: (c) => parseMisc(c.misc).airline },
]

const COLUMNS: ColumnDef[] = [
  ...CLAIM_KEY_COLUMNS.map(c => ({ ...c, group: metricGroup(c.key) })),
  ...BUSINESS_ALIAS_COLUMNS,
]

type ColumnKey = ColumnDef['key']

function formatCell(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if ((key === 'medicine_cost' || key === 'service_cost' || key === 'total_amount_paid') && typeof value === 'number') {
    return `₱${Number(value).toLocaleString()}`
  }
  if ((key === 'created_at' || key === 'updated_at' || key === 'deleted_at') && typeof value === 'string') {
    return new Date(value).toLocaleString()
  }
  return String(value)
}

function metricGroup(key: string): string {
  const k = String(key)
  if (['id', 'policy_number', 'card_number', 'pedigree_number'].includes(k)) return 'Identifiers'

  if (k.startsWith('client_') || ['location_of_residence', 'birthday'].includes(k)) return 'Client'
  if (['pet_name', 'species', 'breed', 'breed_type', 'gender', 'neutering_status', 'color', 'age', 'weight'].includes(k)) return 'Pet'

  if (['place_of_loss', 'diagnosis', 'medications', 'veterinary_services', 'vet_clinic', 'claim_type', 'status', 'missing_documents', 'stage'].includes(k)) return 'Claim & Medical'

  if (
    k.endsWith('_cost') ||
    k.endsWith('_payment') ||
    ['total_amount_paid', 'basic_premium', 'sum_insured', 'net_reserve', 'ri_reserve', 'total_reserve', 'total_net', 'total_ri', 'total_claim'].includes(k)
  ) return 'Financial'

  if (k.endsWith('_at') || k.startsWith('date_') || ['inception_date', 'expiry_date', 'year'].includes(k)) return 'Dates'

  if (['line_of_business', 'branch_code', 'branch', 'external_policy', 'local_global', 'country', 'original_currency'].includes(k)) return 'Policy & Branch'

  if (
    ['client_no', 'master_client', 'claimant', 'payee', 'handler_code', 'handler_name', 'agent_code', 'agent_name', 'sub_agent_code', 'adj_provider_code', 'adj_provider_name'].includes(k)
  ) return 'People & Agents'

  if (['claim_reason', 'catastrophe', 'narrative'].includes(k)) return 'Extras'
  if (k === 'misc') return 'Misc'

  return 'Other'
}

export default function DataDownloadsPage({ claims }: Props) {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<ColumnKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Import
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importErrorRows, setImportErrorRows] = useState<Record<string, unknown>[]>([])
  const [importErrorHeaders, setImportErrorHeaders] = useState<string[]>([])

  // Column selector (show vs export)
  const [colQuery, setColQuery] = useState('')
  const [selectedCols, setSelectedCols] = useState<Set<ColumnKey>>(() => {
    const hiddenByDefault = new Set<ColumnKey>(['created_at', 'updated_at', 'deleted_at'])
    return new Set(COLUMNS.map(c => c.key).filter(k => !hiddenByDefault.has(k)))
  })
  const [showMetrics, setShowMetrics] = useState(false)

  const visibleColumns = useMemo(() => COLUMNS.filter(c => selectedCols.has(c.key)), [selectedCols])
  const exportColumns = visibleColumns

  const colByKey = useMemo(() => {
    const m = new Map<string, ColumnDef>()
    COLUMNS.forEach(c => m.set(c.key, c))
    return m
  }, [])

  const getVal = (claim: Claim, key: ColumnKey) => colByKey.get(key)?.get(claim)

  const filteredColumnPicker = useMemo(() => {
    const q = colQuery.trim().toLowerCase()
    if (!q) return COLUMNS
    return COLUMNS.filter(c => c.label.toLowerCase().includes(q) || String(c.key).toLowerCase().includes(q))
  }, [colQuery])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return claims.filter(c =>
      !q ||
      Object.values(c).some(v => String(v ?? '').toLowerCase().includes(q))
    )
  }, [claims, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = String(getVal(a, sortKey) ?? '')
      const bv = String(getVal(b, sortKey) ?? '')
      const cmp = av.localeCompare(bv, undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir, colByKey])

  function handleSort(key: ColumnKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function normHeader(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '').trim()
  }

  const HEADER_MAP = useMemo(() => {
    const m = new Map<string, { key?: keyof Claim; misc?: keyof MiscObj }>()

    const add = (header: string, v: { key?: keyof Claim; misc?: keyof MiscObj }) => m.set(normHeader(header), v)

    // Direct Claim keys
    ;(CLAIM_KEY_COLUMNS.map(c => c.key) as (keyof Claim)[]).forEach(k => add(String(k), { key: k }))

    // Common business headers
    add('Claim Number', { key: 'id' })
    add('Claim No', { key: 'id' })
    add('Policy No', { key: 'policy_number' })
    add('Policy Number', { key: 'policy_number' })
    add('Assured Name/Assignee', { key: 'client_name' })
    add('Client Name', { key: 'client_name' })
    add('Claim Status', { key: 'status' })
    add('Claim Type', { key: 'claim_type' })
    add('Cause Description', { key: 'diagnosis' })
    add('Product', { key: 'line_of_business' })
    add('Local/Global', { key: 'local_global' })
    add('Handler', { key: 'handler_code' })
    add('Handler Name', { key: 'handler_name' })
    add('Adjuster/Provider Code', { key: 'adj_provider_code' })
    add('Adjuster/Provider Name', { key: 'adj_provider_name' })

    // Misc sub-fields
    add('Catastrophe Code', { misc: 'catastrophe_code' })
    add('Travel protect Sum Insured', { misc: 'travel_sum_insured' })
    add('Travel Sum Insured', { misc: 'travel_sum_insured' })
    add('Last Diary Entry', { misc: 'last_diary_entry' })
    add('Diary Description', { misc: 'diary_description' })
    add('IMEI Number', { misc: 'imei_number' })
    add('AON Event', { misc: 'aon_event' })
    add('Claimant Count', { misc: 'claimant_count' })
    add('Airline', { misc: 'airline' })

    return m
  }, [])

  function toNum(v: unknown): number | undefined {
    if (v === null || v === undefined || v === '') return undefined
    if (typeof v === 'number') return v
    const s = String(v).replace(/[₱$,]/g, '').trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : undefined
  }

  function toStr(v: unknown): string | undefined {
    if (v === null || v === undefined) return undefined
    const s = String(v).trim()
    return s === '' ? undefined : s
  }

  function downloadTemplate() {
    const headers = COLUMNS.map(c => c.label)
    const ws = XLSX.utils.aoa_to_sheet([headers])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data Downloads Import Template')
    XLSX.writeFile(wb, 'data_downloads_import_template.xlsx')
    if (user) addAuditEvent(user, { action: 'download_template', entity: 'template', details: { type: 'data_downloads' } })
  }

  function downloadErrorRowsCSV() {
    if (importErrorRows.length === 0) return
    const headers = [...importErrorHeaders, '__errors']
    const csv = [
      headers,
      ...importErrorRows.map(r => headers.map(h => String((r as any)[h] ?? ''))),
    ]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `data_downloads_import_errors-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadErrorRowsXLSX() {
    if (importErrorRows.length === 0) return
    const headers = [...importErrorHeaders, '__errors']
    const data = importErrorRows.map(r => {
      const row: Record<string, unknown> = {}
      headers.forEach(h => { row[h] = (r as any)[h] ?? '' })
      return row
    })
    const ws = XLSX.utils.json_to_sheet(data, { header: headers })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Import Errors')
    XLSX.writeFile(wb, `data_downloads_import_errors-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg('')
    setImportErrorRows([])
    setImportErrorHeaders([])
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

      let created = 0
      let skipped = 0
      const errorRows: Record<string, unknown>[] = []
      const headers = rows.length ? Object.keys(rows[0]) : []

      for (const row of rows) {
        const missing = headers.filter(h => {
          const v = (row as any)[h]
          return v === '' || v === null || v === undefined
        })
        if (missing.length > 0) {
          errorRows.push({ ...row, __errors: `Blank values: ${missing.join(', ')}` })
          continue
        }

        const payload: any = {}
        const misc: MiscObj = {}

        for (const [hdr, v] of Object.entries(row)) {
          const map = HEADER_MAP.get(normHeader(hdr))
          if (!map) continue
          if (map.key) {
            if (['client_age', 'age', 'year'].includes(String(map.key))) payload[map.key] = toNum(v) ?? 0
            else if (String(map.key).endsWith('_cost') || String(map.key).endsWith('_payment') || ['basic_premium','sum_insured','net_reserve','ri_reserve','total_reserve','total_amount_paid','service_cost','medicine_cost'].includes(String(map.key))) payload[map.key] = toNum(v) ?? 0
            else payload[map.key] = toStr(v) ?? ''
          } else if (map.misc) {
            if (map.misc === 'travel_sum_insured' || map.misc === 'claimant_count') misc[map.misc] = toNum(v) ?? 0
            else misc[map.misc] = toStr(v) ?? ''
          }
        }

        // Required core fields for createClaim
        payload.policy_number = String(payload.policy_number ?? '')
        payload.card_number = String(payload.card_number ?? '')
        payload.pedigree_number = String(payload.pedigree_number ?? '')

        // Carry through misc JSON
        payload.misc = JSON.stringify(misc)

        // If row had an id and it already exists, skip
        const id = String(payload.id ?? '').trim()
        if (id && claims.some(c => c.id === id)) { skipped++; continue }
        delete payload.id

        await window.api.createClaim(payload)
        created++
      }

      setImportErrorRows(errorRows)
      setImportErrorHeaders(headers)

      const errors = errorRows.length
      setImportMsg(
        `✓ Imported ${created} record${created !== 1 ? 's' : ''}` +
        (skipped ? ` · ${skipped} skipped (duplicate ID)` : '') +
        (errors ? ` · ${errors} row${errors !== 1 ? 's' : ''} rejected (blank cells)` : '')
      )
      if (user) addAuditEvent(user, { action: 'import', entity: 'masterlist', details: { file: file.name, created, skipped, rows: rows.length, mode: 'data_downloads' } })
    } catch (err) {
      setImportMsg(`✗ Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function exportCSV() {
    if (exportColumns.length === 0) return
    const headers = exportColumns.map(c => c.label)
    const rows = sorted.map(claim =>
      exportColumns.map(c => {
        const v = c.get(claim)
        return v === null || v === undefined ? '' : String(v)
      })
    )
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `claims-full-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    if (user) addAuditEvent(user, { action: 'export', entity: 'masterlist', details: { type: 'csv', columns: exportColumns.map(c => c.key), count: sorted.length } })
  }

  function exportXLSX() {
    if (exportColumns.length === 0) return
    const data = sorted.map(claim => {
      const row: Record<string, unknown> = {}
      exportColumns.forEach(c => { row[c.label] = c.get(claim) ?? '' })
      return row
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Claims')
    XLSX.writeFile(wb, `claims-full-${new Date().toISOString().slice(0, 10)}.xlsx`)
    if (user) addAuditEvent(user, { action: 'export', entity: 'masterlist', details: { type: 'xlsx', columns: exportColumns.map(c => c.key), count: sorted.length } })
  }

  const selectedCount = visibleColumns.length
  const totalCols = COLUMNS.length

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
        <h1 className="text-lg font-semibold text-slate-800">Data Downloads</h1>
        <p className="text-sm text-slate-500 mt-1">Full-fidelity export (includes optional fields like `misc`).</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search any field…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-9 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <span className="text-xs text-slate-400">{sorted.length} of {claims.length} records</span>

        <div className="flex items-center gap-2 ml-auto">
          {/* Import */}
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            disabled={importing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${importing ? 'opacity-50 cursor-wait' : 'border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'}`}
          >
            <Upload className="w-3.5 h-3.5" />
            {importing ? 'Importing…' : 'Import'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={handleImport} disabled={importing} />

          <button
            onClick={() => setShowMetrics(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              showMetrics ? 'bg-slate-50 border-slate-300 text-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Select columns (metrics)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Select Metrics
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMetrics ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={exportCSV}
            disabled={visibleColumns.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-green-500" />
            Export CSV
          </button>
          <button
            onClick={exportXLSX}
            disabled={visibleColumns.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
            Export Excel
          </button>
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400 ml-2">
            <Download className="w-3 h-3" />
            Full export
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
        {/* Metrics picker (collapsed by default) */}
        {showMetrics && (
          <div className="border-b border-slate-100 px-4 py-3 bg-white">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-56 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={colQuery}
                  onChange={e => setColQuery(e.target.value)}
                  placeholder="Search metrics…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setSelectedCols(new Set(COLUMNS.map(c => c.key)))}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelectedCols(new Set())}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Clear
                </button>
                <button
                  onClick={() => { setShowMetrics(false); setColQuery('') }}
                  className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5 max-h-56 overflow-auto pr-1">
              {(() => {
                const order = [
                  'Identifiers',
                  'Client',
                  'Pet',
                  'Claim & Medical',
                  'Financial',
                  'Dates',
                  'Policy & Branch',
                  'People & Agents',
                  'Extras',
                  'Misc',
                  'Other',
                ]
                const groups = new Map<string, typeof filteredColumnPicker>()
                for (const c of filteredColumnPicker) {
                  const g = c.group || metricGroup(c.key)
                  const arr = groups.get(g) ?? []
                  arr.push(c)
                  groups.set(g, arr)
                }

                return order
                  .filter(g => (groups.get(g)?.length ?? 0) > 0)
                  .flatMap(g => {
                    const cols = groups.get(g) ?? []
                    return [
                      <div key={`${g}-hdr`} className="w-full mt-1 first:mt-0">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {g}
                        </div>
                      </div>,
                      ...cols.map(c => {
                        const checked = selectedCols.has(c.key)
                        return (
                          <label
                            key={String(c.key)}
                            className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[11px] leading-tight cursor-pointer select-none transition-colors whitespace-nowrap ${
                              checked ? 'bg-blue-50 border-blue-200 text-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="accent-blue-600"
                              checked={checked}
                              onChange={() => {
                                setSelectedCols(prev => {
                                  const next = new Set(prev)
                                  if (next.has(c.key)) next.delete(c.key)
                                  else next.add(c.key)
                                  return next
                                })
                              }}
                            />
                            <span title={c.label}>{c.label}</span>
                          </label>
                        )
                      })
                    ]
                  })
              })()}
            </div>

            <div className="mt-3 text-xs text-slate-400">{selectedCount} selected (of {totalCols})</div>
          </div>
        )}

        <div className="overflow-auto h-full">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-100">
                {visibleColumns.map(c => (
                  <th
                    key={String(c.key)}
                    className={`px-4 py-2.5 text-left font-semibold text-slate-500 whitespace-nowrap ${c.width}`}
                    onClick={() => handleSort(c.key)}
                  >
                    <div className="flex items-center gap-1 cursor-pointer select-none">
                      <span>{c.label}</span>
                      {sortKey === c.key ? (
                        sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3 opacity-20" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((claim, idx) => (
                <tr key={claim.id || idx} className="hover:bg-slate-50 transition-colors">
                  {visibleColumns.map(c => (
                    <td key={String(c.key)} className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                      {formatCell(c.key, c.get(claim))}
                    </td>
                  ))}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length || 1} className="px-4 py-10 text-center text-slate-300">
                    No matching records
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImportModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Import Data Downloads</h2>
                <p className="text-xs text-slate-400 mt-0.5">Import full-fidelity claim data (including misc fields)</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <button
                type="button"
                onClick={() => downloadTemplate()}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700">Download Template</p>
                  <p className="text-xs text-slate-400 mt-0.5">Get an Excel template with all supported columns</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 transition-colors text-left ${importing ? 'opacity-50 cursor-wait' : 'hover:bg-slate-50'}`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700">{importing ? 'Importing…' : 'Choose File to Import'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Import from .xlsx, .xls, or .csv</p>
                </div>
              </button>

              {importMsg && (
                <p className={`text-xs font-medium ${importMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                  {importMsg}
                </p>
              )}

              {importErrorRows.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs text-slate-500 mb-2">
                    {importErrorRows.length} row{importErrorRows.length !== 1 ? 's' : ''} had blank cells and were skipped. Download them to fix and re-import.
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={downloadErrorRowsCSV}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-green-500" />
                      Download errors (CSV)
                    </button>
                    <button
                      type="button"
                      onClick={downloadErrorRowsXLSX}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
                      Download errors (XLSX)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

