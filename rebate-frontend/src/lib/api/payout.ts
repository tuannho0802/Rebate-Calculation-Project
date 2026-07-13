import { ApiResponse, Payout, PayoutStatus } from '@/types';
import { apiClient } from './client';

export const payoutApi = {
  requestPayout: async (
    amount: number,
    paymentMethod: string,
    note?: string
  ): Promise<ApiResponse<Payout>> => {
    const response = await apiClient.post<ApiResponse<Payout>>('/payouts', {
      amount,
      paymentMethod,
      note,
    });
    return response.data;
  },

  listPayouts: async (
    params?: {
      status?: PayoutStatus;
      ibId?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<ApiResponse<Payout[]>> => {
    const response = await apiClient.get<ApiResponse<Payout[]>>('/payouts', {
      params,
    });
    return response.data;
  },

  getPendingPayouts: async (page = 1, limit = 20): Promise<ApiResponse<Payout[]>> => {
    const response = await apiClient.get<ApiResponse<Payout[]>>('/payouts/pending', {
      params: { page, limit },
    });
    return response.data;
  },

  approvePayout: async (id: string): Promise<ApiResponse<Payout>> => {
    const response = await apiClient.patch<ApiResponse<Payout>>(`/payouts/${id}/approve`);
    return response.data;
  },

  rejectPayout: async (id: string, rejectedReason: string): Promise<ApiResponse<Payout>> => {
    const response = await apiClient.patch<ApiResponse<Payout>>(`/payouts/${id}/reject`, {
      rejectedReason,
    });
    return response.data;
  },
};
