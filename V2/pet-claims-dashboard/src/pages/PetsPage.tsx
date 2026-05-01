import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Search, ChevronUp, ChevronDown, Upload, Download } from 'lucide-react'
import { Claim, Pet, Client } from '../types'
import { useAuth } from '../auth/AuthContext'
import { addAuditEvent } from '../audit/audit'

interface Props { claims: Claim[] }

interface PetRow {
  id: string
  name: string
  pedigree_number: string
  species: string
  breed: string
  breed_type: string
  gender: string
  neutering_status: string
  color: string
  age: number
  weight: number
  client_id: string
  owner_name: string
  claim_count: number
  created_at: string
  updated_at: string
}

type SortKey = keyof PetRow

function fmtDate(s: string) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString()
}

export default function PetsPage({ claims }: Props) {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [pets, setPets] = useState<Pet[]>([])
  const [clientsMap, setClientsMap] = useState<Map<string, Client>>(new Map())
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [petsData, clientsData] = await Promise.all([
        window.api.getPets(),
        window.api.getClients(),
      ])
      setPets(petsData)
      setClientsMap(new Map(clientsData.map(c => [c.id, c])))
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

  // Build rows from real DB records; join claims only for counts
  const rows = useMemo<PetRow[]>(() => {
    return pets.map(pet => {
      const owner = pet.client_id ? clientsMap.get(pet.client_id) : undefined
      const matching = claims.filter(
        c => c.pet_name === pet.name && c.species === pet.species && c.breed === pet.breed
      )
      return {
        id: pet.id,
        name: pet.name,
        pedigree_number: pet.pedigree_number || '',
        species: pet.species,
        breed: pet.breed,
        breed_type: pet.breed_type,
        gender: pet.gender,
        neutering_status: pet.neutering_status,
        color: pet.color,
        age: pet.age,
        weight: pet.weight,
        client_id: pet.client_id || '',
        owner_name: owner?.name || '',
        claim_count: matching.length,
        created_at: pet.created_at,
        updated_at: pet.updated_at,
      }
    })
  }, [pets, clientsMap, claims])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(p =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.pedigree_number.toLowerCase().includes(q) ||
      p.species.toLowerCase().includes(q) ||
      p.breed.toLowerCase().includes(q) ||
      p.owner_name.toLowerCase().includes(q) ||
      p.client_id.toLowerCase().includes(q)
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

  // id and client_id are hidden from export per policy
  const EXPORT_COLS: { key: SortKey; label: string }[] = [
    { key: 'name',            label: 'Pet Name' },
    { key: 'pedigree_number', label: 'Pedigree #' },
    { key: 'species',         label: 'Species' },
    { key: 'breed',           label: 'Breed' },
    { key: 'breed_type',      label: 'Type' },
    { key: 'gender',          label: 'Gender' },
    { key: 'neutering_status',label: 'Neutering' },
    { key: 'color',           label: 'Color' },
    { key: 'age',             label: 'Age (yr)' },
    { key: 'weight',          label: 'Weight (kg)' },
    { key: 'owner_name',      label: 'Owner' },
    { key: 'created_at',      label: 'Created At' },
    { key: 'updated_at',      label: 'Updated At' },
    { key: 'claim_count',     label: 'Claims' },
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
        return v === null || v === undefined ? '' : String(v)
      })
    )
    const csv = [headers, ...rowsData].map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), 'pets.csv')
    if (user) addAuditEvent(user, { action: 'export', entity: 'pet', details: { format: 'csv', rows: sorted.length, cols: EXPORT_COLS.length } })
  }

  function exportExcel() {
    const sheetData = sorted.map(r => {
      const row: Record<string, unknown> = {}
      EXPORT_COLS.forEach(c => { row[c.label] = r[c.key] ?? '' })
      return row
    })
    const ws = XLSX.utils.json_to_sheet(sheetData)
    ws['!cols'] = EXPORT_COLS.map(c => ({ wch: Math.max(c.label.length, 14) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pets')
    XLSX.writeFile(wb, 'pets.xlsx')
    if (user) addAuditEvent(user, { action: 'export', entity: 'pet', details: { format: 'xlsx', rows: sorted.length, cols: EXPORT_COLS.length } })
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  const IMPORT_FIELDS: { key: keyof Omit<Pet, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>; label: string }[] = [
    { key: 'client_id',        label: 'Owner ID' },
    { key: 'name',             label: 'Pet Name' },
    { key: 'pedigree_number',  label: 'Pedigree #' },
    { key: 'species',          label: 'Species' },
    { key: 'breed',            label: 'Breed' },
    { key: 'breed_type',       label: 'Type' },
    { key: 'gender',           label: 'Gender' },
    { key: 'neutering_status', label: 'Neutering' },
    { key: 'color',            label: 'Color' },
    { key: 'age',              label: 'Age (yr)' },
    { key: 'weight',           label: 'Weight (kg)' },
  ]

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([IMPORT_FIELDS.map(f => f.label)])
    ws['!cols'] = IMPORT_FIELDS.map(f => ({ wch: Math.max(f.label.length, 16) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pets Import Template')
    XLSX.writeFile(wb, 'pets-import-template.xlsx')
    if (user) addAuditEvent(user, { action: 'download_template', entity: 'template', details: { name: 'pets-import-template.xlsx' } })
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
      const rowsImport = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

      const labelToKey = Object.fromEntries(IMPORT_FIELDS.map(f => [f.label.toLowerCase(), f.key]))
      const keyAliases: Record<string, string> = {
        pet_name: 'name',
        pedigree: 'pedigree_number',
        pedigree_no: 'pedigree_number',
        owner_id: 'client_id',
        client_id: 'client_id',
      }

      const existingById = new Map(pets.map(p => [p.id, p]))
      const existingByMatch = new Map(pets.map(p => [`${p.name}||${p.species}||${p.breed}`.toLowerCase(), p]))

      let created = 0
      let updated = 0
      let skipped = 0

      for (let i = 0; i < rowsImport.length; i++) {
        const raw = rowsImport[i]
        const mapped: Record<string, unknown> = {}
        for (const [rawKey, val] of Object.entries(raw)) {
          const norm = rawKey.toLowerCase().trim().replace(/\s+/g, '_')
          const key = labelToKey[norm.replace(/_/g, ' ')] ?? labelToKey[norm] ?? keyAliases[norm] ?? norm
          mapped[key] = val
        }

        const name = String(mapped.name ?? '').trim()
        const species = String(mapped.species ?? '').trim()
        const breed = String(mapped.breed ?? '').trim()
        if (!name || !species || !breed) { skipped++; continue }

        const clientId = String(mapped.client_id ?? '').trim()
        const data: Omit<Pet, 'id' | 'created_at' | 'updated_at'> = {
          client_id: clientId ? clientId : null,
          name,
          pedigree_number: String(mapped.pedigree_number ?? '').trim(),
          species,
          breed,
          breed_type: String(mapped.breed_type ?? '').trim(),
          gender: String(mapped.gender ?? '').trim(),
          neutering_status: String(mapped.neutering_status ?? '').trim(),
          color: String(mapped.color ?? '').trim(),
          age: Number(mapped.age ?? 0),
          weight: Number(mapped.weight ?? 0),
        }

        const incomingId = String(mapped.id ?? '').trim()
        const matchKey = `${name}||${species}||${breed}`.toLowerCase()

        const existing =
          (incomingId && existingById.get(incomingId)) ||
          existingByMatch.get(matchKey)

        if (existing) {
          await window.api.updatePet(existing.id, data, { name: existing.name, species: existing.species, breed: existing.breed })
          updated++
        } else {
          await window.api.createPet(data)
          created++
        }
      }

      setImportMsg(`✓ Imported: ${created} created · ${updated} updated · ${skipped} skipped`)
      if (user) addAuditEvent(user, { action: 'import', entity: 'pet', details: { file: file.name, created, updated, skipped, rows: rowsImport.length } })
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

  // Table columns (id + client_id shown in table but excluded from export)
  const TABLE_COLS: { key: SortKey; label: string }[] = [
    { key: 'id',              label: 'Pet ID' },
    { key: 'name',            label: 'Pet Name' },
    { key: 'pedigree_number', label: 'Pedigree #' },
    { key: 'species',         label: 'Species' },
    { key: 'breed',           label: 'Breed' },
    { key: 'breed_type',      label: 'Type' },
    { key: 'gender',          label: 'Gender' },
    { key: 'neutering_status',label: 'Neutering' },
    { key: 'color',           label: 'Color' },
    { key: 'age',             label: 'Age (yr)' },
    { key: 'weight',          label: 'Weight (kg)' },
    { key: 'client_id',       label: 'Owner ID' },
    { key: 'owner_name',      label: 'Owner Name' },
    { key: 'created_at',      label: 'Created At' },
    { key: 'updated_at',      label: 'Updated At' },
    { key: 'claim_count',     label: 'Claims' },
  ]

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search pets…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-slate-400">{sorted.length} of {rows.length} pets</span>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            disabled={importing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${importing ? 'opacity-50 cursor-wait' : 'border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'}`}
            title="Import pets"
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
                    onClick={() => handleSort(key)}
                    className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-slate-700"
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
                  <td colSpan={TABLE_COLS.length} className="px-4 py-12 text-center text-slate-400">No pets found</td>
                </tr>
              ) : sorted.map(p => (
                <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{p.id}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">{p.name}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{p.pedigree_number || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{p.species}</td>
                  <td className="px-3 py-2 text-slate-500">{p.breed}</td>
                  <td className="px-3 py-2 text-slate-500">{p.breed_type}</td>
                  <td className="px-3 py-2 text-slate-500">{p.gender}</td>
                  <td className="px-3 py-2 text-slate-500">{p.neutering_status}</td>
                  <td className="px-3 py-2 text-slate-500">{p.color || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{p.age}</td>
                  <td className="px-3 py-2 text-slate-500">{p.weight}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{p.client_id || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{p.owner_name || '—'}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(p.updated_at)}</td>
                  <td className="px-3 py-2 text-slate-500">{p.claim_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400 flex-shrink-0">
          {sorted.length} pet{sorted.length !== 1 ? 's' : ''} · Click column headers to sort · IDs hidden from export
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImportModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 flex flex-col gap-4" onClick={ev => ev.stopPropagation()}>
            <h2 className="text-sm font-semibold text-slate-800">Import Pets</h2>
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
