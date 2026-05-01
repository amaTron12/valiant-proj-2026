import React, { useState, useEffect, useRef, useMemo } from 'react'
import { X, ImagePlus, Trash2, Loader2, ScanText, Cloud, ExternalLink, ChevronDown, Search, Plus } from 'lucide-react'
import { Claim, ClaimImage, DriveLink, DiagnosisType, DriveFile } from '../types'
import { useAuth } from '../auth/AuthContext'
import { addAuditEvent } from '../audit/audit'

interface Props {
  claim?: Claim | null
  onSave: (data: Omit<Claim, 'id' | 'created_at' | 'updated_at'>) => void
  onClose: () => void
}

const EMPTY: Omit<Claim, 'id' | 'created_at' | 'updated_at'> = {
  policy_number: '', card_number: '',
  client_name: '', client_age: 0, client_gender: 'Male', location_of_residence: '',
  pet_name: '', pedigree_number: '', species: 'Dog', breed: '', breed_type: 'Pure', gender: 'Male',
  neutering_status: 'Intact', color: '', age: 0, weight: 0,
  place_of_loss: '', diagnosis: '', medications: '', medicine_cost: 0,
  veterinary_services: '', service_cost: 0,
  vet_clinic: '', claim_type: 'Illness', status: 'Open',
  missing_documents: '', stage: 'Document Collection', total_amount_paid: 0,
  // Policy & Branch
  line_of_business: '', branch_code: '', branch: '', external_policy: '',
  date_issued: '', date_of_loss: '', date_reported: '', date_registered: '',
  inception_date: '', expiry_date: '', local_global: '', country: '', original_currency: '', year: undefined,
  // People & Agents
  client_no: '', master_client: '', claimant: '', payee: '',
  handler_code: '', handler_name: '', agent_code: '', agent_name: '',
  sub_agent_code: '', adj_provider_code: '', adj_provider_name: '', birthday: '',
  // Financials
  basic_premium: 0, sum_insured: 0, net_reserve: 0, ri_reserve: 0, total_reserve: 0,
  insured_net_payment: 0, adj_provider_net_payment: 0, tp_claim_payment: 0, ri_payment: 0,
  total_payment: 0, total_net: 0, total_ri: 0, total_claim: 0,
  date_first_payment: '', date_last_payment: '',
  // Filterable extras
  claim_reason: '', catastrophe: '', narrative: '',
  misc: '',
}

const EMPTY_MISC: import('../types').ClaimMisc = {
  imei_number: '', airline: '', aon_event: '',
  travel_sum_insured: 0, catastrophe_code: '', claimant_count: 0,
  last_diary_entry: '', diary_description: '',
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

type Tab = 'client' | 'pet' | 'claim' | 'policy' | 'parties' | 'financials' | 'admin' | 'images' | 'drive'

const TABS: { key: Tab; label: string }[] = [
  { key: 'client',     label: 'Client' },
  { key: 'pet',        label: 'Pet' },
  { key: 'claim',      label: 'Medical' },
  { key: 'policy',     label: 'Policy' },
  { key: 'parties',    label: 'Parties' },
  { key: 'financials', label: 'Financials' },
  { key: 'admin',      label: 'Admin' },
  { key: 'images',     label: 'Images' },
  { key: 'drive',      label: 'Drive' },
]


export default function ClaimModal({ claim, onSave, onClose }: Props) {
  const { user } = useAuth()
  const [form, setForm] = useState<Omit<Claim, 'id' | 'created_at' | 'updated_at'>>(EMPTY)
  const [tab, setTab] = useState<Tab>('client')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [images, setImages] = useState<ClaimImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [addingImages, setAddingImages] = useState(false)
  const [lightbox, setLightbox] = useState<ClaimImage | null>(null)
  const [imageType, setImageType] = useState<ClaimImage['doc_type']>('Prescription')
  const [ocrBusyId, setOcrBusyId] = useState<string | null>(null)
  const [ocrMsg, setOcrMsg] = useState<string>('')
  const [driveLinks, setDriveLinks] = useState<DriveLink[]>([])
  const [loadingDrive, setLoadingDrive] = useState(false)
  const [diagnosisTypes, setDiagnosisTypes] = useState<DiagnosisType[]>([])
  const [miscForm, setMiscForm] = useState<import('../types').ClaimMisc>(EMPTY_MISC)

  // Drive quick-scan (for NEW claims before saving)
  const [driveScanOpen, setDriveScanOpen] = useState(false)
  const [driveQuery, setDriveQuery] = useState('')
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveErr, setDriveErr] = useState('')
  const [driveScanningId, setDriveScanningId] = useState<string | null>(null)

  // Load diagnosis reference list once on mount
  useEffect(() => {
    window.api.getDiagnosisTypes().then(setDiagnosisTypes).catch(() => {})
  }, [])

  // Load Drive files when quick-scan is open (debounced)
  useEffect(() => {
    if (!driveScanOpen) return
    let cancelled = false
    setDriveErr('')
    setDriveLoading(true)
    const t = setTimeout(async () => {
      try {
        const files = await window.api.gdriveListFiles(driveQuery.trim() || undefined)
        if (!cancelled) setDriveFiles(files)
      } catch (e) {
        if (!cancelled) setDriveErr(e instanceof Error ? e.message : 'Failed to list Drive files')
      } finally {
        if (!cancelled) setDriveLoading(false)
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(t) }
  }, [driveScanOpen, driveQuery])

  useEffect(() => {
    if (claim) {
      const { id, created_at, updated_at, ...rest } = claim
      setForm(rest)
      // Parse misc JSON
      try { setMiscForm(rest.misc ? JSON.parse(rest.misc) : EMPTY_MISC) }
      catch { setMiscForm(EMPTY_MISC) }
      setLoadingImages(true)
      window.api.getClaimImages(claim.id)
        .then(setImages)
        .finally(() => setLoadingImages(false))
      setLoadingDrive(true)
      window.api.gdriveGetLinks(claim.id)
        .then(setDriveLinks)
        .finally(() => setLoadingDrive(false))
    } else {
      setForm(EMPTY)
      setMiscForm(EMPTY_MISC)
      setImages([])
      setDriveLinks([])
      setDriveScanOpen(false)
      setDriveQuery('')
      setDriveFiles([])
      setDriveErr('')
      setDriveScanningId(null)
    }
    setTab('client')
    setErrors({})
  }, [claim])

  function mimeLabel(mime: string) {
    if (mime.includes('pdf')) return 'PDF'
    if (mime.includes('spreadsheet') || mime.includes('excel')) return 'Sheet'
    if (mime.includes('document') || mime.includes('word')) return 'Doc'
    if (mime.includes('image')) return 'Image'
    if (mime.includes('presentation')) return 'Slides'
    return 'File'
  }

  async function scanDriveFile(file: DriveFile) {
    setOcrMsg('')
    setDriveErr('')
    setDriveScanningId(file.id)
    try {
      const { dataUrl } = await window.api.gdriveDownloadFile(file.id)
      const { scanDriveImage } = await import('../ocr/ocr')
      const res = await scanDriveImage(dataUrl, { mimeType: file.mimeType, name: file.name })

      // Apply any extracted fields that match Claim keys
      setForm(prev => {
        const next = { ...prev } as Record<string, any>
        for (const [k, v] of Object.entries(res)) {
          if (k === 'rawText' || k === 'foundFields' || k === 'missingFields') continue
          if (Object.prototype.hasOwnProperty.call(EMPTY, k) && v !== undefined && v !== null && v !== '') {
            next[k] = v as any
          }
        }
        return next as typeof prev
      })

      // Populate misc sub-fields (even when claim isn't saved yet)
      const miscKeys = [
        'imei_number',
        'airline',
        'aon_event',
        'travel_sum_insured',
        'catastrophe_code',
        'claimant_count',
        'last_diary_entry',
        'diary_description',
      ] as const
      let miscTouched = false
      setMiscForm(prev => {
        const next = { ...prev }
        for (const k of miscKeys) {
          const v = (res as any)[k]
          if (v === undefined || v === null || v === '') continue
          ;(next as any)[k] = v
          miscTouched = true
        }
        return next
      })

      const filled = res.foundFields?.length ?? 0
      setOcrMsg(filled ? `OCR filled ${filled} field${filled !== 1 ? 's' : ''} from Drive (${file.name})` : 'OCR ran but found no matching fields')
      if (user) addAuditEvent(user, { action: 'update', entity: 'claim', entityId: claim?.id, details: { via: 'drive_ocr', file: { id: file.id, name: file.name, mimeType: file.mimeType }, extracted: { found: res.foundFields, missing: res.missingFields } } })
      setDriveScanOpen(false)
    } catch (e) {
      setDriveErr(e instanceof Error ? e.message : 'OCR scan failed')
      setOcrMsg(`OCR failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setDriveScanningId(null)
    }
  }

  async function handleAddImages() {
    if (!claim) return
    setAddingImages(true)
    try {
      const added = await window.api.pickClaimImages(claim.id, imageType)
      if (added.length > 0) setImages(prev => [...prev, ...added])
      if (user && added.length > 0) addAuditEvent(user, { action: 'add_images', entity: 'claim_image', details: { claimId: claim.id, count: added.length } })
    } finally {
      setAddingImages(false)
    }
  }

  async function handleDeleteImage(img: ClaimImage) {
    await window.api.deleteClaimImage(img.id)
    if (user) addAuditEvent(user, { action: 'delete', entity: 'claim_image', entityId: img.id, details: { claimId: claim?.id, filename: img.filename } })
    setImages(prev => prev.filter(i => i.id !== img.id))
  }

  async function handleOcr(img: ClaimImage) {
    if (!img.dataUrl) return
    setOcrMsg('')
    setOcrBusyId(img.id)
    try {
      // Lazy-load OCR to avoid blocking modal render
      const { runOcrAndExtract } = await import('../ocr/ocr')
      const res = await runOcrAndExtract(img.dataUrl, img.doc_type ?? 'Other')
      setForm(prev => ({
        ...prev,
        ...(res.policy_number ? { policy_number: res.policy_number } : {}),
        ...(res.card_number ? { card_number: res.card_number } : {}),
        ...(res.species ? { species: res.species } : {}),
        ...(res.breed ? { breed: res.breed } : {}),
        ...(res.gender ? { gender: res.gender } : {}),
        ...(typeof res.age === 'number' ? { age: res.age } : {}),
      }))
      const filled = Object.keys(res).length
      setOcrMsg(filled ? `OCR filled ${filled} field${filled !== 1 ? 's' : ''} from ${img.doc_type ?? 'Other'}` : 'OCR ran but found no matching fields')
      if (user) addAuditEvent(user, { action: 'update', entity: 'claim', entityId: claim?.id, details: { via: 'ocr', docType: img.doc_type ?? 'Other', extracted: res } })
    } catch (e) {
      setOcrMsg(`OCR failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setOcrBusyId(null)
    }
  }

  const set = (k: keyof typeof form, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }))

  const num = (v: string) => parseFloat(v) || 0
  const int = (v: string) => parseInt(v) || 0

  function validate() {
    const e: Record<string, string> = {}
    if (!form.client_name.trim()) e.client_name = 'Required'
    if (!form.pet_name.trim()) e.pet_name = 'Required'
    if (!form.diagnosis.trim()) e.diagnosis = 'Required'
    if (!form.vet_clinic.trim()) e.vet_clinic = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    onSave({ ...form, misc: JSON.stringify(miscForm) })
  }

  const setMisc = <K extends keyof import('../types').ClaimMisc>(k: K, v: import('../types').ClaimMisc[K]) =>
    setMiscForm(f => ({ ...f, [k]: v }))

  // ── Multi-select diagnosis picker ──────────────────────────────────────────
  // Parses form.diagnosis (comma-separated) into an array and vice-versa
  const selectedDiagnoses = useMemo(
    () => form.diagnosis ? form.diagnosis.split(',').map(s => s.trim()).filter(Boolean) : [],
    [form.diagnosis]
  )

  function toggleDiagnosis(name: string) {
    const current = selectedDiagnoses
    const next = current.includes(name)
      ? current.filter(d => d !== name)
      : [...current, name]
    set('diagnosis', next.join(', '))
  }

  function removeDiagnosis(name: string) {
    set('diagnosis', selectedDiagnoses.filter(d => d !== name).join(', '))
  }

  function DiagnosisPicker() {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const ref = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
      function handler(e: MouseEvent) {
        if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, [])

    const filtered = useMemo(() => {
      const q = search.toLowerCase()
      return diagnosisTypes.filter(d => !q || d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q))
    }, [search])

    const canAddCustom = useMemo(() => {
      const v = search.trim()
      if (!v) return false
      const existsInSelected = selectedDiagnoses.some(d => d.toLowerCase() === v.toLowerCase())
      const existsInList = diagnosisTypes.some(d => d.name.toLowerCase() === v.toLowerCase())
      return !existsInSelected && !existsInList
    }, [search, selectedDiagnoses, diagnosisTypes])

    function addCustom() {
      const v = search.trim()
      if (!v) return
      toggleDiagnosis(v)
      setSearch('')
    }

    // Group by category
    const grouped = useMemo(() => {
      const map = new Map<string, DiagnosisType[]>()
      filtered.forEach(d => {
        const key = d.category || 'Other'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(d)
      })
      return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    }, [filtered])

    const hasError = !!errors.diagnosis

    return (
      <div ref={ref} className="relative">
        {/* Tag display + trigger */}
        <div
          onClick={() => setOpen(o => !o)}
          className={`min-h-[2.5rem] w-full px-3 py-2 rounded-lg border cursor-pointer flex flex-wrap gap-1.5 items-center
            ${hasError ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}
            focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent`}
        >
          {selectedDiagnoses.length === 0 && (
            <span className="text-sm text-slate-400">Select diagnosis types…</span>
          )}
          {selectedDiagnoses.map(name => (
            <span
              key={name}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200"
            >
              {name}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeDiagnosis(name) }}
                className="hover:text-blue-900 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 ml-auto flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg max-h-64 flex flex-col">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Search diagnosis…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (canAddCustom) addCustom()
                  }
                }}
                onClick={e => e.stopPropagation()}
                className="flex-1 text-xs outline-none bg-transparent"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Options */}
            <div className="overflow-y-auto flex-1">
              {canAddCustom && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); addCustom() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors hover:bg-blue-50"
                  title="Add as a custom diagnosis"
                >
                  <div className="w-4 h-4 rounded border-2 border-slate-300 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3 h-3 text-slate-500" />
                  </div>
                  <span className="text-slate-700">Add “{search.trim()}”</span>
                </button>
              )}
              {diagnosisTypes.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No diagnosis types defined yet —<br />add them under Claims → Diagnosis
                </p>
              ) : grouped.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No matches</p>
              ) : grouped.map(([cat, items]) => (
                <div key={cat}>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 sticky top-0">
                    {cat}
                  </div>
                  {items.map(d => {
                    const checked = selectedDiagnoses.includes(d.name)
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={e => { e.stopPropagation(); toggleDiagnosis(d.name) }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors hover:bg-blue-50 ${checked ? 'bg-blue-50/60' : ''}`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                          {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        <span className={checked ? 'font-medium text-blue-700' : 'text-slate-700'}>{d.name}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            {selectedDiagnoses.length > 0 && (
              <div className="border-t border-slate-100 px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">{selectedDiagnoses.length} selected</span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); set('diagnosis', '') }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
  // ───────────────────────────────────────────────────────────────────────────

  const inp = (k: keyof typeof form, type = 'text', placeholder = '') => (
    <input
      type={type}
      value={form[k] as string | number}
      onChange={e => set(k, type === 'number' ? (k === 'age' || k === 'client_age' ? int(e.target.value) : num(e.target.value)) : e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 text-sm rounded-lg border ${errors[k] ? 'border-red-300 bg-red-50' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
    />
  )

  const sel = (k: keyof typeof form, opts: string[]) => (
    <select
      value={form[k] as string}
      onChange={e => set(k, e.target.value)}
      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
    >
      {opts.map(o => <option key={o}>{o}</option>)}
    </select>
  )

  const textarea = (k: keyof typeof form, rows = 2) => (
    <textarea
      value={form[k] as string}
      onChange={e => set(k, e.target.value)}
      rows={rows}
      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
    />
  )

  return (
    <>
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-semibold text-slate-800 truncate">
              {claim ? `Edit ${claim.id}` : 'New Claim'}
            </h2>
            {!claim && (
              <button
                type="button"
                onClick={() => { setDriveScanOpen(true); setTab('client') }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                title="Scan a Drive file and auto-fill fields"
              >
                <ScanText className="w-3.5 h-3.5 text-blue-600" />
                Scan from Drive
              </button>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-3 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {!claim && driveScanOpen && (
              <div className="mb-4 bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                      <Cloud className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-700">Scan from Google Drive</div>
                      <div className="text-[11px] text-slate-400">Pick a file, OCR it, and we’ll fill matching fields immediately.</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDriveScanOpen(false)}
                    className="ml-auto p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-white"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-3 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={driveQuery}
                    onChange={e => setDriveQuery(e.target.value)}
                    placeholder="Search Drive files…"
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {driveErr && <div className="mt-2 text-xs text-red-600">{driveErr}</div>}

                <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white">
                  {driveLoading ? (
                    <div className="p-4 text-xs text-slate-400 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading files…
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="p-4 text-xs text-slate-400">No files found.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {driveFiles.slice(0, 50).map(f => {
                        const busy = driveScanningId === f.id
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => scanDriveFile(f)}
                            disabled={!!driveScanningId}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors disabled:opacity-60"
                            title="Scan this file"
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                              <ScanText className={`w-4 h-4 ${busy ? 'text-slate-400' : 'text-blue-600'}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-slate-700 truncate">{f.name}</div>
                              <div className="text-[11px] text-slate-400">{mimeLabel(f.mimeType)}</div>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2">
                              {busy ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Scanning…
                                </>
                              ) : (
                                'Scan'
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
            {tab === 'client' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Policy Number">{inp('policy_number', 'text', 'Policy number')}</Field>
                </div>
                <div className="col-span-2">
                  <Field label="Client Health Card ID (Card Num)">{inp('card_number', 'text', 'Card number')}</Field>
                </div>
                <div className="col-span-2">
                  <Field label="Client Name *" error={errors.client_name}>{inp('client_name', 'text', 'Full name')}</Field>
                </div>
                <Field label="Age">{inp('client_age', 'number')}</Field>
                <Field label="Gender">{sel('client_gender', ['Male', 'Female', 'Other'])}</Field>
                <div className="col-span-2">
                  <Field label="Location of Residence">{inp('location_of_residence', 'text', 'City / Address')}</Field>
                </div>
              </div>
            )}

            {tab === 'pet' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Pet Name *" error={errors.pet_name}>{inp('pet_name', 'text', 'Pet name')}</Field>
                <Field label="Pedigree #">{inp('pedigree_number', 'text', 'Pedigree number')}</Field>
                <Field label="Species">{sel('species', ['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'])}</Field>
                <Field label="Breed">{inp('breed', 'text', 'Breed')}</Field>
                <Field label="Breed Type">{sel('breed_type', ['Pure', 'Mixed', 'Unknown'])}</Field>
                <Field label="Gender">{sel('gender', ['Male', 'Female'])}</Field>
                <Field label="Neutering Status">{sel('neutering_status', ['Intact', 'Neutered', 'Spayed'])}</Field>
                <Field label="Color">{inp('color', 'text', 'Color / Markings')}</Field>
                <Field label="Age (years)">{inp('age', 'number')}</Field>
                <Field label="Weight (kg)">{inp('weight', 'number')}</Field>
              </div>
            )}

            {tab === 'claim' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Diagnosis *" error={errors.diagnosis}>
                    <DiagnosisPicker />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Medications">{textarea('medications')}</Field>
                </div>
                <Field label="Medicine Cost (₱)">{inp('medicine_cost', 'number')}</Field>
                <div className="col-span-2">
                  <Field label="Veterinary Services">{textarea('veterinary_services')}</Field>
                </div>
                <Field label="Service Cost (₱)">{inp('service_cost', 'number')}</Field>
                <Field label="Place of Loss">{inp('place_of_loss', 'text', 'Where incident occurred')}</Field>
                <div className="col-span-2">
                  <Field label="Vet Clinic *" error={errors.vet_clinic}>{inp('vet_clinic', 'text', 'Clinic name')}</Field>
                </div>
              </div>
            )}

            {tab === 'policy' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Line of Business">{inp('line_of_business', 'text', 'e.g. Pet, Travel')}</Field>
                <Field label="External Policy">{inp('external_policy', 'text', 'External reference')}</Field>
                <Field label="Branch Code">{inp('branch_code', 'text', 'Code')}</Field>
                <Field label="Branch">{inp('branch', 'text', 'Branch name')}</Field>
                <Field label="Date Issued">{inp('date_issued', 'date')}</Field>
                <Field label="Date of Loss">{inp('date_of_loss', 'date')}</Field>
                <Field label="Date Reported">{inp('date_reported', 'date')}</Field>
                <Field label="Date Registered">{inp('date_registered', 'date')}</Field>
                <Field label="Inception Date">{inp('inception_date', 'date')}</Field>
                <Field label="Expiry Date">{inp('expiry_date', 'date')}</Field>
                <Field label="Local / Global">{sel('local_global', ['', 'Local', 'Global'])}</Field>
                <Field label="Country">{inp('country', 'text', 'Country')}</Field>
                <Field label="Original Currency">{inp('original_currency', 'text', 'e.g. PHP, USD')}</Field>
                <Field label="Year">{inp('year', 'number')}</Field>
                <div className="col-span-2">
                  <Field label="Claim Reason">{inp('claim_reason', 'text', 'Reason for claim')}</Field>
                </div>
                <div className="col-span-2">
                  <Field label="Catastrophe">{inp('catastrophe', 'text', 'e.g. Typhoon Odette')}</Field>
                </div>
                <div className="col-span-2">
                  <Field label="Narrative">{textarea('narrative', 3)}</Field>
                </div>
              </div>
            )}

            {tab === 'parties' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Client No">{inp('client_no', 'text', 'Client number')}</Field>
                <Field label="Master Client">{inp('master_client', 'text', 'Master client reference')}</Field>
                <Field label="Claimant">{inp('claimant', 'text', 'Claimant name')}</Field>
                <Field label="Payee">{inp('payee', 'text', 'Payee name')}</Field>
                <Field label="Handler Code">{inp('handler_code', 'text', 'Code')}</Field>
                <Field label="Handler Name">{inp('handler_name', 'text', 'Name')}</Field>
                <Field label="Agent Code">{inp('agent_code', 'text', 'Code')}</Field>
                <Field label="Agent Name">{inp('agent_name', 'text', 'Name')}</Field>
                <Field label="Sub Agent Code">{inp('sub_agent_code', 'text', 'Code')}</Field>
                <div className="col-span-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Adjuster / Provider</p>
                </div>
                <Field label="Code">{inp('adj_provider_code', 'text', 'Adjuster code')}</Field>
                <Field label="Name">{inp('adj_provider_name', 'text', 'Adjuster name')}</Field>
                <Field label="Birthday (Client)">{inp('birthday', 'date')}</Field>
              </div>
            )}

            {tab === 'financials' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Basic Premium (₱)">{inp('basic_premium', 'number')}</Field>
                <Field label="Sum Insured (₱)">{inp('sum_insured', 'number')}</Field>
                <div className="col-span-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Reserves</p>
                </div>
                <Field label="Net Reserve (₱)">{inp('net_reserve', 'number')}</Field>
                <Field label="RI Reserve (₱)">{inp('ri_reserve', 'number')}</Field>
                <div className="col-span-2">
                  <Field label="Total Reserve (₱)">{inp('total_reserve', 'number')}</Field>
                </div>
                <div className="col-span-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Payments</p>
                </div>
                <Field label="Insured Net Payment (₱)">{inp('insured_net_payment', 'number')}</Field>
                <Field label="Adj/Provider Net Payment (₱)">{inp('adj_provider_net_payment', 'number')}</Field>
                <Field label="TP Claim Payment (₱)">{inp('tp_claim_payment', 'number')}</Field>
                <Field label="RI Payment (₱)">{inp('ri_payment', 'number')}</Field>
                <Field label="Total Payment (₱)">{inp('total_payment', 'number')}</Field>
                <Field label="Total Net (₱)">{inp('total_net', 'number')}</Field>
                <Field label="Total RI (₱)">{inp('total_ri', 'number')}</Field>
                <Field label="Total Claim (₱)">{inp('total_claim', 'number')}</Field>
                <Field label="Date 1st Payment">{inp('date_first_payment', 'date')}</Field>
                <Field label="Date Last Payment">{inp('date_last_payment', 'date')}</Field>
                <div className="col-span-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Misc</p>
                </div>
                <Field label="Travel Sum Insured (₱)">
                  <input type="number" value={miscForm.travel_sum_insured ?? 0}
                    onChange={e => setMisc('travel_sum_insured', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </Field>
                <Field label="Claimant Count">
                  <input type="number" value={miscForm.claimant_count ?? 0}
                    onChange={e => setMisc('claimant_count', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </Field>
                <Field label="Catastrophe Code">
                  <input type="text" value={miscForm.catastrophe_code ?? ''}
                    onChange={e => setMisc('catastrophe_code', e.target.value)}
                    placeholder="Code" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </Field>
                <Field label="IMEI Number">
                  <input type="text" value={miscForm.imei_number ?? ''}
                    onChange={e => setMisc('imei_number', e.target.value)}
                    placeholder="Device IMEI" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </Field>
                <Field label="Airline">
                  <input type="text" value={miscForm.airline ?? ''}
                    onChange={e => setMisc('airline', e.target.value)}
                    placeholder="Airline name" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </Field>
                <Field label="AON Event">
                  <input type="text" value={miscForm.aon_event ?? ''}
                    onChange={e => setMisc('aon_event', e.target.value)}
                    placeholder="AON event reference" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </Field>
                <Field label="Last Diary Entry">
                  <input type="date" value={miscForm.last_diary_entry ?? ''}
                    onChange={e => setMisc('last_diary_entry', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </Field>
                <div className="col-span-2">
                  <Field label="Diary Description">
                    <textarea value={miscForm.diary_description ?? ''} rows={2}
                      onChange={e => setMisc('diary_description', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </Field>
                </div>
              </div>
            )}

            {tab === 'admin' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Claim Type">{sel('claim_type', ['Illness', 'Accident', 'Dental', 'Wellness', 'Emergency', 'Other'])}</Field>
                <Field label="Status">{sel('status', ['Open', 'Pending', 'Approved', 'Denied'])}</Field>
                <Field label="Stage">{sel('stage', ['Document Collection', 'Under Review', 'Approved', 'Completed', 'Closed'])}</Field>
                <Field label="Total Amount Paid (₱)">{inp('total_amount_paid', 'number')}</Field>
                <div className="col-span-2">
                  <Field label="Missing Documents">{textarea('missing_documents')}</Field>
                </div>
              </div>
            )}

            {tab === 'drive' && (
              <div className="space-y-3">
                {!claim ? (
                  <p className="text-sm text-slate-400 text-center py-8">Save the claim first to view linked Drive documents.</p>
                ) : loadingDrive ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                ) : driveLinks.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                    <Cloud className="w-8 h-8" />
                    <p className="text-sm">No Drive documents linked</p>
                    <p className="text-xs text-center">Go to Connections → Google Drive to browse and attach documents to this claim.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 overflow-hidden">
                    {driveLinks.map(link => (
                      <div key={link.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50">
                        <Cloud className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{link.file_name}</p>
                          <p className="text-xs text-slate-400">{new Date(link.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => window.api.gdriveOpenFile(link.web_view_link)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
                            title="Open in Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => window.api.gdriveUnlinkFile(link.id).then(() => setDriveLinks(prev => prev.filter(l => l.id !== link.id)))}
                            className="p-1.5 rounded-lg border border-slate-200 text-red-400 hover:bg-red-50"
                            title="Remove link"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'images' && (
              <div className="flex flex-col gap-4">
                {!claim ? (
                  <p className="text-sm text-slate-400 text-center py-8">Save the claim first to attach images.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-xs text-slate-500">{images.length} image{images.length !== 1 ? 's' : ''}</span>
                      <div className="flex items-center gap-2 ml-auto">
                        <select
                          value={imageType}
                          onChange={e => setImageType(e.target.value as ClaimImage['doc_type'])}
                          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          title="Select image type"
                        >
                          <option value="Prescription">Prescription</option>
                          <option value="Birthcertificate/Pedigree">Birthcertificate / Pedigree</option>
                          <option value="Client Health Card ID">Client Health Card ID</option>
                          <option value="Other">Other</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleAddImages}
                          disabled={addingImages}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {addingImages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                          Add Images
                        </button>
                      </div>
                    </div>

                    {ocrMsg && (
                      <p className={`text-xs font-medium ${ocrMsg.startsWith('OCR failed') ? 'text-red-600' : 'text-slate-500'}`}>
                        {ocrMsg}
                      </p>
                    )}

                    {loadingImages ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      </div>
                    ) : images.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                        <ImagePlus className="w-8 h-8" />
                        <p className="text-sm">No images attached</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        {images.map(img => (
                          <div key={img.id} className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-50">
                            {img.dataUrl ? (
                              <img
                                src={img.dataUrl}
                                alt={img.filename}
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={() => setLightbox(img)}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Error</div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleOcr(img)}
                                disabled={ocrBusyId === img.id || !img.dataUrl}
                                className="p-1 rounded-lg bg-white/90 text-slate-700 hover:bg-white transition-colors disabled:opacity-60"
                                title="Run OCR"
                              >
                                {ocrBusyId === img.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanText className="w-3 h-3" />}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteImage(img)}
                              className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <p className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[11px] text-white bg-black/55 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                              {img.doc_type ? `[${img.doc_type}] ` : ''}{img.filename}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex gap-1">
              {TABS.filter(t => t.key !== 'images').map((t) => (
                <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className={`w-2 h-2 rounded-full transition-colors ${tab === t.key ? 'bg-blue-600' : 'bg-slate-200'}`}
                />
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                {claim ? 'Save Changes' : 'Create Claim'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox.dataUrl ?? ''}
            alt={lightbox.filename}
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <p className="absolute bottom-4 text-white/70 text-sm">{lightbox.filename}</p>
        </div>
      )}
    </>
  )
}
