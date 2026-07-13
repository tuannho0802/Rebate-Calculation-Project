'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMutation } from '@tanstack/react-query';
import { rebateApi } from '@/lib/api/rebate';
import { rebateTemplateApi } from '@/lib/api/rebateTemplates';
import { ibApi } from '@/lib/api/ib';
import { useAuthStore } from '@/store/auth.store';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import { AssetType, IbNode, RebateAssetConfig, RebateConfig } from '@/types';
import { AccountTypeTable, MarkupLinkRow } from '@/components/rebate/AccountTypeBuilder';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from 'sonner';

export default function EditIbRebatePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { user } = useAuthStore();
  
  useEffect(() => {
    try {
      console.log('EditIbRebatePage target IB', { targetId: id, configPath: `/rebate/config/${id}` });
    } catch (e) {
      // ignore logging errors
    }
  }, [id]);
  
  const [tables, setTables] = useState<AccountTypeTable[]>([]);
  const [mounted, setMounted] = useState(false);
  // We'll store separate Rebate and Markup values for each table row.
  // Keys are `${tableId}_${assetType}_rebate` and `${tableId}_${assetType}_markup`.
  const [rebateValues, setRebateValues] = useState<Record<string, string>>({});
  const [markupValues, setMarkupValues] = useState<Record<string, string>>({});

  const [profile, setProfile] = useState<IbNode | null>(null);
  const [currentUserConfig, setCurrentUserConfig] = useState<RebateConfig | null>(null);
  const [subIbAccountType, setSubIbAccountType] = useState('Markup 0%');
  const [markupLinks, setMarkupLinks] = useState<MarkupLinkRow[]>([]);

  const [targetIb, setTargetIb] = useState<IbNode | null>(null);

  useEffect(() => {
    setMounted(true);

    if (!user?.id) return;

    const loadTemplates = async () => {
      try {
        const [profileRes, configRes, templatesRes, targetRes, targetConfigRes] = await Promise.all([
          ibApi.getMe().catch(() => null),
          rebateApi.getConfig(user.id).catch(() => null),
          rebateTemplateApi.getTemplates(user.id).catch(() => null),
          ibApi.getById(id).catch(() => null),
          rebateApi.getConfig(id).catch(() => null),
        ]);

        if (profileRes?.data) setProfile(profileRes.data);
        if (configRes?.data) setCurrentUserConfig(configRes.data);
        
        let loadedTables: AccountTypeTable[] = [];
        if (templatesRes?.data) {
          loadedTables = templatesRes.data.accountTypeTemplates.map((table: any) => ({
            id: table.id,
            name: table.name,
            rows: table.rows.map((row: any) => ({
              id: `${table.id}-${row.assetType}-${Math.random().toString(36).substr(2, 5)}`,
              assetType: row.assetType,
              maxCeiling: row.maxCeiling,
              calcUnit: row.calcUnit,
            })),
          }));
          setTables(loadedTables);
          setMarkupLinks(templatesRes.data.markupLinkTemplates);
        }
        
        if (targetRes?.data) {
          setTargetIb(targetRes.data);
          setSubIbAccountType(targetRes.data.accountType || 'Markup 0%');
        }

        if (targetConfigRes?.data?.assets && loadedTables.length > 0) {
          const initialRebate: Record<string, string> = {};
          const initialMarkup: Record<string, string> = {};
          
          loadedTables.forEach((table) => {
            table.rows.forEach((row) => {
              const assetConfig = targetConfigRes.data.assets.find(
                (a: RebateAssetConfig) => a.assetType.toUpperCase() === row.assetType.toUpperCase().trim()
              );
              if (assetConfig) {
                initialRebate[`${table.id}_${row.assetType}_rebate`] = String(assetConfig.rebatePips);
                initialMarkup[`${table.id}_${row.assetType}_markup`] = String(assetConfig.markupPips);
              }
            });
          });
          
          setRebateValues(initialRebate);
          setMarkupValues(initialMarkup);
        }

      } catch (error) {
        console.error('Failed to load rebate templates or IB details', error);
      }
    };

    loadTemplates();
  }, [id, user?.id]);


  const [saveSuccess, setSaveSuccess] = useState(false);

  const updateConfigMutation = useMutation({
    mutationFn: (assets: RebateAssetConfig[]) => rebateApi.updateConfig(id, assets),
    onSuccess: (res) => {
      if (res.success) {
        setSaveSuccess(true);
        toast.success('Cập nhật cấu hình hoa hồng thành công');
        setTimeout(() => {
          router.push('/dashboard/tree');
        }, 1200);
      } else {
        toast.error(getErrorMessage((res as any).error?.code));
      }
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR'));
    }
  });

  const updateAccountTypeMutation = useMutation({
    mutationFn: (newType: string) => ibApi.update(id, { accountType: newType }),
    onSuccess: (res, variables) => {
      if (res.success) {
        setSubIbAccountType(variables);
        toast.success('Cập nhật Loại tài khoản (Link) thành công');
      } else {
        toast.error(getErrorMessage((res as any).error?.code));
      }
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR'));
    }
  });

  if (!mounted) return null;

  const parsePipsValue = (value: string) => {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const handleRebateChange = (tableId: string, assetType: string, value: string) => {
    if (value && !/^\d*\.?\d*$/.test(value)) return;
    setSaveSuccess(false);
    setRebateValues(prev => ({ ...prev, [`${tableId}_${assetType}_rebate`]: value }));
  };

  const handleMarkupChange = (tableId: string, assetType: string, value: string) => {
    if (value && !/^\d*\.?\d*$/.test(value)) return;
    setSaveSuccess(false);
    setMarkupValues(prev => ({ ...prev, [`${tableId}_${assetType}_markup`]: value }));
  };

  const getRebateMax = (assetType: string, originalMax: string) => {
    if (!profile) return originalMax;
    if (profile.parentId === null) {
      return originalMax;
    }

    const normalizedAssetType = assetType.toUpperCase().trim();
    const assetConfig = currentUserConfig?.assets?.find((a: RebateAssetConfig) => a.assetType.toUpperCase() === normalizedAssetType);
    return assetConfig ? String(assetConfig.rebatePips ?? originalMax) : originalMax;
  };

  const getMarkupMax = (assetType: string) => {
    if (!profile) return '0';

    if (profile.parentId === null) {
      const accountType = subIbAccountType || 'Markup 0%';
      if (accountType === 'Markup 0%') return '0';
      
      const link = markupLinks.find((linkItem) => linkItem.name === accountType);
      if (link && link.share !== undefined && link.share !== null) {
        return String(link.share);
      }
      if (markupLinks.length > 0) {
        return String(markupLinks[0].share ?? '0');
      }
      return '0';
    }

    const normalizedAssetType = assetType.toUpperCase().trim();
    const assetConfig = currentUserConfig?.assets?.find((a: RebateAssetConfig) => a.assetType.toUpperCase() === normalizedAssetType);
    return assetConfig ? String(assetConfig.markupPips ?? '0') : '0';
  };

  const getRowError = (tableId: string, row: AccountTypeTable['rows'][number]) => {
    const rebateVal = rebateValues[`${tableId}_${row.assetType}_rebate`] || '0';
    const markupVal = markupValues[`${tableId}_${row.assetType}_markup`] || '0';
    const parsedRebate = parsePipsValue(rebateVal);
    const parsedMarkup = parsePipsValue(markupVal);
    const rebateMax = parsePipsValue(getRebateMax(row.assetType, row.maxCeiling));
    const markupMax = parsePipsValue(getMarkupMax(row.assetType));
    if (process.env.NODE_ENV === 'development') {
      console.log('getRowError debug', { row: row.assetType, accountType: subIbAccountType, markupLinks, markupMax });
    }

    if (parsedRebate > rebateMax) {
      return `Rebate không được vượt quá ${rebateMax}.`;
    }
    if (parsedMarkup > markupMax) {
      return `Markup không được vượt quá ${markupMax}.`;
    }

    return '';
  };

  const handleSave = (tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const assetsToUpdate: RebateAssetConfig[] = [];
    let hasError = false;

    for (const row of table.rows) {
      const rebateVal = rebateValues[`${tableId}_${row.assetType}_rebate`] || '0';
      const markupVal = markupValues[`${tableId}_${row.assetType}_markup`] || '0';
      const parsedRebate = parsePipsValue(rebateVal);
      const parsedMarkup = parsePipsValue(markupVal);
      const rebateMax = parsePipsValue(getRebateMax(row.assetType, row.maxCeiling));
      const markupMax = parsePipsValue(getMarkupMax(row.assetType));

      if (parsedRebate > rebateMax) {
        toast.error(`Rebate ${row.assetType} không được vượt quá ${rebateMax}.`);
        hasError = true;
        break;
      }
      if (parsedMarkup > markupMax) {
        toast.error(`Markup ${row.assetType} không được vượt quá ${markupMax}.`);
        hasError = true;
        break;
      }

      assetsToUpdate.push({
        assetType: row.assetType.toUpperCase().trim() as AssetType,
        rebateType: 'STP_REBATE',
        rebatePips: parsedRebate,
        markupPips: parsedMarkup,
        maxPips: rebateMax + markupMax,
        markupPercent: 100,
      });
    }

    if (!hasError && assetsToUpdate.length > 0) {
      updateConfigMutation.mutate(assetsToUpdate);
    }
  };

  if (!mounted) return null;

  if (tables.length === 0) {
    return (
      <div className="space-y-6">
        <button onClick={() => router.back()} className="flex items-center text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
        </button>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có Bảng Gói phí (Account Type) nào</h3>
          <p className="text-gray-500 mb-6">Vui lòng vào trang Cấu Hình để tạo các bảng mẫu trước khi chia sẻ cho Sub-IB.</p>
          <button
            onClick={() => router.push('/dashboard/rebate')}
            className="px-6 py-2.5 bg-[#0066ff] text-white rounded-xl font-medium hover:bg-[#0052cc] transition-colors shadow-md shadow-blue-500/20"
          >
            Đến trang Cấu Hình
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <button onClick={() => router.back()} className="flex items-center text-gray-500 hover:text-gray-900 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại Mạng lưới IB
        </button>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Chỉnh sửa Hoa Hồng Sub-IB</h1>
        <p className="text-gray-500 mt-1">
          Lựa chọn gói phí và chia sẻ hoa hồng cho IB tuyến dưới (IB: <span className="font-semibold text-[#0066ff]">{targetIb ? (targetIb.name ? `${targetIb.name} - ${targetIb.email}` : targetIb.email) : id}</span>)
        </p>
        
        <div className="mt-6 flex items-center gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
          <label className="text-sm font-semibold text-gray-800">Loại tài khoản (Link Markup):</label>
          <div className="relative flex items-center gap-3">
            <select
              value={subIbAccountType}
              onChange={(e) => updateAccountTypeMutation.mutate(e.target.value)}
              disabled={updateAccountTypeMutation.isPending || markupLinks.length === 0 || profile?.parentId !== null}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066ff] focus:border-[#0066ff] text-sm font-medium disabled:opacity-50 min-w-[200px]"
            >
              {markupLinks.map((link) => (
                <option key={link.id} value={link.name}>{link.name}</option>
              ))}
              {!markupLinks.some(l => l.name === subIbAccountType) && (
                <option value={subIbAccountType}>{subIbAccountType}</option>
              )}
            </select>
            {updateAccountTypeMutation.isPending && <Loader2 className="h-5 w-5 animate-spin text-[#0066ff]" />}
          </div>
          <p className="text-xs text-gray-500 ml-2">Bạn có thể đổi Link Markup (sẽ thay đổi Markup Max bên dưới).</p>
        </div>
      </div>

      <div className="grid gap-8">
        {tables.map((table) => (
          <div key={table.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">{table.name}</h3>
              <button
                onClick={() => handleSave(table.id)}
                disabled={updateConfigMutation.isPending || table.rows.length === 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md disabled:opacity-50 ${saveSuccess ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20 text-white' : 'bg-[#0066ff] hover:bg-[#0052cc] shadow-blue-500/20 text-white'}`}
              >
                {updateConfigMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {saveSuccess ? 'Đã lưu thành công' : 'Lưu Bảng Này'}
              </button>
            </div>
            
            {table.rows.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Bảng này chưa có dữ liệu.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4">Sản Phẩm (Asset Type / Symbol)</th>
                      <th className="px-6 py-4">Tổng (Total)</th>
                      <th className="px-6 py-4 w-48">Chia sẻ (Share)</th>
                      <th className="px-6 py-4">Đơn Vị Tính (Calculation Unit)</th>
                      <th className="px-6 py-4 text-right">Còn lại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {table.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {row.assetType}
                        </td>
                        <td className="px-6 py-4 text-gray-500 font-medium">
                          <div className="space-y-1">
                            <div className="text-sm text-gray-700">Rebate Max: {getRebateMax(row.assetType, row.maxCeiling)}</div>
                            <div className="text-sm text-gray-700">Markup Max: {getMarkupMax(row.assetType)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="grid gap-2">
                            <input
                              type="text"
                              value={rebateValues[`${table.id}_${row.assetType}_rebate`] || ''}
                              onChange={(e) => handleRebateChange(table.id, row.assetType, e.target.value)}
                              placeholder="Rebate Pips"
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0066ff]/50 focus:border-[#0066ff] transition-all ${getRowError(table.id, row) ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
                            />
                            <input
                              type="text"
                              value={markupValues[`${table.id}_${row.assetType}_markup`] || ''}
                              onChange={(e) => handleMarkupChange(table.id, row.assetType, e.target.value)}
                              placeholder="Markup Pips"
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0066ff]/50 focus:border-[#0066ff] transition-all ${getRowError(table.id, row) ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
                            />
                            {getRowError(table.id, row) ? (
                              <p className="text-xs text-red-600 font-medium">{getRowError(table.id, row)}</p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {row.calcUnit}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-700 font-semibold">
                          {(() => {
                            const rebateVal = rebateValues[`${table.id}_${row.assetType}_rebate`] || '0';
                            const markupVal = markupValues[`${table.id}_${row.assetType}_markup`] || '0';
                            const parsedRebate = parsePipsValue(rebateVal);
                            const parsedMarkup = parsePipsValue(markupVal);
                            const rebateMax = parsePipsValue(getRebateMax(row.assetType, row.maxCeiling));
                            const markupMax = parsePipsValue(getMarkupMax(row.assetType));
                            const remaining = rebateMax + markupMax - (parsedRebate + parsedMarkup);
                            return remaining >= 0 ? remaining.toFixed(1) : '0.0';
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
