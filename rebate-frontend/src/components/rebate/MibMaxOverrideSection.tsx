'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { ibApi } from '@/lib/api/ib';
import { rebateApi } from '@/lib/api/rebate';
import { normalizeTreeRoots } from '@/lib/tree-utils';
import { AssetType, MAX_PIPS, RebateType } from '@/types';

type OverrideRow = {
  assetType: AssetType;
  customMax: string;
};

const ASSET_TYPES = Object.values(AssetType);

export function MibMaxOverrideSection() {
  const { user } = useAuthStore();
  const [selectedMibId, setSelectedMibId] = useState('');
  const [rows, setRows] = useState<OverrideRow[]>(
    ASSET_TYPES.map((assetType) => ({ assetType, customMax: '' })),
  );
  const [saving, setSaving] = useState(false);

  const { data: treeRes } = useQuery({
    queryKey: ['ibTree', 'admin-mib-override'],
    queryFn: () => ibApi.getTree('all'),
    enabled: user?.role === 'ADMIN',
  });

  const mibs = useMemo(
    () => normalizeTreeRoots(treeRes?.data).filter((n) => n.level === 0),
    [treeRes?.data],
  );

  useEffect(() => {
    if (!selectedMibId && mibs.length > 0) {
      setSelectedMibId(mibs[0].id);
    }
  }, [mibs, selectedMibId]);

  useEffect(() => {
    if (!selectedMibId) return;
    rebateApi.getConfig(selectedMibId).then((res) => {
      if (!res.success) return;
      setRows(
        ASSET_TYPES.map((assetType) => {
          const cfg = res.data.assets.find(
            (a) => a.assetType === assetType && a.rebateType === RebateType.STP_REBATE,
          );
          const companyMax = MAX_PIPS[assetType];
          const custom =
            cfg && cfg.maxPips < companyMax ? String(cfg.maxPips) : '';
          return { assetType, customMax: custom };
        }),
      );
    });
  }, [selectedMibId]);

  const hasValidationError = rows.some((row) => {
    if (!row.customMax.trim()) return false;
    const val = Number(row.customMax);
    return Number.isNaN(val) || val > MAX_PIPS[row.assetType];
  });

  const handleSave = async () => {
    if (!selectedMibId || hasValidationError) return;
    const overrides = rows
      .filter((row) => row.customMax.trim() !== '')
      .map((row) => ({
        assetType: row.assetType,
        rebateType: RebateType.STP_REBATE,
        maxPips: Number(row.customMax),
      }));

    if (overrides.length === 0) {
      toast.error('Nhập ít nhất một trần tuỳ chỉnh');
      return;
    }

    setSaving(true);
    try {
      const res = await rebateApi.setMibMaxOverride(selectedMibId, overrides);
      if (res.success) {
        toast.success('Đã lưu trần tuỳ chỉnh cho MIB');
      } else {
        toast.error('Lưu thất bại');
      }
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(code ?? 'Không thể lưu trần tuỳ chỉnh');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'ADMIN') return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-lg font-bold text-gray-800">Trần hoa hồng theo MIB (chỉ Admin)</h2>
        <p className="text-sm text-gray-500 mt-1">
          Set trần tuỳ chỉnh thấp hơn trần công ty; để trống = dùng trần công ty.
        </p>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Chọn MIB</label>
          <select
            value={selectedMibId}
            onChange={(e) => setSelectedMibId(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            {mibs.map((mib) => (
              <option key={mib.id} value={mib.id}>
                {mib.name} ({mib.email})
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[480px]">
            <thead>
              <tr className="bg-gray-50 border-b text-sm font-bold text-gray-700">
                <th className="p-3">Asset Type</th>
                <th className="p-3">Trần công ty</th>
                <th className="p-3">Trần tuỳ chỉnh cho MIB này</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const companyMax = MAX_PIPS[row.assetType];
                const val = row.customMax.trim();
                const invalid = val !== '' && (Number.isNaN(Number(val)) || Number(val) > companyMax);
                return (
                  <tr key={row.assetType}>
                    <td className="p-3 font-medium">{row.assetType}</td>
                    <td className="p-3 text-gray-600">{companyMax}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        max={companyMax}
                        step="0.01"
                        value={row.customMax}
                        placeholder={`≤ ${companyMax}`}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r) =>
                              r.assetType === row.assetType
                                ? { ...r, customMax: e.target.value }
                                : r,
                            ),
                          )
                        }
                        className={`w-full max-w-[140px] px-2 py-1.5 border rounded-lg ${invalid ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {invalid && (
                        <p className="text-xs text-red-600 mt-1">
                          Không được vượt trần công ty ({companyMax})
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || hasValidationError || !selectedMibId}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>
    </div>
  );
}
