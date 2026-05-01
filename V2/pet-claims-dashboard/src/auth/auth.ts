export type AuthUser = {
  id: string
  name: string
  email?: string
  role: 'user' | 'guest'
  createdAt: string
  updatedAt: string
}

type StoredUser = AuthUser & { password: string }

const USERS_KEY = 'pc_users_v1'
const SESSION_KEY = 'pc_session_v1'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

function nowIso() {
  return new Date().toISOString()
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`
}

export function getSession(): AuthUser | null {
  return readJson<AuthUser | null>(SESSION_KEY, null)
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export function loginAsGuest(): AuthUser {
  const user: AuthUser = {
    id: uid('GST'),
    name: 'Guest',
    role: 'guest',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  writeJson(SESSION_KEY, user)
  return user
}

export function signup(params: { name: string; email: string; password: string }): AuthUser {
  const email = params.email.trim().toLowerCase()
  const users = readJson<StoredUser[]>(USERS_KEY, [])
  if (users.some(u => u.email?.toLowerCase() === email)) {
    throw new Error('Email already exists')
  }
  const user: StoredUser = {
    id: uid('USR'),
    name: params.name.trim() || 'User',
    email,
    password: params.password,
    role: 'user',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  users.unshift(user)
  writeJson(USERS_KEY, users)

  const session: AuthUser = stripPassword(user)
  writeJson(SESSION_KEY, session)
  return session
}

export function login(params: { email: string; password: string }): AuthUser {
  const email = params.email.trim().toLowerCase()
  const users = readJson<StoredUser[]>(USERS_KEY, [])
  const user = users.find(u => u.email?.toLowerCase() === email)
  if (!user || user.password !== params.password) {
    throw new Error('Invalid email or password')
  }
  const session: AuthUser = stripPassword(user)
  writeJson(SESSION_KEY, session)
  return session
}

export function updateProfile(patch: Partial<Pick<AuthUser, 'name' | 'email'>>): AuthUser {
  const session = getSession()
  if (!session) throw new Error('Not logged in')

  const next: AuthUser = {
    ...session,
    name: (patch.name ?? session.name).trim() || session.name,
    email: patch.email !== undefined ? patch.email.trim().toLowerCase() : session.email,
    updatedAt: nowIso(),
  }

  // If it's a real user account, update stored users too
  if (session.role === 'user') {
    const users = readJson<StoredUser[]>(USERS_KEY, [])
    const idx = users.findIndex(u => u.id === session.id)
    if (idx !== -1) {
      // Basic email uniqueness check
      if (next.email && users.some(u => u.id !== session.id && u.email?.toLowerCase() === next.email)) {
        throw new Error('Email already exists')
      }
      users[idx] = { ...users[idx], name: next.name, email: next.email, updatedAt: next.updatedAt }
      writeJson(USERS_KEY, users)
    }
  }

  writeJson(SESSION_KEY, next)
  return next
}

function stripPassword(u: StoredUser): AuthUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = u
  return rest
}

