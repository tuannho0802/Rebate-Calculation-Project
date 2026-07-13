import { ApiResponse, AssetType, RebateTransaction } from '@/types';
import { apiClient } from './client';

export interface CreateTransactionDto {
  ibId: string;
  assetType: AssetType;
  lots: number;
  rebateAmount: number;
  tradedAt: string;
  note?: string;
}

export const transactionApi = {
  create: async (dto: CreateTransactionDto): Promise<ApiResponse<RebateTransaction>> => {
    const response = await apiClient.post<ApiResponse<RebateTransaction>>('/transactions', dto);
    return response.data;
  },

  remove: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/transactions/${id}`);
    return response.data;
  },
};
