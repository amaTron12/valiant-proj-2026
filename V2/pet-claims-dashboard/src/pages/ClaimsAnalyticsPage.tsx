import React, { useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, FunnelChart, Funnel, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts'
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

const FUNNEL_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4']

export default function ClaimsAnalyticsPage({ claims }: { claims: Claim[] }) {
  const data = useMemo(() => {
    const total = claims.length
    const byStatus = { Open: 0, Pending: 0, Approved: 0, Denied: 0 }
    claims.forEach(c => { if (c.status in byStatus) byStatus[c.status as keyof typeof byStatus]++ })
    const approvalRate = total ? ((byStatus.Approved / total) * 100) : 0
    const denialRate = total ? ((byStatus.Denied / total) * 100) : 0

    // Monthly approval rate
    const monthMap: Record<string, { total: number; approved: number; denied: number }> = {}
    claims.forEach(c => {
      const m = c.created_at?.slice(0, 7) ?? 'Unknown'
      if (!monthMap[m]) monthMap[m] = { total: 0, approved: 0, denied: 0 }
      monthMap[m].total++
      if (c.status === 'Approved') monthMap[m].approved++
      if (c.status === 'Denied') monthMap[m].denied++
    })
    const monthlyRates = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([k, v]) => ({
        label: new Date(k + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        'Approval Rate': v.total ? +((v.approved / v.total) * 100).toFixed(1) : 0,
        'Denial Rate': v.total ? +((v.denied / v.total) * 100).toFixed(1) : 0,
        Total: v.total,
      }))

    // Stage funnel
    const stageOrder = ['Document Collection', 'Under Review', 'Approved', 'Completed', 'Closed']
    const stageMap: Record<string, number> = {}
    claims.forEach(c => { stageMap[c.stage] = (stageMap[c.stage] || 0) + 1 })
    const funnel = [...stageOrder.filter(s => stageMap[s]), ...Object.keys(stageMap).filter(s => !stageOrder.includes(s))]
      .map((name, i) => ({ name, value: stageMap[name] || 0, fill: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }))
      .filter(s => s.value > 0)

    // Top diagnoses with avg cost
    const dxMap: Record<string, { count: number; cost: number }> = {}
    claims.forEach(c => {
      if (!c.diagnosis) return
      if (!dxMap[c.diagnosis]) dxMap[c.diagnosis] = { count: 0, cost: 0 }
      dxMap[c.diagnosis].count++
      dxMap[c.diagnosis].cost += (c.medicine_cost || 0) + (c.service_cost || 0)
    })
    const topDx = Object.entries(dxMap)
      .map(([name, v]) => ({ name, count: v.count, avgCost: Math.round(v.cost / v.count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // Missing documents
    const missingMap: Record<string, number> = {}
    claims.filter(c => c.missing_documents).forEach(c => {
      c.missing_documents.split(',').map(s => s.trim()).filter(Boolean).forEach(doc => {
        missingMap[doc] = (missingMap[doc] || 0) + 1
      })
    })
    const missingDocs = Object.entries(missingMap).sort((a, b) => b[1] - a[1]).slice(0, 8)

    // Vet clinic stats
    const clinicMap: Record<string, { claims: number; paid: number; approved: number }> = {}
    claims.forEach(c => {
      if (!clinicMap[c.vet_clinic]) clinicMap[c.vet_clinic] = { claims: 0, paid: 0, approved: 0 }
      clinicMap[c.vet_clinic].claims++
      clinicMap[c.vet_clinic].paid += c.total_amount_paid || 0
      if (c.status === 'Approved') clinicMap[c.vet_clinic].approved++
    })
    const clinics = Object.entries(clinicMap)
      .map(([name, v]) => ({ name, ...v, approvalRate: v.claims ? +((v.approved / v.claims) * 100).toFixed(0) : 0 }))
      .sort((a, b) => b.claims - a.claims)
      .slice(0, 8)

    return { total, byStatus, approvalRate, denialRate, monthlyRates, funnel, topDx, missingDocs, clinics }
  }, [claims])

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Approval Rate', value: `${data.approvalRate.toFixed(1)}%`, sub: `${data.byStatus.Approved} approved`, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Denial Rate',   value: `${data.denialRate.toFixed(1)}%`,   sub: `${data.byStatus.Denied} denied`,   color: 'text-red-500',   bg: 'bg-red-50' },
          { label: 'Pending',       value: data.byStatus.Pending,              sub: 'awaiting decision',                 color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Open',          value: data.byStatus.Open,                 sub: 'needs documents',                   color: 'text-blue-600',  bg: 'bg-blue-50' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl border border-slate-100 shadow-sm p-5`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-400 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Approval rate trend + funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Approval & Denial Rate Trend" sub="Monthly %" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.monthlyRates}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number) => `${v}%`} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Approval Rate" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Denial Rate" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Claims Pipeline" sub="Volume by stage">
          <ResponsiveContainer width="100%" height={220}>
            <FunnelChart>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Funnel dataKey="value" data={data.funnel} isAnimationActive>
                <LabelList position="insideRight" fill="#fff" stroke="none" dataKey="name" style={{ fontSize: 11 }} />
                {data.funnel.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Diagnoses + Missing docs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Top Diagnoses" sub="Count · avg claim cost">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.topDx} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={160} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(v: number, name) => name === 'avgCost' ? fmt(v) : v}
                labelFormatter={l => l} />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="Claims" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Missing Documents" sub="Frequency of incomplete submissions">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.missingDocs.map(([name, value]) => ({ name, value }))} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={160} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Frequency" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Vet clinic table */}
      <Card title="Vet Clinic Performance" sub="Claims filed and outcomes per clinic">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                {['Clinic', 'Claims', 'Approved', 'Approval Rate', 'Total Paid'].map(h => (
                  <th key={h} className="pb-2 text-left text-slate-500 font-semibold px-2 first:pl-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.clinics.map(c => (
                <tr key={c.name} className="hover:bg-slate-50">
                  <td className="py-2 font-medium text-slate-700">{c.name}</td>
                  <td className="py-2 px-2 text-slate-600">{c.claims}</td>
                  <td className="py-2 px-2 text-slate-600">{c.approved}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-16">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${c.approvalRate}%` }} />
                      </div>
                      <span className="text-slate-600">{c.approvalRate}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-green-600 font-medium">{c.paid > 0 ? fmt(c.paid) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
