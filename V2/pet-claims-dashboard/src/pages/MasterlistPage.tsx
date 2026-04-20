import React, { useState, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Download, Upload, FileSpreadsheet, FileText, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { Claim } from '../types'

interface Props {
  claims: Claim[]
  onRefresh: () => void
}

const COLUMNS: { key: keyof Claim; label: string; width: string }[] = [
  { key: 'id',                    label: 'Claim ID',          width: 'w-28'  },
  { key: 'client_name',           label: 'Client Name',       width: 'w-36'  },
  { key: 'client_age',            label: 'Client Age',        width: 'w-24'  },
  { key: 'client_gender',         label: 'Client Gender',     width: 'w-28'  },
  { key: 'location_of_residence', label: 'Location',          width: 'w-36'  },
  { key: 'pet_name',              label: 'Pet Name',          width: 'w-28'  },
  { key: 'species',               label: 'Species',           width: 'w-24'  },
  { key: 'breed',                 label: 'Breed',             width: 'w-36'  },
  { key: 'breed_type',            label: 'Breed Type',        width: 'w-24'  },
  { key: 'gender',                label: 'Pet Gender',        width: 'w-24'  },
  { key: 'neutering_status',      label: 'Neutering',         width: 'w-24'  },
  { key: 'color',                 label: 'Color',             width: 'w-32'  },
  { key: 'age',                   label: 'Pet Age (yr)',      width: 'w-24'  },
  { key: 'weight',                label: 'Weight (kg)',       width: 'w-24'  },
  { key: 'place_of_loss',         label: 'Place of Loss',     width: 'w-32'  },
  { key: 'diagnosis',             label: 'Diagnosis',         width: 'w-48'  },
  { key: 'medications',           label: 'Medications',       width: 'w-48'  },
  { key: 'medicine_cost',         label: 'Medicine Cost (₱)', width: 'w-32'  },
  { key: 'veterinary_services',   label: 'Vet Services',      width: 'w-48'  },
  { key: 'service_cost',          label: 'Service Cost (₱)',  width: 'w-28'  },
  { key: 'vet_clinic',            label: 'Vet Clinic',        width: 'w-40'  },
  { key: 'claim_type',            label: 'Claim Type',        width: 'w-28'  },
  { key: 'status',                label: 'Status',            width: 'w-24'  },
  { key: 'missing_documents',     label: 'Missing Docs',      width: 'w-44'  },
  { key: 'stage',                 label: 'Stage',             width: 'w-36'  },
  { key: 'total_amount_paid',     label: 'Amount Paid (₱)',   width: 'w-32'  },
  { key: 'created_at',            label: 'Created At',        width: 'w-36'  },
  { key: 'updated_at',            label: 'Updated At',        width: 'w-36'  },
]

const STATUS_BADGE: Record<string, string> = {
  Open:     'bg-blue-100 text-blue-700',
  Pending:  'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Denied:   'bg-red-100 text-red-700',
}

function formatCell(key: keyof Claim, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if ((key === 'medicine_cost' || key === 'service_cost' || key === 'total_amount_paid') && typeof value === 'number') {
    return `₱${Number(value).toLocaleString()}`
  }
  if ((key === 'created_at' || key === 'updated_at') && typeof value === 'string') {
    return new Date(value).toLocaleDateString()
  }
  return String(value)
}

export default function MasterlistPage({ claims, onRefresh }: Props) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<keyof Claim>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return claims.filter(c =>
      !q ||
      Object.values(c).some(v => String(v ?? '').toLowerCase().includes(q))
    )
  }, [claims, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = String(a[sortKey] ?? '')
      const bv = String(b[sortKey] ?? '')
      const cmp = av.localeCompare(bv, undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  function handleSort(key: keyof Claim) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = COLUMNS.map(c => c.label)
    const rows = sorted.map(claim =>
      COLUMNS.map(c => {
        const v = claim[c.key]
        return v === null || v === undefined ? '' : String(v)
      })
    )
    const csv = [headers, ...rows].map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    download(blob, 'claims-masterlist.csv')
  }

  function exportExcel() {
    const sheetData = sorted.map(claim => {
      const row: Record<string, unknown> = {}
      COLUMNS.forEach(c => { row[c.label] = claim[c.key] ?? '' })
      return row
    })
    const ws = XLSX.utils.json_to_sheet(sheetData)
    // Column widths
    ws['!cols'] = COLUMNS.map(c => ({ wch: Math.max(c.label.length, 14) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Claims Masterlist')
    XLSX.writeFile(wb, 'claims-masterlist.xlsx')
  }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Import ──────────────────────────────────────────────────────────────────
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

      // Map label → key
      const labelToKey = Object.fromEntries(COLUMNS.map(c => [c.label.toLowerCase(), c.key]))

      let created = 0
      let skipped = 0

      for (const row of rows) {
        // Normalise keys: try label match first, then direct key match
        const mapped: Record<string, unknown> = {}
        for (const [rawKey, val] of Object.entries(row)) {
          const norm = rawKey.toLowerCase().trim()
          const key = labelToKey[norm] ?? norm
          mapped[key] = val
        }

        // Skip rows that already have an ID matching an existing claim
        const existingIds = new Set(claims.map(c => c.id))
        if (mapped.id && existingIds.has(String(mapped.id))) { skipped++; continue }

        const payload = {
          client_name:           String(mapped.client_name           ?? ''),
          client_age:            Number(mapped.client_age            ?? 0),
          client_gender:         String(mapped.client_gender         ?? ''),
          location_of_residence: String(mapped.location_of_residence ?? ''),
          pet_name:              String(mapped.pet_name              ?? ''),
          species:               String(mapped.species               ?? ''),
          breed:                 String(mapped.breed                 ?? ''),
          breed_type:            String(mapped.breed_type            ?? ''),
          gender:                String(mapped.gender                ?? ''),
          neutering_status:      String(mapped.neutering_status      ?? ''),
          color:                 String(mapped.color                 ?? ''),
          age:                   Number(mapped.age                   ?? 0),
          weight:                Number(mapped.weight                ?? 0),
          place_of_loss:         String(mapped.place_of_loss         ?? ''),
          diagnosis:             String(mapped.diagnosis             ?? ''),
          medications:           String(mapped.medications           ?? ''),
          medicine_cost:         Number(mapped.medicine_cost         ?? 0),
          veterinary_services:   String(mapped.veterinary_services   ?? ''),
          service_cost:          Number(mapped.service_cost          ?? 0),
          vet_clinic:            String(mapped.vet_clinic            ?? ''),
          claim_type:            String(mapped.claim_type            ?? 'Illness'),
          status:                String(mapped.status                ?? 'Open') as Claim['status'],
          missing_documents:     String(mapped.missing_documents     ?? ''),
          stage:                 String(mapped.stage                 ?? 'Document Collection'),
          total_amount_paid:     Number(mapped.total_amount_paid     ?? 0),
        }

        await window.api.createClaim(payload)
        created++
      }

      setImportMsg(`✓ Imported ${created} record${created !== 1 ? 's' : ''}${skipped ? ` · ${skipped} skipped (duplicate ID)` : ''}`)
      onRefresh()
    } catch (err) {
      setImportMsg(`✗ Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search any field…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <span className="text-xs text-slate-400">{sorted.length} of {claims.length} records</span>

        <div className="flex items-center gap-2 ml-auto">
          {/* Import */}
          <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${importing ? 'opacity-50 cursor-wait' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <Upload className="w-3.5 h-3.5" />
            {importing ? 'Importing…' : 'Import'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={handleImport} disabled={importing} />
          </label>

          {/* Export CSV */}
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-green-500" />
            Export CSV
          </button>

          {/* Export Excel */}
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
            Export Excel
          </button>
        </div>

        {importMsg && (
          <p className={`w-full text-xs font-medium px-1 ${importMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
            {importMsg}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="text-xs border-collapse" style={{ minWidth: 'max-content' }}>
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0 ${col.width}`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key
                        ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                        : <ChevronUp className="w-3 h-3 text-slate-200" />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-slate-400">
                    No records found
                  </td>
                </tr>
              ) : sorted.map(claim => (
                <tr key={claim.id} className="hover:bg-blue-50/40 transition-colors">
                  {COLUMNS.map(col => {
                    const val = claim[col.key]
                    if (col.key === 'status') {
                      return (
                        <td key={col.key} className="px-3 py-2 border-r border-slate-50 last:border-r-0 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[String(val)] ?? 'bg-slate-100 text-slate-600'}`}>
                            {String(val)}
                          </span>
                        </td>
                      )
                    }
                    return (
                      <td
                        key={col.key}
                        className="px-3 py-2 text-slate-600 border-r border-slate-50 last:border-r-0 whitespace-nowrap max-w-xs truncate"
                        title={String(val ?? '')}
                      >
                        {formatCell(col.key, val)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between flex-shrink-0">
          <span>{sorted.length} record{sorted.length !== 1 ? 's' : ''} · {COLUMNS.length} columns</span>
          <span>Click any column header to sort · Scroll horizontally to see all fields</span>
        </div>
      </div>
    </div>
  )
}
