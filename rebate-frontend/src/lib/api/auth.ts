import { apiClient } from './client';
import type { AuthTokens } from '@/types';

export const authApi = {
  login: async (email: string, password: string): Promise<AuthTokens> => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    return data.data;
  },

  refresh: async (refreshToken: string) => {
    const { data } = await apiClient.post('/auth/refresh', { refreshToken });
    return data.data;
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ib_access_token');
        localStorage.removeItem('ib_refresh_token');
      }
    }
  },
};
