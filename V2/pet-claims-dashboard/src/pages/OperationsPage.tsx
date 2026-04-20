import React, { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'
import { Clock, AlertTriangle, CheckCircle, FileX } from 'lucide-react'
import { Claim } from '../types'

function fmt(v: number) { return `₱${v.toLocaleString()}` }

function Card({ title, sub, children, className = '' }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

const STAGE_COLORS: Record<string, string> = {
  'Document Collection': '#3b82f6',
  'Under Review': '#f59e0b',
  'Approved': '#22c55e',
  'Completed': '#10b981',
  'Closed': '#94a3b8',
}
const AGING_COLORS = ['#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444']

function daysBetween(a: string, b: string) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

export default function OperationsPage({ claims }: { claims: Claim[] }) {
  const data = useMemo(() => {
    // Stage distribution
    const stageMap: Record<string, number> = {}
    claims.forEach(c => { stageMap[c.stage] = (stageMap[c.stage] || 0) + 1 })
    const stages = Object.entries(stageMap)
      .map(([name, value]) => ({ name, value, fill: STAGE_COLORS[name] ?? '#8b5cf6' }))
      .sort((a, b) => b.value - a.value)

    // Incomplete claims (missing docs)
    const incomplete = claims.filter(c => c.missing_documents?.trim())
    const complete = claims.filter(c => !c.missing_documents?.trim())
    const completionRate = claims.length ? ((complete.length / claims.length) * 100) : 0

    // Avg resolution time (created_at → updated_at for approved/completed)
    const resolved = claims.filter(c => c.status === 'Approved' && c.created_at && c.updated_at)
    const avgDays = resolved.length
      ? resolved.reduce((s, c) => s + daysBetween(c.created_at, c.updated_at), 0) / resolved.length
      : 0

    // Open claim aging buckets
    const openClaims = claims.filter(c => c.status === 'Open' || c.status === 'Pending')
    const now = new Date().toISOString()
    const agingBuckets = [
      { label: '0–7 days',  min: 0,  max: 8  },
      { label: '8–14 days', min: 8,  max: 15 },
      { label: '15–30 days',min: 15, max: 31 },
      { label: '31–60 days',min: 31, max: 61 },
      { label: '60+ days',  min: 61, max: 9999 },
    ]
    const aging = agingBuckets.map((b, i) => ({
      name: b.label,
      value: openClaims.filter(c => {
        const d = daysBetween(c.created_at, now)
        return d >= b.min && d < b.max
      }).length,
      fill: AGING_COLORS[i],
    }))

    // Missing doc types
    const docMap: Record<string, number> = {}
    claims.filter(c => c.missing_documents).forEach(c => {
      c.missing_documents.split(',').map(s => s.trim()).filter(Boolean).forEach(d => {
        docMap[d] = (docMap[d] || 0) + 1
      })
    })
    const missingDocs = Object.entries(docMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, value]) => ({ name, value }))

    // Claims needing action (open > 14 days)
    const needsAction = openClaims
      .map(c => ({ ...c, days: daysBetween(c.created_at, now) }))
      .filter(c => c.days >= 14)
      .sort((a, b) => b.days - a.days)
      .slice(0, 8)

    return { stages, incomplete, completionRate, avgDays, aging, missingDocs, needsAction, resolved, openClaims }
  }, [claims])

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Resolution</p>
          </div>
          <p className="text-3xl font-bold text-blue-600">{data.avgDays.toFixed(1)}<span className="text-base font-normal text-slate-400 ml-1">days</span></p>
          <p className="text-xs text-slate-400 mt-1">approved claims only</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Doc Completion</p>
          </div>
          <p className="text-3xl font-bold text-green-600">{data.completionRate.toFixed(1)}<span className="text-base font-normal text-slate-400 ml-0.5">%</span></p>
          <p className="text-xs text-slate-400 mt-1">{data.incomplete.length} incomplete</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open/Pending</p>
          </div>
          <p className="text-3xl font-bold text-amber-600">{data.openClaims.length}</p>
          <p className="text-xs text-slate-400 mt-1">requiring attention</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <FileX className="w-4 h-4 text-red-500" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue (14d+)</p>
          </div>
          <p className="text-3xl font-bold text-red-500">{data.needsAction.length}</p>
          <p className="text-xs text-slate-400 mt-1">open &gt; 14 days</p>
        </div>
      </div>

      {/* Stage + Aging */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Claims by Stage" sub="Current pipeline status">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.stages} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={155} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Claims">
                {data.stages.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Open Claim Aging" sub="Days since filed (open + pending)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.aging}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Claims">
                {data.aging.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Overdue claims table */}
      {data.needsAction.length > 0 && (
        <Card title="Claims Needing Immediate Attention" sub="Open or pending for 14+ days">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {['ID', 'Client', 'Pet', 'Stage', 'Missing Docs', 'Days Open'].map(h => (
                    <th key={h} className="pb-2 text-left text-slate-500 font-semibold px-2 first:pl-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.needsAction.map(c => (
                  <tr key={c.id} className="hover:bg-red-50">
                    <td className="py-2 font-mono text-slate-500">{c.id}</td>
                    <td className="py-2 px-2 font-medium text-slate-700">{c.client_name}</td>
                    <td className="py-2 px-2 text-slate-500">{c.pet_name} ({c.species})</td>
                    <td className="py-2 px-2 text-slate-500">{c.stage}</td>
                    <td className="py-2 px-2 text-amber-600 max-w-[160px] truncate" title={c.missing_documents}>{c.missing_documents || '—'}</td>
                    <td className="py-2 px-2">
                      <span className={`font-bold ${c.days >= 30 ? 'text-red-600' : 'text-amber-600'}`}>{c.days}d</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
