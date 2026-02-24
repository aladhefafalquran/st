import { create } from 'zustand';
import { User } from '@streamtime/shared';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  initialized: false,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: () => set({ initialized: true }),
}));
