import React, { useMemo } from 'react'
import {
  ComposedChart, AreaChart, Area,
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { Claim } from '../types'

function fmt(v: number) { return `₱${v.toLocaleString()}` }
function fmtK(v: number) {
  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1000) return `₱${(v / 1000).toFixed(1)}k`
  return `₱${v}`
}
function fmtFull(v: number) {
  return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const DIAG_COLORS = ['#a5b4fc', '#86efac', '#fcd34d', '#6ee7b7', '#34d399', '#818cf8', '#f9a8d4']

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

export default function FinancialPage({ claims }: { claims: Claim[] }) {
  function renderDiagPieLabel(props: { x?: number; y?: number; name?: string; pct?: number; textAnchor?: string; dominantBaseline?: string }) {
    const x = props.x ?? 0
    const y = props.y ?? 0
    const name = props.name ?? ''
    const pct = props.pct ?? 0
    const maxName = 14
    const shortName = name.length > maxName ? `${name.slice(0, maxName - 1)}…` : name
    return (
      <text
        x={x}
        y={y}
        textAnchor={props.textAnchor as any}
        dominantBaseline={props.dominantBaseline as any}
        fill="#475569"
        fontSize={9.5}
        fontWeight={500}
      >
        <title>{`${name} ${pct.toFixed(1)}%`}</title>
        {`${shortName} ${pct.toFixed(1)}%`}
      </text>
    )
  }

  const data = useMemo(() => {
    const totalClaimsAsked  = claims.reduce((s, c) => s + (c.medicine_cost || 0) + (c.service_cost || 0), 0)
    const totalClaimsPaid   = claims.reduce((s, c) => s + (c.total_amount_paid || 0), 0)
    const deniedClaims      = claims.filter(c => c.status === 'Denied')
    const totalDeniedValue  = deniedClaims.reduce((s, c) => s + (c.medicine_cost || 0) + (c.service_cost || 0), 0)
    const lossRatio         = totalClaimsAsked ? (totalClaimsPaid / totalClaimsAsked) * 100 : 0
    const avgClaimValue     = claims.length ? totalClaimsAsked / claims.length : 0

    // Monthly filed vs paid
    const monthMap: Record<string, { label: string; Filed: number; Paid: number; Count: number }> = {}
    claims.forEach(c => {
      const m = c.created_at?.slice(0, 7) ?? 'Unknown'
      if (!monthMap[m]) monthMap[m] = {
        label: new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        Filed: 0, Paid: 0, Count: 0,
      }
      monthMap[m].Filed += (c.medicine_cost || 0) + (c.service_cost || 0)
      monthMap[m].Paid  += c.total_amount_paid || 0
      monthMap[m].Count++
    })
    const monthly = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([, v]) => v)

    // Cumulative paid
    let cum = 0
    const cumulative = monthly.map(m => { cum += m.Paid; return { label: m.label, Cumulative: cum } })

    // Leading diagnoses by claims paid
    const diagMap: Record<string, { paid: number; asked: number; count: number }> = {}
    claims.forEach(c => {
      const key = (c.diagnosis || 'Unknown').trim()
      if (!diagMap[key]) diagMap[key] = { paid: 0, asked: 0, count: 0 }
      diagMap[key].paid  += c.total_amount_paid || 0
      diagMap[key].asked += (c.medicine_cost || 0) + (c.service_cost || 0)
      diagMap[key].count++
    })
    const topDiagnoses = Object.entries(diagMap)
      .map(([name, v]) => ({
        name,
        paid:     v.paid,
        asked:    v.asked,
        count:    v.count,
        avgPaid:  v.count ? v.paid / v.count : 0,
        pctOfTotal: totalClaimsPaid ? (v.paid / totalClaimsPaid) * 100 : 0,
      }))
      .sort((a, b) => b.paid - a.paid)
      .slice(0, 12)

    // Top 5 diagnoses for pie chart
    const top5Diagnoses = topDiagnoses.slice(0, 5)
    const top5Total = top5Diagnoses.reduce((s, d) => s + d.paid, 0)
    const diagPieData = top5Diagnoses.map(d => ({
      name: d.name.length > 30 ? d.name.slice(0, 28) + '…' : d.name,
      fullName: d.name,
      value: d.paid,
      pct: top5Total ? (d.paid / top5Total) * 100 : 0,
    }))

    // Cats vs Dogs
    const speciesRows = ['Cat', 'Dog'].map(sp => {
      const bucket = claims.filter(c => c.species === sp)
      return {
        label: sp,
        countPaid: bucket.filter(c => (c.total_amount_paid || 0) > 0).length,
        sumAsked:  bucket.reduce((s, c) => s + (c.medicine_cost || 0) + (c.service_cost || 0), 0),
        sumPaid:   bucket.reduce((s, c) => s + (c.total_amount_paid || 0), 0),
      }
    })
    const catsVsDogs = {
      rows: speciesRows,
      grandCount: speciesRows.reduce((s, r) => s + r.countPaid, 0),
      grandAsked: speciesRows.reduce((s, r) => s + r.sumAsked, 0),
      grandPaid:  speciesRows.reduce((s, r) => s + r.sumPaid, 0),
    }

    return {
      totalClaimsAsked, totalClaimsPaid,
      deniedCount: deniedClaims.length, totalDeniedValue,
      lossRatio, avgClaimValue,
      monthly, cumulative, topDiagnoses,
      diagPieData, top5Diagnoses,
      catsVsDogs,
    }
  }, [claims])

  return (
    <div className="p-6 space-y-6">

      {/* Row 1 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPI
          label="Total Claims Paid"
          value={fmtK(data.totalClaimsPaid)}
          sub="approved payouts to date"
          color="text-green-600"
        />
        <KPI
          label="Total Claims Asked"
          value={fmtK(data.totalClaimsAsked)}
          sub="medicine + service costs filed"
          color="text-slate-800"
        />
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Denied Claims</p>
          <p className="text-3xl font-bold text-red-500 leading-tight">{data.deniedCount}</p>
          <p className="text-xs text-slate-400 mt-1">{fmtK(data.totalDeniedValue)} in denied claim value</p>
        </div>
      </div>

      {/* Row 2 KPIs — retained */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Loss Ratio with bar */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div className="flex-shrink-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Loss Ratio</p>
            <p className="text-3xl font-bold text-slate-800">{data.lossRatio.toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-1">paid ÷ total asked</p>
          </div>
          <div className="flex-1 min-w-0">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${data.lossRatio < 50 ? 'bg-green-500' : data.lossRatio < 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(data.lossRatio, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {data.lossRatio < 50 ? 'Healthy' : data.lossRatio < 75 ? 'Moderate' : 'High exposure'}
            </p>
          </div>
        </div>
        <KPI
          label="Avg Claim Value"
          value={fmtK(data.avgClaimValue)}
          sub="per claim filed"
          color="text-violet-600"
        />
        <KPI
          label="Total Claims Filed"
          value={String(claims.length)}
          sub={`${fmtK(data.totalClaimsAsked)} total exposure`}
          color="text-slate-700"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Monthly Claims Filed vs Paid" sub="Claim value filed vs actual payouts">
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number) => fmt(v)} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Filed" fill="#e0e7ff" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Paid"  fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="Count" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} yAxisId={0} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Cumulative Spend (YTD)" sub="Running total of payouts">
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={data.cumulative}>
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number) => fmt(v)} />
              <Area type="monotone" dataKey="Cumulative" stroke="#6366f1" strokeWidth={2.5} fill="url(#cumGrad)" dot={{ r: 3, fill: '#6366f1' }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Leading diagnoses */}
      <Card
        title="Leading Diseases / Illnesses by Claims Paid"
        sub="Diagnoses ranked by total amount paid out — shows which conditions cost the most"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2.5 text-left text-slate-500 font-semibold w-6">#</th>
                <th className="pb-2.5 text-left text-slate-500 font-semibold">Diagnosis</th>
                <th className="pb-2.5 text-right text-slate-500 font-semibold whitespace-nowrap">Claims</th>
                <th className="pb-2.5 text-right text-slate-500 font-semibold whitespace-nowrap">Total Paid</th>
                <th className="pb-2.5 text-right text-slate-500 font-semibold whitespace-nowrap">Total Asked</th>
                <th className="pb-2.5 text-right text-slate-500 font-semibold whitespace-nowrap">Avg Paid</th>
                <th className="pb-2.5 text-left text-slate-500 font-semibold pl-4 w-40">% of Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.topDiagnoses.map((d, i) => (
                <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 text-slate-400 font-medium">{i + 1}</td>
                  <td className="py-2.5 font-medium text-slate-700 max-w-[220px]">
                    <span className="truncate block" title={d.name}>{d.name || '—'}</span>
                  </td>
                  <td className="py-2.5 text-right text-slate-600 tabular-nums">{d.count}</td>
                  <td className="py-2.5 text-right font-semibold text-green-700 tabular-nums">{d.paid > 0 ? fmtK(d.paid) : <span className="text-slate-300">—</span>}</td>
                  <td className="py-2.5 text-right text-slate-600 tabular-nums">{fmtK(d.asked)}</td>
                  <td className="py-2.5 text-right text-slate-500 tabular-nums">{d.avgPaid > 0 ? fmtK(d.avgPaid) : <span className="text-slate-300">—</span>}</td>
                  <td className="py-2.5 pl-4">
                    {d.paid > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${Math.min(d.pctOfTotal, 100)}%` }}
                          />
                        </div>
                        <span className="text-slate-500 tabular-nums w-10 text-right">{d.pctOfTotal.toFixed(1)}%</span>
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.topDiagnoses.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">No diagnosis data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Diagnosis Category */}
      <Card title="Diagnosis Category" sub="Top 5 pet health diagnoses by total claims paid">
        <div className="flex flex-col lg:flex-row gap-8 items-center">

          {/* Numbered list */}
          <div className="flex-1 min-w-0 space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              These are the Top 5 Pet Health Diagnoses by total claims paid.
            </p>
            {data.top5Diagnoses.map((d, i) => (
              <div key={d.name} className="flex items-start gap-3">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: DIAG_COLORS[i] }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 leading-snug" title={d.name}>{d.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="font-medium text-green-700">{fmtFull(d.paid)}</span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    {d.count} claim{d.count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}
            {data.top5Diagnoses.length === 0 && (
              <p className="text-sm text-slate-400">No paid claims data available.</p>
            )}
          </div>

          {/* Pie chart */}
          {data.diagPieData.length > 0 && (
            <div className="w-full lg:w-96 flex-shrink-0">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.diagPieData}
                    cx="50%" cy="50%"
                    outerRadius={110}
                    dataKey="value"
                    paddingAngle={2}
                    label={renderDiagPieLabel}
                    labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                  >
                    {data.diagPieData.map((_, i) => (
                      <Cell key={i} fill={DIAG_COLORS[i % DIAG_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    formatter={(v: number, _n: string, props: { payload?: { fullName?: string } }) =>
                      [fmtFull(v), props?.payload?.fullName ?? '']}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      {/* Cats VS Dogs */}
      <Card title="Cats VS Dogs" sub="Claims comparison by species">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-bold text-slate-700">Row Labels</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">Count of Claims Paid</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">Sum of Total Claim Asked</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">Sum of Claims Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.catsVsDogs.rows.map((row, i) => (
                <tr key={row.label} className={i % 2 === 1 ? 'bg-amber-50/50' : 'bg-white'}>
                  <td className="px-4 py-3 font-medium text-slate-700">{row.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.countPaid.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtFull(row.sumAsked)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">{fmtFull(row.sumPaid)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td className="px-4 py-3 font-bold text-slate-800">Grand Total</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-800">
                  {data.catsVsDogs.grandCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-800">
                  {fmtFull(data.catsVsDogs.grandAsked)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-800">
                  {fmtFull(data.catsVsDogs.grandPaid)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

    </div>
  )
}
