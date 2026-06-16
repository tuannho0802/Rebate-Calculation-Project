import { apiClient } from './client';
import type { RebateConfig, RebateCalculation, AssetType } from '@/types';

export const rebateApi = {
  getConfig: async (ibId: string): Promise<RebateConfig> => {
    const { data } = await apiClient.get(`/rebate/config/${ibId}`);
    return data.data;
  },

  updateConfig: async (ibId: string, assets: any[]): Promise<RebateConfig> => {
    const { data } = await apiClient.put(`/rebate/config/${ibId}`, { assets });
    return data.data;
  },

  calculate: async (ibId: string, assetType: AssetType, lots: number): Promise<RebateCalculation> => {
    const { data } = await apiClient.get(`/rebate/calculate`, {
      params: { ibId, assetType, lots },
    });
    return data.data;
  },
};
