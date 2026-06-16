import { create } from 'zustand';
import type { AuthUser } from '@/types';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user, isLoading: false }),

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ib_access_token');
      localStorage.removeItem('ib_refresh_token');
    }
    set({ user: null, isLoading: false });
  },
}));
