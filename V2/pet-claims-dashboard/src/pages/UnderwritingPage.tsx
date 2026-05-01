import React, { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts'
import { Shield, AlertTriangle, XCircle, Clock, FileSearch, ChevronDown, ChevronUp, X, Info, CalendarRange, RotateCcw, PawPrint } from 'lucide-react'
import { Claim, PremiumPlan } from '../types'

interface Props {
  claims: Claim[]
  onRefresh: () => void
}

// ── Risk scoring ────────────────────────────────────────────────────────────

const HIGH_RISK_DIAGNOSES = [
  'cancer', 'tumor', 'lymphoma', 'cardiac', 'heart', 'renal', 'kidney',
  'diabetes', 'epilepsy', 'seizure', 'fracture', 'surgery', 'hip dysplasia',
  'intervertebral', 'ivdd', 'pancreatitis', 'autoimmune', 'cushing',
]

function riskScore(claim: Claim, allClaims: Claim[]): number {
  let score = 0

  // Claim value
  const total = (claim.medicine_cost || 0) + (claim.service_cost || 0)
  if (total > 50_000) score += 30
  else if (total > 20_000) score += 20
  else if (total > 10_000) score += 10

  // Missing documents
  const missingCount = claim.missing_documents?.split(',').filter(s => s.trim()).length ?? 0
  score += missingCount * 8

  // Pet age (older → higher risk)
  if (claim.age >= 10) score += 20
  else if (claim.age >= 7) score += 10
  else if (claim.age >= 5) score += 5

  // High-risk diagnosis keywords
  const diag = (claim.diagnosis ?? '').toLowerCase()
  if (HIGH_RISK_DIAGNOSES.some(k => diag.includes(k))) score += 25

  // Repeat claimant
  const clientClaims = allClaims.filter(c => c.client_name === claim.client_name).length
  if (clientClaims >= 5) score += 20
  else if (clientClaims >= 3) score += 10

  // Status
  if (claim.status === 'Pending') score += 5

  // Neutering status increases risk slightly if not neutered
  if (claim.neutering_status?.toLowerCase().includes('not')) score += 5

  return Math.min(score, 100)
}

function riskLevel(score: number): { label: string; color: string; bg: string } {
  if (score >= 70) return { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100' }
  if (score >= 50) return { label: 'High',     color: 'text-orange-700', bg: 'bg-orange-100' }
  if (score >= 30) return { label: 'Medium',   color: 'text-yellow-700', bg: 'bg-yellow-100' }
  return              { label: 'Low',      color: 'text-green-700', bg: 'bg-green-100' }
}

function riskFactors(claim: Claim, allClaims: Claim[]): string[] {
  const factors: string[] = []
  const total = (claim.medicine_cost || 0) + (claim.service_cost || 0)
  if (total > 50_000) factors.push(`High claim value (₱${total.toLocaleString()})`)
  else if (total > 20_000) factors.push(`Elevated claim value (₱${total.toLocaleString()})`)

  const missingCount = claim.missing_documents?.split(',').filter(s => s.trim()).length ?? 0
  if (missingCount > 0) factors.push(`${missingCount} missing document${missingCount > 1 ? 's' : ''}`)

  if (claim.age >= 10) factors.push(`Senior pet (${claim.age} yrs)`)
  else if (claim.age >= 7) factors.push(`Aging pet (${claim.age} yrs)`)

  const diag = (claim.diagnosis ?? '').toLowerCase()
  const matched = HIGH_RISK_DIAGNOSES.find(k => diag.includes(k))
  if (matched) factors.push(`High-risk diagnosis: ${matched}`)

  const clientClaims = allClaims.filter(c => c.client_name === claim.client_name).length
  if (clientClaims >= 3) factors.push(`Repeat claimant (${clientClaims} claims)`)

  if (claim.neutering_status?.toLowerCase().includes('not')) factors.push('Not neutered/spayed')

  return factors
}

// ── Assessment modal ─────────────────────────────────────────────────────────

type Decision = 'Approve' | 'Deny' | 'Request Docs' | 'Escalate'

interface ScoredClaim extends Claim {
  score: number
  level: ReturnType<typeof riskLevel>
  factors: string[]
}

function AssessmentModal({ claim, onClose, onSave }: {
  claim: ScoredClaim
  onClose: () => void
  onSave: (decision: Decision, notes: string) => Promise<void>
}) {
  const [decision, setDecision] = useState<Decision | ''>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!decision) return
    setSaving(true)
    try { await onSave(decision as Decision, notes) }
    finally { setSaving(false) }
  }

  const decisionColors: Record<Decision, string> = {
    'Approve':      'border-green-500 bg-green-50 text-green-700',
    'Deny':         'border-red-500 bg-red-50 text-red-700',
    'Request Docs': 'border-yellow-500 bg-yellow-50 text-yellow-700',
    'Escalate':     'border-purple-500 bg-purple-50 text-purple-700',
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <FileSearch className="w-5 h-5 text-blue-500" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Underwriting Assessment</h2>
              <p className="text-xs text-slate-400">Claim #{claim.id} · {claim.client_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Claim snapshot */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
              <p className="font-semibold text-slate-500 uppercase tracking-wide mb-2">Claim Details</p>
              <p><span className="text-slate-400">Pet:</span> <span className="font-medium text-slate-700">{claim.pet_name} ({claim.species}, {claim.breed})</span></p>
              <p><span className="text-slate-400">Age / Weight:</span> <span className="font-medium text-slate-700">{claim.age} yrs / {claim.weight} kg</span></p>
              <p><span className="text-slate-400">Diagnosis:</span> <span className="font-medium text-slate-700">{claim.diagnosis || '—'}</span></p>
              <p><span className="text-slate-400">Medications:</span> <span className="font-medium text-slate-700">{claim.medications || '—'}</span></p>
              <p><span className="text-slate-400">Vet Clinic:</span> <span className="font-medium text-slate-700">{claim.vet_clinic || '—'}</span></p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
              <p className="font-semibold text-slate-500 uppercase tracking-wide mb-2">Financials</p>
              <p><span className="text-slate-400">Medicine Cost:</span> <span className="font-medium text-slate-700">₱{(claim.medicine_cost || 0).toLocaleString()}</span></p>
              <p><span className="text-slate-400">Service Cost:</span> <span className="font-medium text-slate-700">₱{(claim.service_cost || 0).toLocaleString()}</span></p>
              <p><span className="text-slate-400">Total:</span> <span className="font-bold text-slate-800">₱{((claim.medicine_cost || 0) + (claim.service_cost || 0)).toLocaleString()}</span></p>
              <p className="mt-2"><span className="text-slate-400">Missing Docs:</span> <span className={`font-medium ${claim.missing_documents ? 'text-amber-600' : 'text-green-600'}`}>{claim.missing_documents || 'None'}</span></p>
              <p><span className="text-slate-400">Current Status:</span> <span className="font-medium text-slate-700">{claim.status}</span></p>
            </div>
          </div>

          {/* Risk summary */}
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${claim.level.bg} ${claim.level.color}`}>
              {claim.level.label} Risk · {claim.score}/100
            </div>
            <div className="flex-1 flex flex-wrap gap-1.5">
              {claim.factors.map((f, i) => (
                <span key={i} className="text-xs bg-white border border-slate-200 text-slate-600 rounded-full px-2 py-0.5">{f}</span>
              ))}
              {claim.factors.length === 0 && <span className="text-xs text-slate-400">No significant risk factors</span>}
            </div>
          </div>

          {/* Decision */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Decision</p>
            <div className="grid grid-cols-4 gap-2">
              {(['Approve', 'Deny', 'Request Docs', 'Escalate'] as Decision[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDecision(d)}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg border-2 transition-all ${
                    decision === d ? decisionColors[d] : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Underwriter Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Add assessment notes, justification, or follow-up instructions…"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!decision || saving}
            className="px-4 py-2 text-xs rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : 'Submit Assessment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Premium tiers (DB-driven) ─────────────────────────────────────────────────

const PLAN_BADGE: Record<string, string> = {
  Silver:   'bg-slate-100 text-slate-600 border-slate-300',
  Gold:     'bg-amber-100 text-amber-700 border-amber-300',
  Platinum: 'bg-indigo-100 text-indigo-700 border-indigo-300',
}

interface PremiumRow {
  plan_name: string
  price: number
  coverage: number
  claimsPaid: number
  claimsAsked: number
  count: number
}

function computePremiumRows(claims: Claim[], plans: PremiumPlan[], species: 'Cat' | 'Dog'): PremiumRow[] {
  const speciesPlans = plans
    .filter(p => p.species === species)
    .sort((a, b) => a.sort_order - b.sort_order || a.coverage - b.coverage)

  const src = claims.filter(c => c.species === species)

  return speciesPlans.map((plan, i) => {
    const prevCoverage = i === 0 ? -1 : speciesPlans[i - 1].coverage
    const isLast = i === speciesPlans.length - 1
    const bucket = src.filter(c => {
      const val = c.sum_insured || ((c.medicine_cost || 0) + (c.service_cost || 0))
      return isLast ? val > prevCoverage : val > prevCoverage && val <= plan.coverage
    })
    return {
      plan_name: plan.plan_name,
      price: plan.price,
      coverage: plan.coverage,
      claimsPaid: bucket.reduce((s, c) => s + (c.total_amount_paid || 0), 0),
      claimsAsked: bucket.reduce((s, c) => s + (c.medicine_cost || 0) + (c.service_cost || 0), 0),
      count: bucket.length,
    }
  })
}

function PremiumTable({ species, rows }: { species: 'Cat' | 'Dog'; rows: PremiumRow[] }) {
  const totalPaid  = rows.reduce((s, r) => s + r.claimsPaid, 0)
  const totalAsked = rows.reduce((s, r) => s + r.claimsAsked, 0)
  const totalCount = rows.reduce((s, r) => s + r.count, 0)
  const fmt = (v: number) => `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const accent = species === 'Cat'
    ? { ring: 'ring-pink-200', icon: 'text-pink-600', badge: 'bg-pink-50 text-pink-700 border-pink-200', soft: 'bg-pink-50/40' }
    : { ring: 'ring-blue-200', icon: 'text-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-200', soft: 'bg-blue-50/40' }
  const lossRatio = totalAsked > 0 ? totalPaid / totalAsked : 0

  return (
    <div className={`flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ${accent.ring} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${accent.soft} flex items-center justify-center`}>
            <PawPrint className={`w-5 h-5 ${accent.icon}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-slate-800">Premium breakdown</h4>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${accent.badge}`}>
                {species}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Configured tiers and claim buckets for this species</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Claims Paid</div>
            <div className="text-xs font-bold text-slate-800 tabular-nums">{fmt(totalPaid)}</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Claims Asked</div>
            <div className="text-xs font-bold text-slate-800 tabular-nums">{fmt(totalAsked)}</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Count</div>
            <div className="text-xs font-bold text-slate-800 tabular-nums">{totalCount.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Loss Ratio</div>
            <div className="text-xs font-bold text-slate-800 tabular-nums">{(lossRatio * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="text-sm font-semibold text-slate-600">No premium tiers configured</div>
          <div className="text-xs text-slate-400 mt-1">Add plans in Premiums to see breakdowns here.</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white">
              <tr className="border-b border-slate-100">
                {['Plan', 'Premium', 'Coverage', 'Paid', 'Asked', 'Count'].map(h => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 text-left font-semibold text-slate-500 whitespace-nowrap ${h !== 'Plan' ? 'text-right' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r, i) => {
                const isTop = i === 0
                const rowRatio = r.claimsAsked > 0 ? r.claimsPaid / r.claimsAsked : 0
                return (
                  <tr
                    key={i}
                    className={`transition-colors ${isTop ? 'bg-slate-50/60' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${PLAN_BADGE[r.plan_name] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {r.plan_name}
                        </span>
                        {rowRatio > 0 && (
                          <span className="text-[10px] text-slate-400 tabular-nums">{(rowRatio * 100).toFixed(0)}% LR</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800 text-right tabular-nums">{fmt(r.price)}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800 text-right tabular-nums">{fmt(r.coverage)}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-right tabular-nums">{fmt(r.claimsPaid)}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-right tabular-nums">{fmt(r.claimsAsked)}</td>
                    <td className="px-4 py-2.5 text-slate-700 font-semibold text-right tabular-nums">{r.count.toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="px-4 py-2.5 font-bold text-slate-700">Total</td>
                <td className="px-4 py-2.5"></td>
                <td className="px-4 py-2.5"></td>
                <td className="px-4 py-2.5 font-bold text-slate-700 text-right tabular-nums">{fmt(totalPaid)}</td>
                <td className="px-4 py-2.5 font-bold text-slate-700 text-right tabular-nums">{fmt(totalAsked)}</td>
                <td className="px-4 py-2.5 font-bold text-slate-700 text-right tabular-nums">{totalCount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── DOB age-group tables ──────────────────────────────────────────────────────

const AGE_GROUPS = [
  { label: '< 28 years old',    test: (age: number) => age > 0 && age < 28 },
  { label: '29 to 44 years old', test: (age: number) => age >= 29 && age <= 44 },
  { label: '45 to 60 years old', test: (age: number) => age >= 45 && age <= 60 },
  { label: '66+',                test: (age: number) => age >= 66 },
  { label: 'N/A',                test: (age: number) => !age || age <= 0 },
]

function computeDobRows(claims: Claim[]) {
  return AGE_GROUPS.map(g => {
    const bucket = claims.filter(c => g.test(c.client_age ?? 0))
    return {
      label: g.label,
      paid:  bucket.reduce((s, c) => s + (c.total_amount_paid || 0), 0),
      asked: bucket.reduce((s, c) => s + (c.medicine_cost || 0) + (c.service_cost || 0), 0),
    }
  })
}

function DobTable({ title, rows }: { title: string; rows: ReturnType<typeof computeDobRows> }) {
  const maxAsked = Math.max(...rows.map(r => r.asked))
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
  const totalAsked = rows.reduce((s, r) => s + r.asked, 0)
  const fmt = (v: number) =>
    v === 0 ? '₱0.00' : `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="flex-1 min-w-0 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <td colSpan={3} className="px-4 py-3 text-center text-sm font-bold text-slate-700 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
              {title}
            </td>
          </tr>
          <tr className="border-b border-slate-100">
            <th className="px-4 py-2.5 text-left font-semibold text-slate-500 w-36"></th>
            <th className="px-4 py-2.5 text-left font-semibold text-slate-500 whitespace-nowrap">Claims Paid</th>
            <th className="px-4 py-2.5 text-left font-semibold text-slate-500 whitespace-nowrap">Total Claims Asked</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((r, i) => {
            const isHighest = r.asked > 0 && r.asked === maxAsked
            return (
              <tr key={i} className={isHighest ? 'bg-green-50' : 'hover:bg-slate-50 transition-colors'}>
                <td className={`px-4 py-2.5 font-semibold whitespace-nowrap ${isHighest ? 'text-green-800' : 'text-slate-700'}`}>
                  {r.label}
                </td>
                <td className={`px-4 py-2.5 ${isHighest ? 'text-green-700' : 'text-slate-600'}`}>{fmt(r.paid)}</td>
                <td className={`px-4 py-2.5 font-bold ${isHighest ? 'text-green-800' : 'text-slate-700'}`}>{fmt(r.asked)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50">
            <td className="px-4 py-2.5 font-bold text-slate-700">Total</td>
            <td className="px-4 py-2.5 font-bold text-slate-700">{fmt(totalPaid)}</td>
            <td className="px-4 py-2.5 font-bold text-slate-700">{fmt(totalAsked)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#f59e0b',
  Low:      '#22c55e',
}

export default function UnderwritingPage({ claims, onRefresh }: Props) {
  const [selected, setSelected] = useState<ScoredClaim | null>(null)
  const [filterLevel, setFilterLevel] = useState<string>('')
  const [sortKey, setSortKey] = useState<'score' | 'total'>('score')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [successMsg, setSuccessMsg] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [plans, setPlans] = useState<PremiumPlan[]>([])
  const [premiumSpecies, setPremiumSpecies] = useState<'Cat' | 'Dog'>('Cat')
  const [dobSpecies, setDobSpecies] = useState<'Total' | 'Cat' | 'Dog'>('Total')

  useEffect(() => {
    window.api.getPremiumPlans().then(setPlans).catch(() => setPlans([]))
  }, [])

  // Apply date filter to all claims on this page
  const dateClaims = useMemo(() => claims.filter(c => {
    if (dateFrom && c.created_at < dateFrom) return false
    if (dateTo   && c.created_at > dateTo + 'T23:59:59') return false
    return true
  }), [claims, dateFrom, dateTo])

  const dateActive = !!(dateFrom || dateTo)

  const scored = useMemo<ScoredClaim[]>(() => {
    return dateClaims
      .filter(c => c.status === 'Open' || c.status === 'Pending')
      .map(c => {
        const score = riskScore(c, dateClaims)
        return { ...c, score, level: riskLevel(score), factors: riskFactors(c, dateClaims) }
      })
  }, [dateClaims])

  const riskDist = useMemo(() => {
    const counts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 }
    scored.forEach(c => { counts[c.level.label]++ })
    return Object.entries(counts).map(([name, value]) => ({ name, value, fill: RISK_COLORS[name] }))
  }, [scored])

  const filtered = useMemo(() => {
    const list = filterLevel ? scored.filter(c => c.level.label === filterLevel) : scored
    return [...list].sort((a, b) => {
      const av = sortKey === 'score' ? a.score : (a.medicine_cost || 0) + (a.service_cost || 0)
      const bv = sortKey === 'score' ? b.score : (b.medicine_cost || 0) + (b.service_cost || 0)
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [scored, filterLevel, sortKey, sortDir])

  const catPremiumRows = useMemo(() => computePremiumRows(dateClaims, plans, 'Cat'), [dateClaims, plans])
  const dogPremiumRows = useMemo(() => computePremiumRows(dateClaims, plans, 'Dog'), [dateClaims, plans])
  const premiumRows = useMemo(
    () => premiumSpecies === 'Cat' ? catPremiumRows : dogPremiumRows,
    [premiumSpecies, catPremiumRows, dogPremiumRows]
  )
  const dobAllRows = useMemo(() => computeDobRows(dateClaims), [dateClaims])
  const dobCatRows = useMemo(() => computeDobRows(dateClaims.filter(c => c.species === 'Cat')), [dateClaims])
  const dobDogRows = useMemo(() => computeDobRows(dateClaims.filter(c => c.species === 'Dog')), [dateClaims])
  const dobRows = useMemo(() => {
    if (dobSpecies === 'Cat') return dobCatRows
    if (dobSpecies === 'Dog') return dobDogRows
    return dobAllRows
  }, [dobSpecies, dobAllRows, dobCatRows, dobDogRows])

  const kpis = useMemo(() => ({
    pending: scored.length,
    critical: scored.filter(c => c.level.label === 'Critical').length,
    high: scored.filter(c => c.level.label === 'High').length,
    avgScore: scored.length ? Math.round(scored.reduce((s, c) => s + c.score, 0) / scored.length) : 0,
    totalExposure: scored.reduce((s, c) => s + (c.medicine_cost || 0) + (c.service_cost || 0), 0),
  }), [scored])

  function toggleSort(key: 'score' | 'total') {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  async function handleAssessment(decision: Decision, _notes: string) {
    if (!selected) return
    let newStatus: Claim['status'] = selected.status
    if (decision === 'Approve') newStatus = 'Approved'
    else if (decision === 'Deny') newStatus = 'Denied'
    else if (decision === 'Request Docs') newStatus = 'Pending'

    await window.api.updateClaim(selected.id, {
      client_name: selected.client_name,
      client_age: selected.client_age,
      client_gender: selected.client_gender,
      location_of_residence: selected.location_of_residence,
      pet_name: selected.pet_name,
      species: selected.species,
      breed: selected.breed,
      breed_type: selected.breed_type,
      gender: selected.gender,
      neutering_status: selected.neutering_status,
      color: selected.color,
      age: selected.age,
      weight: selected.weight,
      place_of_loss: selected.place_of_loss,
      diagnosis: selected.diagnosis,
      medications: selected.medications,
      medicine_cost: selected.medicine_cost,
      veterinary_services: selected.veterinary_services,
      service_cost: selected.service_cost,
      vet_clinic: selected.vet_clinic,
      claim_type: selected.claim_type,
      status: newStatus,
      missing_documents: selected.missing_documents,
      stage: decision === 'Approve' ? 'Approved' : decision === 'Request Docs' ? 'Document Collection' : selected.stage,
      total_amount_paid: decision === 'Approve' ? (selected.medicine_cost || 0) + (selected.service_cost || 0) : selected.total_amount_paid,
    })

    setSelected(null)
    setSuccessMsg(`Claim #${selected.id} → ${decision}`)
    setTimeout(() => setSuccessMsg(''), 3000)
    onRefresh()
  }

  const SortIcon = ({ k }: { k: 'score' | 'total' }) =>
    sortKey === k
      ? (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)
      : <ChevronDown className="w-3 h-3 text-slate-200" />

  return (
    <div className="p-6 space-y-6">

      {/* Date range filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3.5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 flex-shrink-0">
          <CalendarRange className="w-4 h-4 text-blue-500" />
          Date Range
        </div>

        {/* Quick preset buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { label: '7d',   days: 7   },
            { label: '30d',  days: 30  },
            { label: '90d',  days: 90  },
            { label: 'Month', month: true },
            { label: 'Year',  year: true },
          ] as { label: string; days?: number; month?: boolean; year?: boolean }[]).map(p => {
            function applyPreset() {
              const now = new Date()
              const pad = (n: number) => String(n).padStart(2, '0')
              const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
              if (p.days) {
                const from = new Date(now); from.setDate(now.getDate() - p.days)
                setDateFrom(fmt(from)); setDateTo(fmt(now))
              } else if (p.month) {
                const from = new Date(now.getFullYear(), now.getMonth(), 1)
                setDateFrom(fmt(from)); setDateTo(fmt(now))
              } else if (p.year) {
                const from = new Date(now.getFullYear(), 0, 1)
                setDateFrom(fmt(from)); setDateTo(fmt(now))
              }
            }
            return (
              <button
                key={p.label}
                onClick={applyPreset}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            />
          </div>
          {dateActive && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {dateActive && (
          <span className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-full whitespace-nowrap ml-auto">
            {dateClaims.length} of {claims.length} claims
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { icon: Clock,         color: 'text-blue-500',   label: 'Pending Review',    value: kpis.pending,                                              sub: 'open + pending claims' },
          { icon: AlertTriangle, color: 'text-red-500',    label: 'Critical Risk',     value: kpis.critical,                                             sub: 'score ≥ 70' },
          { icon: AlertTriangle, color: 'text-orange-500', label: 'High Risk',         value: kpis.high,                                                 sub: 'score 50–69' },
          { icon: Shield,        color: 'text-purple-500', label: 'Avg Risk Score',    value: `${kpis.avgScore}/100`,                                    sub: 'across pending queue' },
          { icon: XCircle,       color: 'text-slate-500',  label: 'Total Exposure',    value: `₱${kpis.totalExposure.toLocaleString()}`,                 sub: 'pending claim value' },
        ].map(({ icon: Icon, color, label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Charts + queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Risk distribution pie */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Risk Distribution</h3>
          <p className="text-xs text-slate-400 mb-4">Pending claims by risk level</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={riskDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {riskDist.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Risk bar */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Risk Score Distribution</h3>
          <p className="text-xs text-slate-400 mb-4">Top pending claims by score</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scored.sort((a, b) => b.score - a.score).slice(0, 10)} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis type="category" dataKey="id" tick={{ fontSize: 10, fill: '#64748b' }} width={60} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(v: number) => [`${v}/100`, 'Risk Score']} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} name="Risk Score">
                {scored.sort((a, b) => b.score - a.score).slice(0, 10).map((e, i) => (
                  <Cell key={i} fill={RISK_COLORS[e.level.label]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Review Queue */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-start gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Underwriting Review Queue</h3>
              <p className="text-xs text-slate-400 mt-0.5">Open and pending claims awaiting assessment</p>
            </div>
            {/* Risk score info tooltip */}
            <span className="relative group/tip mt-0.5 flex-shrink-0">
              <Info className="w-3.5 h-3.5 text-slate-300 hover:text-blue-400 cursor-default transition-colors" />
              <div className="pointer-events-none absolute left-0 top-full mt-2 w-72 bg-slate-800 text-white text-[11px] rounded-xl p-3.5 shadow-2xl opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 leading-relaxed">
                <p className="font-semibold mb-2 text-slate-100">How risk score is calculated</p>
                <p className="text-slate-400 mb-2 leading-relaxed">The score estimates the likelihood that a claim is <span className="text-white font-medium">fraudulent or invalid</span> — the higher the score, the more scrutiny the claim needs before approval.</p>
                <ul className="space-y-1.5 text-slate-300">
                  <li><span className="text-white font-medium">Claim value</span> — up to +30 pts (₱10k / ₱20k / ₱50k+)</li>
                  <li><span className="text-white font-medium">Missing documents</span> — +8 pts each</li>
                  <li><span className="text-white font-medium">Pet age</span> — +5 pts (5yr+), +10 (7yr+), +20 (10yr+)</li>
                  <li><span className="text-white font-medium">High-risk diagnosis</span> — +25 pts (cancer, cardiac, renal, surgery, etc.)</li>
                  <li><span className="text-white font-medium">Repeat claimant</span> — +10 pts (3+ claims), +20 (5+ claims)</li>
                  <li><span className="text-white font-medium">Not neutered / spayed</span> — +5 pts</li>
                  <li><span className="text-white font-medium">Pending status</span> — +5 pts</li>
                </ul>
                <div className="mt-2.5 pt-2 border-t border-slate-600 text-slate-400">
                  Score capped at 100 · Low &lt;30 · Medium 30–49 · High 50–69 · Critical 70+
                </div>
                <div className="absolute left-3 bottom-full w-2 h-2 bg-slate-800 rotate-45 mb-[-4px]" />
              </div>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {successMsg && (
              <span className="text-xs text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full">
                {successMsg}
              </span>
            )}
            <select
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Risk Levels</option>
              {['Critical', 'High', 'Medium', 'Low'].map(l => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {[
                  { label: 'Claim ID' }, { label: 'Client' }, { label: 'Pet / Species' },
                  { label: 'Diagnosis' }, { label: 'Risk Level' },
                  { label: 'Risk Score', key: 'score' as const },
                  { label: 'Claim Value', key: 'total' as const },
                  { label: 'Risk Factors' }, { label: 'Status' }, { label: 'Action' },
                ].map(col => (
                  <th
                    key={col.label}
                    onClick={col.key ? () => toggleSort(col.key!) : undefined}
                    className={`px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${col.key ? 'cursor-pointer hover:text-slate-700 select-none' : ''}`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.key && <SortIcon k={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    {filterLevel ? `No ${filterLevel} risk claims in queue` : 'No claims pending review'}
                  </td>
                </tr>
              ) : filtered.map(claim => {
                const total = (claim.medicine_cost || 0) + (claim.service_cost || 0)
                return (
                  <tr key={claim.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-slate-400">{claim.id}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">{claim.client_name}</td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{claim.pet_name} <span className="text-slate-400">({claim.species})</span></td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[160px] truncate" title={claim.diagnosis}>{claim.diagnosis || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full font-semibold text-xs ${claim.level.bg} ${claim.level.color}`}>
                        {claim.level.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${claim.score}%`, backgroundColor: RISK_COLORS[claim.level.label] }}
                          />
                        </div>
                        <span className="font-semibold text-slate-700">{claim.score}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">₱{total.toLocaleString()}</td>
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {claim.factors.slice(0, 2).map((f, i) => (
                          <span key={i} className="bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5 text-[10px] whitespace-nowrap">{f}</span>
                        ))}
                        {claim.factors.length > 2 && (
                          <span className="bg-slate-100 text-slate-400 rounded-full px-1.5 py-0.5 text-[10px]">+{claim.factors.length - 2}</span>
                        )}
                        {claim.factors.length === 0 && <span className="text-slate-300">None</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        claim.status === 'Open' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => setSelected(claim)}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
                      >
                        <FileSearch className="w-3 h-3" />
                        Assess
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
          <span>{filtered.length} claim{filtered.length !== 1 ? 's' : ''} in queue</span>
          <span>Risk score: 0–29 Low · 30–49 Medium · 50–69 High · 70+ Critical</span>
        </div>
      </div>

      {/* Premium of Cats and Dogs */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start gap-4 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-700">Premium of Cats and Dogs</h3>
            <p className="text-xs text-slate-400 mt-0.5">Claims aggregated by species and premium tier (bucketed by claim value)</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Species</span>
            <select
              value={premiumSpecies}
              onChange={e => setPremiumSpecies(e.target.value as 'Cat' | 'Dog')}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Cat">Cat</option>
              <option value="Dog">Dog</option>
            </select>
          </div>
        </div>
        <div className="p-5">
          <PremiumTable species={premiumSpecies} rows={premiumRows} />
        </div>
      </div>

      {/* Client DOB Data */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start gap-4 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-700">Client’s Age</h3>
            <p className="text-xs text-slate-400 mt-0.5">Claims paid and asked grouped by client age bracket · highlighted row = highest claim volume</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">View</span>
            <select
              value={dobSpecies}
              onChange={e => setDobSpecies(e.target.value as 'Total' | 'Cat' | 'Dog')}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Total">Total</option>
              <option value="Cat">Cat</option>
              <option value="Dog">Dog</option>
            </select>
          </div>
        </div>
        <div className="p-5">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <DobTable title="Clients Age" rows={dobRows} />
          </div>
        </div>
      </div>

      {selected && (
        <AssessmentModal
          claim={selected}
          onClose={() => setSelected(null)}
          onSave={handleAssessment}
        />
      )}
    </div>
  )
}
