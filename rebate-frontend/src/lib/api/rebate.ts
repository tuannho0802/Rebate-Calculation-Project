import { ApiResponse, RebateConfig, RebateCalculation, AssetType } from '@/types';
import { apiClient } from './client';

export const rebateApi = {
  getConfig: async (ibId: string): Promise<ApiResponse<RebateConfig>> => {
    try {
      console.log('rebateApi.getConfig', { url: `/rebate/config/${ibId}`, ibId });
    } catch (e) {
      // ignore logging errors
    }
    const response = await apiClient.get<ApiResponse<RebateConfig>>(`/rebate/config/${ibId}`);
    return response.data;
  },

  updateConfig: async (ibId: string, assets: any): Promise<ApiResponse<RebateConfig>> => {
    try {
      console.log('rebateApi.updateConfig', { url: `/rebate/config/${ibId}`, ibId, assets });
    } catch (e) {
      // ignore logging errors
    }
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
