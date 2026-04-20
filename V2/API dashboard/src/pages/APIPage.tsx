import React, { useState } from 'react'
import {
  Key, Plus, Copy, Trash2, Eye, EyeOff, RefreshCw, Webhook,
  CheckCircle, Globe, Lock, Zap, Code2, X, Edit2, ToggleLeft, ToggleRight
} from 'lucide-react'
import { SidebarFilters } from '../components/FilterSidebar'

// ── Mock data ─────────────────────────────────────────────────────────────────

interface APIToken {
  id: string
  name: string
  type: 'Public' | 'Secret'
  key: string
  created: string
  lastUsed: string
  status: 'Active' | 'Revoked'
  permissions: string[]
}

const INITIAL_TOKENS: APIToken[] = [
  {
    id: '1',
    name: 'Production Client',
    type: 'Public',
    key: 'pk_live_4f8a2b9c1d3e7f0a2b4c6d8e9f1a3b5c',
    created: '2026-01-15',
    lastUsed: '2026-04-19',
    status: 'Active',
    permissions: ['claims:read', 'reports:read'],
  },
  {
    id: '2',
    name: 'Internal Integration',
    type: 'Secret',
    key: 'sk_live_••••••••••••••••••••••••••••••••',
    created: '2026-02-20',
    lastUsed: '2026-04-18',
    status: 'Active',
    permissions: ['claims:read', 'claims:write', 'claims:delete', 'reports:read'],
  },
  {
    id: '3',
    name: 'Staging Test Key',
    type: 'Secret',
    key: 'sk_test_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
    created: '2026-03-01',
    lastUsed: '2026-03-28',
    status: 'Revoked',
    permissions: ['claims:read'],
  },
]

const ENDPOINTS = [
  { method: 'GET',    path: '/v1/claims',          desc: 'List all claims with optional filters',         auth: 'Public' },
  { method: 'POST',   path: '/v1/claims',          desc: 'Create a new claim record',                     auth: 'Secret' },
  { method: 'GET',    path: '/v1/claims/{id}',     desc: 'Retrieve a specific claim by ID',               auth: 'Public' },
  { method: 'PUT',    path: '/v1/claims/{id}',     desc: 'Update an existing claim',                      auth: 'Secret' },
  { method: 'DELETE', path: '/v1/claims/{id}',     desc: 'Delete a claim record',                         auth: 'Secret' },
  { method: 'GET',    path: '/v1/reports/summary', desc: 'Get aggregate claim statistics',                auth: 'Public' },
  { method: 'GET',    path: '/v1/reports/financial','desc': 'Financial breakdown and loss ratio data',    auth: 'Secret' },
  { method: 'POST',   path: '/v1/webhooks',        desc: 'Register a new webhook endpoint',               auth: 'Secret' },
]

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-blue-100 text-blue-700',
  POST:   'bg-green-100 text-green-700',
  PUT:    'bg-yellow-100 text-yellow-700',
  DELETE: 'bg-red-100 text-red-700',
}

const ALL_PERMISSIONS = [
  'claims:read', 'claims:write', 'claims:delete',
  'reports:read', 'reports:write', 'webhooks:manage',
]

const BASE_URL = 'https://api.your-domain.com'

// ── Token modal ───────────────────────────────────────────────────────────────

function TokenModal({ token, onSave, onClose }: {
  token: APIToken | null
  onSave: (t: Omit<APIToken, 'id' | 'created' | 'lastUsed' | 'status' | 'key'>) => void
  onClose: () => void
}) {
  const [name, setName] = useState(token?.name ?? '')
  const [type, setType] = useState<'Public' | 'Secret'>(token?.type ?? 'Public')
  const [perms, setPerms] = useState<string[]>(token?.permissions ?? ['claims:read'])

  function togglePerm(p: string) {
    setPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-800">{token ? 'Edit API Token' : 'Create New Token'}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Token Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Production Client"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Token Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Public', 'Secret'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-xs font-medium transition-all ${
                    type === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {t === 'Public' ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {t} Key
                  <span className="ml-auto text-[10px] text-slate-400">{t === 'Public' ? 'pk_' : 'sk_'}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {type === 'Public' ? 'Safe to expose in client-side code. Read-only access.' : 'Keep secret. Grants full write access.'}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Permissions</label>
            <div className="space-y-1.5">
              {ALL_PERMISSIONS.map(p => (
                <label key={p} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={perms.includes(p)}
                    onChange={() => togglePerm(p)}
                    className="w-3.5 h-3.5 accent-blue-500"
                  />
                  <span className="text-xs text-slate-600 group-hover:text-slate-800 font-mono">{p}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            onClick={() => { if (name.trim()) { onSave({ name: name.trim(), type, permissions: perms }); onClose() } }}
            disabled={!name.trim()}
            className="px-4 py-2 text-xs rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors"
          >
            {token ? 'Save Changes' : 'Generate Token'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function APIPage({ filters }: { filters?: SidebarFilters }) {
  const [tokens, setTokens] = useState<APIToken[]>(INITIAL_TOKENS)
  const [modalToken, setModalToken] = useState<APIToken | null | undefined>(undefined)
  const [revealId, setRevealId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSaved, setWebhookSaved] = useState(false)
  const [activeWebhookEvents, setActiveWebhookEvents] = useState<string[]>(['claim.created', 'claim.approved'])

  const WEBHOOK_EVENTS = ['claim.created', 'claim.updated', 'claim.approved', 'claim.denied', 'claim.deleted']

  const visibleTokens = tokens.filter(t => {
    if (filters?.tokenStatuses.length && !filters.tokenStatuses.includes(t.status)) return false
    if (filters?.tokenTypes.length) {
      const typeLabel = t.type === 'Public' ? 'Public Key' : 'Secret Key'
      if (!filters.tokenTypes.includes(typeLabel)) return false
    }
    return true
  })

  const visibleEndpoints = ENDPOINTS.filter(ep => {
    if (filters?.methods.length && !filters.methods.includes(ep.method)) return false
    if (filters?.authTypes.length && !filters.authTypes.includes(ep.auth)) return false
    return true
  })

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleSaveToken(data: Omit<APIToken, 'id' | 'created' | 'lastUsed' | 'status' | 'key'>) {
    if (modalToken) {
      setTokens(prev => prev.map(t => t.id === modalToken.id ? { ...t, ...data } : t))
    } else {
      const prefix = data.type === 'Public' ? 'pk_live_' : 'sk_live_'
      const key = prefix + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
      setTokens(prev => [...prev, {
        id: Date.now().toString(),
        key,
        created: new Date().toISOString().split('T')[0],
        lastUsed: '—',
        status: 'Active',
        ...data,
      }])
    }
  }

  function revokeToken(id: string) {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'Active' ? 'Revoked' : 'Active' } : t))
  }

  function deleteToken(id: string) {
    setTokens(prev => prev.filter(t => t.id !== id))
  }

  function maskKey(key: string) {
    return key.slice(0, 12) + '•'.repeat(20) + key.slice(-4)
  }

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { icon: Key,          color: 'text-blue-500',   label: 'API Keys',           value: visibleTokens.filter(t => t.status === 'Active').length,  sub: `${visibleTokens.length} shown` },
          { icon: Zap,          color: 'text-green-500',  label: 'Requests Today',     value: '1,247',                                            sub: 'across all endpoints' },
          { icon: CheckCircle,  color: 'text-purple-500', label: 'Avg Response',       value: '142ms',                                            sub: 'p95 last 24 hours' },
          { icon: Globe,        color: 'text-orange-500', label: 'API Version',        value: 'v1',                                               sub: 'stable · REST / JSON' },
        ].map(({ icon: Icon, color, label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Connection details */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Connection Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Base URL',         value: BASE_URL },
            { label: 'Authentication',   value: 'Bearer Token (Authorization header)' },
            { label: 'Response Format',  value: 'JSON · UTF-8 · gzip supported' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-lg px-4 py-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-xs font-mono text-slate-700 break-all">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-slate-900 rounded-lg px-4 py-3 flex items-start gap-3">
          <Code2 className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[11px] text-slate-500 mb-1">Example request</p>
            <p className="text-xs font-mono text-green-400">curl {BASE_URL}/v1/claims \</p>
            <p className="text-xs font-mono text-slate-400 ml-4">-H <span className="text-yellow-300">"Authorization: Bearer sk_live_••••••••"</span></p>
          </div>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">API Tokens</h3>
            <p className="text-xs text-slate-400 mt-0.5">Manage public and secret keys for system integrations</p>
          </div>
          <button
            onClick={() => setModalToken(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Token
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Name', 'Type', 'Key', 'Permissions', 'Created', 'Last Used', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleTokens.map(token => (
                <tr key={token.id} className={`hover:bg-slate-50/60 transition-colors ${token.status === 'Revoked' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{token.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                      token.type === 'Public' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {token.type === 'Public' ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                      {token.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500 text-[11px]">
                        {revealId === token.id ? token.key : maskKey(token.key)}
                      </span>
                      <button
                        onClick={() => setRevealId(revealId === token.id ? null : token.id)}
                        className="text-slate-300 hover:text-slate-500 transition-colors"
                        title={revealId === token.id ? 'Hide' : 'Reveal'}
                      >
                        {revealId === token.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(token.key, token.id)}
                        className="text-slate-300 hover:text-blue-500 transition-colors"
                        title="Copy"
                      >
                        {copied === token.id ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {token.permissions.map(p => (
                        <span key={p} className="bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 font-mono text-[10px]">{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{token.created}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{token.lastUsed}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      token.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                    }`}>
                      {token.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setModalToken(token)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => revokeToken(token.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors"
                        title={token.status === 'Active' ? 'Revoke' : 'Re-activate'}
                      >
                        {token.status === 'Active'
                          ? <ToggleRight className="w-3.5 h-3.5 text-green-500" />
                          : <ToggleLeft className="w-3.5 h-3.5 text-slate-300" />}
                      </button>
                      <button
                        onClick={() => deleteToken(token.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
          Secret keys are never shown in full after creation. Store them securely.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Endpoints */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Available Endpoints</h3>
            <p className="text-xs text-slate-400 mt-0.5">REST API reference for system integrations</p>
          </div>
          <div className="divide-y divide-slate-50">
            {visibleEndpoints.map((ep, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] font-mono shrink-0 mt-0.5 ${METHOD_COLORS[ep.method]}`}>
                  {ep.method}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-slate-700">{ep.path}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{ep.desc}</p>
                </div>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                  ep.auth === 'Public' ? 'bg-blue-50 text-blue-500' : 'bg-purple-50 text-purple-500'
                }`}>
                  {ep.auth === 'Public' ? <Globe className="w-2.5 h-2.5 inline mr-0.5" /> : <Lock className="w-2.5 h-2.5 inline mr-0.5" />}
                  {ep.auth}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Webhooks */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-slate-700">Webhooks</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Receive real-time events when claims are updated</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Endpoint URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => { setWebhookUrl(e.target.value); setWebhookSaved(false) }}
                  placeholder="https://your-system.com/webhook"
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <button
                  onClick={() => { if (webhookUrl) setWebhookSaved(true) }}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  {webhookSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Events to Send</label>
              <div className="space-y-2">
                {WEBHOOK_EVENTS.map(ev => (
                  <label key={ev} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={activeWebhookEvents.includes(ev)}
                      onChange={() => setActiveWebhookEvents(prev =>
                        prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]
                      )}
                      className="w-3.5 h-3.5 accent-blue-500"
                    />
                    <span className="text-xs font-mono text-slate-600 group-hover:text-slate-800">{ev}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Signing Secret</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-slate-500">whsec_••••••••••••••••••••••••••••••••</span>
                <button className="text-slate-300 hover:text-blue-500 transition-colors" title="Copy">
                  <Copy className="w-3 h-3" />
                </button>
                <button className="text-slate-300 hover:text-amber-500 transition-colors" title="Rotate secret">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Use this to verify webhook payloads are from us.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Token modal */}
      {modalToken !== undefined && (
        <TokenModal
          token={modalToken}
          onSave={handleSaveToken}
          onClose={() => setModalToken(undefined)}
        />
      )}
    </div>
  )
}
