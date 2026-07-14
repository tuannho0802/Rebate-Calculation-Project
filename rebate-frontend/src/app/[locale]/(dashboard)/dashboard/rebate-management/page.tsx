'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { rebateApi } from '@/lib/api/rebate';
import { AssetType, RebateConfig, MAX_PIPS, IbTreeNode } from '@/types';
import { Loader2, Save, Table2, Sheet } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-messages';
import { normalizeTreeRoots, flattenIbTree } from '@/lib/tree-utils';

export default function RebateManagementPage() {
  const t = useTranslations('RebateManagement');
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'flat' | 'pivot'>('flat');
  const [configs, setConfigs] = useState<Record<string, RebateConfig>>({});
  const [dirtyIbs, setDirtyIbs] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveResults, setSaveResults] = useState<Record<string, { success: boolean; message: string }>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: treeRes, isLoading: isLoadingTree } = useQuery({
    queryKey: ['ibTree', 'all', 'rebate-management'],
    queryFn: () => ibApi.getTree('all'),
  });

  const roots = useMemo(() => normalizeTreeRoots(treeRes?.data), [treeRes?.data]);

  // Mỗi MIB (root) là 1 nhóm riêng — giữ nguyên dạng bảng cũ (dòng=IB, cột=Asset)
  // bên trong từng nhóm, chỉ tách khối hiển thị theo từng MIB thay vì gộp chung 1 bảng.
  const groups = useMemo(() => {
    return roots.map(root => ({
      root,
      ibs: flattenIbTree(root).filter(ib => ib.level > 0),
    }));
  }, [roots]);

  const flatIbs = useMemo(() => groups.flatMap(g => g.ibs), [groups]);

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
          return { ...asset, rebatePips: Number.isNaN(parsed) ? 0 : parsed, rawInput: value };
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

    const items = Array.from(dirtyIbs).map((ibId) => {
      const ibConfig = configs[ibId];
      const cleanAssets = ibConfig.assets.map(({ rawInput, ...rest }: RebateConfig['assets'][number] & { rawInput?: string }) => rest);
      return { ibId, assets: cleanAssets };
    });

    try {
      const bulkResult = await rebateApi.bulkUpdateConfig(items);

      const newSaveResults: Record<string, { success: boolean; message: string }> = {};
      const newDirtyIbs = new Set(dirtyIbs);
      const newConfigs = { ...configs };

      bulkResult.results.forEach((result) => {
        newSaveResults[result.ibId] = {
          success: result.success,
          message: result.success
            ? t('saveSuccess')
            : getErrorMessage(result.error?.code || 'INTERNAL_ERROR', result.error?.message),
        };
        if (result.success) {
          newDirtyIbs.delete(result.ibId);
          if (result.config) {
            newConfigs[result.ibId] = result.config;
          }
        }
      });

      setSaveResults(newSaveResults);
      setDirtyIbs(newDirtyIbs);
      setConfigs(newConfigs);

      if (newDirtyIbs.size === 0) {
        toast.success(t('saveAllSuccess'));
      } else {
        toast.warning(t('savePartialWarning'));
      }
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code || 'INTERNAL_ERROR';
      toast.error(getErrorMessage(code));
    } finally {
      setIsSaving(false);
    }
  };

  const assetTypes = Object.values(AssetType);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(v => (v === 'flat' ? 'pivot' : 'flat'))}
            className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {viewMode === 'flat' ? <Sheet className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
            {viewMode === 'flat' ? 'Xem dạng Google Sheet' : 'Xem dạng bảng'}
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isSaving || dirtyIbs.size === 0}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('saveAll', { count: dirtyIbs.size })}
          </button>
        </div>
      </div>

      {isLoadingTree ? (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-500">{t('loading')}</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-12 text-center text-gray-500">{t('noIbs')}</div>
      ) : (
        // Mỗi MIB (root) là 1 khối bảng riêng biệt, xếp xuống — không gộp chung mọi MIB vào 1 bảng.
        groups.map(({ root, ibs }) => (
          <div key={root.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col max-h-[70vh]">
            <div className="px-4 py-3 border-b border-gray-200 bg-indigo-50/50 flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">MIB</span>
              <span className="font-semibold text-gray-900">{root.name || root.email}</span>
              <span className="text-xs text-gray-500">({root.email})</span>
            </div>
            {ibs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">{t('noIbs')}</div>
            ) : viewMode === 'pivot' ? (
              <PivotTable
                ibs={ibs}
                assetTypes={assetTypes}
                configs={configs}
                dirtyIbs={dirtyIbs}
                handleCellChange={handleCellChange}
              />
            ) : (
              <div className="overflow-auto relative">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-20 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 border-b border-r border-gray-200 sticky left-0 bg-slate-50 z-30 w-64 shadow-[1px_0_0_0_#e5e7eb]">{t('colIb')}</th>
                      <th className="px-4 py-3 border-b border-gray-200 w-32 text-center">{t('colStatus')}</th>
                      {assetTypes.map(asset => (
                        <th key={asset} className="px-4 py-3 border-b border-gray-200 min-w-[140px] text-center">
                          {asset}
                          <div className="text-[10px] text-gray-400 font-normal mt-0.5">{t('systemMax', { max: MAX_PIPS[asset] })}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ibs.map(ib => {
                      const ibConfig = configs[ib.id];
                      const isDirty = dirtyIbs.has(ib.id);
                      const result = saveResults[ib.id];

                      return (
                        <tr key={ib.id} className={`hover:bg-blue-50/30 transition-colors ${isDirty ? 'bg-amber-50/20' : ''}`}>
                          <td className="px-4 py-2 border-r border-gray-100 sticky left-0 bg-white shadow-[1px_0_0_0_#f3f4f6] z-10">
                            <div className="font-medium text-gray-900 truncate" title={ib.email}>{ib.name || ib.email}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                                {`Lv${ib.level}`}
                              </span>
                              {ib.id.substring(0, 8)}...
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center text-xs">
                            {result ? (
                              <span className={`px-2 py-1 rounded-full font-medium ${result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`} title={result.message}>
                                {result.success ? t('statusOk') : t('statusError')}
                              </span>
                            ) : isDirty ? (
                              <span className="text-amber-600 font-medium">{t('statusUnsaved')}</span>
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

                            const rawValue = (assetConfig as RebateConfig['assets'][number] & { rawInput?: string }).rawInput !== undefined
                              ? (assetConfig as RebateConfig['assets'][number] & { rawInput?: string }).rawInput
                              : assetConfig.rebatePips;
                            const isExceeding = assetConfig.rebatePips > assetConfig.maxPips;

                            return (
                              <td key={asset} className="px-2 py-2">
                                <div className="flex flex-col items-center">
                                  <input
                                    type="text"
                                    value={rawValue}
                                    onChange={(e) => handleCellChange(ib.id, asset, e.target.value)}
                                    className={`w-full max-w-[80px] text-center px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${isExceeding ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200'
                                      }`}
                                  />
                                  <div className={`text-[10px] mt-1 ${isExceeding ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                    {t('maxLabel', { max: assetConfig.maxPips })}
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
        ))
      )}
    </div>
  );
}

/**
 * Bảng dạng Google Sheet mẫu: dòng = Asset Type, cột = từng Level trong nhánh MIB,
 * cột cuối = Hệ thống Max (MAX_PIPS, hằng số công ty). Nếu 1 level có nhiều IB cùng
 * cấp (rẽ nhánh), mỗi IB hiện thành 1 ô input nhỏ xếp chồng trong cùng 1 cột, kèm tên
 * để phân biệt — không gộp/ghi đè lẫn nhau.
 */
function PivotTable({
  ibs,
  assetTypes,
  configs,
  dirtyIbs,
  handleCellChange,
}: {
  ibs: IbTreeNode[];
  assetTypes: AssetType[];
  configs: Record<string, RebateConfig>;
  dirtyIbs: Set<string>;
  handleCellChange: (ibId: string, assetType: AssetType, value: string) => void;
}) {
  const maxLevel = ibs.reduce((max, ib) => Math.max(max, ib.level), 0);
  const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);
  const ibsByLevel = (lvl: number) => ibs.filter(ib => ib.level === lvl);

  return (
    <div className="overflow-auto relative">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-20 shadow-sm">
          <tr>
            <th className="px-4 py-3 border-b border-r border-gray-200 sticky left-0 bg-slate-50 z-30 w-40 shadow-[1px_0_0_0_#e5e7eb]">
              Asset Type
            </th>
            {levels.map(lvl => (
              <th key={lvl} className="px-4 py-3 border-b border-gray-200 min-w-[140px] text-center">
                Level {lvl}
              </th>
            ))}
            <th className="px-4 py-3 border-b border-gray-200 min-w-[110px] text-center bg-emerald-50 text-emerald-700">
              Hệ thống Max
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {assetTypes.map(asset => (
            <tr key={asset} className="hover:bg-blue-50/30 transition-colors">
              <td className="px-4 py-2 border-r border-gray-100 sticky left-0 bg-white shadow-[1px_0_0_0_#f3f4f6] z-10 font-medium text-gray-900">
                {asset}
              </td>
              {levels.map(lvl => (
                <td key={lvl} className="px-2 py-2">
                  <div className="flex flex-col gap-2">
                    {ibsByLevel(lvl).map(ib => {
                      const ibConfig = configs[ib.id];
                      if (!ibConfig) {
                        return <Loader2 key={ib.id} className="h-4 w-4 animate-spin mx-auto text-gray-300" />;
                      }
                      const assetConfig = ibConfig.assets.find(a => a.assetType === asset);
                      if (!assetConfig) {
                        return <div key={ib.id} className="text-center text-gray-300 text-xs">—</div>;
                      }
                      const rawValue = (assetConfig as RebateConfig['assets'][number] & { rawInput?: string }).rawInput !== undefined
                        ? (assetConfig as RebateConfig['assets'][number] & { rawInput?: string }).rawInput
                        : assetConfig.rebatePips;
                      const isExceeding = assetConfig.rebatePips > assetConfig.maxPips;
                      const isDirty = dirtyIbs.has(ib.id);
                      return (
                        <div key={ib.id} className="flex flex-col items-center">
                          <input
                            type="text"
                            value={rawValue}
                            onChange={(e) => handleCellChange(ib.id, asset, e.target.value)}
                            className={`w-full max-w-[80px] text-center px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${isExceeding ? 'border-red-400 bg-red-50 text-red-700' : isDirty ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'
                              }`}
                          />
                          <span className="text-[9px] text-gray-400 truncate max-w-[90px]" title={ib.email}>
                            {ib.name || ib.email}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </td>
              ))}
              <td className="px-4 py-2 text-center font-semibold text-emerald-700 bg-emerald-50/40">
                {MAX_PIPS[asset]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}