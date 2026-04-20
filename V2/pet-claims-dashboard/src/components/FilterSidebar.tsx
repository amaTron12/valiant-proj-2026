import React, { useMemo, useState } from 'react'
import { X, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { Claim } from '../types'

export interface SidebarFilters {
  species: string[]
  claimTypes: string[]
  petGender: string
  petAgeRange: [number, number]
  weightRange: [number, number]
  breed: string
  diagnosis: string
  clientAgeRange: [number, number]
  premiumRange: [number, number]
}

export const DEFAULT_FILTERS: SidebarFilters = {
  species: [],
  claimTypes: [],
  petGender: '',
  petAgeRange: [0, 20],
  weightRange: [0, 50],
  breed: '',
  diagnosis: '',
  clientAgeRange: [0, 100],
  premiumRange: [0, 100000],
}

function isDefault(f: SidebarFilters): boolean {
  const d = DEFAULT_FILTERS
  return (
    f.species.length === 0 &&
    f.claimTypes.length === 0 &&
    f.petGender === '' &&
    f.petAgeRange[0] === d.petAgeRange[0] && f.petAgeRange[1] === d.petAgeRange[1] &&
    f.weightRange[0] === d.weightRange[0] && f.weightRange[1] === d.weightRange[1] &&
    f.breed === '' &&
    f.diagnosis === '' &&
    f.clientAgeRange[0] === d.clientAgeRange[0] && f.clientAgeRange[1] === d.clientAgeRange[1] &&
    f.premiumRange[0] === d.premiumRange[0] && f.premiumRange[1] === d.premiumRange[1]
  )
}

// ── Dual range slider ────────────────────────────────────────────────────────
interface DualRangeProps {
  min: number
  max: number
  value: [number, number]
  onChange: (v: [number, number]) => void
  step?: number
  format?: (v: number) => string
}

function DualRange({ min, max, value, onChange, step = 1, format = String }: DualRangeProps) {
  const [lo, hi] = value
  const pct = (v: number) => ((v - min) / (max - min)) * 100

  return (
    <div className="px-1">
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1.5 bg-slate-200 rounded-full">
          <div
            className="absolute h-full bg-blue-500 rounded-full"
            style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
          />
        </div>
        <input
          type="range" min={min} max={max} step={step} value={lo}
          onChange={e => onChange([Math.min(+e.target.value, hi - step), hi])}
          className="range-thumb"
          style={{ zIndex: lo >= hi - (max - min) * 0.1 ? 5 : 3 }}
        />
        <input
          type="range" min={min} max={max} step={step} value={hi}
          onChange={e => onChange([lo, Math.max(+e.target.value, lo + step)])}
          className="range-thumb"
          style={{ zIndex: 4 }}
        />
      </div>
      <div className="flex justify-between mt-3">
        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{format(lo)}</span>
        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{format(hi)}</span>
      </div>
    </div>
  )
}

// ── Collapsible section ──────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ── Checkbox item ────────────────────────────────────────────────────────────
function CheckItem({ label, count, checked, onChange }: { label: string; count: number; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer group py-1">
      <div className="flex items-center gap-2">
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-blue-400'}`}>
          {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </div>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
        <span className="text-sm text-slate-700 group-hover:text-slate-900">{label}</span>
      </div>
      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{count}</span>
    </label>
  )
}

// ── Main sidebar ─────────────────────────────────────────────────────────────
interface Props {
  claims: Claim[]
  filters: SidebarFilters
  onChange: (f: SidebarFilters) => void
  onClose: () => void
}

export default function FilterSidebar({ claims, filters, onChange, onClose }: Props) {
  const set = <K extends keyof SidebarFilters>(k: K, v: SidebarFilters[K]) =>
    onChange({ ...filters, [k]: v })

  const toggleArr = (k: 'species' | 'claimTypes', val: string) => {
    const arr = filters[k]
    set(k, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  // Counts per dimension (over all claims, not filtered)
  const counts = useMemo(() => {
    const species: Record<string, number> = {}
    const types: Record<string, number> = {}
    const breeds: Record<string, number> = {}
    for (const c of claims) {
      species[c.species] = (species[c.species] || 0) + 1
      types[c.claim_type] = (types[c.claim_type] || 0) + 1
      breeds[c.breed] = (breeds[c.breed] || 0) + 1
    }
    return { species, types, breeds }
  }, [claims])

  const speciesList = Object.keys(counts.species).sort()
  const typesList = Object.keys(counts.types).sort()

  // Dynamic breeds: filter by selected species
  const breedsForSpecies = useMemo(() => {
    const src = filters.species.length > 0
      ? claims.filter(c => filters.species.includes(c.species))
      : claims
    const map: Record<string, number> = {}
    src.forEach(c => { map[c.breed] = (map[c.breed] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([b]) => b)
  }, [claims, filters.species])

  const activeCount = (
    filters.species.length +
    filters.claimTypes.length +
    (filters.petGender ? 1 : 0) +
    (filters.breed ? 1 : 0) +
    (filters.diagnosis ? 1 : 0) +
    (filters.petAgeRange[0] !== DEFAULT_FILTERS.petAgeRange[0] || filters.petAgeRange[1] !== DEFAULT_FILTERS.petAgeRange[1] ? 1 : 0) +
    (filters.weightRange[0] !== DEFAULT_FILTERS.weightRange[0] || filters.weightRange[1] !== DEFAULT_FILTERS.weightRange[1] ? 1 : 0) +
    (filters.clientAgeRange[0] !== DEFAULT_FILTERS.clientAgeRange[0] || filters.clientAgeRange[1] !== DEFAULT_FILTERS.clientAgeRange[1] ? 1 : 0) +
    (filters.premiumRange[0] !== DEFAULT_FILTERS.premiumRange[0] || filters.premiumRange[1] !== DEFAULT_FILTERS.premiumRange[1] ? 1 : 0)
  )

  return (
    <aside className="w-72 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">Filters</span>
          {activeCount > 0 && (
            <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isDefault(filters) && (
            <button
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Clear all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Species */}
        <Section title="Species">
          <div className="space-y-0.5">
            {speciesList.map(s => (
              <CheckItem
                key={s} label={s} count={counts.species[s]}
                checked={filters.species.includes(s)}
                onChange={() => toggleArr('species', s)}
              />
            ))}
          </div>
        </Section>

        {/* Breed */}
        <Section title="Breed" defaultOpen={false}>
          <input
            type="text"
            placeholder={filters.species.length ? `Search ${filters.species.join('/')} breeds…` : 'Search breed…'}
            value={filters.breed}
            onChange={e => set('breed', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
          />
          {breedsForSpecies.slice(0, 8).map(b => (
            <button
              key={b}
              onClick={() => set('breed', filters.breed === b ? '' : b)}
              className={`inline-flex mr-1 mb-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${filters.breed === b ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600'}`}
            >
              {b}
            </button>
          ))}
        </Section>

        {/* Claim Type */}
        <Section title="Claim Type">
          <div className="space-y-0.5">
            {typesList.map(t => (
              <CheckItem
                key={t} label={t} count={counts.types[t]}
                checked={filters.claimTypes.includes(t)}
                onChange={() => toggleArr('claimTypes', t)}
              />
            ))}
          </div>
        </Section>

        {/* Pet Gender */}
        <Section title="Pet Gender">
          <div className="flex gap-2">
            {['', 'Male', 'Female'].map(g => (
              <button
                key={g}
                onClick={() => set('petGender', g)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filters.petGender === g ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:border-blue-400'}`}
              >
                {g === '' ? 'All' : g}
              </button>
            ))}
          </div>
        </Section>

        {/* Disease / Diagnosis */}
        <Section title="Disease / Diagnosis">
          <input
            type="text"
            placeholder="Search diagnosis…"
            value={filters.diagnosis}
            onChange={e => set('diagnosis', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Section>

        {/* Pet Age */}
        <Section title="Pet Age (years)">
          <DualRange
            min={0} max={20}
            value={filters.petAgeRange}
            onChange={v => set('petAgeRange', v)}
            format={v => `${v} yr`}
          />
        </Section>

        {/* Pet Weight */}
        <Section title="Pet Weight (kg)">
          <DualRange
            min={0} max={50}
            value={filters.weightRange}
            onChange={v => set('weightRange', v)}
            step={0.5}
            format={v => `${v} kg`}
          />
        </Section>

        {/* Client Age */}
        <Section title="Client Age">
          <DualRange
            min={0} max={100}
            value={filters.clientAgeRange}
            onChange={v => set('clientAgeRange', v)}
            format={v => `${v} yr`}
          />
        </Section>

        {/* Claim Value (Premium proxy) */}
        <Section title="Claim Value (₱)">
          <DualRange
            min={0} max={100000}
            value={filters.premiumRange}
            onChange={v => set('premiumRange', v)}
            step={500}
            format={v => v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`}
          />
        </Section>

      </div>
    </aside>
  )
}
