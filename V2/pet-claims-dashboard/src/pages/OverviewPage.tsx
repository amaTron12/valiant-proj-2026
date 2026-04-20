import React, { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Claim } from '../types'

const STATUS_COLORS: Record<string, string> = {
  Open: '#3b82f6', Pending: '#f59e0b', Approved: '#22c55e', Denied: '#ef4444'
}

function fmt(v: number) { return `₱${v.toLocaleString()}` }
function fmtK(v: number) { return v >= 1000 ? `₱${(v / 1000).toFixed(1)}k` : `₱${v}` }

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  trend?: number
  accent: string
  bg: string
}

function StatCard({ label, value, sub, trend, accent, bg }: StatCardProps) {
  const TrendIcon = trend === undefined ? Minus : trend > 0 ? TrendingUp : TrendingDown
  const trendColor = trend === undefined ? 'text-slate-400' : trend > 0 ? 'text-green-500' : 'text-red-400'
  return (
    <div className={`${bg} rounded-xl p-5 border border-slate-100 shadow-sm`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent} leading-tight`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          {Math.abs(trend).toFixed(1)}% vs last month
        </div>
      )}
    </div>
  )
}

function ChartCard({ title, sub, children, className = '' }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
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

export default function OverviewPage({ claims }: { claims: Claim[] }) {
  const metrics = useMemo(() => {
    const total = claims.length
    const approved = claims.filter(c => c.status === 'Approved').length
    const pending = claims.filter(c => c.status === 'Pending').length
    const open = claims.filter(c => c.status === 'Open').length
    const denied = claims.filter(c => c.status === 'Denied').length
    const totalPaid = claims.reduce((s, c) => s + (c.total_amount_paid || 0), 0)
    const approvalRate = total ? (approved / total) * 100 : 0
    const outstanding = claims
      .filter(c => c.status === 'Open' || c.status === 'Pending')
      .reduce((s, c) => s + (c.medicine_cost || 0) + (c.service_cost || 0), 0)

    // Monthly breakdown
    const monthMap: Record<string, { count: number; paid: number; approved: number }> = {}
    claims.forEach(c => {
      const m = c.created_at?.slice(0, 7) ?? 'Unknown'
      if (!monthMap[m]) monthMap[m] = { count: 0, paid: 0, approved: 0 }
      monthMap[m].count++
      monthMap[m].paid += c.total_amount_paid || 0
      if (c.status === 'Approved') monthMap[m].approved++
    })
    const monthly = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([k, v]) => ({
        label: new Date(k + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        Claims: v.count,
        Paid: v.paid,
        Approved: v.approved,
      }))

    // Month-over-month trend
    const thisMonth = monthly[monthly.length - 1]?.Claims ?? 0
    const lastMonth = monthly[monthly.length - 2]?.Claims ?? 0
    const trend = lastMonth ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0

    // Top diagnoses
    const dxMap: Record<string, number> = {}
    claims.forEach(c => { if (c.diagnosis) dxMap[c.diagnosis] = (dxMap[c.diagnosis] || 0) + 1 })
    const topDx = Object.entries(dxMap).sort((a, b) => b[1] - a[1]).slice(0, 6)

    // Status pie
    const statusPie = [
      { name: 'Open', value: open },
      { name: 'Pending', value: pending },
      { name: 'Approved', value: approved },
      { name: 'Denied', value: denied },
    ].filter(x => x.value > 0)

    // Recent claims
    const recent = [...claims].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6)

    return { total, approved, pending, open, denied, totalPaid, approvalRate, outstanding, monthly, trend, topDx, statusPie, recent }
  }, [claims])

  return (
    <div className="p-6 space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Claims"    value={metrics.total}              sub={`${metrics.open} open · ${metrics.pending} pending`} trend={metrics.trend} accent="text-slate-800" bg="bg-white" />
        <StatCard label="Approval Rate"   value={`${metrics.approvalRate.toFixed(1)}%`} sub={`${metrics.approved} approved of ${metrics.total}`} accent="text-green-600" bg="bg-green-50" />
        <StatCard label="Total Paid Out"  value={fmtK(metrics.totalPaid)}    sub="cumulative payouts"  accent="text-blue-600"   bg="bg-blue-50" />
        <StatCard label="Outstanding"     value={fmtK(metrics.outstanding)}  sub="open + pending exposure" accent="text-amber-600" bg="bg-amber-50" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Claims Volume & Payouts" sub="Monthly trend" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={metrics.monthly}>
              <defs>
                <linearGradient id="claimsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number, name) => name === 'Paid' ? fmt(v) : v} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Area yAxisId="l" type="monotone" dataKey="Claims" stroke="#3b82f6" strokeWidth={2} fill="url(#claimsGrad)" dot={{ r: 3, fill: '#3b82f6' }} />
              <Area yAxisId="r" type="monotone" dataKey="Paid" stroke="#22c55e" strokeWidth={2} fill="url(#paidGrad)" dot={{ r: 3, fill: '#22c55e' }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Claims by Status" sub="Current distribution">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={metrics.statusPie} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {metrics.statusPie.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.name]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Top Diagnoses" sub="By claim count" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metrics.topDx.map(([name, value]) => ({ name, value }))} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={160} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Recent Activity" sub="Latest claims">
          <div className="space-y-2">
            {metrics.recent.map(c => (
              <div key={c.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{c.client_name}</p>
                  <p className="text-xs text-slate-400">{c.pet_name} · {c.diagnosis?.slice(0, 24)}</p>
                </div>
                <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border ${
                  c.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' :
                  c.status === 'Pending'  ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                  c.status === 'Open'     ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            'bg-red-50 text-red-700 border-red-200'
                }`}>{c.status}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
