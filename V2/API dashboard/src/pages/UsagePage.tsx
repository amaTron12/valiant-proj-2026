import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Zap, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

const PLAN_LIMIT = 50000
const BILLING_RESET = '2026-05-01'

const TOKEN_USAGE = [
  { name: 'Production Client',   type: 'Public',  used: 18420, limit: 20000 },
  { name: 'Internal Integration', type: 'Secret', used: 11300, limit: 25000 },
  { name: 'Staging Test Key',    type: 'Secret',  used: 850,   limit: 5000  },
]

const DAILY_USAGE = [
  { day: 'Apr 14', requests: 980 },
  { day: 'Apr 15', requests: 1240 },
  { day: 'Apr 16', requests: 1100 },
  { day: 'Apr 17', requests: 870 },
  { day: 'Apr 18', requests: 1580 },
  { day: 'Apr 19', requests: 1247 },
  { day: 'Apr 20', requests: 553 },
]

const ENDPOINT_USAGE = [
  { path: 'GET /v1/claims',           requests: 14200, pct: 47 },
  { path: 'GET /v1/claims/{id}',      requests: 8100,  pct: 27 },
  { path: 'POST /v1/claims',          requests: 3900,  pct: 13 },
  { path: 'GET /v1/reports/summary',  requests: 2200,  pct: 7  },
  { path: 'PUT /v1/claims/{id}',      requests: 1170,  pct: 4  },
  { path: 'GET /v1/reports/financial',requests: 570,   pct: 2  },
]

const totalUsed = TOKEN_USAGE.reduce((s, t) => s + t.used, 0)
const usagePct = Math.round((totalUsed / PLAN_LIMIT) * 100)

function ProgressBar({ used, limit, color = 'bg-blue-500' }: { used: number; limit: number; color?: string }) {
  const pct = Math.min(Math.round((used / limit) * 100), 100)
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : color
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-500">{used.toLocaleString()} used</span>
        <span className="text-slate-400">{limit.toLocaleString()} limit</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-xs mt-1 font-medium ${pct >= 90 ? 'text-red-500' : pct >= 70 ? 'text-yellow-600' : 'text-slate-400'}`}>
        {pct}% used
      </p>
    </div>
  )
}

export default function UsagePage() {
  const statusIcon = usagePct >= 90
    ? <AlertTriangle className="w-4 h-4 text-red-500" />
    : <CheckCircle className="w-4 h-4 text-green-500" />

  return (
    <div className="p-6 space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { icon: <Zap className="w-4 h-4 text-blue-500" />,                                                                    label: 'Total Requests',    value: totalUsed.toLocaleString(),  sub: `of ${PLAN_LIMIT.toLocaleString()} plan limit` },
          { icon: usagePct >= 90 ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <CheckCircle className="w-4 h-4 text-green-500" />, label: 'Plan Usage',        value: `${usagePct}%`,              sub: usagePct >= 90 ? 'Near limit — upgrade soon' : 'Within plan limits' },
          { icon: <Clock className="w-4 h-4 text-purple-500" />,                                                                 label: 'Billing Resets',    value: 'May 1',                     sub: `${Math.ceil((new Date(BILLING_RESET).getTime() - Date.now()) / 86400000)} days remaining` },
          { icon: <Zap className="w-4 h-4 text-green-500" />,                                                                    label: "Today's Requests",  value: '553',                       sub: 'as of Apr 20, 2026' },
        ].map(({ icon, label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              {icon}
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className={`text-xs mt-0.5 ${usagePct >= 90 && label === 'Plan Usage' ? 'text-red-500 font-medium' : 'text-slate-400'}`}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Overall usage bar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Plan Usage</h3>
            <p className="text-xs text-slate-400 mt-0.5">Resets on {BILLING_RESET}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            usagePct >= 90 ? 'bg-red-100 text-red-600' :
            usagePct >= 70 ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-600'
          }`}>
            {usagePct >= 90 ? 'Critical' : usagePct >= 70 ? 'Warning' : 'Healthy'}
          </span>
        </div>
        <ProgressBar used={totalUsed} limit={PLAN_LIMIT} color="bg-blue-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Daily requests chart */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Daily Requests (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={DAILY_USAGE} barSize={28}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                cursor={{ fill: '#f1f5f9' }}
              />
              <Bar dataKey="requests" radius={[4, 4, 0, 0]}>
                {DAILY_USAGE.map((_, i) => (
                  <Cell key={i} fill={i === DAILY_USAGE.length - 1 ? '#93c5fd' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Per-token usage */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Usage by Token</h3>
          <div className="space-y-5">
            {TOKEN_USAGE.map(t => (
              <div key={t.name}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                    t.type === 'Public' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {t.type === 'Public' ? 'pk_' : 'sk_'}
                  </span>
                  <span className="text-sm font-medium text-slate-700">{t.name}</span>
                </div>
                <ProgressBar used={t.used} limit={t.limit} />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Endpoint breakdown */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Requests by Endpoint</h3>
          <p className="text-xs text-slate-400 mt-0.5">Cumulative across all tokens this billing period</p>
        </div>
        <div className="divide-y divide-slate-50">
          {ENDPOINT_USAGE.map(ep => (
            <div key={ep.path} className="px-5 py-3 flex items-center gap-4">
              <span className="font-mono text-xs text-slate-600 w-56 shrink-0">{ep.path}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${ep.pct}%` }} />
              </div>
              <span className="text-xs text-slate-500 w-20 text-right shrink-0">{ep.requests.toLocaleString()} req</span>
              <span className="text-xs font-semibold text-slate-400 w-8 text-right shrink-0">{ep.pct}%</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
