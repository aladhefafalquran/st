import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Home } from '@/pages/Home';
import { Browse } from '@/pages/Browse';
import { Search } from '@/pages/Search';
import { MovieDetail } from '@/pages/MovieDetail';
import { TVDetail } from '@/pages/TVDetail';
import { Watch } from '@/pages/Watch';
import { Watchlist } from '@/pages/Watchlist';
import { History } from '@/pages/History';
import { Login } from '@/pages/Login';
import { useAuth } from '@/hooks/useAuth';

function AppRoutes() {
  // Initialize auth state on mount
  useAuth();

  return (
    <Routes>
      {/* Watch page — full-screen, no nav */}
      <Route path="/watch" element={<Watch />} />

      {/* Pages with nav */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/browse/:type" element={<Browse />} />
        <Route path="/search" element={<Search />} />
        <Route path="/movie/:id" element={<MovieDetail />} />
        <Route path="/tv/:id" element={<TVDetail />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/history" element={<History />} />
        <Route path="/login" element={<Login />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
