import { createWorker } from 'tesseract.js'
import type { ClaimImage, DriveScanResult } from '../types'

export type { DriveScanResult }

type ScanOpts = {
  mimeType?: string
  name?: string
}

// Attempt extraction for all Claim fields shown in Data Downloads.
// Keep this list in sync with `Claim` keys in `src/types/index.ts`.
const SCAN_FIELDS: (keyof DriveScanResult | string)[] = [
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
  'misc',
  // misc sub-fields (exposed as first-class scan outputs)
  'imei_number',
  'airline',
  'aon_event',
  'travel_sum_insured',
  'catastrophe_code',
  'claimant_count',
  'last_diary_entry',
  'diary_description',
]

const NUM_FIELDS = new Set<string>([
  'client_age',
  'age',
  'weight',
  'medicine_cost',
  'service_cost',
  'total_amount_paid',
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
  'year',
  // misc numeric fields
  'travel_sum_insured',
  'claimant_count',
])

const DATE_FIELDS = new Set<string>([
  'created_at', 'updated_at', 'deleted_at', 'birthday',
  'date_issued', 'date_of_loss', 'date_reported', 'date_registered',
  'inception_date', 'expiry_date',
  'date_first_payment', 'date_last_payment',
  // misc date-like fields
  'last_diary_entry',
])

export async function scanDriveImage(dataUrl: string, opts: ScanOpts = {}): Promise<DriveScanResult> {
  const isPdf =
    dataUrl.startsWith('data:application/pdf') ||
    (opts.mimeType?.toLowerCase().includes('pdf') ?? false) ||
    (opts.name?.toLowerCase().endsWith('.pdf') ?? false)

  const result: DriveScanResult = { rawText: '', foundFields: [], missingFields: [] }
  ;(result as any).matchedLabels = {}

  const found = (field: string, val: string | number | undefined, matchedLabel?: string) => {
    if (val !== undefined && val !== '') {
      (result as Record<string, unknown>)[field] = val
      if (!result.foundFields.includes(field)) result.foundFields.push(field)
      if (matchedLabel) (result as any).matchedLabels[field] = matchedLabel
    }
  }

  // PDF: text-extract first (no OCR), then parse.
  if (isPdf) {
    const text = await extractPdfText(dataUrl)
    result.rawText = text

    const stream = parseKeyValueStream(text)
    for (const [field, val] of Object.entries(stream)) {
      if (val === '') continue
      if (NUM_FIELDS.has(field)) {
        const n = parseNumber(val)
        if (n !== null) found(field, n, streamMatchedLabel(field))
        continue
      }
      if (DATE_FIELDS.has(field)) {
        const d = parseDate(val)
        if (d) found(field, d, streamMatchedLabel(field))
        continue
      }
      if (field === 'gender' || field === 'client_gender') {
        const g = normalizeGender(val)
        found(field, g || val, streamMatchedLabel(field))
        continue
      }
      found(field, val, streamMatchedLabel(field))
    }

    applyRegexExtractors(text, found)
    result.missingFields = SCAN_FIELDS.map(String).filter(f => !result.foundFields.includes(f))
    return result
  }

  // Images: OCR via Tesseract, then parse.
  const worker = await createWorker('eng')
  try {
    const { data } = await worker.recognize(dataUrl)
    const text = (data.text || '').replace(/\r/g, '\n')
    result.rawText = text

    applyRegexExtractors(text, found)

    for (const key of SCAN_FIELDS) {
      const field = String(key)
      if (result.foundFields.includes(field)) continue

      const aliases = fieldAliases(field)
      let rawVal = ''
      let matched = ''
      for (const a of aliases) {
        rawVal = matchAfterLabel(text, a) || matchAfterLabelLoose(text, a)
        if (rawVal) { matched = a; break }
      }
      if (!rawVal) continue

      if (NUM_FIELDS.has(field)) {
        const n = parseNumber(rawVal)
        if (n !== null) found(field, n, matched)
        continue
      }

      if (DATE_FIELDS.has(field)) {
        const d = parseDate(rawVal)
        if (d) { found(field, d, matched); continue }
      }

      if (field === 'gender' || field === 'client_gender') {
        const g = normalizeGender(rawVal)
        found(field, g || rawVal, matched)
        continue
      }

      found(field, rawVal, matched)
    }

    result.missingFields = SCAN_FIELDS.map(String).filter(f => !result.foundFields.includes(f))
    return result
  } finally {
    await worker.terminate()
  }
}

type DocType = NonNullable<ClaimImage['doc_type']>

export type OcrExtract = Partial<{
  policy_number: string
  card_number: string
  species: string
  breed: string
  gender: 'Male' | 'Female'
  age: number
}>

function clean(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

function matchLine(text: string, re: RegExp) {
  const m = text.match(re)
  return m?.[1] ? clean(m[1]) : ''
}

function fieldAliases(field: string): string[] {
  // Prefer human-style labels first
  const base = field.replace(/_/g, ' ')
  const titled = base.replace(/\b\w/g, m => m.toUpperCase())

  const out = new Set<string>([titled, base])
  out.add(field) // snake_case
  out.add(field.replace(/_/g, '')) // underscores collapsed

  // A few common synonyms seen on forms
  if (field === 'id') { out.add('Claim ID'); out.add('Claim No'); out.add('Claim #') }
  if (field === 'policy_number') { out.add('Policy #'); out.add('Policy No'); out.add('Policy No.'); out.add('Policy Number') }
  if (field === 'card_number') { out.add('Card #'); out.add('Card No'); out.add('Member ID'); out.add('Member No') }
  if (field === 'client_name') { out.add('Owner'); out.add('Owner Name'); out.add('Insured Name'); out.add('Client') }
  if (field === 'line_of_business') { out.add('Product'); out.add('Line of Business') }
  if (field === 'status') { out.add('Claim Status'); out.add('Status') }
  if (field === 'claim_reason') { out.add('Claim Reason') }
  if (field === 'local_global') { out.add('Local/Global'); out.add('Local Global') }
  if (field === 'handler_code') { out.add('Handler') }
  if (field === 'handler_name') { out.add('Handler Name') }
  if (field === 'adj_provider_code') { out.add('Adjuster/Provider Code'); out.add('Adj/Provider Code') }
  if (field === 'adj_provider_name') { out.add('Adjuster/Provider Name'); out.add('Adj/Provider Name') }
  if (field === 'diagnosis') { out.add('Cause Description') }
  if (field === 'pet_name') { out.add('Pet'); out.add('Pet Name') }
  if (field === 'vet_clinic') { out.add('Veterinary Clinic'); out.add('Animal Clinic'); out.add('Animal Hospital') }
  if (field === 'missing_documents') { out.add('Missing Docs'); out.add('Missing Documents') }
  if (field === 'total_amount_paid') { out.add('Amount Paid'); out.add('Total Paid') }

  // misc sub-fields
  if (field === 'catastrophe_code') { out.add('Catastrophe Code') }
  if (field === 'travel_sum_insured') { out.add('Travel protect Sum Insured'); out.add('Travel Sum Insured') }
  if (field === 'last_diary_entry') { out.add('Last Diary Entry') }
  if (field === 'diary_description') { out.add('Diary Description') }
  if (field === 'imei_number') { out.add('IMEI Number') }
  if (field === 'aon_event') { out.add('AON Event') }
  if (field === 'claimant_count') { out.add('Claimant Count') }
  if (field === 'airline') { out.add('Airline') }

  return Array.from(out)
}

function matchAfterLabel(text: string, label: string): string {
  const esc = label
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s*')
  const re = new RegExp(`(?:^|\\n)\\s*${esc}\\s*[:\\-]\\s*(.+?)(?=\\n|$)`, 'i')
  const m = text.match(re)
  return m?.[1] ? clean(m[1]) : ''
}

function matchAfterLabelLoose(text: string, label: string): string {
  // label <space> value (no colon)
  const esc = label
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+')
  const re = new RegExp(`(?:^|\\n)\\s*${esc}\\s+(.+?)(?=\\n|$)`, 'i')
  const m = text.match(re)
  return m?.[1] ? clean(m[1]) : ''
}

function parseNumber(s: string): number | null {
  // Strip currency and thousands separators
  const cleaned = s
    .replace(/[₱$,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const m = cleaned.match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

function parseDate(s: string): string | null {
  const v = clean(String(s))
  if (!v) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)

  const n = parseNumber(v)
  if (n !== null && n >= 20_000 && n <= 80_000) {
    const ms = (n * 86400000) + Date.UTC(1899, 11, 30)
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }

  const t = Date.parse(v)
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10)
  return null
}

function normalizeGender(s: string): 'Male' | 'Female' | '' {
  const v = s.trim().toLowerCase()
  if (v.startsWith('m')) return 'Male'
  if (v.startsWith('f')) return 'Female'
  return ''
}

function applyRegexExtractors(text: string, found: (field: string, val: string | number | undefined, matchedLabel?: string) => void) {
  found('policy_number',
    matchLine(text, /policy\s*#?\s*(?:no\.?|num(?:ber)?)?\s*[:\-]?\s*([A-Z0-9\-]{4,})/i) ||
    matchLine(text, /\bpolicy\b\s*[:\-]?\s*([A-Z0-9\-]{4,})/i),
    'Policy Number'
  )

  found('card_number',
    matchLine(text, /\bcard\s*(?:no\.?|num(?:ber)?|id)?\s*[:\-]?\s*([A-Z0-9\-]{4,})/i) ||
    matchLine(text, /\bmember\s*(?:id|no\.?)\s*[:\-]?\s*([A-Z0-9\-]{4,})/i),
    'Card Number'
  )

  found('client_name',
    matchLine(text, /(?:owner|client|insured|patient\s*owner)\s*(?:name)?\s*[:\-]?\s*([A-Za-z][A-Za-z .]{2,30})/i) ||
    matchLine(text, /\bname\s*of\s*(?:owner|client|insured)\s*[:\-]?\s*([A-Za-z][A-Za-z .]{2,30})/i),
    'Client Name'
  )

  found('pet_name',
    matchLine(text, /(?:pet|animal|dog|cat)\s*(?:name|'s\s*name)?\s*[:\-]?\s*([A-Za-z][A-Za-z ]{1,20})/i) ||
    matchLine(text, /\bname\s*(?:of\s*(?:pet|animal|dog|cat))?\s*[:\-]?\s*([A-Za-z][A-Za-z ]{1,20})/i),
    'Pet Name'
  )

  const speciesLabel = matchLine(text, /\bspecies\s*[:\-]?\s*([A-Za-z ]{3,20})/i)
  const speciesInferred = !speciesLabel
    ? (text.match(/\bcanine\b/i) ? 'Dog' : text.match(/\bfeline\b/i) ? 'Cat' : '')
    : ''
  found('species', speciesLabel || speciesInferred, 'Species')

  found('breed', matchLine(text, /\bbreed\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9 \-]{2,30})/i), 'Breed')

  const genderRaw =
    matchLine(text, /\b(?:sex|gender)\s*[:\-]?\s*(male|female)\b/i) ||
    matchLine(text, /\b(male|female)\b/i)
  const gender = normalizeGender(genderRaw)
  if (gender) found('gender', gender, 'Gender')

  const ageRaw =
    matchLine(text, /\bage\s*[:\-]?\s*(\d{1,2})\b/i) ||
    matchLine(text, /\b(\d{1,2})\s*(?:years?|yrs?)\b/i)
  const age = ageRaw ? parseInt(ageRaw, 10) : NaN
  if (!isNaN(age) && age > 0 && age < 30) found('age', age, 'Age')

  found('vet_clinic',
    matchLine(text, /(?:veterinary\s*clinic|vet\s*clinic|animal\s*(?:hospital|clinic)|veterinary\s*hospital)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9 &.,\-]{2,40})/i),
    'Vet Clinic'
  )
}

function b64ToBytes(b64: string): Uint8Array {
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

function ensureReadableStreamAsyncIterable() {
  const RS = (globalThis as any).ReadableStream as (undefined | { prototype: any })
  if (!RS?.prototype) return
  const proto = RS.prototype
  const sym = (Symbol as any).asyncIterator
  if (!sym) return
  if (proto[sym]) return
  // Minimal async-iterator adapter for environments where ReadableStream
  // doesn't implement Symbol.asyncIterator (some Electron/Chromium builds).
  proto[sym] = function () {
    const reader = this.getReader()
    const it = {
      next: () => reader.read(),
      return: () => {
        try { reader.releaseLock() } catch {}
        return Promise.resolve({ done: true, value: undefined })
      },
      [sym]() { return this },
    }
    return it
  }
}

async function extractPdfText(dataUrl: string): Promise<string> {
  const [, b64] = dataUrl.split(',', 2)
  if (!b64) return ''
  const bytes = b64ToBytes(b64)
  ensureReadableStreamAsyncIterable()
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // In some Electron/Vite environments PDF.js still checks for workerSrc.
  // Point it at the bundled worker to avoid runtime errors.
  try {
    const g = (pdfjs as any).GlobalWorkerOptions
    if (g && !g.workerSrc) {
      g.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
    }
  } catch {}
  // Avoid requiring GlobalWorkerOptions.workerSrc in the renderer.
  // Also disable streaming/range loading to avoid "readableStream is not async iterable"
  // in some Electron/Chromium builds.
  const doc = await (pdfjs as any).getDocument({
    data: bytes,
    disableWorker: true,
    disableStream: true,
    disableRange: true,
    disableAutoFetch: true,
  }).promise
  let out = ''
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const strings = (content.items as any[]).map(it => String((it as any).str ?? '')).filter(Boolean)
    out += strings.join(' ') + '\n'
  }
  return out.replace(/\r/g, '\n')
}

let _streamMatchedLabels: Record<string, string> = {}
function streamMatchedLabel(field: string) {
  return _streamMatchedLabels[field]
}

function normalizeLabelTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[_:/\-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

function parseKeyValueStream(text: string): Record<string, string> {
  _streamMatchedLabels = {}
  const tokens = normalizeLabelTokens(text)
  if (tokens.length === 0) return {}

  type Cand = { field: string; label: string; toks: string[] }
  const cands: Cand[] = []
  for (const f of SCAN_FIELDS.map(String)) {
    for (const a of fieldAliases(f)) {
      const toks = normalizeLabelTokens(a)
      if (toks.length === 0 || toks.length > 3) continue
      cands.push({ field: f, label: a, toks })
    }
  }

  const byFirst = new Map<string, Cand[]>()
  for (const c of cands) {
    const first = c.toks[0]
    const arr = byFirst.get(first) ?? []
    arr.push(c)
    byFirst.set(first, arr)
  }

  const out: Record<string, string> = {}
  let curField: string | null = null
  let curLabel: string | null = null
  let buf: string[] = []

  const flush = () => {
    if (!curField) return
    const v = buf.join(' ').trim()
    if (v) {
      out[curField] = v
      if (curLabel) _streamMatchedLabels[curField] = curLabel
    }
    buf = []
  }

  for (let i = 0; i < tokens.length; i++) {
    const first = tokens[i]
    const possible = byFirst.get(first)
    let matched: Cand | null = null
    if (possible) {
      for (const cand of possible) {
        const len = cand.toks.length
        if (i + len > tokens.length) continue
        let ok = true
        for (let j = 0; j < len; j++) {
          if (tokens[i + j] !== cand.toks[j]) { ok = false; break }
        }
        if (ok && (!matched || cand.toks.length > matched.toks.length)) matched = cand
      }
    }

    if (matched) {
      flush()
      curField = matched.field
      curLabel = matched.label
      i += matched.toks.length - 1
      continue
    }

    if (curField && buf.length < 30) buf.push(tokens[i])
  }
  flush()
  return out
}

export async function runOcrAndExtract(dataUrl: string, docType: DocType): Promise<OcrExtract> {
  const worker = await createWorker('eng')
  try {
    const { data } = await worker.recognize(dataUrl)
    const raw = data.text || ''
    const text = raw.replace(/\r/g, '\n')

    if (docType === 'Prescription') {
      // Try a few common patterns for policy number
      const policy =
        matchLine(text, /policy\s*#?\s*(?:no\.?|num(?:ber)?)?\s*[:\-]?\s*([A-Z0-9\-]{4,})/i) ||
        matchLine(text, /\bpolicy\b\s*[:\-]?\s*([A-Z0-9\-]{4,})/i)
      return policy ? { policy_number: policy } : {}
    }

    if (docType === 'Client Health Card ID') {
      const card =
        matchLine(text, /\bcard\s*(?:no\.?|num(?:ber)?)\s*[:\-]?\s*([A-Z0-9\-]{4,})/i) ||
        matchLine(text, /\bmember\s*(?:id|no\.?)\s*[:\-]?\s*([A-Z0-9\-]{4,})/i)
      return card ? { card_number: card } : {}
    }

    if (docType === 'Birthcertificate/Pedigree') {
      const species = matchLine(text, /\bspecies\s*[:\-]?\s*([A-Za-z ]{3,})/i)
      const breed = matchLine(text, /\bbreed\s*[:\-]?\s*([A-Za-z0-9 \-]{3,})/i)
      const genderRaw =
        matchLine(text, /\b(?:sex|gender)\s*[:\-]?\s*(male|female)\b/i) ||
        matchLine(text, /\b(male|female)\b/i)
      const gender = normalizeGender(genderRaw)
      const ageRaw =
        matchLine(text, /\bage\s*[:\-]?\s*(\d{1,2})\b/i) ||
        matchLine(text, /\b(\d{1,2})\s*(?:years?|yrs?)\b/i)
      const age = ageRaw ? Number(ageRaw) : NaN

      const out: OcrExtract = {}
      if (species) out.species = species
      if (breed) out.breed = breed
      if (gender) out.gender = gender
      if (!Number.isNaN(age)) out.age = age
      return out
    }

    return {}
  } finally {
    await worker.terminate()
  }
}

