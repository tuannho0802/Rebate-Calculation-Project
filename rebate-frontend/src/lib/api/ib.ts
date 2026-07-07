import { ApiResponse, IbNode, IbTreeNode, IbPerformanceResponse } from '@/types';
import { apiClient } from './client';

export const ibApi = {
  getMe: async (): Promise<ApiResponse<IbNode>> => {
    const response = await apiClient.get<ApiResponse<IbNode>>('/ib/me');
    return response.data;
  },

  getTree: async (depth: 'all' | 1 = 1): Promise<ApiResponse<IbTreeNode>> => {
    const response = await apiClient.get<ApiResponse<IbTreeNode>>(`/ib/tree?depth=${depth}`);
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<IbNode>> => {
    const response = await apiClient.get<ApiResponse<IbNode>>(`/ib/${id}`);
    return response.data;
  },

  create: async (email: string, password?: string, name?: string): Promise<ApiResponse<IbNode>> => {
    const response = await apiClient.post<ApiResponse<IbNode>>('/ib', { email, password, name });
    return response.data;
  },

  getPerformance: async (id: string, month?: string): Promise<ApiResponse<IbPerformanceResponse>> => {
    const query = month ? `?month=${month}` : '';
    const response = await apiClient.get<ApiResponse<IbPerformanceResponse>>(`/ib/${id}/performance${query}`);
    return response.data;
  },
};
