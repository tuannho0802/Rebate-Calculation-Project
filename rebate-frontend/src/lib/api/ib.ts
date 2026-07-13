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
    try {
      console.log('ibApi.getById', { id });
    } catch (e) {
      // ignore logging errors
    }
    const response = await apiClient.get<ApiResponse<IbNode>>(`/ib/${id}`);
    return response.data;
  },

  create: async (email: string, password?: string, name?: string, accountType?: string): Promise<ApiResponse<IbNode>> => {
    const response = await apiClient.post<ApiResponse<IbNode>>('/ib', { email, password, name, accountType });
    return response.data;
  },

  search: async (q: string, includeInactive = false, page = 1, limit = 20): Promise<ApiResponse<{ items: IbNode[]; total: number }>> => {
    const response = await apiClient.get<ApiResponse<{ items: IbNode[]; total: number }>>(`/ib/search?q=${encodeURIComponent(q)}&includeInactive=${includeInactive}&page=${page}&limit=${limit}`);
    return response.data;
  },

  update: async (id: string, dto: { name?: string; email?: string; accountType?: string }): Promise<ApiResponse<IbNode>> => {
    const response = await apiClient.put<ApiResponse<IbNode>>(`/ib/${id}`, dto);
    return response.data;
  },

  deactivate: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/ib/${id}`);
    return response.data;
  },

  restore: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.patch<ApiResponse<null>>(`/ib/${id}/restore`);
    return response.data;
  },

  getChildren: async (id: string, page = 1, limit = 20): Promise<ApiResponse<{ items: IbNode[]; total: number }>> => {
    const response = await apiClient.get<ApiResponse<{ items: IbNode[]; total: number }>>(`/ib/${id}/children?page=${page}&limit=${limit}`);
    return response.data;
  },

  getPerformance: async (id: string, month?: string): Promise<ApiResponse<IbPerformanceResponse>> => {
    const query = month ? `?month=${month}` : '';
    const response = await apiClient.get<ApiResponse<IbPerformanceResponse>>(`/ib/${id}/performance${query}`);
    return response.data;
  },
};
