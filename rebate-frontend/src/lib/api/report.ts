import { ApiResponse, ReportSummary, RebateTransaction } from '@/types';
import { apiClient } from './client';

export const reportApi = {
  getSummary: async (period?: string, ibId?: string): Promise<ApiResponse<ReportSummary>> => {
    const response = await apiClient.get<ApiResponse<ReportSummary>>('/report/summary', {
      params: { period, ibId }
    });
    return response.data;
  },

  getTransactions: async (params?: { page?: number; limit?: number; period?: string; ibId?: string; assetType?: string }): Promise<ApiResponse<RebateTransaction[]>> => {
    const response = await apiClient.get<ApiResponse<RebateTransaction[]>>('/report/transactions', { params });
    return response.data;
  }
};
