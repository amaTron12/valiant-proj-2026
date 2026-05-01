import type { AuthUser } from '../auth/auth'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'import'
  | 'export'
  | 'add_images'
  | 'delete_images'
  | 'download_template'

export type AuditEntity =
  | 'claim'
  | 'claim_image'
  | 'client'
  | 'pet'
  | 'masterlist'
  | 'template'
  | 'diagnosis_type'
  | 'premium_plan'

export type AuditEvent = {
  id: string
  ts: string
  userId: string
  userName: string
  userRole: AuthUser['role']
  action: AuditAction
  entity: AuditEntity
  entityId?: string
  details?: Record<string, unknown>
}

const KEY = 'pc_audit_v1'
const MAX_EVENTS = 2000

function read(): AuditEvent[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const v = JSON.parse(raw) as AuditEvent[]
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function write(v: AuditEvent[]) {
  localStorage.setItem(KEY, JSON.stringify(v))
}

function uid() {
  return `AUD-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`
}

export function addAuditEvent(user: AuthUser, e: Omit<AuditEvent, 'id' | 'ts' | 'userId' | 'userName' | 'userRole'>) {
  const ev: AuditEvent = {
    id: uid(),
    ts: new Date().toISOString(),
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    ...e,
  }
  const cur = read()
  cur.unshift(ev)
  if (cur.length > MAX_EVENTS) cur.length = MAX_EVENTS
  write(cur)
}

export function getAuditEvents(): AuditEvent[] {
  return read()
}

export function clearAuditEvents() {
  localStorage.removeItem(KEY)
}

