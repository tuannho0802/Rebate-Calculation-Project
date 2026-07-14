import { ApiResponse, IbNode } from '@/types';
import { apiClient } from './client';

export const trashApi = {
  getAll: async (): Promise<ApiResponse<IbNode[]>> => {
    const response = await apiClient.get<ApiResponse<IbNode[]>>('/trash');
    return response.data;
  },

  restore: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.patch<ApiResponse<null>>(`/trash/${id}/restore`);
    return response.data;
  },

  hardDelete: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/trash/${id}/permanent`);
    return response.data;
  },
};
