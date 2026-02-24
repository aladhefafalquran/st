import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { api } from '../api/client'

export function Navbar() {
  const { user, isAuthenticated, clearUser } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
    setMenuOpen(false)
  }, [location.pathname])

  // Clear search when leaving search page
  useEffect(() => {
    if (!location.pathname.startsWith('/search')) setSearch('')
  }, [location.pathname])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { navigate('/search', { replace: true }); return }
    debounceRef.current = setTimeout(() => {
      navigate(`/search?q=${encodeURIComponent(val.trim())}`, {
        replace: location.pathname === '/search',
      })
    }, 400)
  }

  async function logout() {
    await api.post('/api/auth/logout').catch(() => {})
    clearUser()
    navigate('/')
  }

  const navLinks = (
    <>
      <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--st-text-muted)] hover:text-white hover:bg-white/5 transition-colors text-sm font-medium">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
        Home
      </Link>
      <Link to="/browse/movies" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--st-text-muted)] hover:text-white hover:bg-white/5 transition-colors text-sm font-medium">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
        Movies
      </Link>
      <Link to="/browse/tv" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--st-text-muted)] hover:text-white hover:bg-white/5 transition-colors text-sm font-medium">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        TV Shows
      </Link>
      {isAuthenticated && (
        <>
          <Link to="/watchlist" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--st-text-muted)] hover:text-white hover:bg-white/5 transition-colors text-sm font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
            Watchlist
          </Link>
          <Link to="/history" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--st-text-muted)] hover:text-white hover:bg-white/5 transition-colors text-sm font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Watch History
          </Link>
        </>
      )}
    </>
  )

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/90 to-transparent backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 sm:px-8 py-4">
          {/* Hamburger (mobile only) */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="sm:hidden text-white p-1 -ml-1 cursor-pointer"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-1">
            <span className="text-[var(--st-accent)] font-bold text-2xl tracking-tight">STREAM</span>
            <span className="text-white font-bold text-2xl tracking-tight">TIME</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden sm:flex items-center gap-1 text-sm font-medium">
            <Link to="/" className="text-[var(--st-text-muted)] hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">Home</Link>
            <Link to="/browse/movies" className="text-[var(--st-text-muted)] hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">Movies</Link>
            <Link to="/browse/tv" className="text-[var(--st-text-muted)] hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">TV Shows</Link>
            {isAuthenticated && (
              <Link to="/watchlist" className="text-[var(--st-text-muted)] hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">Watchlist</Link>
            )}
          </div>

          {/* Right side: search + user */}
          <div className="flex items-center gap-3">
            {/* Desktop search */}
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={handleSearchChange}
              className="hidden sm:block bg-white/10 border border-white/20 text-white placeholder-[var(--st-text-muted)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-white/50 w-40 focus:w-56 transition-all"
            />

            {/* Mobile search icon */}
            <button
              onClick={() => navigate('/search')}
              className="sm:hidden text-[var(--st-text-muted)] hover:text-white p-1 cursor-pointer"
              aria-label="Search"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
            </button>

            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((p) => !p)}
                  className="flex items-center gap-2 text-sm text-white hover:text-white/80 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--st-accent)] flex items-center justify-center font-bold text-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 bg-[var(--st-surface)] border border-[var(--st-border)] rounded-lg py-1 shadow-xl z-50">
                    <div className="px-3 py-2 text-xs text-[var(--st-text-muted)] border-b border-[var(--st-border)]">
                      {user.username}
                    </div>
                    <Link to="/profile" className="block px-3 py-2 text-sm text-[var(--st-text)] hover:bg-white/5 transition-colors" onClick={() => setMenuOpen(false)}>Profile</Link>
                    <Link to="/watchlist" className="block px-3 py-2 text-sm text-[var(--st-text)] hover:bg-white/5 transition-colors" onClick={() => setMenuOpen(false)}>My Watchlist</Link>
                    <Link to="/history" className="block px-3 py-2 text-sm text-[var(--st-text)] hover:bg-white/5 transition-colors" onClick={() => setMenuOpen(false)}>Watch History</Link>
                    <button onClick={logout} className="w-full text-left px-3 py-2 text-sm text-[var(--st-text)] hover:bg-white/5 transition-colors cursor-pointer">Sign Out</button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="text-sm bg-[var(--st-accent)] hover:bg-[var(--st-accent-hover)] text-white px-4 py-1.5 rounded-md font-medium transition-colors">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 sm:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-[var(--st-surface)] z-50 flex flex-col transition-transform duration-300 sm:hidden ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--st-border)]">
          <Link to="/" className="flex items-center gap-1">
            <span className="text-[var(--st-accent)] font-bold text-xl tracking-tight">STREAM</span>
            <span className="text-white font-bold text-xl tracking-tight">TIME</span>
          </Link>
          <button onClick={() => setDrawerOpen(false)} className="text-[var(--st-text-muted)] hover:text-white p-1 cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mobile search */}
        <div className="px-4 py-3 border-b border-[var(--st-border)]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--st-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search movies & shows..."
              value={search}
              onChange={handleSearchChange}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-[var(--st-text-muted)] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[var(--st-accent)] transition-colors"
            />
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-0.5 px-3 py-3 flex-1 overflow-y-auto">
          {navLinks}
        </nav>

        {/* User section at bottom */}
        <div className="border-t border-[var(--st-border)] p-4">
          {isAuthenticated && user ? (
            <div className="flex flex-col gap-1">
              <Link to="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--st-text-muted)] hover:text-white hover:bg-white/5 transition-colors text-sm font-medium">
                <div className="w-7 h-7 rounded-full bg-[var(--st-accent)] flex items-center justify-center font-bold text-xs text-white shrink-0">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                {user.username}
              </Link>
              <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--st-text-muted)] hover:text-white hover:bg-white/5 transition-colors text-sm font-medium w-full text-left cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sign Out
              </button>
            </div>
          ) : (
            <Link to="/login" className="flex items-center justify-center bg-[var(--st-accent)] hover:bg-[var(--st-accent-hover)] text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
