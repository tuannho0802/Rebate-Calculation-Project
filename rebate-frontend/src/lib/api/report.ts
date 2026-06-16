import { apiClient } from './client';
import type { ReportSummary, RebateTransaction, ApiResponse } from '@/types';

export const reportApi = {
  getSummary: async (period?: string, ibId?: string): Promise<ReportSummary> => {
    const { data } = await apiClient.get('/report/summary', {
      params: { period, ibId },
    });
    return data.data;
  },

  getTransactions: async (params: {
    ibId?: string;
    period?: string;
    assetType?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<RebateTransaction[]>> => {
    const { data } = await apiClient.get('/report/transactions', {
      params,
    });
    return data;
  },
};
