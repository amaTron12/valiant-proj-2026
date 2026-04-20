import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, SlidersHorizontal, LayoutDashboard, TrendingUp, BarChart2, PawPrint, Workflow, Table2, Database, Shield, Code2 } from 'lucide-react'
import { Claim } from '../types'
import FilterSidebar, { SidebarFilters, DEFAULT_FILTERS } from '../components/FilterSidebar'
import OverviewPage from './OverviewPage'
import FinancialPage from './FinancialPage'
import ClaimsAnalyticsPage from './ClaimsAnalyticsPage'
import PetAnalyticsPage from './PetAnalyticsPage'
import OperationsPage from './OperationsPage'
import ClaimsTablePage from './ClaimsTablePage'
import MasterlistPage from './MasterlistPage'
import UnderwritingPage from './UnderwritingPage'
import APIPage from './APIPage'

type TabId = 'overview' | 'financial' | 'claims' | 'pets' | 'operations' | 'table' | 'masterlist' | 'underwriting' | 'api'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview',      label: 'Overview',       icon: LayoutDashboard },
  { id: 'financial',     label: 'Financial',       icon: TrendingUp },
  { id: 'underwriting',  label: 'Underwriting',    icon: Shield },
  { id: 'claims',        label: 'Claims',          icon: BarChart2 },
  { id: 'pets',          label: 'Pets & Clients',  icon: PawPrint },
  { id: 'operations',    label: 'Operations',      icon: Workflow },
  { id: 'table',         label: 'Claims Table',    icon: Table2 },
  { id: 'masterlist',    label: 'Masterlist',      icon: Database },
  // { id: 'api',        label: 'API',             icon: Code2 }, // hidden
]

function applyFilters(claims: Claim[], sf: SidebarFilters): Claim[] {
  return claims.filter(c => {
    if (sf.species.length && !sf.species.includes(c.species)) return false
    if (sf.claimTypes.length && !sf.claimTypes.includes(c.claim_type)) return false
    if (sf.petGender && c.gender !== sf.petGender) return false
    if (c.age < sf.petAgeRange[0] || c.age > sf.petAgeRange[1]) return false
    if (c.weight < sf.weightRange[0] || c.weight > sf.weightRange[1]) return false
    if (sf.breed && !c.breed.toLowerCase().includes(sf.breed.toLowerCase())) return false
    if (sf.diagnosis && !c.diagnosis.toLowerCase().includes(sf.diagnosis.toLowerCase())) return false
    if (c.client_age < sf.clientAgeRange[0] || c.client_age > sf.clientAgeRange[1]) return false
    const claimValue = (c.medicine_cost || 0) + (c.service_cost || 0)
    if (claimValue < sf.premiumRange[0] || claimValue > sf.premiumRange[1]) return false
    return true
  })
}

export default function Dashboard() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilters>(DEFAULT_FILTERS)

  const load = useCallback(async () => {
    setLoading(true)
    try { setClaims(await window.api.getClaims()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filteredClaims = useMemo(() => applyFilters(claims, sidebarFilters), [claims, sidebarFilters])

  const activeFilterCount = (
    sidebarFilters.species.length +
    sidebarFilters.claimTypes.length +
    (sidebarFilters.petGender ? 1 : 0) +
    (sidebarFilters.breed ? 1 : 0) +
    (sidebarFilters.diagnosis ? 1 : 0) +
    (JSON.stringify(sidebarFilters.petAgeRange) !== JSON.stringify(DEFAULT_FILTERS.petAgeRange) ? 1 : 0) +
    (JSON.stringify(sidebarFilters.weightRange) !== JSON.stringify(DEFAULT_FILTERS.weightRange) ? 1 : 0) +
    (JSON.stringify(sidebarFilters.clientAgeRange) !== JSON.stringify(DEFAULT_FILTERS.clientAgeRange) ? 1 : 0) +
    (JSON.stringify(sidebarFilters.premiumRange) !== JSON.stringify(DEFAULT_FILTERS.premiumRange) ? 1 : 0)
  )

  return (
    <div className="flex min-h-screen bg-slate-50 flex-col">
      {/* Top bar */}
      <header className="bg-[#3b82f6] text-white flex-shrink-0 z-20 sticky top-0">
        {/* Traffic-light spacer — draggable, gives macOS window controls room */}
        <div className="h-7 w-full" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
        <div className="flex items-center gap-3 px-5 py-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {/* App name only — no logo icon */}
          <span className="font-semibold text-sm tracking-wide whitespace-nowrap mr-2">Pet Insurance Claims</span>

          {/* Scrollable tab navigation */}
          <div className="flex-1 overflow-x-auto nav-scroll">
            <nav className="flex items-center gap-1 w-max">
              {TABS.map(t => {
                const Icon = t.icon
                const active = tab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'text-blue-200 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sidebarOpen || activeFilterCount > 0
                  ? 'bg-blue-400 text-white'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-white text-blue-700 text-xs font-bold px-1 rounded-full">{activeFilterCount}</span>
              )}
            </button>

            <button
              onClick={load}
              disabled={loading}
              className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {sidebarOpen && (
          <FilterSidebar
            claims={claims}
            filters={sidebarFilters}
            onChange={setSidebarFilters}
            onClose={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 min-w-0 overflow-auto">
          {tab === 'overview'    && <OverviewPage claims={filteredClaims} />}
          {tab === 'financial'  && <FinancialPage claims={filteredClaims} />}
          {tab === 'claims'     && <ClaimsAnalyticsPage claims={filteredClaims} />}
          {tab === 'pets'       && <PetAnalyticsPage claims={filteredClaims} />}
          {tab === 'operations' && <OperationsPage claims={filteredClaims} />}
          {tab === 'table'      && (
            <ClaimsTablePage
              claims={filteredClaims}
              onRefresh={load}
            />
          )}
          {tab === 'masterlist' && (
            <MasterlistPage
              claims={filteredClaims}
              onRefresh={load}
            />
          )}
          {tab === 'underwriting' && (
            <UnderwritingPage
              claims={filteredClaims}
              onRefresh={load}
            />
          )}
          {tab === 'api' && <APIPage />}
        </main>
      </div>
    </div>
  )
}
