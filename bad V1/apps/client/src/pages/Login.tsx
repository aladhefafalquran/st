import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/api/client';

export function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ email, username, password });
      }
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-1 mb-6">
            <span className="text-[var(--st-accent)] font-bold text-3xl">STREAM</span>
            <span className="text-white font-bold text-3xl">TIME</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
        </div>

        <div className="bg-[var(--st-surface)] rounded-2xl p-8 border border-[var(--st-border)]">
          {/* Toggle */}
          <div className="flex rounded-lg bg-[var(--st-surface-2)] p-1 mb-6">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                  mode === m ? 'bg-white text-black' : 'text-[var(--st-text-muted)] hover:text-white'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--st-text-muted)] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[var(--st-surface-2)] border border-[var(--st-border)] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--st-accent)] transition-colors"
                placeholder="you@example.com"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm text-[var(--st-text-muted)] mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  className="w-full bg-[var(--st-surface-2)] border border-[var(--st-border)] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--st-accent)] transition-colors"
                  placeholder="cooluser"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-[var(--st-text-muted)] mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-[var(--st-surface-2)] border border-[var(--st-border)] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--st-accent)] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading} size="lg">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
