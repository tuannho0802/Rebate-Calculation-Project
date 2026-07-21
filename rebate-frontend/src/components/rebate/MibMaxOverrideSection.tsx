'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { ibApi } from '@/lib/api/ib';
import { rebateApi } from '@/lib/api/rebate';
import { normalizeTreeRoots } from '@/lib/tree-utils';
import { AssetType, RebateType } from '@/types';

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
          const custom = cfg ? String(cfg.maxPips) : '';
          return { assetType, customMax: custom };
        }),
      );
    });
  }, [selectedMibId]);

  const hasValidationError = rows.some((row) => {
    if (!row.customMax.trim()) return false;
    const val = Number(row.customMax);
    return Number.isNaN(val) || val < 0;
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
    <div className="bg-white rounded-xl border border-amber-200/80 shadow-sm p-4 space-y-4">
      <h3 className="text-lg font-extrabold text-gray-900">
        Tuỳ chỉnh Max Rebate (Pips/USD) cho MIB
      </h3>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-bold text-gray-700">Chọn MIB:</label>
          <select
            value={selectedMibId}
            onChange={(e) => setSelectedMibId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-amber-500"
          >
            {mibs.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email} ({m.email})
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-amber-50/80 text-gray-800 font-extrabold border-b border-amber-200/80">
              <tr>
                <th className="p-3">Sản phẩm</th>
                <th className="p-3">Mức Max Pips (Để trống = mặc định)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const val = row.customMax.trim();
                const invalid = val !== '' && (Number.isNaN(Number(val)) || Number(val) < 0);
                return (
                  <tr key={row.assetType} className="hover:bg-amber-50/40 transition-colors">
                    <td className="p-3 font-bold text-gray-900">{row.assetType}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.customMax}
                        placeholder="Tuỳ chỉnh (>= 0)"
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r) =>
                              r.assetType === row.assetType
                                ? { ...r, customMax: e.target.value }
                                : r,
                            ),
                          )
                        }
                        className={`w-full max-w-[140px] px-3 py-1.5 border rounded-lg font-medium text-gray-900 ${invalid ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {invalid && (
                        <p className="text-xs text-red-600 mt-1 font-semibold">Giá trị phải &gt;= 0</p>
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
          className="px-5 py-2 bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] text-gray-900 rounded-lg font-extrabold hover:opacity-95 shadow-md disabled:opacity-50"
        >
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>
    </div>
  );
}
