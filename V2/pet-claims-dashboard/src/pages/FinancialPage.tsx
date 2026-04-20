import React, { useMemo } from 'react'
import {
  ComposedChart, AreaChart, Area, BarChart, Bar,
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts'
import { Claim } from '../types'

function fmt(v: number) { return `₱${v.toLocaleString()}` }
function fmtK(v: number) {
  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1000) return `₱${(v / 1000).toFixed(1)}k`
  return `₱${v}`
}

function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color} leading-tight`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

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

const TYPE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4']

export default function FinancialPage({ claims }: { claims: Claim[] }) {
  const data = useMemo(() => {
    const totalClaimValue = claims.reduce((s, c) => s + (c.medicine_cost || 0) + (c.service_cost || 0), 0)
    const totalPaid = claims.reduce((s, c) => s + (c.total_amount_paid || 0), 0)
    const outstanding = claims
      .filter(c => c.status === 'Open' || c.status === 'Pending')
      .reduce((s, c) => s + (c.medicine_cost || 0) + (c.service_cost || 0), 0)
    const denialSavings = claims
      .filter(c => c.status === 'Denied')
      .reduce((s, c) => s + (c.medicine_cost || 0) + (c.service_cost || 0), 0)
    const lossRatio = totalClaimValue ? ((totalPaid / totalClaimValue) * 100) : 0
    const avgClaimValue = claims.length ? totalClaimValue / claims.length : 0

    // Monthly: filed value vs paid
    const monthMap: Record<string, { label: string; Filed: number; Paid: number; Medicine: number; Service: number; Count: number }> = {}
    claims.forEach(c => {
      const m = c.created_at?.slice(0, 7) ?? 'Unknown'
      if (!monthMap[m]) monthMap[m] = {
        label: new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        Filed: 0, Paid: 0, Medicine: 0, Service: 0, Count: 0
      }
      monthMap[m].Filed += (c.medicine_cost || 0) + (c.service_cost || 0)
      monthMap[m].Paid += c.total_amount_paid || 0
      monthMap[m].Medicine += c.medicine_cost || 0
      monthMap[m].Service += c.service_cost || 0
      monthMap[m].Count++
    })
    const monthly = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([, v]) => v)

    // Cumulative spend
    let cum = 0
    const cumulative = monthly.map(m => { cum += m.Paid; return { label: m.label, Cumulative: cum } })

    // By claim type
    const typeMap: Record<string, { value: number; count: number }> = {}
    claims.forEach(c => {
      if (!typeMap[c.claim_type]) typeMap[c.claim_type] = { value: 0, count: 0 }
      typeMap[c.claim_type].value += (c.medicine_cost || 0) + (c.service_cost || 0)
      typeMap[c.claim_type].count++
    })
    const byType = Object.entries(typeMap)
      .map(([name, v]) => ({ name, value: v.value, avg: Math.round(v.value / v.count) }))
      .sort((a, b) => b.value - a.value)

    // By species
    const specMap: Record<string, number> = {}
    claims.forEach(c => { specMap[c.species] = (specMap[c.species] || 0) + (c.medicine_cost || 0) + (c.service_cost || 0) })
    const bySpecies = Object.entries(specMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

    // Top 8 claims by value
    const topClaims = [...claims]
      .map(c => ({ ...c, claimValue: (c.medicine_cost || 0) + (c.service_cost || 0) }))
      .sort((a, b) => b.claimValue - a.claimValue)
      .slice(0, 8)

    return { totalClaimValue, totalPaid, outstanding, denialSavings, lossRatio, avgClaimValue, monthly, cumulative, byType, bySpecies, topClaims }
  }, [claims])

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPI label="Total Claim Value"  value={fmtK(data.totalClaimValue)}  sub="medicine + service costs"  color="text-slate-800" />
        <KPI label="Total Paid Out"     value={fmtK(data.totalPaid)}        sub="approved payouts"          color="text-green-600" />
        <KPI label="Outstanding Liability" value={fmtK(data.outstanding)}   sub="open + pending claims"     color="text-amber-600" />
        <KPI label="Denial Savings"     value={fmtK(data.denialSavings)}    sub="denied claim value"        color="text-blue-600" />
      </div>

      {/* Second KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Loss Ratio</p>
            <p className="text-3xl font-bold text-slate-800">{data.lossRatio.toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-1">paid ÷ total claimed</p>
          </div>
          <div className="flex-1">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${data.lossRatio < 50 ? 'bg-green-500' : data.lossRatio < 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(data.lossRatio, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">{data.lossRatio < 50 ? 'Healthy' : data.lossRatio < 75 ? 'Moderate' : 'High exposure'}</p>
          </div>
        </div>
        <KPI label="Avg Claim Value"    value={fmtK(data.avgClaimValue)}    sub="per claim filed"           color="text-violet-600" />
        <KPI label="Total Claims Filed" value={String(claims.length)}       sub={`${fmt(data.totalClaimValue)} total exposure`} color="text-slate-700" />
      </div>

      {/* Monthly Filed vs Paid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Monthly Claims Filed vs Paid" sub="Claim value filed vs actual payouts">
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number) => fmt(v)} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Filed" fill="#e0e7ff" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Paid" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="Count" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} yAxisId={0} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Cumulative Spend (YTD)" sub="Running total of payouts">
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={data.cumulative}>
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number) => fmt(v)} />
              <Area type="monotone" dataKey="Cumulative" stroke="#6366f1" strokeWidth={2.5} fill="url(#cumGrad)" dot={{ r: 3, fill: '#6366f1' }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Cost breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Claim Value by Type" sub="Total exposure per claim category">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byType} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} width={70} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {data.byType.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Highest Value Claims" sub="Top 8 by total claim cost">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-left text-slate-500 font-semibold">ID</th>
                  <th className="pb-2 text-left text-slate-500 font-semibold">Client</th>
                  <th className="pb-2 text-left text-slate-500 font-semibold">Diagnosis</th>
                  <th className="pb-2 text-right text-slate-500 font-semibold">Value</th>
                  <th className="pb-2 text-right text-slate-500 font-semibold">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.topClaims.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2 font-mono text-slate-500">{c.id}</td>
                    <td className="py-2 font-medium text-slate-700">{c.client_name}</td>
                    <td className="py-2 text-slate-500 max-w-[120px] truncate" title={c.diagnosis}>{c.diagnosis}</td>
                    <td className="py-2 text-right font-medium text-slate-700">{fmtK(c.claimValue)}</td>
                    <td className="py-2 text-right text-green-600 font-medium">{c.total_amount_paid > 0 ? fmtK(c.total_amount_paid) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
