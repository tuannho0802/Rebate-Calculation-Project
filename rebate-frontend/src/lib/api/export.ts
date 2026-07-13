import { apiClient } from './client';

export const exportApi = {
  getRebateConfig: async (period?: string): Promise<Blob> => {
    const response = await apiClient.get('/export/rebate-config', {
      params: { period },
      responseType: 'blob',
    });
    return response.data;
  },

  getTransactions: async (period?: string, ibId?: string): Promise<Blob> => {
    const response = await apiClient.get('/export/transactions', {
      params: { period, ibId },
      responseType: 'blob',
    });
    return response.data;
  },
};
