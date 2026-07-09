'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMutation } from '@tanstack/react-query';
import { rebateApi } from '@/lib/api/rebate';
import { ibApi } from '@/lib/api/ib';
import { useAuthStore } from '@/store/auth.store';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import { AssetType, IbNode, RebateAssetConfig } from '@/types';
import { AccountTypeTable, MarkupLinkRow } from '@/components/rebate/AccountTypeBuilder';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from 'sonner';

export default function EditIbRebatePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const { user } = useAuthStore();
  
  const [tables, setTables] = useState<AccountTypeTable[]>([]);
  // We'll store separate Rebate and Markup values for each table row.
  // Keys are `${tableId}_${assetType}_rebate` and `${tableId}_${assetType}_markup`.
  const [rebateValues, setRebateValues] = useState<Record<string, string>>({});
  const [markupValues, setMarkupValues] = useState<Record<string, string>>({});

  const [mounted, setMounted] = useState(false);
  const [subIbAccountType, setSubIbAccountType] = useState('SEA STD');
  const [markupLinks, setMarkupLinks] = useState<MarkupLinkRow[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('accountTypeTemplates');
    if (saved) {
      try {
        setTables(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse templates', e);
      }
    }

    const storedTypes = JSON.parse(localStorage.getItem('ibAccountTypes') || '{}');
    setSubIbAccountType(storedTypes[id] || 'SEA STD');

    const savedMarkupLinks = localStorage.getItem('markupLinkTemplates');
    if (savedMarkupLinks) {
      try {
        setMarkupLinks(JSON.parse(savedMarkupLinks));
      } catch (e) {
        console.error('Failed to parse markupLinkTemplates', e);
      }
    }
  }, [id]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [saveSuccess, setSaveSuccess] = useState(false);

  const updateConfigMutation = useMutation({
    mutationFn: (assets: RebateAssetConfig[]) => rebateApi.updateConfig(id, { assets }),
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

  const getRebateMax = (_assetType: string, originalMax: string) => {
    return originalMax;
  };

  const normalizeKey = (value: string | undefined) => {
    return String(value ?? '').trim().toLowerCase();
  };

  const readStoredAccountType = (ibId: string) => {
    if (typeof window === 'undefined') return 'SEA STD';
    const storedTypes = JSON.parse(localStorage.getItem('ibAccountTypes') || '{}');
    return storedTypes[ibId] || 'SEA STD';
  };

  const readSavedMarkupLinks = () => {
    if (typeof window === 'undefined') return [] as MarkupLinkRow[];
    try {
      return JSON.parse(localStorage.getItem('markupLinkTemplates') || '[]') as MarkupLinkRow[];
    } catch {
      return [];
    }
  };

  const getMarkupMax = (assetType: string) => {
    const accountType = normalizeKey(subIbAccountType || readStoredAccountType(id));
    const links = markupLinks.length > 0 ? markupLinks : readSavedMarkupLinks();
    const link = links.find((linkItem) => normalizeKey(linkItem.name) === accountType);
    if (link) {
      return String(link.share ?? '0');
    }

    return links.length > 0 ? String(links[0].share ?? '0') : '0';
  };

  const getRowError = (tableId: string, row: AccountTypeTable['rows'][number]) => {
    const rebateVal = rebateValues[`${tableId}_${row.assetType}_rebate`] || '0';
    const markupVal = markupValues[`${tableId}_${row.assetType}_markup`] || '0';
    const parsedRebate = parsePipsValue(rebateVal);
    const parsedMarkup = parsePipsValue(markupVal);
    const rebateMax = parsePipsValue(getRebateMax(row.assetType, row.maxCeiling));
    const markupMax = parsePipsValue(getMarkupMax(row.assetType));

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
        assetType: row.assetType as AssetType,
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
          Lựa chọn gói phí và chia sẻ hoa hồng cho IB tuyến dưới (IB ID: <span className="font-mono text-gray-700">{id}</span>)
        </p>
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
