import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getMe, login as apiLogin, register as apiRegister, logout as apiLogout } from '@/api/auth';
import { LoginBody, RegisterBody } from '@streamtime/shared';

export function useAuth() {
  const { user, isLoading, isAuthenticated, initialized, setUser, setInitialized } = useAuthStore();

  // Only fetch once per app lifetime — guard with `initialized` flag
  useEffect(() => {
    if (initialized) return;
    setInitialized();
    getMe()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null));
  }, [initialized, setUser, setInitialized]);

  async function login(body: LoginBody) {
    const { user } = await apiLogin(body);
    setUser(user);
    return user;
  }

  async function register(body: RegisterBody) {
    const { user } = await apiRegister(body);
    setUser(user);
    return user;
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  return { user, isLoading, isAuthenticated, login, register, logout };
}
