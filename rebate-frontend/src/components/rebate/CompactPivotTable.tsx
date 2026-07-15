'use client';

/**
 * CompactPivotTable — View thứ 3 "Bảng gọn"
 *
 * Cấu trúc: HÀNG = Asset Type, CỘT = Level (MIB, Level 1, Level 2, ...).
 * Mỗi cột Level có <select> ở header để chọn IB hiển thị trong cột đó.
 * Dùng chung configs / dirtyIbs / handleCellChange với 2 view còn lại —
 * KHÔNG có fetch riêng, KHÔNG có luồng save riêng.
 *
 * Selection state (Record<rootId, Record<level, ibId>>) được lift up sang
 * RebateManagementPage để persist khi switch view.
 */

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AssetType, IbTreeNode, RebateConfig, MAX_PIPS } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * compactSelection[rootId][level] = ibId hiện đang được chọn ở cột level đó.
 * Nested object thay vì flat key để truy xuất rõ ràng hơn.
 */
export type CompactSelection = Record<string, Record<number, string>>;

export interface CompactPivotTableProps {
  rootId: string;
  ibs: IbTreeNode[];                                   // flattenIbTree(root).filter(lv>0)
  assetTypes: AssetType[];
  configs: Record<string, RebateConfig>;               // shared state
  dirtyIbs: Set<string>;
  handleCellChange: (ibId: string, assetType: AssetType, value: string) => void;
  getMibMaxDisplay: (mibId: string, assetType: AssetType) => number | null;
  parentById: Record<string, string | null>;
  ibNodesById: Record<string, IbTreeNode>;
  selection: CompactSelection;                         // lifted-up selection state
  onSelectionChange: (rootId: string, level: number, ibId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Danh sách IB thuộc (rootId, level) — lọc từ ibs prop đã có sẵn. */
function ibsAtLevel(ibs: IbTreeNode[], level: number): IbTreeNode[] {
  return ibs.filter(ib => ib.level === level);
}

/** Label cho option trong <select>: "IB Name (↑ Parent Name)" */
function selectLabel(ib: IbTreeNode, parentById: Record<string, string | null>, ibNodesById: Record<string, IbTreeNode>): string {
  const name = ib.name ?? ib.email;
  const parentId = parentById[ib.id];
  if (!parentId) return name;
  const parent = ibNodesById[parentId];
  if (!parent) return name;
  const parentName = parent.name ?? parent.email;
  return `${name} (↑ ${parentName})`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CompactPivotTable({
  rootId,
  ibs,
  assetTypes,
  configs,
  dirtyIbs,
  handleCellChange,
  getMibMaxDisplay,
  parentById,
  ibNodesById,
  selection,
  onSelectionChange,
}: CompactPivotTableProps) {
  const t = useTranslations('RebateManagement');

  // Tập hợp các level có ít nhất 1 IB
  const maxLevel = ibs.reduce((acc, ib) => Math.max(acc, ib.level), 0);
  const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);

  // Lấy IB đang được chọn ở (rootId, level) — fallback về IB đầu tiên nếu chưa có
  const selectedIbId = (level: number): string | undefined => {
    const stored = selection[rootId]?.[level];
    if (stored) return stored;
    return ibsAtLevel(ibs, level)[0]?.id;
  };

  return (
    <div className="overflow-auto relative">
      <table className="w-full text-sm text-left border-collapse">

        {/* ── Header ── */}
        <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-20 shadow-sm">
          <tr>
            {/* Col 0: Asset Type label */}
            <th className="px-4 py-3 border-b border-r border-gray-200 sticky left-0 bg-slate-50 z-30 w-40 shadow-[1px_0_0_0_#e5e7eb]">
              Asset Type
            </th>

            {/* Col 1: MIB (read-only ceiling) */}
            <th className="px-4 py-3 border-b border-gray-200 min-w-[120px] text-center">
              <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">MIB</div>
              <div className="text-[10px] font-normal text-gray-400 mt-0.5">trần override</div>
            </th>

            {/* Col 2..N: Level với <select> chọn IB */}
            {levels.map(lvl => {
              const candidates = ibsAtLevel(ibs, lvl);
              const current = selectedIbId(lvl);
              return (
                <th key={lvl} className="px-3 py-2 border-b border-gray-200 min-w-[160px] text-center">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Level {lvl}
                  </div>
                  {candidates.length === 0 ? (
                    <span className="text-[10px] text-gray-400">—</span>
                  ) : candidates.length === 1 ? (
                    /* Chỉ 1 IB → không cần select, hiện tên luôn */
                    <span className="text-[10px] font-medium text-gray-600 block truncate max-w-[140px] mx-auto" title={candidates[0].email}>
                      {candidates[0].name ?? candidates[0].email}
                    </span>
                  ) : (
                    /* Nhiều IB → select có grouping theo cha */
                    <select
                      value={current ?? ''}
                      onChange={e => onSelectionChange(rootId, lvl, e.target.value)}
                      className="w-full max-w-[150px] px-2 py-1 text-[11px] border border-gray-300 rounded-lg bg-white font-normal focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {candidates.map(ib => (
                        <option key={ib.id} value={ib.id}>
                          {selectLabel(ib, parentById, ibNodesById)}
                        </option>
                      ))}
                    </select>
                  )}
                </th>
              );
            })}

            {/* Col cuối: Company cap tham chiếu */}
            <th className="px-4 py-3 border-b border-gray-200 min-w-[120px] text-center bg-emerald-50 text-emerald-700">
              {t('capColumn')}
            </th>
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody className="divide-y divide-gray-100">
          {assetTypes.map(asset => {
            const companyMax = MAX_PIPS[asset];
            const mibMax = getMibMaxDisplay(rootId, asset);
            const isOverride = mibMax !== null && mibMax !== companyMax;

            return (
              <tr key={asset} className="hover:bg-blue-50/20 transition-colors">

                {/* Col 0: Asset Type */}
                <td className="px-4 py-3 border-r border-gray-100 sticky left-0 bg-white shadow-[1px_0_0_0_#f3f4f6] z-10 font-medium text-gray-900">
                  {asset}
                </td>

                {/* Col 1: MIB ceiling — read-only */}
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`text-sm font-bold ${isOverride ? 'text-amber-700' : 'text-indigo-600'}`}>
                      {mibMax ?? '—'}
                    </span>
                    {isOverride && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                        {t('overrideBadge')}
                      </span>
                    )}
                    {!isOverride && (
                      <span className="text-[10px] text-gray-400">company max</span>
                    )}
                  </div>
                </td>

                {/* Col 2..N: 1 ô input per level (IB đang được chọn) */}
                {levels.map(lvl => {
                  const ibId = selectedIbId(lvl);

                  if (!ibId) {
                    return (
                      <td key={lvl} className="px-4 py-3 text-center text-gray-300 text-xs">—</td>
                    );
                  }

                  const ibConfig = configs[ibId];
                  if (!ibConfig) {
                    return (
                      <td key={lvl} className="px-4 py-3 text-center">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-300" />
                      </td>
                    );
                  }

                  const assetConfig = ibConfig.assets.find(a => a.assetType === asset);
                  if (!assetConfig) {
                    return (
                      <td key={lvl} className="px-4 py-3 text-center text-gray-300 text-xs">—</td>
                    );
                  }

                  // rawInput: giá trị đang nhập chưa lưu (nếu có), fallback về rebatePips
                  const rawValue =
                    (assetConfig as RebateConfig['assets'][number] & { rawInput?: string }).rawInput !== undefined
                      ? (assetConfig as RebateConfig['assets'][number] & { rawInput?: string }).rawInput!
                      : String(assetConfig.rebatePips);

                  const isExceeding = assetConfig.rebatePips > assetConfig.maxPips;
                  const isDirty = dirtyIbs.has(ibId);

                  return (
                    <td key={lvl} className="px-3 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <input
                          type="text"
                          value={rawValue}
                          onChange={e => handleCellChange(ibId, asset, e.target.value)}
                          title={ibNodesById[ibId]?.name ?? ibNodesById[ibId]?.email ?? ibId}
                          className={[
                            'w-full max-w-[80px] text-center px-2 py-1 text-sm border rounded',
                            'focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors',
                            isExceeding
                              ? 'border-red-400 bg-red-50 text-red-700'
                              : isDirty
                                ? 'border-amber-300 bg-amber-50/40'
                                : 'border-gray-200',
                          ].join(' ')}
                        />
                        {/* Label: max theo công thức mới = assetConfig.maxPips */}
                        <span className={`text-[10px] ${isExceeding ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                          {assetConfig.maxPips === 0
                            ? t('parentNotAllocated')
                            : t('maxLabel', { max: assetConfig.maxPips })}
                        </span>
                      </div>
                    </td>
                  );
                })}

                {/* Col cuối: company cap */}
                <td className="px-4 py-3 text-center bg-emerald-50/40">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-medium text-emerald-700">
                      {t('companyCap', { max: companyMax })}
                    </div>
                    <div className={`text-[10px] ${isOverride ? 'font-semibold text-amber-700' : 'text-emerald-700'}`}>
                      {t('mibCap', { max: mibMax ?? '—' })}
                    </div>
                  </div>
                </td>

              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
