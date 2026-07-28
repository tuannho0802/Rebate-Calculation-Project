import { ApiResponse } from '@/types';
import { apiClient } from './client';

export interface AuditLogItem {
  id: string;
  actorId: string;
  actor: { id: string; email: string; level: number };
  action: string;
  targetType: string;
  targetId: string;
  targetLabel?: string | null;
  before?: any;
  after?: any;
  createdAt: string;
}

export const auditApi = {
  getLogs: async (params?: {
    page?: number;
    limit?: number;
    actorId?: string;
    targetId?: string;
    action?: string;
    targetType?: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<{ items: AuditLogItem[]; total: number }>> => {
    const response = await apiClient.get<ApiResponse<any>>('/audit/logs', { params });
    return {
      ...response.data,
      data: {
        items: Array.isArray(response.data.data) ? response.data.data : [],
        total: response.data.meta?.total || 0,
      }
    };
  },

  dismissLog: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete<ApiResponse<any>>(`/audit/logs/${id}`);
    return response.data;
  },
};
