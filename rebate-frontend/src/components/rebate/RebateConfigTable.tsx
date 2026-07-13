'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { rebateApi } from '@/lib/api/rebate';
import { AssetType, MAX_PIPS, RebateAssetConfig } from '@/types';
import { getErrorMessage } from '@/lib/error-messages';
import { Loader2, AlertCircle, Save, CheckCircle2, Search } from 'lucide-react';

export function RebateConfigTable() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  const defaultIbId = user?.id || 'mib-uuid-001';
  const [targetIbId, setTargetIbId] = useState<string>(defaultIbId);
  const [searchIbId, setSearchIbId] = useState<string>(defaultIbId);

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['rebateConfig', searchIbId],
    queryFn: () => rebateApi.getConfig(searchIbId),
  });

  const [formData, setFormData] = useState<RebateAssetConfig[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const updateMutation = useMutation({
    mutationFn: (assets: RebateAssetConfig[]) => rebateApi.updateConfig(searchIbId, assets),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['rebateConfig', searchIbId] });
        setSaveSuccess(true);
        setErrorMsg('');
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrorMsg(getErrorMessage((res as any).error?.code));
      }
    },
    onError: (err: any) => {
      setErrorMsg(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR'));
    }
  });

  useEffect(() => {
    if (response?.success && response.data?.assets) {
      setFormData(response.data.assets);
      setErrorMsg('');
    }
  }, [response]);

  const handleInputChange = (index: number, field: keyof RebateAssetConfig, value: string) => {
    const numValue = parseFloat(value);
    const newFormData = [...formData];
    newFormData[index] = {
      ...newFormData[index],
      [field]: isNaN(numValue) ? 0 : numValue,
    };
    setFormData(newFormData);
  };

  const validateRow = (row: RebateAssetConfig) => {
    const limit = user?.level === 0
      ? MAX_PIPS[row.assetType]
      : row.maxPips ?? 0;
    return (row.rebatePips + row.markupPips) <= limit;
  };

  const isFormValid = formData.length > 0 && formData.every(validateRow);

  const handleSave = () => {
    if (isFormValid) {
      updateMutation.mutate(formData);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetIbId.trim()) {
      setSearchIbId(targetIbId.trim());
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* IB Selector */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Chọn Mã IB để cấu hình</label>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={targetIbId}
                onChange={(e) => setTargetIbId(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                placeholder="Nhập ID của IB..."
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-lg transition-colors border border-gray-200"
            >
              Tải Cấu Hình
            </button>
          </form>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-gray-200 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-[#0066ff] mb-4" />
          <p className="text-gray-500 font-medium">Đang tải cấu hình hoa hồng...</p>
        </div>
      ) : isError || !response?.success ? (
        <div className="flex flex-col items-center justify-center py-24 bg-red-50 rounded-xl border border-red-100 text-red-500">
          <AlertCircle className="h-10 w-10 mb-4 text-red-400" />
          <p className="font-semibold">Không tìm thấy cấu hình cho IB này.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Bảng Giá Trị Hoa Hồng</h2>
              <p className="text-sm text-gray-500 mt-1">Điều chỉnh mức Rebate và Markup. <strong className="text-red-500">Tổng Pips không được vượt quá Max Pips.</strong></p>
            </div>
            <button
              onClick={handleSave}
              disabled={!isFormValid || updateMutation.isPending}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#0066ff] text-white font-medium rounded-lg hover:bg-[#0052cc] disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/20 disabled:shadow-none"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              {saveSuccess ? 'Đã lưu thành công' : 'Lưu Cấu Hình'}
            </button>
          </div>

          {errorMsg && (
            <div className="px-6 py-3 bg-red-50 text-red-600 text-sm font-medium border-b border-red-100 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {errorMsg}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-700 uppercase tracking-wider">
                  <th className="p-4 pl-6 whitespace-nowrap">Tài Sản (Asset)</th>
                  <th className="p-4 whitespace-nowrap">Rebate Pips</th>
                  <th className="p-4 whitespace-nowrap">Markup Pips</th>
                  <th className="p-4 whitespace-nowrap">Markup (%)</th>
                  <th className="p-4 pr-6 whitespace-nowrap text-right">Max Pips</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {formData.map((row, idx) => {
                  const limit = user?.level === 0
                    ? MAX_PIPS[row.assetType] ?? row.maxPips ?? 100
                    : row.maxPips ?? 100;
                  const isRowInvalid = !validateRow(row);
                  const total = row.rebatePips + row.markupPips;

                  return (
                    <tr key={`${row.assetType}-${idx}`} className={`hover:bg-blue-50/30 transition-colors ${isRowInvalid ? 'bg-red-50/30 hover:bg-red-50/50' : ''}`}>
                      <td className="p-4 pl-6">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0066ff]/10 text-[#0066ff] border border-[#0066ff]/20 shadow-sm">
                          {row.assetType}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={row.rebatePips}
                            onChange={(e) => handleInputChange(idx, 'rebatePips', e.target.value)}
                            className={`w-28 px-3 py-2 text-sm font-semibold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-[#0066ff]/50 ${isRowInvalid ? 'border-red-400 bg-white text-red-700 focus:border-red-500 shadow-[0_0_0_1px_rgba(248,113,113,0.5)]' : 'border-gray-200 bg-white text-gray-900 focus:border-[#0066ff]'}`}
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={row.markupPips}
                            onChange={(e) => handleInputChange(idx, 'markupPips', e.target.value)}
                            className={`w-28 px-3 py-2 text-sm font-semibold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-[#0066ff]/50 ${isRowInvalid ? 'border-red-400 bg-white text-red-700 focus:border-red-500 shadow-[0_0_0_1px_rgba(248,113,113,0.5)]' : 'border-gray-200 bg-white text-gray-900 focus:border-[#0066ff]'}`}
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={row.markupPercent}
                            onChange={(e) => handleInputChange(idx, 'markupPercent', e.target.value)}
                            className="w-24 px-3 py-2 text-sm font-semibold border border-gray-200 bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066ff]/50 focus:bg-white transition-all text-gray-900"
                          />
                          <span className="text-gray-500 font-bold">%</span>
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex flex-col items-end justify-center">
                          <span className={`font-bold text-lg ${isRowInvalid ? 'text-red-600' : 'text-gray-700'}`}>
                            {limit.toFixed(1)}
                          </span>
                          {isRowInvalid ? (
                            <span className="text-xs text-red-500 font-bold mt-1 bg-red-100 px-2 py-0.5 rounded animate-pulse">
                              Lỗi: {total.toFixed(1)} &gt; {limit.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-xs text-green-600 font-medium mt-1">
                              Tổng: {total.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
