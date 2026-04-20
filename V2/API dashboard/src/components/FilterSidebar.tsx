import React, { useState } from 'react'
import { X, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'

export interface SidebarFilters {
  methods: string[]
  authTypes: string[]
  tokenStatuses: string[]
  tokenTypes: string[]
}

export const DEFAULT_FILTERS: SidebarFilters = {
  methods: [],
  authTypes: [],
  tokenStatuses: [],
  tokenTypes: [],
}

function isDefault(f: SidebarFilters): boolean {
  return (
    f.methods.length === 0 &&
    f.authTypes.length === 0 &&
    f.tokenStatuses.length === 0 &&
    f.tokenTypes.length === 0
  )
}

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

function CheckItem({
  label, checked, onChange, badge, badgeClass,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  badge?: string
  badgeClass?: string
}) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer group py-1">
      <div className="flex items-center gap-2">
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-blue-400'}`}>
          {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </div>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
        <span className="text-sm text-slate-700 group-hover:text-slate-900">{label}</span>
      </div>
      {badge && (
        <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${badgeClass ?? 'bg-slate-100 text-slate-500'}`}>
          {badge}
        </span>
      )}
    </label>
  )
}

interface Props {
  filters: SidebarFilters
  onChange: (f: SidebarFilters) => void
  onClose: () => void
}

export default function FilterSidebar({ filters, onChange, onClose }: Props) {
  const toggle = (k: keyof SidebarFilters, val: string) => {
    const arr = filters[k]
    onChange({ ...filters, [k]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] })
  }

  const activeCount =
    filters.methods.length +
    filters.authTypes.length +
    filters.tokenStatuses.length +
    filters.tokenTypes.length

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

        {/* HTTP Method */}
        <Section title="HTTP Method">
          <div className="space-y-0.5">
            {[
              { label: 'GET',    badge: 'GET',    badgeClass: 'bg-blue-100 text-blue-700' },
              { label: 'POST',   badge: 'POST',   badgeClass: 'bg-green-100 text-green-700' },
              { label: 'PUT',    badge: 'PUT',    badgeClass: 'bg-yellow-100 text-yellow-700' },
              { label: 'DELETE', badge: 'DELETE', badgeClass: 'bg-red-100 text-red-700' },
            ].map(({ label, badge, badgeClass }) => (
              <CheckItem
                key={label}
                label={label}
                badge={badge}
                badgeClass={badgeClass}
                checked={filters.methods.includes(label)}
                onChange={() => toggle('methods', label)}
              />
            ))}
          </div>
        </Section>

        {/* Auth Level */}
        <Section title="Auth Level">
          <div className="space-y-0.5">
            {[
              { label: 'Public',  badge: 'pk_', badgeClass: 'bg-blue-50 text-blue-600' },
              { label: 'Secret',  badge: 'sk_', badgeClass: 'bg-purple-50 text-purple-600' },
            ].map(({ label, badge, badgeClass }) => (
              <CheckItem
                key={label}
                label={label}
                badge={badge}
                badgeClass={badgeClass}
                checked={filters.authTypes.includes(label)}
                onChange={() => toggle('authTypes', label)}
              />
            ))}
          </div>
        </Section>

        {/* Token Status */}
        <Section title="Token Status">
          <div className="space-y-0.5">
            {[
              { label: 'Active',  badge: 'Active',  badgeClass: 'bg-green-100 text-green-700' },
              { label: 'Revoked', badge: 'Revoked', badgeClass: 'bg-red-100 text-red-500' },
            ].map(({ label, badge, badgeClass }) => (
              <CheckItem
                key={label}
                label={label}
                badge={badge}
                badgeClass={badgeClass}
                checked={filters.tokenStatuses.includes(label)}
                onChange={() => toggle('tokenStatuses', label)}
              />
            ))}
          </div>
        </Section>

        {/* Token Type */}
        <Section title="Token Type">
          <div className="space-y-0.5">
            {[
              { label: 'Public Key',  badge: 'pk_live_', badgeClass: 'bg-blue-50 text-blue-600' },
              { label: 'Secret Key',  badge: 'sk_live_', badgeClass: 'bg-purple-50 text-purple-600' },
            ].map(({ label, badge, badgeClass }) => (
              <CheckItem
                key={label}
                label={label}
                badge={badge}
                badgeClass={badgeClass}
                checked={filters.tokenTypes.includes(label)}
                onChange={() => toggle('tokenTypes', label)}
              />
            ))}
          </div>
        </Section>

      </div>
    </aside>
  )
}
