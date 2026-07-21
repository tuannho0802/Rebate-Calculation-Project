import { ApiResponse, RebateConfig, RebateCalculation, AssetType, BulkUpdateResponse, SimulationResult, RebateScenario } from '@/types';
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

  bulkUpdateConfig: async (
    items: { ibId: string; assets: RebateConfig['assets'] }[],
    notifyScope?: 'direct' | 'cascade',
  ): Promise<BulkUpdateResponse> => {
    const response = await apiClient.put<ApiResponse<BulkUpdateResponse>>('/rebate/config/bulk', {
      items,
      notifyScope,
    });
    return response.data.data;
  },

  setMibMaxOverride: async (
    mibId: string,
    overrides: { assetType: AssetType; rebateType: string; maxPips: number }[],
  ): Promise<ApiResponse<RebateConfig>> => {
    const response = await apiClient.put<ApiResponse<RebateConfig>>(
      `/rebate/config/mib/${mibId}/max-override`,
      { overrides },
    );
    return response.data;
  },

  getConfigHistory: async (
    ibId: string,
    limit = 20,
  ): Promise<ApiResponse<unknown[]>> => {
    const response = await apiClient.get<ApiResponse<unknown[]>>(
      `/rebate/config/${ibId}/history?limit=${limit}`,
    );
    return response.data;
  },

  calculate: async (ibId: string, assetType: AssetType, lots: number, period?: string): Promise<ApiResponse<RebateCalculation>> => {
    const response = await apiClient.get<ApiResponse<RebateCalculation>>('/rebate/calculate', {
      params: { ibId, assetType, lots, period }
    });
    return response.data;
  },

  simulate: async (ibId: string, markupPips?: number): Promise<ApiResponse<SimulationResult>> => {
    const response = await apiClient.get<ApiResponse<SimulationResult>>('/rebate/simulate', {
      params: { ibId, markupPips }
    });
    return response.data;
  },

  simulateCustom: async (dto: any): Promise<ApiResponse<{ totalScenarios: number; scenarios: RebateScenario[] }>> => {
    const response = await apiClient.post<ApiResponse<{ totalScenarios: number; scenarios: RebateScenario[] }>>('/rebate/simulate', dto);
    return response.data;
  },

  saveBranchScenario: async (nodes: { ibId: string; markupPercent: number; markupPips: number }[]): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    const response = await apiClient.put<ApiResponse<{ success: boolean; message: string }>>('/rebate/config/scenario/save', { nodes });
    return response.data;
  }
};

