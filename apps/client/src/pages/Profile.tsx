import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { Spinner } from '../components/Spinner'

interface Stats {
  watchlistCount: number
  historyCount: number
}

export function Profile() {
  const { user, isAuthenticated, clearUser } = useAuthStore()
  const navigate = useNavigate()

  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return }
    api.get<Stats>('/api/auth/stats')
      .then((r) => setStats(r.data))
      .finally(() => setStatsLoading(false))
  }, [isAuthenticated, navigate])

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters')
      return
    }
    setPwLoading(true)
    try {
      await api.post('/api/auth/password', { currentPassword, newPassword })
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setPwError(err?.response?.data?.error ?? 'Something went wrong')
    } finally {
      setPwLoading(false)
    }
  }

  async function handleLogout() {
    await api.post('/api/auth/logout').catch(() => {})
    clearUser()
    navigate('/')
  }

  if (!user) return null

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : null

  return (
    <div className="pt-24 pb-16 px-4 sm:px-8 max-w-2xl mx-auto">
      {/* Avatar + name */}
      <div className="flex items-center gap-5 mb-10">
        <div className="w-20 h-20 rounded-full bg-[var(--st-accent)] flex items-center justify-center text-3xl font-bold text-white shrink-0">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{user.username}</h1>
          <p className="text-[var(--st-text-muted)] text-sm">{user.email}</p>
          {memberSince && <p className="text-[var(--st-text-muted)] text-xs mt-0.5">Member since {memberSince}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <Link
          to="/watchlist"
          className="bg-[var(--st-surface)] border border-[var(--st-border)] rounded-xl p-5 hover:bg-[var(--st-surface-2)] transition-colors"
        >
          {statsLoading ? (
            <div className="flex justify-center"><Spinner /></div>
          ) : (
            <>
              <p className="text-3xl font-bold text-white">{stats?.watchlistCount ?? 0}</p>
              <p className="text-[var(--st-text-muted)] text-sm mt-1">Watchlist</p>
            </>
          )}
        </Link>
        <Link
          to="/history"
          className="bg-[var(--st-surface)] border border-[var(--st-border)] rounded-xl p-5 hover:bg-[var(--st-surface-2)] transition-colors"
        >
          {statsLoading ? (
            <div className="flex justify-center"><Spinner /></div>
          ) : (
            <>
              <p className="text-3xl font-bold text-white">{stats?.historyCount ?? 0}</p>
              <p className="text-[var(--st-text-muted)] text-sm mt-1">Titles Watched</p>
            </>
          )}
        </Link>
      </div>

      {/* Change password */}
      <div className="bg-[var(--st-surface)] border border-[var(--st-border)] rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-5">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-[var(--st-text-muted)] mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full bg-[var(--st-surface-2)] border border-[var(--st-border)] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[var(--st-accent)] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--st-text-muted)] mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full bg-[var(--st-surface-2)] border border-[var(--st-border)] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[var(--st-accent)] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--st-text-muted)] mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full bg-[var(--st-surface-2)] border border-[var(--st-border)] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[var(--st-accent)] transition-colors"
            />
          </div>

          {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
          {pwSuccess && <p className="text-green-400 text-sm">Password updated successfully.</p>}

          <button
            type="submit"
            disabled={pwLoading}
            className="bg-[var(--st-accent)] hover:bg-[var(--st-accent-hover)] text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {pwLoading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Sign out */}
      <button
        onClick={handleLogout}
        className="w-full bg-white/5 hover:bg-white/10 border border-[var(--st-border)] text-[var(--st-text-muted)] hover:text-white font-medium py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
      >
        Sign Out
      </button>
    </div>
  )
}
