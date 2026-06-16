import { apiClient } from './client';
import type { IbNode, IbTreeNode } from '@/types';

export const ibApi = {
  getMe: async (): Promise<IbNode> => {
    const { data } = await apiClient.get('/ib/me');
    return data.data;
  },

  getTree: async (depth: 'all' | 1 = 1): Promise<IbTreeNode> => {
    const { data } = await apiClient.get(`/ib/tree?depth=${depth}`);
    return data.data;
  },

  getById: async (id: string): Promise<IbNode> => {
    const { data } = await apiClient.get(`/ib/${id}`);
    return data.data;
  },

  create: async (email: string, password: string): Promise<IbNode> => {
    const { data } = await apiClient.post('/ib', { email, password });
    return data.data;
  },
};
