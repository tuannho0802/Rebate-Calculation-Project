'use client';

/**
 * CompactPivotTable — View thứ 3 "Bảng gọn"
 *
 * Cấu trúc: HÀNG = Asset Type, CỘT = Level (MIB | Level 1 | Level 2 | ...).
 * CÁC CỘT LÀ DYNAMIC — số cột hiển thị phụ thuộc vào selection hiện tại:
 *   - Cột Level N+1 CHỈ hiển thị khi node đang chọn ở Level N CÓ con trực tiếp.
 *   - Options trong cột Level N+1 chỉ là CON TRỰC TIẾP của node đang chọn ở Level N.
 *   - Khi đổi select ở Level N → cascade reset selection các cột N+1, N+2, ...
 *
 * Không có fetch riêng — dùng chung configs/dirtyIbs/handleCellChange.
 */

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AssetType, IbTreeNode, RebateConfig, MAX_PIPS } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * compactSelection[rootId][level] = ibId đang được chọn ở cột level đó.
 * Nested Record (không dùng flat key) để truy xuất rõ ràng.
 */
export type CompactSelection = Record<string, Record<number, string>>;

export interface CompactPivotTableProps {
  rootId: string;
  rootIb: IbTreeNode;                                  // MIB node (level=0)
  ibs: IbTreeNode[];                                   // flattenIbTree(root).filter(lv>0)
  assetTypes: AssetType[];
  configs: Record<string, RebateConfig>;
  dirtyIbs: Set<string>;
  handleCellChange: (ibId: string, assetType: AssetType, value: string) => void;
  getMibMaxDisplay: (mibId: string, assetType: AssetType) => number | null;
  parentById: Record<string, string | null>;
  ibNodesById: Record<string, IbTreeNode>;
  selection: CompactSelection;
  onSelectionChange: (rootId: string, level: number, ibId: string) => void;
  // Cascade reset: khi đổi level N, page xoá level N+1, N+2, ...
  onCascadeReset: (rootId: string, fromLevel: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Trả về con TRỰC TIẾP của parentId trong danh sách ibs.
 * Với level=1, parentId = rootId (MIB).
 */
function directChildren(
  parentId: string,
  ibs: IbTreeNode[],
  parentById: Record<string, string | null>,
): IbTreeNode[] {
  return ibs.filter(ib => parentById[ib.id] === parentId);
}

/** Label cho option: "IB Name (↑ Parent)" */
function optionLabel(
  ib: IbTreeNode,
  parentById: Record<string, string | null>,
  ibNodesById: Record<string, IbTreeNode>,
): string {
  const name = ib.name ?? ib.email;
  const parentId = parentById[ib.id];
  if (!parentId) return name;
  const parent = ibNodesById[parentId];
  if (!parent) return name;
  return `${name} (↑ ${parent.name ?? parent.email})`;
}

/**
 * Tính chuỗi cột hiển thị (dynamic) dựa trên selection hiện tại.
 * Mỗi phần tử = { level, selectedIbId, options[] }
 * Dừng khi node đang chọn không có con.
 */
function buildColumns(
  rootId: string,
  rootIb: IbTreeNode,
  ibs: IbTreeNode[],
  parentById: Record<string, string | null>,
  selection: CompactSelection,
): Array<{ level: number; selectedIbId: string; options: IbTreeNode[] }> {
  const cols: Array<{ level: number; selectedIbId: string; options: IbTreeNode[] }> = [];

  // Level 1: con trực tiếp của MIB root
  let parentId = rootId;
  let level = 1;

  while (true) {
    const children = directChildren(parentId, ibs, parentById);
    if (children.length === 0) break; // Không có con → dừng, không thêm cột

    // IB đang chọn ở level này (fallback về con đầu tiên)
    const stored = selection[rootId]?.[level];
    const selectedIbId = stored && children.some(c => c.id === stored)
      ? stored
      : children[0].id;

    cols.push({ level, selectedIbId, options: children });

    // Đi xuống: xem node đang chọn có con không
    parentId = selectedIbId;
    level += 1;
  }

  return cols;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CompactPivotTable({
  rootId,
  rootIb,
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
  onCascadeReset,
}: CompactPivotTableProps) {
  const t = useTranslations('RebateManagement');

  // Dynamic columns — recomputed setiap render (dựa trên selection)
  const columns = buildColumns(rootId, rootIb, ibs, parentById, selection);

  const handleSelect = (level: number, ibId: string) => {
    // 1. Ghi selection mới
    onSelectionChange(rootId, level, ibId);
    // 2. Cascade reset các cột con (level+1, level+2, ...)
    onCascadeReset(rootId, level + 1);
  };

  return (
    <div className="overflow-auto relative">
      <table className="w-full text-sm text-left border-collapse">

        {/* ── Header ── */}
        <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-20 shadow-sm">
          <tr>
            {/* Col 0: Asset Type */}
            <th className="px-4 py-3 border-b border-r border-gray-200 sticky left-0 bg-slate-50 z-30 w-40 shadow-[1px_0_0_0_#e5e7eb]">
              Asset Type
            </th>

            {/* Col MIB */}
            <th className="px-4 py-3 border-b border-gray-200 min-w-[120px] text-center">
              <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">MIB</div>
              <div className="text-[10px] font-normal text-gray-500 mt-0.5 truncate max-w-[110px] mx-auto" title={rootIb.email}>
                {rootIb.name ?? rootIb.email}
              </div>
            </th>

            {/* Col Level N — chỉ hiển thị khi có options */}
            {columns.map(({ level, selectedIbId, options }) => (
              <th key={level} className="px-3 py-2 border-b border-gray-200 min-w-[160px] text-center">
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                  Level {level}
                </div>
                {options.length === 1 ? (
                  <span
                    className="text-[10px] font-medium text-gray-600 block truncate max-w-[140px] mx-auto"
                    title={options[0].email}
                  >
                    {options[0].name ?? options[0].email}
                  </span>
                ) : (
                  <select
                    value={selectedIbId}
                    onChange={e => handleSelect(level, e.target.value)}
                    className="w-full max-w-[150px] px-2 py-1 text-[11px] border border-gray-300 rounded-lg bg-white font-normal focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {options.map(ib => (
                      <option key={ib.id} value={ib.id}>
                        {optionLabel(ib, parentById, ibNodesById)}
                      </option>
                    ))}
                  </select>
                )}
              </th>
            ))}

            {/* Col cuối: company / MIB cap */}
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

                {/* Col MIB: editable rebatePips + Max label — cùng pattern cột IB */}
                <td className="px-3 py-2 text-center">
                  {(() => {
                    const mibConfig = configs[rootId];
                    if (!mibConfig) {
                      return <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-300" />;
                    }
                    const mibAssetConfig = mibConfig.assets.find(a => a.assetType === asset);
                    if (!mibAssetConfig) {
                      return <span className="text-gray-300 text-xs">—</span>;
                    }
                    const mibRaw =
                      (mibAssetConfig as RebateConfig['assets'][number] & { rawInput?: string }).rawInput !== undefined
                        ? (mibAssetConfig as RebateConfig['assets'][number] & { rawInput?: string }).rawInput!
                        : String(mibAssetConfig.rebatePips);
                    const mibExceeding = mibAssetConfig.rebatePips > mibAssetConfig.maxPips;
                    const mibIsDirty = dirtyIbs.has(rootId);
                    return (
                      <div className="flex flex-col items-center gap-0.5">
                        <input
                          type="text"
                          value={mibRaw}
                          onChange={e => handleCellChange(rootId, asset, e.target.value)}
                          title={rootIb.name ?? rootIb.email ?? rootId}
                          className={[
                            'w-full max-w-[80px] text-center px-2 py-1 text-sm border rounded',
                            'focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors',
                            mibExceeding
                              ? 'border-red-400 bg-red-50 text-red-700'
                              : mibIsDirty
                                ? 'border-amber-300 bg-amber-50/40'
                                : 'border-gray-200',
                          ].join(' ')}
                        />
                        <span className={`text-[10px] ${mibExceeding ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                          {mibAssetConfig.maxPips === 0
                            ? t('parentNotAllocated')
                            : t('maxLabel', { max: mibAssetConfig.maxPips })}
                        </span>
                      </div>
                    );
                  })()}
                </td>

                {/* Col Level N — chỉ hiển thị ô input của selectedIbId */}
                {columns.map(({ level, selectedIbId }) => {
                  const ibConfig = configs[selectedIbId];
                  if (!ibConfig) {
                    return (
                      <td key={level} className="px-4 py-3 text-center">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-300" />
                      </td>
                    );
                  }

                  const assetConfig = ibConfig.assets.find(a => a.assetType === asset);
                  if (!assetConfig) {
                    return (
                      <td key={level} className="px-4 py-3 text-center text-gray-300 text-xs">—</td>
                    );
                  }

                  const rawValue =
                    (assetConfig as RebateConfig['assets'][number] & { rawInput?: string }).rawInput !== undefined
                      ? (assetConfig as RebateConfig['assets'][number] & { rawInput?: string }).rawInput!
                      : String(assetConfig.rebatePips);

                  const isExceeding = assetConfig.rebatePips > assetConfig.maxPips;
                  const isDirty = dirtyIbs.has(selectedIbId);

                  return (
                    <td key={level} className="px-3 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <input
                          type="text"
                          value={rawValue}
                          onChange={e => handleCellChange(selectedIbId, asset, e.target.value)}
                          title={ibNodesById[selectedIbId]?.name ?? ibNodesById[selectedIbId]?.email ?? selectedIbId}
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
                        <span className={`text-[10px] ${isExceeding ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                          {assetConfig.maxPips === 0
                            ? t('parentNotAllocated')
                            : t('maxLabel', { max: assetConfig.maxPips })}
                        </span>
                      </div>
                    </td>
                  );
                })}

                {/* Col cuối: company / MIB cap */}
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
