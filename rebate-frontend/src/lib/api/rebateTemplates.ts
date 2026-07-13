import { ApiResponse } from '@/types';
import { apiClient } from './client';

export interface AccountTypeRow {
  assetType: string;
  maxCeiling: string;
  calcUnit: string;
}

export interface AccountTypeTemplate {
  id: string;
  name: string;
  rows: AccountTypeRow[];
}

export interface MarkupLinkRow {
  id: string;
  name: string;
  share: number;
}

export interface RebateTemplatesResponse {
  accountTypeTemplates: AccountTypeTemplate[];
  markupLinkTemplates: MarkupLinkRow[];
}

export const rebateTemplateApi = {
  getTemplates: async (ibId: string): Promise<ApiResponse<RebateTemplatesResponse>> => {
    const response = await apiClient.get<ApiResponse<RebateTemplatesResponse>>(`/rebate/ib/${ibId}/templates`);
    return response.data;
  },

  saveTemplates: async (ibId: string, templates: RebateTemplatesResponse): Promise<ApiResponse<RebateTemplatesResponse>> => {
    const response = await apiClient.put<ApiResponse<RebateTemplatesResponse>>(`/rebate/ib/${ibId}/templates`, templates);
    return response.data;
  },
};
