'use client';

/**
 * CompactPivotTable — View thứ 3 "Bảng gọn"
 *
 * Cấu trúc: HÀNG = Asset Type, CỘT = Level (MIB | Level 1 | Level 2 | ...).
 * CÁC CỘT LÀ DYNAMIC — số cột hiển thị phụ thuộc vào selection hiện tại.
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { AssetType, IbTreeNode, RebateConfig, MAX_PIPS } from '@/types';
import { solveBallAllocation, SolverNodeInput } from '@/lib/ai-rebate-solver';
import { rebateApi } from '@/lib/api/rebate';
import { useProducts } from '@/hooks/useProducts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CompactSelection = Record<string, Record<number, string>>;

export interface CompactPivotTableProps {
  rootId: string;
  rootIb: IbTreeNode;                                  // MIB node (level=0)
  ibs: IbTreeNode[];                                   // flattenIbTree(root).filter(lv>0)
  assetTypes: AssetType[];
  configs: Record<string, RebateConfig>;
  getMibMaxDisplay: (mibId: string, assetType: AssetType) => number | null;
  parentById: Record<string, string | null>;
  ibNodesById: Record<string, IbTreeNode>;
  selection: CompactSelection;
  onSelectionChange: (rootId: string, level: number, ibId: string) => void;
  // Cascade reset: khi đổi level N, page xoá level N+1, N+2, ...
  onCascadeReset: (rootId: string, fromLevel: number) => void;
  // Edit mode props per branch table
  isEditing?: boolean;
  draftPips?: Record<string, Record<string, number>>;
  onCellEdit?: (ibId: string, assetType: AssetType, newPips: number) => void;
  // Callback truyền kịch bản active lên MibBranchCard để đồng loạt Lưu
  onActiveScenarioChange?: (nodes: Array<{ nodeId: string; pct: string; white_hold: number }>) => void;
  // IB cần tô sáng cột tương ứng (đến từ deep-link click thông báo ở trang Notification)
  highlightIbId?: string;
  selectedAccountType?: string;
}

export function nodeHasAccountType(
  node: IbTreeNode | null | undefined,
  targetAccountType: string,
  configs?: Record<string, RebateConfig>
): boolean {
  if (!node) return false;
  // MIB root luôn có mặt trên mọi loại tài khoản
  if (node.level === 0 || !node.parentId) return true;

  if (node.accountTypes && Array.isArray(node.accountTypes) && node.accountTypes.length > 0) {
    if (node.accountTypes.includes(targetAccountType)) return true;
  }

  if ((node.accountType || 'STD') === targetAccountType) {
    return true;
  }

  if (configs && configs[node.id]?.assets && configs[node.id].assets.length > 0) {
    if (configs[node.id].accountType === targetAccountType) {
      return true;
    }
  }

  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eligibleChildren(
  parentId: string,
  ibs: IbTreeNode[],
  parentById: Record<string, string | null>,
  targetAccountType: string,
  configs?: Record<string, RebateConfig>,
): IbTreeNode[] {
  return ibs.filter(ib => parentById[ib.id] === parentId);
}

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

export function buildColumns(
  rootId: string,
  rootIb: IbTreeNode,
  ibs: IbTreeNode[],
  parentById: Record<string, string | null>,
  selection: CompactSelection,
  targetAccountType: string,
  configs?: Record<string, RebateConfig>,
): Array<{ level: number; selectedIbId: string; options: IbTreeNode[] }> {
  const cols: Array<{ level: number; selectedIbId: string; options: IbTreeNode[] }> = [];

  let parentId = rootId;
  let level = 1;

  while (true) {
    const children = eligibleChildren(parentId, ibs, parentById, targetAccountType, configs);
    if (children.length === 0) break;

    const stored = selection[rootId]?.[level];
    const selectedIbId = stored && children.some(c => c.id === stored)
      ? stored
      : children[0].id;

    cols.push({ level, selectedIbId, options: children });

    parentId = selectedIbId;
    level += 1;
  }

  return cols;
}

export const formatPips = (val: number): number => {
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

import { useDisabledAssetTypes } from '@/hooks/useDisabledAssetTypes';

export function CompactPivotTable({
  rootId,
  rootIb,
  ibs,
  assetTypes: rawAssetTypes,
  configs,
  getMibMaxDisplay,
  parentById,
  ibNodesById,
  selection,
  onSelectionChange,
  onCascadeReset,
  isEditing = false,
  draftPips = {},
  onCellEdit,
  onActiveScenarioChange,
  highlightIbId,
  selectedAccountType = 'STD',
}: CompactPivotTableProps) {
  const { activeAssetTypes } = useDisabledAssetTypes();
  const { products } = useProducts();
  const productMap = useMemo(() => new Map(products.map((p) => [p.symbol, p])), [products]);

  const isMarkupAllowed = (asset: string): boolean => {
    const prod = productMap.get(asset);
    return prod ? prod.allowMarkup !== false : true;
  };

  const assetTypes = useMemo(
    () => rawAssetTypes.filter((a) => activeAssetTypes.includes(a)),
    [rawAssetTypes, activeAssetTypes],
  );
  const t = useTranslations('RebateManagement');
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number>(0);
  const [userHasSelected, setUserHasSelected] = useState<boolean>(false);

  // Helper đọc Pips (ưu tiên đọc từ draftPips khi đang chỉnh sửa)
  const getRebatePips = (ibId: string | null | undefined, asset: AssetType): number => {
    if (!ibId) return 0;
    if (draftPips[ibId] && draftPips[ibId][asset] !== undefined) {
      return draftPips[ibId][asset];
    }
    const cfg = configs[ibId]?.assets?.find(a => a.assetType === asset);
    return Number(cfg?.rebatePips || 0);
  };

  // Dynamic columns — recomputed mỗi render (dựa trên selection, selectedAccountType và configs)
  const columns = buildColumns(rootId, rootIb, ibs, parentById, selection, selectedAccountType, configs);

  const activeBranchKey = [rootId, ...columns.map(c => c.selectedIbId)].join(',');
  useEffect(() => {
    setUserHasSelected(false);
  }, [activeBranchKey]);

  // Lấy level1 node và số Markup Pips của selectedAccountType
  const level1Id = columns[0]?.selectedIbId;
  const level1Node = level1Id ? ibNodesById[level1Id] : null;

  const parseAccountTypePips = (accType?: string): number => {
    if (!accType) return 0;
    if (accType === 'STD') return 0;
    const match = accType.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const level1MarkupPips = parseAccountTypePips(selectedAccountType);

  // ── 🤖 AI REBATE ENGINE SOLVER COMPUTATION (TÍNH TOÁN KỊCH BẢN TỐI ƯU CHO NHÁNH) ──
  const branchIds = [rootId, ...columns.map(c => c.selectedIbId)];
  const totalMarkupPips = level1MarkupPips;

  const solverInput: SolverNodeInput[] = branchIds.map((id, idx) => {
    const isRoot = idx === 0;
    const name = isRoot ? (rootIb.name ?? rootIb.email) : (ibNodesById[id]?.name ?? ibNodesById[id]?.email ?? id);
    const lvl = isRoot ? 0 : idx;
    const assets: Record<string, number> = {};

    assetTypes.forEach((asset) => {
      const assetMarkup = isMarkupAllowed(asset) ? level1MarkupPips : 0;
      if (isRoot) {
        const mibAssetConfig = configs[rootId]?.assets?.find(a => a.assetType === asset);
        const mibBaseCap = getMibMaxDisplay(rootId, asset) ?? Number(mibAssetConfig?.maxPips || 0);
        assets[asset] = mibBaseCap > 0 ? mibBaseCap + assetMarkup : 0;
      } else {
        assets[asset] = getRebatePips(id, asset);
      }
    });

    return {
      nodeId: id,
      nodeName: name,
      level: lvl,
      assets,
    };
  });

  const scenarios = solveBallAllocation(solverInput, totalMarkupPips, assetTypes);

  // Read saved pattern from DB configs for active branch
  const savedPatternKey = branchIds.map(id => {
    const cfg = configs[id]?.assets?.find(a => a.markupPips !== undefined && a.markupPips !== null);
    return cfg ? Number(cfg.markupPips) : null;
  });

  // Auto-match scenario if user hasn't manually picked a scenario in this session
  let activeIndex = selectedScenarioIndex;
  if (!userHasSelected && scenarios.length > 0) {
    const isSavedPatternValid = savedPatternKey.every(p => p !== null);
    if (isSavedPatternValid) {
      const foundIdx = scenarios.findIndex(sc =>
        sc.nodes.every((n, idx) => n.white_hold === savedPatternKey[idx])
      );
      if (foundIdx !== -1) {
        activeIndex = foundIdx;
      }
    }
  }

  const activeScenario = scenarios[activeIndex] || scenarios[0];

  // Map nodeId -> nodeResult từ active scenario (pct & white_hold)
  const scenarioMap: Record<string, { pct: string; white_hold: number }> = {};
  if (activeScenario) {
    activeScenario.nodes.forEach((n) => {
      scenarioMap[n.nodeId] = { pct: n.pct, white_hold: n.white_hold };
    });
  }

  // Truyền kịch bản active lên parent để gộp Lưu đồng thời (Dùng JSON key để tránh infinite re-render loop)
  const scenarioNodesKey = JSON.stringify(activeScenario?.nodes || []);
  useEffect(() => {
    if (activeScenario?.nodes && onActiveScenarioChange) {
      onActiveScenarioChange(activeScenario.nodes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioNodesKey, onActiveScenarioChange]);

  const handleSelect = (level: number, ibId: string) => {
    onSelectionChange(rootId, level, ibId);
    onCascadeReset(rootId, level + 1);
  };

  return (
    <div className="overflow-auto relative">
      <table className="w-full text-sm text-left border-collapse">

        {/* ── Header ── */}
        <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
          <tr>
            {/* Cột 1: Asset Type label */}
            <th className="px-4 py-3 border-r border-slate-200 min-w-[150px] text-slate-900 font-bold bg-slate-100 sticky left-0 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
              Asset Type
            </th>

            {/* Cột MIB — Cố định ở Level 0 */}
            <th
              className={`px-3 py-2.5 border-r border-slate-200 text-center min-w-[150px] bg-indigo-50/50 ${highlightIbId && highlightIbId === rootId ? 'ring-2 ring-inset ring-amber-500 bg-amber-50/70' : ''
                }`}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-indigo-800 bg-indigo-100 border border-indigo-200 uppercase tracking-wider">
                  MIB
                </span>
                <div className="text-xs font-extrabold text-gray-900 truncate max-w-[140px] mx-auto text-center" title={rootIb.email}>
                  {rootIb.name ?? rootIb.email}
                </div>
              </div>
            </th>

            {/* Các Cột Dynamic Sub-IB (Level 1, Level 2, ...) */}
            {columns.map(({ level, selectedIbId, options }) => {
              const isHighlighted = !!highlightIbId && selectedIbId === highlightIbId;
              return (
                <th
                  key={level}
                  className={`px-3 py-2.5 border-r border-slate-200 text-center min-w-[160px] ${isHighlighted ? 'ring-2 ring-inset ring-amber-500 bg-amber-50/70' : ''
                    }`}
                >
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-slate-800 bg-slate-200 border border-slate-300 uppercase tracking-wider">
                      LEVEL {level}
                    </span>
                    {options.length === 1 ? (
                      <div className="text-xs font-extrabold text-gray-900 truncate max-w-[150px] mx-auto text-center py-1" title={options[0].email}>
                        {optionLabel(options[0], parentById, ibNodesById)}
                      </div>
                    ) : (
                      <select
                        value={selectedIbId}
                        onChange={(e) => handleSelect(level, e.target.value)}
                        className="w-full text-xs font-bold text-gray-900 bg-white border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs truncate text-center"
                      >
                        {options.map(ib => (
                          <option key={ib.id} value={ib.id}>
                            {optionLabel(ib, parentById, ibNodesById)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody className="divide-y divide-slate-100 bg-white">
          {assetTypes.map((asset) => {
            const isAllowed = isMarkupAllowed(asset) && level1MarkupPips > 0;
            const assetMarkup = isAllowed ? level1MarkupPips : 0;
            const mibAssetConfig = configs[rootId]?.assets?.find(a => a.assetType === asset);
            const mibBaseCap = getMibMaxDisplay(rootId, asset) ?? Number(mibAssetConfig?.maxPips || 0);
            const mibCap = mibBaseCap > 0 ? mibBaseCap + assetMarkup : 0;

            const mibGiven = level1Id ? getRebatePips(level1Id, asset) : 0;
            const isMibInsufficient = !!level1Id && mibCap < mibGiven;
            const mibRetained = Math.max(0, mibCap - mibGiven);

            const isNoMarkup = level1MarkupPips > 0 && !isMarkupAllowed(asset);

            return (
              <tr key={asset} className="hover:bg-slate-50/80 transition-colors">
                {/* Cell: Asset Name */}
                <td className="px-4 py-2.5 font-bold text-slate-800 border-r border-slate-200 text-xs bg-white sticky left-0 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center justify-between gap-1">
                    <span>{asset}</span>
                    {isNoMarkup && (
                      <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded leading-none" title="Sản phẩm không áp dụng cộng thêm Link Markup (0 pips)">
                        +0
                      </span>
                    )}
                  </div>
                </td>

                {/* Cell: MIB (Level 0) */}
                <td className={`px-3 py-2 border-r border-slate-200 text-center ${isMibInsufficient ? 'bg-red-50/80 ring-2 ring-inset ring-red-400' : 'bg-indigo-50/20'}`}>
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Cap: <span className={`font-bold ${isMibInsufficient ? 'text-red-700 underline' : 'text-slate-700'}`}>{formatPips(mibCap)}</span>
                    </span>
                    {isMibInsufficient && (
                      <div className="flex items-center gap-0.5 text-[9px] font-extrabold text-red-600 bg-red-100 px-1 py-0.5 rounded border border-red-300" title={`Cap MIB (${formatPips(mibCap)}) không đủ chia cho Level 1 (${formatPips(mibGiven)})`}>
                        <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" />
                        <span>Thiếu {formatPips(mibGiven - mibCap)}</span>
                      </div>
                    )}
                    <span className={`text-sm font-black px-2 py-0.5 rounded border min-w-[36px] ${
                      isMibInsufficient ? 'text-red-700 bg-red-100 border-red-300' : 'text-indigo-700 bg-indigo-100/60 border-indigo-200/50'
                    }`}>
                      {isMibInsufficient ? `-${formatPips(mibGiven - mibCap)}` : formatPips(mibRetained)}
                    </span>
                  </div>
                </td>

                {/* Cells: Dynamic Sub-IBs (Level 1, Level 2, ...) */}
                {columns.map(({ level, selectedIbId }, idx) => {
                  const received = getRebatePips(selectedIbId, asset);
                  const nextLevelId = columns[idx + 1]?.selectedIbId;
                  const given = nextLevelId ? getRebatePips(nextLevelId, asset) : 0;
                  const retained = Math.max(0, received - given);

                  const prevLevelIbId = idx === 0 ? null : columns[idx - 1]?.selectedIbId;
                  const maxAllowed = idx === 0 ? mibCap : getRebatePips(prevLevelIbId, asset);
                  const minAllowed = nextLevelId ? getRebatePips(nextLevelId, asset) : 0;

                  const isExceedsParent = received > maxAllowed;
                  const isInsufficientForChild = !!nextLevelId && received < given;
                  const isInvalid = isExceedsParent || isInsufficientForChild;

                  return (
                    <td key={level} className={`px-3 py-2 border-r border-slate-200 text-center ${
                      isInvalid ? 'bg-red-50/80 ring-2 ring-inset ring-red-400' : (isEditing ? 'bg-amber-50/30' : '')
                    }`}>
                      <div className="flex flex-col items-center justify-center gap-1">
                        {isEditing ? (
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-[10px] text-indigo-700 font-bold">Nhận:</span>
                              <input
                                type="number"
                                step="0.01"
                                min={minAllowed}
                                max={maxAllowed}
                                value={formatPips(received)}
                                onChange={(e) => {
                                  let val = parseFloat(e.target.value);
                                  if (isNaN(val)) val = 0;
                                  if (val > maxAllowed) {
                                    toast.error(`Số Pips cho ${asset} không được vượt quá trần cấp trên (${maxAllowed} pips)`);
                                    val = maxAllowed;
                                  } else if (val < minAllowed) {
                                    toast.error(`Số Pips cho ${asset} không được nhỏ hơn số Pips đã chia cho cấp dưới (${minAllowed} pips)`);
                                    val = minAllowed;
                                  }
                                  if (onCellEdit) {
                                    onCellEdit(selectedIbId, asset, val);
                                  }
                                }}
                                className={`w-16 text-center text-xs font-black border-2 rounded-md bg-white px-1 py-0.5 text-indigo-950 focus:outline-none focus:ring-2 shadow-xs ${
                                  isInvalid ? 'border-red-500 focus:ring-red-400' : 'border-indigo-400 focus:ring-indigo-500'
                                }`}
                              />
                            </div>
                            {minAllowed > 0 && (
                              <span className="text-[9px] text-slate-500 font-medium">
                                (Sàn: {formatPips(minAllowed)} - Trần: {formatPips(maxAllowed)})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className={`text-[11px] font-semibold ${isInvalid ? 'text-red-700' : 'text-slate-500'}`}>
                            Nhận: <span className={`font-bold ${isInvalid ? 'text-red-800 underline' : 'text-slate-700'}`}>{formatPips(received)}</span>
                          </span>
                        )}

                        {/* Cảnh báo lỗi trực quan nếu vi phạm ràng buộc chia Pip */}
                        {isInsufficientForChild && (
                          <div
                            className="flex items-center gap-0.5 text-[9px] font-extrabold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-300 shadow-xs"
                            title={`Lỗi: Cấp trên nhận ${formatPips(received)} pips nhưng chia cho cấp dưới ${formatPips(given)} pips (thiếu ${formatPips(given - received)} pips)!`}
                          >
                            <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" />
                            <span>Thiếu {formatPips(given - received)} pips</span>
                          </div>
                        )}

                        {isExceedsParent && !isInsufficientForChild && (
                          <div
                            className="flex items-center gap-0.5 text-[9px] font-extrabold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-300 shadow-xs"
                            title={`Lỗi: Vượt trần cấp trên! Cấp trên chỉ cấp tối đa ${formatPips(maxAllowed)} pips.`}
                          >
                            <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" />
                            <span>Vượt trần ({formatPips(maxAllowed)})</span>
                          </div>
                        )}

                        {isInsufficientForChild ? (
                          <span
                            className="text-xs font-black text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-300 min-w-[36px]"
                            title="Lỗi: Giữ lại bị âm do cấp dưới nhận nhiều hơn cấp trên"
                          >
                            -{formatPips(given - received)}
                          </span>
                        ) : (
                          <span className="text-sm font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 min-w-[36px]">
                            {formatPips(retained)}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>

        {/* ── Footer: Company Cap (Sum per column) ── */}
        <tfoot className="bg-slate-100 border-t-2 border-slate-300 text-xs">
          <tr>
            <td className="px-4 py-3 font-extrabold text-slate-900 border-r border-slate-200 sticky left-0 bg-slate-100 z-10">
              Company Caps
            </td>

            {/* Total cho MIB */}
            <td className="px-3 py-3 border-r border-slate-200 text-center font-bold text-indigo-900 bg-indigo-100/40">
              {(() => {
                const totalCap = assetTypes.reduce((sum, asset) => {
                  const isAllowed = isMarkupAllowed(asset) && level1MarkupPips > 0;
                  const assetMarkup = isAllowed ? level1MarkupPips : 0;
                  const mibAssetConfig = configs[rootId]?.assets?.find(a => a.assetType === asset);
                  const mibBaseCap = getMibMaxDisplay(rootId, asset) ?? Number(mibAssetConfig?.maxPips || 0);
                  const mibCap = mibBaseCap > 0 ? mibBaseCap + assetMarkup : 0;
                  return sum + mibCap;
                }, 0);
                const totalGiven = assetTypes.reduce((sum, asset) => {
                  if (!level1Id) return sum;
                  return sum + getRebatePips(level1Id, asset);
                }, 0);
                return (
                  <div>
                    <div className="text-[10px] text-slate-500">Company cap: <span className="font-bold">{formatPips(totalCap)}</span></div>
                    <div className="text-xs font-black text-indigo-700">Allocated: {formatPips(totalGiven)}</div>
                  </div>
                );
              })()}
            </td>

            {/* Total cho từng Sub-IB column */}
            {columns.map(({ level, selectedIbId }, idx) => {
              const totalReceived = assetTypes.reduce((sum, asset) => {
                return sum + getRebatePips(selectedIbId, asset);
              }, 0);

              const nextLevelId = columns[idx + 1]?.selectedIbId;
              const totalGiven = assetTypes.reduce((sum, asset) => {
                if (!nextLevelId) return sum;
                return sum + getRebatePips(nextLevelId, asset);
              }, 0);

              return (
                <td key={level} className="px-3 py-3 border-r border-slate-200 text-center font-bold text-slate-800">
                  <div>
                    <div className="text-[10px] text-slate-500">Company cap: <span className="font-bold">{formatPips(totalReceived)}</span></div>
                    <div className="text-xs font-black text-slate-900">Allocated: {formatPips(totalGiven)}</div>
                  </div>
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>

      {/* ── 🤖 AI REBATE ENGINE SOLVER BẢNG BÊN DƯỚI ── */}
      <div className="mt-4 border-t-2 border-slate-300">
        <div className="overflow-x-auto rounded-none border-b border-slate-300 bg-white">
          <div className="bg-indigo-900 text-white text-xs font-extrabold px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span>🤖 AI REBATE ENGINE - KỊCH BẢN PHÂN BỔ TỐI ƯU (SCENARIO {activeScenario ? activeScenario.scenarioId : 1} / {scenarios.length || 1})</span>
              {scenarios.length > 1 && (
                <>
                  <button
                    onClick={() => {
                      setSelectedScenarioIndex((activeIndex + 1) % scenarios.length);
                      setUserHasSelected(true);
                    }}
                    className="px-2.5 py-1 text-[11px] bg-amber-400 hover:bg-amber-300 text-indigo-950 font-extrabold rounded-md shadow transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    🔀 Kịch Bản Tiếp Theo
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0 bg-indigo-950/80 px-2.5 py-1 rounded-md border border-indigo-700/60">
                    <span className="text-[11px] font-extrabold text-amber-300">Chọn trường hợp:</span>
                    <select
                      value={activeIndex}
                      onChange={(e) => {
                        setSelectedScenarioIndex(Number(e.target.value));
                        setUserHasSelected(true);
                      }}
                      className="text-[11px] font-extrabold bg-indigo-900 text-white border border-indigo-500 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-xs max-w-[240px] truncate"
                    >
                      {scenarios.map((sc, idx) => {
                        const pattern = sc.nodes.map((n) => n.white_hold).join(' : ');
                        return (
                          <option key={sc.scenarioId} value={idx} className="bg-indigo-950 text-white font-mono">
                            #{sc.scenarioId} [{pattern}] (Var: {sc.variance})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </>
              )}
            </div>
            {activeScenario && (
              <span className="text-amber-300 font-normal text-right">
                Độ lệch (Variance): {activeScenario.variance} | Markup Giữ Max: {activeScenario.maxHold} pips
              </span>
            )}
          </div>
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 border-r border-slate-200 min-w-[150px] text-slate-900 font-bold bg-slate-100">
                  Markup Option
                </th>
                <th className="px-3 py-2.5 border-r border-slate-200 text-center min-w-[150px] bg-indigo-50/50">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-indigo-800 bg-indigo-100 border border-indigo-200 uppercase tracking-wider">
                      MIB
                    </span>
                    <div className="text-xs font-extrabold text-gray-900 truncate max-w-[140px] mx-auto text-center" title={rootIb.email}>
                      {rootIb.name ?? rootIb.email}
                    </div>
                  </div>
                </th>
                {columns.map(({ level, selectedIbId }) => {
                  const node = ibNodesById[selectedIbId];
                  const name = node ? (node.name ?? node.email) : selectedIbId;
                  return (
                    <th key={level} className="px-3 py-2.5 border-r border-slate-200 text-center min-w-[160px]">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-slate-800 bg-slate-200 border border-slate-300 uppercase tracking-wider">
                          LEVEL {level}
                        </span>
                        <div className="text-xs font-extrabold text-gray-900 truncate max-w-[150px] mx-auto text-center" title={node?.email || ''}>
                          {name}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Hàng 1: % Giữ lại tính từ AI Rebate */}
              <tr className="bg-amber-50/70 font-semibold">
                <td className="px-4 py-3 border-r border-slate-200 font-bold text-amber-900 bg-amber-50">
                  Tỷ Lệ % Giữ Lại
                </td>
                <td className="px-4 py-3 border-r border-slate-200 text-center text-amber-900 text-base font-extrabold bg-amber-50/50">
                  {scenarioMap[rootId]?.pct ?? '100%'}
                </td>
                {columns.map(({ level, selectedIbId }) => (
                  <td key={level} className="px-4 py-3 border-r border-slate-200 text-center text-amber-900 text-base font-extrabold">
                    {scenarioMap[selectedIbId]?.pct ?? '0%'}
                  </td>
                ))}
              </tr>

              {/* Hàng 2: Pips thực giữ lại tính từ AI Rebate Engine */}
              <tr className="hover:bg-blue-50/20 transition-colors">
                <td className="px-4 py-3 border-r border-slate-200 font-bold text-slate-800 bg-slate-50">
                  {selectedAccountType || 'STD'} <span className="text-xs font-normal text-slate-500">({totalMarkupPips} Pips)</span>
                </td>
                <td className="px-4 py-3 border-r border-slate-200 text-center text-blue-700 font-bold text-base bg-slate-50/30">
                  {scenarioMap[rootId]?.white_hold ?? 0}
                </td>
                {columns.map(({ level, selectedIbId }) => (
                  <td key={level} className="px-4 py-3 border-r border-slate-200 text-center text-blue-700 font-bold text-base">
                    {scenarioMap[selectedIbId]?.white_hold ?? 0}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}