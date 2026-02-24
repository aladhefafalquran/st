import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function Navbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`);
      setSearch('');
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/90 to-transparent backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 sm:px-8 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="text-[var(--st-accent)] font-bold text-2xl tracking-tight">STREAM</span>
          <span className="text-white font-bold text-2xl tracking-tight">TIME</span>
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-6 text-sm font-medium">
          <Link to="/" className="text-[var(--st-text-muted)] hover:text-white transition-colors">Home</Link>
          <Link to="/browse/movies" className="text-[var(--st-text-muted)] hover:text-white transition-colors">Movies</Link>
          <Link to="/browse/tv" className="text-[var(--st-text-muted)] hover:text-white transition-colors">TV Shows</Link>
          {user && (
            <Link to="/watchlist" className="text-[var(--st-text-muted)] hover:text-white transition-colors">Watchlist</Link>
          )}
        </div>

        {/* Search + User */}
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="hidden sm:flex">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/10 border border-white/20 text-white placeholder-[var(--st-text-muted)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-white/50 w-40 focus:w-56 transition-all"
            />
          </form>

          {user ? (
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
                <div className="absolute right-0 top-full mt-2 w-44 bg-[var(--st-surface)] border border-[var(--st-border)] rounded-lg py-1 shadow-xl">
                  <div className="px-3 py-2 text-xs text-[var(--st-text-muted)] border-b border-[var(--st-border)]">
                    {user.username}
                  </div>
                  <Link
                    to="/watchlist"
                    className="block px-3 py-2 text-sm text-[var(--st-text)] hover:bg-white/5 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    My Watchlist
                  </Link>
                  <Link
                    to="/history"
                    className="block px-3 py-2 text-sm text-[var(--st-text)] hover:bg-white/5 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Watch History
                  </Link>
                  <button
                    onClick={() => { logout(); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--st-text)] hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="text-sm bg-[var(--st-accent)] hover:bg-[var(--st-accent-hover)] text-white px-4 py-1.5 rounded-md font-medium transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
