import { ApiResponse, IbNode } from '@/types';
import { apiClient } from './client';

export const adminApi = {
  create: async (email: string, password?: string, name?: string): Promise<ApiResponse<IbNode>> => {
    const response = await apiClient.post<ApiResponse<IbNode>>('/admin/users', { email, password, name });
    return response.data;
  },

  getAll: async (): Promise<ApiResponse<IbNode[]>> => {
    const response = await apiClient.get<ApiResponse<IbNode[]>>('/admin/users');
    return response.data;
  },

  update: async (id: string, dto: { name?: string; email?: string; password?: string }): Promise<ApiResponse<IbNode>> => {
    const response = await apiClient.patch<ApiResponse<IbNode>>(`/admin/users/${id}`, dto);
    return response.data;
  },

  deactivate: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/admin/users/${id}`);
    return response.data;
  },
};
