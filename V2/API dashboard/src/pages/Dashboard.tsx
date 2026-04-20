import React, { useState } from 'react'
import { SlidersHorizontal, Code2, BarChart2 } from 'lucide-react'
import FilterSidebar, { SidebarFilters, DEFAULT_FILTERS } from '../components/FilterSidebar'
import APIPage from './APIPage'
import UsagePage from './UsagePage'

type TabId = 'api' | 'usage'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'api',   label: 'API Dashboard', icon: Code2 },
  { id: 'usage', label: 'Account Usage', icon: BarChart2 },
]

export default function Dashboard() {
  const [tab, setTab] = useState<TabId>('api')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilters>(DEFAULT_FILTERS)

  const activeFilterCount =
    sidebarFilters.methods.length +
    sidebarFilters.authTypes.length +
    sidebarFilters.tokenStatuses.length +
    sidebarFilters.tokenTypes.length

  return (
    <div className="flex min-h-screen bg-slate-50 flex-col">
      {/* Top bar */}
      <header className="bg-[#3b82f6] text-white flex-shrink-0 z-20 sticky top-0">
        {/* Traffic-light spacer */}
        <div className="h-7 w-full" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
        <div className="flex items-center gap-3 px-5 py-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <span className="font-semibold text-sm tracking-wide whitespace-nowrap mr-2">Insurance API</span>

          {/* Tab navigation */}
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
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {sidebarOpen && (
          <FilterSidebar
            filters={sidebarFilters}
            onChange={setSidebarFilters}
            onClose={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 min-w-0 overflow-auto">
          {tab === 'api'   && <APIPage filters={sidebarFilters} />}
          {tab === 'usage' && <UsagePage />}
        </main>
      </div>
    </div>
  )
}
