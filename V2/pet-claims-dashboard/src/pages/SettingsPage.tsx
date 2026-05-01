import React, { useEffect, useState } from 'react'
import { Save, LogOut, User, Link2, ClipboardList } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import ConnectionsPage from './ConnectionsPage'
import AuditTrailPage from './AuditTrailPage'

export default function SettingsPage({ initialTab }: { initialTab?: 'profile' | 'connections' | 'audit' }) {
  const { user, updateProfile, logout } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<'profile' | 'connections' | 'audit'>(initialTab ?? 'profile')

  if (!user) return null

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  function onSave() {
    setMsg(null)
    setErr(null)
    try {
      if (!user) return
      updateProfile({
        name,
        email: user.role === 'guest' ? undefined : email,
      })
      setMsg('Profile updated')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
        <h1 className="text-lg font-semibold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Profile, connections, and audit trail.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 px-4">
          <button
            onClick={() => setTab('profile')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
              tab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={() => setTab('connections')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
              tab === 'connections' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Link2 className="w-4 h-4" />
            Connections
          </button>
          <button
            onClick={() => setTab('audit')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
              tab === 'audit' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Audit Trail
          </button>
          <div className="ml-auto flex items-center py-2">
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </div>

        <div className="p-5">
          {tab === 'profile' && (
            <div className="max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={user.role === 'guest'}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    placeholder={user.role === 'guest' ? 'Guest account (no email)' : 'you@company.com'}
                  />
                  {user.role === 'guest' && (
                    <p className="text-xs text-slate-400 mt-1">Guest profiles can edit name only.</p>
                  )}
                </div>
              </div>

              {msg && <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{msg}</div>}
              {err && <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</div>}

              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  onClick={onSave}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          )}

          {tab === 'connections' && (
            <div className="-m-5">
              <ConnectionsPage />
            </div>
          )}

          {tab === 'audit' && (
            <AuditTrailPage />
          )}
        </div>
      </div>
    </div>
  )
}

