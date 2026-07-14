'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { rebateApi } from '@/lib/api/rebate';
import { AssetType, IbTreeNode, RebateConfig, RebateAssetConfig, MAX_PIPS } from '@/types';
import { Loader2, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-messages';

// Flatten tree to array
const flattenTree = (node: IbTreeNode): IbTreeNode[] => {
  let result: IbTreeNode[] = [node];
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      if (child.isActive) {
        result = result.concat(flattenTree(child));
      }
    });
  }
  return result;
};

export default function BulkRebateManagementPage() {
  const [mounted, setMounted] = useState(false);
  const [configs, setConfigs] = useState<Record<string, RebateConfig>>({});
  const [dirtyIbs, setDirtyIbs] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveResults, setSaveResults] = useState<Record<string, { success: boolean; message: string }>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: treeRes, isLoading: isLoadingTree } = useQuery({
    queryKey: ['ibTree', 'all', 'bulk'],
    queryFn: () => ibApi.getTree('all'),
  });

  const flatIbs = useMemo(() => {
    if (!treeRes?.data) return [];
    return flattenTree(treeRes.data).filter(ib => ib.level > 0); 
  }, [treeRes?.data]);

  // Load configs
  useEffect(() => {
    if (flatIbs.length > 0) {
      const loadConfigs = async () => {
        const results = await Promise.allSettled(
          flatIbs.map(ib => rebateApi.getConfig(ib.id))
        );
        
        const newConfigs: Record<string, RebateConfig> = {};
        results.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value.success) {
            newConfigs[flatIbs[idx].id] = res.value.data;
          }
        });
        setConfigs(newConfigs);
        setDirtyIbs(new Set());
        setSaveResults({});
      };
      loadConfigs();
    }
  }, [flatIbs]);

  if (!mounted) return null;

  const handleCellChange = (ibId: string, assetType: AssetType, value: string) => {
    if (value && !/^\d*\.?\d*$/.test(value)) return;
    
    setConfigs(prev => {
      const ibConfig = prev[ibId];
      if (!ibConfig) return prev;

      const newAssets = ibConfig.assets.map(asset => {
        if (asset.assetType === assetType) {
          const parsed = parseFloat(value);
          return { ...asset, rebatePips: Number.isNaN(parsed) ? 0 : parsed, rawInput: value }; // Keep rawInput to allow '0.'
        }
        return asset;
      });

      return { ...prev, [ibId]: { ...ibConfig, assets: newAssets } };
    });

    setDirtyIbs(prev => new Set(prev).add(ibId));
    setSaveResults(prev => {
      const next = { ...prev };
      delete next[ibId];
      return next;
    });
  };

  const handleSaveAll = async () => {
    if (dirtyIbs.size === 0) return;
    
    setIsSaving(true);
    setSaveResults({});

    const ibsToSave = Array.from(dirtyIbs);
    
    // Client-side validation
    let hasValidationError = false;
    ibsToSave.forEach(ibId => {
      const ibConfig = configs[ibId];
      ibConfig.assets.forEach(asset => {
        if (asset.rebatePips > asset.maxPips) {
          hasValidationError = true;
          toast.error(`Hoa hồng cho ${asset.assetType} của ${ibId} vượt quá Max (${asset.maxPips})`);
        }
      });
    });

    if (hasValidationError) {
      setIsSaving(false);
      return;
    }

    const promises = ibsToSave.map(async (ibId) => {
      const ibConfig = configs[ibId];
      // Clean up rawInput before sending
      const cleanAssets = ibConfig.assets.map(({ rawInput, ...rest }: any) => rest);
      try {
        const res = await rebateApi.updateConfig(ibId, cleanAssets);
        if (res.success) {
          return { ibId, success: true, message: 'Thành công' };
        } else {
          return { ibId, success: false, message: getErrorMessage((res as any).error?.code) };
        }
      } catch (err: any) {
        return { ibId, success: false, message: getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR') };
      }
    });

    const results = await Promise.allSettled(promises);
    
    const newSaveResults: Record<string, { success: boolean; message: string }> = {};
    const newDirtyIbs = new Set(dirtyIbs);

    results.forEach(res => {
      if (res.status === 'fulfilled') {
        newSaveResults[res.value.ibId] = { success: res.value.success, message: res.value.message };
        if (res.value.success) {
          newDirtyIbs.delete(res.value.ibId);
        }
      }
    });

    setSaveResults(newSaveResults);
    setDirtyIbs(newDirtyIbs);
    setIsSaving(false);

    if (newDirtyIbs.size === 0) {
      toast.success('Đã lưu toàn bộ thay đổi thành công!');
    } else {
      toast.warning('Lưu hoàn tất, nhưng có một số IB bị lỗi. Vui lòng kiểm tra lại.');
    }
  };

  const assetTypes = Object.values(AssetType);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Hoa Hồng Hàng Loạt (Bulk Edit)</h1>
          <p className="text-gray-500">Chỉnh sửa trực tiếp hoa hồng của nhiều IB cùng lúc.</p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={isSaving || dirtyIbs.size === 0}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Lưu tất cả ({dirtyIbs.size})
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col max-h-[70vh]">
        {isLoadingTree ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-500">Đang tải cấu trúc cây và dữ liệu hoa hồng...</p>
          </div>
        ) : flatIbs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Không có IB nào.</div>
        ) : (
          <div className="overflow-auto relative">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="px-4 py-3 border-b border-r border-gray-200 sticky left-0 bg-slate-50 z-30 w-64 shadow-[1px_0_0_0_#e5e7eb]">IB / Cấp</th>
                  <th className="px-4 py-3 border-b border-gray-200 w-32 text-center">Trạng thái</th>
                  {assetTypes.map(asset => (
                    <th key={asset} className="px-4 py-3 border-b border-gray-200 min-w-[140px] text-center">
                      {asset}
                      <div className="text-[10px] text-gray-400 font-normal mt-0.5">Hệ thống Max: {MAX_PIPS[asset]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {flatIbs.map(ib => {
                  const ibConfig = configs[ib.id];
                  const isDirty = dirtyIbs.has(ib.id);
                  const result = saveResults[ib.id];

                  return (
                    <tr key={ib.id} className={`hover:bg-blue-50/30 transition-colors ${isDirty ? 'bg-amber-50/20' : ''}`}>
                      <td className="px-4 py-2 border-r border-gray-100 sticky left-0 bg-white shadow-[1px_0_0_0_#f3f4f6] z-10">
                        <div className="font-medium text-gray-900 truncate" title={ib.email}>{ib.name || ib.email}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ib.level === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                            {ib.level === 0 ? 'MIB' : `Lv${ib.level}`}
                          </span>
                          {ib.id.substring(0, 8)}...
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center text-xs">
                        {result ? (
                          <span className={`px-2 py-1 rounded-full font-medium ${result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`} title={result.message}>
                            {result.success ? 'OK' : 'Lỗi'}
                          </span>
                        ) : isDirty ? (
                          <span className="text-amber-600 font-medium">Chưa lưu</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {assetTypes.map(asset => {
                        if (!ibConfig) {
                          return <td key={asset} className="px-4 py-2 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></td>;
                        }
                        
                        const assetConfig = ibConfig.assets.find(a => a.assetType === asset);
                        if (!assetConfig) {
                          return <td key={asset} className="px-4 py-2 text-center text-gray-400">—</td>;
                        }

                        const rawValue = (assetConfig as any).rawInput !== undefined ? (assetConfig as any).rawInput : assetConfig.rebatePips;
                        const isExceeding = assetConfig.rebatePips > assetConfig.maxPips;

                        return (
                          <td key={asset} className="px-2 py-2">
                            <div className="flex flex-col items-center">
                              <input
                                type="text"
                                value={rawValue}
                                onChange={(e) => handleCellChange(ib.id, asset, e.target.value)}
                                className={`w-full max-w-[80px] text-center px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
                                  isExceeding ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200'
                                }`}
                              />
                              <div className={`text-[10px] mt-1 ${isExceeding ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                Max: {assetConfig.maxPips}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
