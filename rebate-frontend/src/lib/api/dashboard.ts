import {
  ApiResponse,
  DashboardSummary,
  DashboardOverview,
  DashboardRebateSummary,
  DashboardIbPerformance,
} from '@/types';
import { apiClient } from './client';

// Cả 4 endpoint đều "tự-phục-vụ" (self-service) — không nhận ibId, BE tự
// suy ra phạm vi xem đúng theo role của người gọi (Admin: toàn hệ thống,
// MIB: đệ quy toàn nhánh, Lv1+: chỉ con trực tiếp). Xem dashboard.service.ts.
export const dashboardApi = {
  getSummary: async (): Promise<ApiResponse<DashboardSummary>> => {
    const response = await apiClient.get<ApiResponse<DashboardSummary>>('/dashboard/summary');
    return response.data;
  },

  getOverview: async (): Promise<ApiResponse<DashboardOverview>> => {
    const response = await apiClient.get<ApiResponse<DashboardOverview>>('/dashboard/overview');
    return response.data;
  },

  getRebateSummary: async (period: string): Promise<ApiResponse<DashboardRebateSummary>> => {
    const response = await apiClient.get<ApiResponse<DashboardRebateSummary>>('/dashboard/rebate-summary', {
      params: { period },
    });
    return response.data;
  },

  getIbPerformance: async (
    period: string,
    page = 1,
    limit = 10,
  ): Promise<ApiResponse<DashboardIbPerformance>> => {
    const response = await apiClient.get<ApiResponse<DashboardIbPerformance>>('/dashboard/ib-performance', {
      params: { period, page, limit },
    });
    return response.data;
  },
};
