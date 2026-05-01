import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { RefreshCw, SlidersHorizontal, LayoutDashboard, TrendingUp, BarChart2, PawPrint, Workflow, Table2, Database, Shield, Users, ChevronDown, X, Settings, Link2, ClipboardList, ChevronLeft, ChevronRight, Contact, Stethoscope, BadgeDollarSign } from 'lucide-react'
import { Claim } from '../types'
import FilterSidebar, { SidebarFilters, DEFAULT_FILTERS } from '../components/FilterSidebar'
import OverviewPage from './OverviewPage'
import FinancialPage from './FinancialPage'
import ClaimsAnalyticsPage from './ClaimsAnalyticsPage'
import PetAnalyticsPage from './PetAnalyticsPage'
import OperationsPage from './OperationsPage'
import ClaimsTablePage from './ClaimsTablePage'
import MasterlistPage from './MasterlistPage'
import DataDownloadsPage from './DataDownloadsPage'
import UnderwritingPage from './UnderwritingPage'
import ClientsPage from './ClientsPage'
import PetsPage from './PetsPage'
import APIPage from './APIPage'
import SettingsPage from './SettingsPage'
import ProfilesPage from './ProfilesPage'
import DiagnosisTypesPage from './DiagnosisTypesPage'
import PremiumsPage from './PremiumsPage'
import { useAuth } from '../auth/AuthContext'

type PageId =
  | 'overview'
  | 'financial'
  | 'claims'
  | 'pets'
  | 'operations'
  | 'table'
  | 'masterlist'
  | 'downloads'
  | 'masterlist-clients'
  | 'masterlist-pets'
  | 'underwriting'
  | 'api'
  | 'settings'
  | 'profiles'
  | 'diagnosis-types'
  | 'premiums'

interface OpenTab {
  id: string
  page: PageId
  label: string
  icon: React.ElementType
  closeable: boolean
}

const PAGE_META: Record<PageId, { label: string; icon: React.ElementType }> = {
  overview:           { label: 'Overview',      icon: LayoutDashboard },
  financial:          { label: 'Financial',      icon: TrendingUp },
  underwriting:       { label: 'Underwriting',   icon: Shield },
  claims:             { label: 'Claims',         icon: BarChart2 },
  pets:               { label: 'Pets & Clients', icon: PawPrint },
  operations:         { label: 'Operations',     icon: Workflow },
  table:              { label: 'Claims Table',   icon: Table2 },
  // Submenu items under the Data Download dropdown
  downloads:          { label: 'Data Download',  icon: Database },
  masterlist:         { label: 'Claims',         icon: Table2 },
  'masterlist-clients': { label: 'Clients',      icon: Users },
  'masterlist-pets':  { label: 'Pets',           icon: PawPrint },
  api:                { label: 'API',            icon: Database },
  settings:           { label: 'Settings',      icon: Settings },
  profiles:           { label: 'Profiles',      icon: Contact },
  'diagnosis-types':  { label: 'Diagnosis Types', icon: Stethoscope },
  'premiums':         { label: 'Premiums',         icon: BadgeDollarSign },
}

// Top quick-launch buttons (left side of header)
const LAUNCHERS: PageId[] = ['claims', 'pets', 'operations', 'table', 'profiles']

function applyFilters(claims: Claim[], sf: SidebarFilters): Claim[] {
  return claims.filter(c => {
    if (sf.species.length && !sf.species.includes(c.species)) return false
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

const DEFAULT_TAB: OpenTab = {
  id: 'tab-overview',
  page: 'overview',
  label: 'Overview',
  icon: LayoutDashboard,
  closeable: false,
}

export default function Dashboard() {
  const { user } = useAuth()
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([DEFAULT_TAB])
  const [activeTabId, setActiveTabId] = useState('tab-overview')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilters>(DEFAULT_FILTERS)
  const [masterlistOpen, setMasterlistOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const [financeOpen, setFinanceOpen] = useState(false)
  const [financeDropdownPos, setFinanceDropdownPos] = useState({ top: 0, left: 0 })
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const masterlistRef = useRef<HTMLDivElement>(null)
  const masterlistCloseTimer = useRef<number | null>(null)
  const financeRef = useRef<HTMLDivElement>(null)
  const financeCloseTimer = useRef<number | null>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const settingsCloseTimer = useRef<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDropdownPos, setSettingsDropdownPos] = useState({ top: 0, left: 0 })
  const [settingsTab, setSettingsTab] = useState<'profile' | 'connections' | 'audit'>('profile')
  const tabBarRef = useRef<HTMLDivElement>(null)
  const [tabBarCanLeft, setTabBarCanLeft] = useState(false)
  const [tabBarCanRight, setTabBarCanRight] = useState(false)
  const dragTabId = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setClaims(await window.api.getClaims()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Allow other pages (Profiles) to request a claims refresh
  useEffect(() => {
    const handler = () => { load() }
    document.addEventListener('refresh-claims', handler)
    return () => document.removeEventListener('refresh-claims', handler)
  }, [load])

  useEffect(() => {
    const el = tabBarRef.current
    if (!el) return

    const update = () => {
      const max = el.scrollWidth - el.clientWidth
      setTabBarCanLeft(el.scrollLeft > 0)
      setTabBarCanRight(el.scrollLeft < max - 1)
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [openTabs.length])

  function scrollTabsBy(dx: number) {
    const el = tabBarRef.current
    if (!el) return
    el.scrollBy({ left: dx, behavior: 'smooth' })
  }

  const filteredClaims = useMemo(() => applyFilters(claims, sidebarFilters), [claims, sidebarFilters])

  const activeFilterCount = (
    sidebarFilters.species.length +
    (sidebarFilters.petGender ? 1 : 0) +
    (sidebarFilters.breed ? 1 : 0) +
    (sidebarFilters.diagnosis ? 1 : 0) +
    (JSON.stringify(sidebarFilters.petAgeRange) !== JSON.stringify(DEFAULT_FILTERS.petAgeRange) ? 1 : 0) +
    (JSON.stringify(sidebarFilters.weightRange) !== JSON.stringify(DEFAULT_FILTERS.weightRange) ? 1 : 0) +
    (JSON.stringify(sidebarFilters.clientAgeRange) !== JSON.stringify(DEFAULT_FILTERS.clientAgeRange) ? 1 : 0) +
    (JSON.stringify(sidebarFilters.premiumRange) !== JSON.stringify(DEFAULT_FILTERS.premiumRange) ? 1 : 0)
  )

  function openTab(page: PageId) {
    const existing = openTabs.find(t => t.page === page)
    if (existing) {
      setActiveTabId(existing.id)
    } else {
      const meta = PAGE_META[page]
      const newTab: OpenTab = {
        id: `tab-${Date.now()}`,
        page,
        label: meta.label,
        icon: meta.icon,
        closeable: true,
      }
      setOpenTabs(prev => [...prev, newTab])
      setActiveTabId(newTab.id)
    }
    setMasterlistOpen(false)
    setFinanceOpen(false)
    setSettingsOpen(false)
  }

  function openSettings(next: 'profile' | 'connections' | 'audit') {
    setSettingsTab(next)
    openTab('settings')
  }

  function closeTab(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setOpenTabs(prev => {
      const idx = prev.findIndex(t => t.id === id)
      const next = prev.filter(t => t.id !== id)
      if (activeTabId === id && next.length > 0) {
        setActiveTabId(next[Math.max(0, idx - 1)].id)
      }
      return next
    })
  }

  function onDragStart(id: string) {
    dragTabId.current = id
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    setDragOverId(id)
  }

  function onDrop(targetId: string) {
    const fromId = dragTabId.current
    if (!fromId || fromId === targetId) { setDragOverId(null); return }
    setOpenTabs(prev => {
      const from = prev.findIndex(t => t.id === fromId)
      const to = prev.findIndex(t => t.id === targetId)
      const next = [...prev]
      const [removed] = next.splice(from, 1)
      next.splice(to, 0, removed)
      return next
    })
    dragTabId.current = null
    setDragOverId(null)
  }

  const activeTab = openTabs.find(t => t.id === activeTabId) ?? openTabs[0]

  const cancelMasterlistClose = useCallback(() => {
    if (masterlistCloseTimer.current != null) {
      window.clearTimeout(masterlistCloseTimer.current)
      masterlistCloseTimer.current = null
    }
  }, [])

  const scheduleMasterlistClose = useCallback(() => {
    cancelMasterlistClose()
    // Small delay so you can move from launcher to menu (there's a tiny visual gap)
    masterlistCloseTimer.current = window.setTimeout(() => {
      setMasterlistOpen(false)
      masterlistCloseTimer.current = null
    }, 200)
  }, [cancelMasterlistClose])

  const cancelFinanceClose = useCallback(() => {
    if (financeCloseTimer.current != null) {
      window.clearTimeout(financeCloseTimer.current)
      financeCloseTimer.current = null
    }
  }, [])

  const scheduleFinanceClose = useCallback(() => {
    cancelFinanceClose()
    financeCloseTimer.current = window.setTimeout(() => {
      setFinanceOpen(false)
      financeCloseTimer.current = null
    }, 200)
  }, [cancelFinanceClose])

  const cancelSettingsClose = useCallback(() => {
    if (settingsCloseTimer.current != null) {
      window.clearTimeout(settingsCloseTimer.current)
      settingsCloseTimer.current = null
    }
  }, [])

  const scheduleSettingsClose = useCallback(() => {
    cancelSettingsClose()
    settingsCloseTimer.current = window.setTimeout(() => {
      setSettingsOpen(false)
      settingsCloseTimer.current = null
    }, 200)
  }, [cancelSettingsClose])

  return (
    <div className="flex min-h-screen bg-slate-50 flex-col">
      <header className="bg-[#3b82f6] text-white flex-shrink-0 z-20 sticky top-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        {/* Nav row — pl-20 leaves room for macOS traffic lights */}
        <div className="flex items-center gap-3 pl-20 pr-4 py-1.5">
          <span className="font-semibold text-sm tracking-wide whitespace-nowrap mr-1">Pet Insurance Claims</span>

          <div className="flex-1 overflow-x-auto nav-scroll" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <nav className="flex items-center gap-1 w-max">
              {/* Overview (always left-most) */}
              <button
                onClick={() => openTab('overview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                  transition-all duration-150 ease-out
                  hover:-translate-y-[1px] hover:scale-[1.02]
                  active:translate-y-0 active:scale-[0.98]
                  hover:shadow-md hover:shadow-black/10
                  ${
                  openTabs.some(t => t.page === 'overview') ? 'bg-white/20 text-white' : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Overview
              </button>

              {/* Financial / Underwriting dropdown launcher */}
              <div
                ref={financeRef}
                className="relative"
                onMouseEnter={() => {
                  cancelFinanceClose()
                  if (financeRef.current) {
                    const r = financeRef.current.getBoundingClientRect()
                    setFinanceDropdownPos({ top: r.bottom + 4, left: r.left })
                  }
                  setFinanceOpen(true)
                }}
                onMouseLeave={scheduleFinanceClose}
              >
                <button
                  onClick={() => openTab('financial')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                    transition-all duration-150 ease-out
                    hover:-translate-y-[1px] hover:scale-[1.02]
                    active:translate-y-0 active:scale-[0.98]
                    hover:shadow-md hover:shadow-black/10
                    ${
                    openTabs.some(t => t.page === 'financial' || t.page === 'underwriting')
                      ? 'bg-white/20 text-white'
                      : 'text-blue-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Financial
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>

                {financeOpen && (
                  <div
                    className="fixed w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50"
                    style={{ top: financeDropdownPos.top, left: financeDropdownPos.left }}
                    onMouseEnter={cancelFinanceClose}
                    onMouseLeave={scheduleFinanceClose}
                  >
                    {(['financial', 'underwriting'] as PageId[]).map(page => {
                      const { label, icon: Icon } = PAGE_META[page]
                      return (
                        <button
                          key={page}
                          onClick={() => openTab(page)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-slate-50 ${
                            openTabs.some(t => t.page === page) ? 'text-blue-600' : 'text-slate-700'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {LAUNCHERS.map(page => {
                const { label, icon: Icon } = PAGE_META[page]
                const isOpen = openTabs.some(t => t.page === page)
                const launcherLabel = label
                return (
                  <button
                    key={page}
                    onClick={() => openTab(page)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                      transition-all duration-150 ease-out
                      hover:-translate-y-[1px] hover:scale-[1.02]
                      active:translate-y-0 active:scale-[0.98]
                      hover:shadow-md hover:shadow-black/10
                      ${
                      isOpen ? 'bg-white/20 text-white' : 'text-blue-200 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {launcherLabel}
                  </button>
                )
              })}

              {/* Masterlist dropdown launcher */}
              <div
                ref={masterlistRef}
                className="relative"
                onMouseEnter={() => {
                  cancelMasterlistClose()
                  if (masterlistRef.current) {
                    const r = masterlistRef.current.getBoundingClientRect()
                    setDropdownPos({ top: r.bottom + 4, left: r.left })
                  }
                  setMasterlistOpen(true)
                }}
                onMouseLeave={scheduleMasterlistClose}
              >
                <button
                  onClick={() => openTab('downloads')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                    transition-all duration-150 ease-out
                    hover:-translate-y-[1px] hover:scale-[1.02]
                    active:translate-y-0 active:scale-[0.98]
                    hover:shadow-md hover:shadow-black/10
                    ${
                    openTabs.some(t => t.page === 'downloads' || t.page === 'masterlist' || t.page === 'masterlist-clients' || t.page === 'masterlist-pets' || t.page === 'diagnosis-types' || t.page === 'premiums')
                      ? 'bg-white/20 text-white'
                      : 'text-blue-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  Data Download
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>

                {masterlistOpen && (
                  <div
                    className="fixed w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50"
                    style={{ top: dropdownPos.top, left: dropdownPos.left }}
                    onMouseEnter={cancelMasterlistClose}
                    onMouseLeave={scheduleMasterlistClose}
                  >
                    {(['downloads', 'masterlist', 'masterlist-clients', 'masterlist-pets', 'diagnosis-types', 'premiums'] as PageId[]).map(page => {
                      const { label, icon: Icon } = PAGE_META[page]
                      return (
                        <button
                          key={page}
                          onClick={() => openTab(page)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-slate-50 ${openTabs.some(t => t.page === page) ? 'text-blue-600' : 'text-slate-700'}`}
                        >
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Settings dropdown launcher */}
              <div
                ref={settingsRef}
                className="relative"
                onMouseEnter={() => {
                  cancelSettingsClose()
                  if (settingsRef.current) {
                    const r = settingsRef.current.getBoundingClientRect()
                    setSettingsDropdownPos({ top: r.bottom + 4, left: r.left })
                  }
                  setSettingsOpen(true)
                }}
                onMouseLeave={scheduleSettingsClose}
              >
                <button
                  onClick={() => openSettings('profile')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                    transition-all duration-150 ease-out
                    hover:-translate-y-[1px] hover:scale-[1.02]
                    active:translate-y-0 active:scale-[0.98]
                    hover:shadow-md hover:shadow-black/10
                    ${
                      openTabs.some(t => t.page === 'settings')
                        ? 'bg-white/20 text-white'
                        : 'text-blue-200 hover:text-white hover:bg-white/10'
                    }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>

                {settingsOpen && (
                  <div
                    className="fixed w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50"
                    style={{ top: settingsDropdownPos.top, left: settingsDropdownPos.left }}
                    onMouseEnter={cancelSettingsClose}
                    onMouseLeave={scheduleSettingsClose}
                  >
                    <button
                      onClick={() => openSettings('profile')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-slate-50 text-slate-700"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      Profile
                    </button>
                    <button
                      onClick={() => openSettings('connections')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-slate-50 text-slate-700"
                    >
                      <Link2 className="w-3.5 h-3.5 text-slate-400" />
                      Connections
                    </button>
                    <button
                      onClick={() => openSettings('audit')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-slate-50 text-slate-700"
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                      Audit Trail
                    </button>
                  </div>
                )}
              </div>
            </nav>
          </div>

          <div className="flex items-center gap-2 ml-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <div className="hidden sm:flex items-center gap-2 text-xs text-white/90 mr-1">
              <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center font-semibold">
                {(user?.name?.trim()?.[0] ?? 'U').toUpperCase()}
              </div>
              <span className="max-w-36 truncate">{user?.name ?? 'User'}</span>
            </div>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sidebarOpen || activeFilterCount > 0 ? 'bg-blue-400 text-white' : 'text-blue-200 hover:text-white hover:bg-white/10'
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

        {/* Chrome-style tab bar */}
        <div className="relative bg-blue-800/70 border-t border-white/10" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {/* Edge fades for readability when scrollable */}
          {tabBarCanLeft && <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-blue-900/60 to-transparent z-10" />}
          {tabBarCanRight && <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-blue-900/60 to-transparent z-10" />}

          {/* Scroll buttons */}
          {tabBarCanLeft && (
            <button
              type="button"
              onClick={() => scrollTabsBy(-260)}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 transition-colors"
              title="Scroll tabs left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {tabBarCanRight && (
            <button
              type="button"
              onClick={() => scrollTabsBy(260)}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 transition-colors"
              title="Scroll tabs right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          <div
            ref={tabBarRef}
            className="flex items-end px-4 gap-1 overflow-x-auto nav-scroll"
            onWheel={(e) => {
              // Convert vertical wheel into horizontal scroll (helps when tabs are crowded)
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                tabBarRef.current?.scrollBy({ left: e.deltaY, behavior: 'auto' })
              }
            }}
          >
          {openTabs.map(t => {
            const Icon = t.icon
            const active = t.id === activeTabId
            const isDragOver = dragOverId === t.id && dragTabId.current !== t.id
            return (
              <div
                key={t.id}
                draggable
                onDragStart={() => onDragStart(t.id)}
                onDragOver={e => onDragOver(e, t.id)}
                onDrop={() => onDrop(t.id)}
                onDragEnd={() => { dragTabId.current = null; setDragOverId(null) }}
                onClick={() => setActiveTabId(t.id)}
                className={`
                  flex items-center gap-1.5 px-3 pt-2 pb-2 rounded-t-lg text-xs font-medium
                  cursor-pointer select-none whitespace-nowrap min-w-0 max-w-44 group
                  transition-all duration-150 ease-out
                  ${active
                    ? 'bg-slate-50 text-slate-900 shadow-md shadow-black/15 border border-slate-200 border-b-transparent'
                    : 'bg-blue-900/35 text-white/90 border border-white/10 hover:bg-blue-900/55 hover:text-white hover:border-white/20 hover:-translate-y-[1px]'
                  }
                  ${isDragOver ? 'ring-2 ring-inset ring-white/60' : ''}
                `}
              >
                <Icon className={`w-3 h-3 flex-shrink-0 ${active ? 'text-slate-700' : 'text-white/80'}`} />
                <span className="truncate">{t.label}</span>
                {t.closeable && (
                  <button
                    type="button"
                    onClick={e => closeTab(t.id, e)}
                    className={`ml-1 p-0.5 rounded flex-shrink-0 transition-colors
                      ${active
                        ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                        : 'text-white/70 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/15'
                      }`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            )
          })}
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
          {activeTab?.page === 'overview'           && <OverviewPage claims={filteredClaims} />}
          {activeTab?.page === 'financial'          && <FinancialPage claims={filteredClaims} />}
          {activeTab?.page === 'claims'             && <ClaimsAnalyticsPage claims={filteredClaims} />}
          {activeTab?.page === 'pets'               && <PetAnalyticsPage claims={filteredClaims} />}
          {activeTab?.page === 'operations'         && <OperationsPage claims={filteredClaims} />}
          {activeTab?.page === 'table'              && <ClaimsTablePage claims={filteredClaims} onRefresh={load} />}
          {activeTab?.page === 'masterlist'         && <MasterlistPage claims={filteredClaims} onRefresh={load} />}
          {activeTab?.page === 'downloads'          && <DataDownloadsPage claims={filteredClaims} onRefresh={load} />}
          {activeTab?.page === 'masterlist-clients' && <ClientsPage claims={filteredClaims} />}
          {activeTab?.page === 'masterlist-pets'    && <PetsPage claims={filteredClaims} />}
          {activeTab?.page === 'underwriting'       && <UnderwritingPage claims={filteredClaims} onRefresh={load} />}
          {activeTab?.page === 'api'                && <APIPage />}
          {activeTab?.page === 'settings'           && <SettingsPage initialTab={settingsTab} />}
          {activeTab?.page === 'profiles'           && <ProfilesPage />}
          {activeTab?.page === 'diagnosis-types'    && <DiagnosisTypesPage />}
          {activeTab?.page === 'premiums'            && <PremiumsPage />}
        </main>
      </div>
    </div>
  )
}
