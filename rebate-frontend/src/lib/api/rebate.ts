import { ApiResponse, RebateConfig, RebateCalculation, AssetType } from '@/types';
import { apiClient } from './client';

export const rebateApi = {
  getConfig: async (ibId: string): Promise<ApiResponse<RebateConfig>> => {
    const response = await apiClient.get<ApiResponse<RebateConfig>>(`/rebate/config/${ibId}`);
    return response.data;
  },

  updateConfig: async (ibId: string, assets: any): Promise<ApiResponse<RebateConfig>> => {
    const response = await apiClient.put<ApiResponse<RebateConfig>>(`/rebate/config/${ibId}`, { assets });
    return response.data;
  },

  calculate: async (ibId: string, assetType: AssetType, lots: number, period?: string): Promise<ApiResponse<RebateCalculation>> => {
    const response = await apiClient.get<ApiResponse<RebateCalculation>>('/rebate/calculate', {
      params: { ibId, assetType, lots, period }
    });
    return response.data;
  }
};
