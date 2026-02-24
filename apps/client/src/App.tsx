import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { Navbar } from './components/Navbar'
import { Home } from './pages/Home'
import { Browse } from './pages/Browse'
import { Search } from './pages/Search'
import { MovieDetail } from './pages/MovieDetail'
import { TVDetail } from './pages/TVDetail'
import { Watch } from './pages/Watch'
import { Watchlist } from './pages/Watchlist'
import { History } from './pages/History'
import { Login } from './pages/Login'
import { Profile } from './pages/Profile'
import { GenreBrowse } from './pages/GenreBrowse'
import { useAuthStore } from './store/authStore'
import { api } from './api/client'

function AuthInit() {
  const setUser = useAuthStore((s) => s.setUser)
  const clearUser = useAuthStore((s) => s.clearUser)

  useEffect(() => {
    api.get('/api/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => clearUser())
  }, [])

  return null
}

function Layout() {
  return (
    <div className="min-h-screen bg-[var(--st-bg)]">
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthInit />
      <Routes>
        <Route path="/watch" element={<Watch />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/browse/:type" element={<Browse />} />
          <Route path="/browse/:type/genre/:genreId" element={<GenreBrowse />} />
          <Route path="/search" element={<Search />} />
          <Route path="/movie/:id" element={<MovieDetail />} />
          <Route path="/tv/:id" element={<TVDetail />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/history" element={<History />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
