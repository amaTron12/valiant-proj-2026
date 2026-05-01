import React, { useMemo, useState, useCallback } from 'react'
import { Trash2, Search, RotateCcw, CheckCircle2 } from 'lucide-react'
import { clearAuditEvents, getAuditEvents, addAuditEvent, type AuditEvent } from '../audit/audit'
import { useAuth } from '../auth/AuthContext'

function fmtTs(ts: string) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

const ACTION_BADGE: Record<string, string> = {
  create:            'bg-green-100 text-green-700',
  update:            'bg-blue-100 text-blue-700',
  delete:            'bg-red-100 text-red-700',
  restore:           'bg-emerald-100 text-emerald-700',
  import:            'bg-violet-100 text-violet-700',
  export:            'bg-slate-100 text-slate-600',
  add_images:        'bg-sky-100 text-sky-700',
  delete_images:     'bg-orange-100 text-orange-700',
  download_template: 'bg-slate-100 text-slate-600',
}

export default function AuditTrailPage() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [action, setAction] = useState<string>('')
  const [entity, setEntity] = useState<string>('')
  const [nonce, setNonce] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string>('')
  const [successMsg, setSuccessMsg] = useState<string>('')

  const refresh = useCallback(() => setNonce(n => n + 1), [])

  // Build a Set of delete-event IDs that have already been restored.
  // A delete event is considered restored if a 'restore' event for the same
  // entityId exists with a timestamp AFTER the delete event's timestamp.
  const restoredDeleteIds = useMemo(() => {
    const all = getAuditEvents()
    // Map: entityId → latest restore timestamp for that entity
    const latestRestore = new Map<string, string>()
    for (const e of all) {
      if (e.action === 'restore' && e.entityId) {
        const prev = latestRestore.get(e.entityId)
        if (!prev || e.ts > prev) latestRestore.set(e.entityId, e.ts)
      }
    }
    const result = new Set<string>()
    for (const e of all) {
      if (e.action === 'delete' && e.entityId) {
        const restoreTs = latestRestore.get(e.entityId)
        if (restoreTs && restoreTs > e.ts) result.add(e.id)
      }
    }
    return result
  }, [nonce])

  const events = useMemo(() => {
    const list = getAuditEvents()
    const query = q.trim().toLowerCase()
    return list.filter(e => {
      if (action && e.action !== action) return false
      if (entity && e.entity !== entity) return false
      if (!query) return true
      const hay = [
        e.userName,
        e.userId,
        e.userRole,
        e.action,
        e.entity,
        e.entityId ?? '',
        JSON.stringify(e.details ?? {}),
      ].join(' ').toLowerCase()
      return hay.includes(query)
    })
  }, [q, action, entity, nonce])

  const actions = useMemo(() => Array.from(new Set(getAuditEvents().map(e => e.action))).sort(), [nonce])
  const entities = useMemo(() => Array.from(new Set(getAuditEvents().map(e => e.entity))).sort(), [nonce])

  function onClear() {
    clearAuditEvents()
    setSuccessMsg('')
    setErr('')
    refresh()
  }

  async function onRevert(e: AuditEvent) {
    if (!e.entityId) return
    setErr('')
    setSuccessMsg('')
    setBusyId(e.id)
    try {
      if      (e.entity === 'claim')       await window.api.restoreClaim(e.entityId)
      else if (e.entity === 'claim_image') await window.api.restoreClaimImage(e.entityId)
      else if (e.entity === 'client')      await window.api.restoreClient(e.entityId)
      else if (e.entity === 'pet')         await window.api.restorePet(e.entityId)
      else if (e.entity === 'diagnosis_type') await window.api.restoreDiagnosisType(e.entityId)

      // Record the restore action in the audit trail
      if (user) {
        addAuditEvent(user, {
          action: 'restore',
          entity: e.entity,
          entityId: e.entityId,
          details: { originalDeleteEventId: e.id, ...e.details },
        })
      }

      const label = e.entity === 'claim' ? `Claim ${e.entityId}` :
                    e.entity === 'client' ? `Client ${e.entityId}` :
                    e.entity === 'pet'    ? `Pet ${e.entityId}`    :
                    `Image ${e.entityId}`
      setSuccessMsg(`✓ ${label} restored successfully`)

      refresh()
      document.dispatchEvent(new Event('refresh-claims'))
      if (e.entity === 'client' || e.entity === 'pet') {
        document.dispatchEvent(new Event('refresh-profiles'))
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-800">Audit Trail</h2>
        <p className="text-sm text-slate-500 mt-1">Tracks create / update / delete / restore / import / export actions.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search user, action, ID…"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={action}
          onChange={e => setAction(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <select
          value={entity}
          onChange={e => setEntity(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All entities</option>
          {entities.map(en => <option key={en} value={en}>{en}</option>)}
        </select>

        <button
          onClick={onClear}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
          title="Clear audit trail (local)"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      {successMsg && (
        <div className="px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {successMsg}
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="ml-auto text-emerald-500 hover:text-emerald-700 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {err && (
        <div className="px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm">
          ✗ {err}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                {(['Time', 'User', 'Role', 'Action', 'Entity', 'Entity ID', 'Details', ''] as const).map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">No audit events</td>
                </tr>
              ) : events.map((e: AuditEvent) => {
                const isReverted = restoredDeleteIds.has(e.id)
                const isBusy = busyId === e.id
                const canRevert =
                  e.action === 'delete' &&
                  (e.entity === 'claim' || e.entity === 'claim_image' || e.entity === 'client' || e.entity === 'pet' || e.entity === 'diagnosis_type') &&
                  !!e.entityId

                return (
                  <tr key={e.id} className={`transition-colors ${isReverted ? 'bg-emerald-50/60' : 'hover:bg-blue-50/40'}`}>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtTs(e.ts)}</td>
                    <td className="px-3 py-2 text-slate-700 font-medium whitespace-nowrap">{e.userName}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{e.userRole}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ACTION_BADGE[e.action] ?? 'bg-slate-100 text-slate-600'}`}>
                        {e.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{e.entity}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">{e.entityId ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500 max-w-[360px] truncate" title={JSON.stringify(e.details ?? {})}>
                      {e.details ? JSON.stringify(e.details) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {canRevert && !isReverted && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onRevert(e)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                          title="Restore this deleted record"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                          {isBusy ? 'Restoring…' : 'Revert'}
                        </button>
                      )}
                      {canRevert && isReverted && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-emerald-600 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Restored
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
