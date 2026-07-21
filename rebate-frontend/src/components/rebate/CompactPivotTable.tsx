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

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { AssetType, IbTreeNode, RebateConfig, MAX_PIPS } from '@/types';
import { solveBallAllocation, SolverNodeInput } from '@/lib/ai-rebate-solver';
import { rebateApi } from '@/lib/api/rebate';

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
  getMibMaxDisplay,
  parentById,
  ibNodesById,
  selection,
  onSelectionChange,
  onCascadeReset,
}: CompactPivotTableProps) {
  const t = useTranslations('RebateManagement');
  const queryClient = useQueryClient();
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number>(0);
  const [userHasSelected, setUserHasSelected] = useState<boolean>(false);
  const [isSavingScenario, setIsSavingScenario] = useState<boolean>(false);

  // Dynamic columns — recomputed mỗi render (dựa trên selection)
  const columns = buildColumns(rootId, rootIb, ibs, parentById, selection);

  const activeBranchKey = [rootId, ...columns.map(c => c.selectedIbId)].join(',');
  useEffect(() => {
    setUserHasSelected(false);
  }, [activeBranchKey]);

  // Lấy level1 node và số Markup Pips của level 1
  const level1Id = columns[0]?.selectedIbId;
  const level1Node = level1Id ? ibNodesById[level1Id] : null;

  const parseAccountTypePips = (accType?: string): number => {
    if (!accType) return 0;
    if (accType === 'STD' || accType === 'SEA STD') return 0;
    const match = accType.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const level1MarkupPips = parseAccountTypePips(level1Node?.accountType);

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
        <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
          <tr>
            {/* Cột 1: Asset Type label */}
            <th className="px-4 py-3 border-r border-slate-200 min-w-[150px] text-slate-900 font-bold bg-slate-100 sticky left-0 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
              Asset Type
            </th>

            {/* Cột MIB — Cố định ở Level 0 */}
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

            {/* Các Cột Dynamic Sub-IB (Level 1, Level 2, ...) */}
            {columns.map(({ level, selectedIbId, options }) => {
              return (
                <th key={level} className="px-3 py-2.5 border-r border-slate-200 text-center min-w-[160px]">
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
            // Lấy config của MIB cho asset này (base cap từ MIB config)
            const mibAssetConfig = configs[rootId]?.assets?.find(a => a.assetType === asset);
            const mibBaseCap = getMibMaxDisplay(rootId, asset) ?? Number(mibAssetConfig?.maxPips || 0);

            // Cap thực tế của MIB = mibBaseCap + level1MarkupPips (nếu mibBaseCap > 0)
            const mibCap = mibBaseCap > 0 ? mibBaseCap + level1MarkupPips : 0;

            // MIB đã cho đi (allocated) = rebatePips của Level 1 đang chọn (Cột "Nhận" của Level 1)
            const level1Config = level1Id ? configs[level1Id]?.assets?.find(a => a.assetType === asset) : null;
            const mibGiven = level1Config ? Number(level1Config.rebatePips || 0) : 0;
            const mibRetained = Math.max(0, mibCap - mibGiven);

            return (
              <tr key={asset} className="hover:bg-slate-50/80 transition-colors">
                {/* Cell: Asset Name */}
                <td className="px-4 py-2.5 font-bold text-slate-800 border-r border-slate-200 text-xs bg-white sticky left-0 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                  {asset}
                </td>

                {/* Cell: MIB (Level 0) */}
                <td className="px-3 py-2 border-r border-slate-200 text-center bg-indigo-50/20">
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Cap: <span className="font-bold text-slate-700">{mibCap}</span>
                    </span>
                    <span className="text-sm font-black text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded border border-indigo-200/50 min-w-[36px]">
                      {mibRetained}
                    </span>
                  </div>
                </td>

                {/* Cells: Dynamic Sub-IBs (Level 1, Level 2, ...) */}
                {columns.map(({ level, selectedIbId }, idx) => {
                  const ibConfig = configs[selectedIbId]?.assets?.find(a => a.assetType === asset);
                  const received = Number(ibConfig?.rebatePips || 0);

                  // Next level đang chọn = cột tiếp theo trong columns array
                  const nextLevelId = columns[idx + 1]?.selectedIbId;
                  const nextIbConfig = nextLevelId ? configs[nextLevelId]?.assets?.find(a => a.assetType === asset) : null;

                  // Đã cho đi = rebatePips của con tiếp theo trong nhánh active
                  const given = nextIbConfig ? Number(nextIbConfig.rebatePips || 0) : 0;
                  const retained = Math.max(0, received - given);

                  return (
                    <td key={level} className="px-3 py-2 border-r border-slate-200 text-center">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Nhận: <span className="font-bold text-slate-700">{received}</span>
                        </span>
                        <span className="text-sm font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 min-w-[36px]">
                          {retained}
                        </span>
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
                  const mibAssetConfig = configs[rootId]?.assets?.find(a => a.assetType === asset);
                  const mibBaseCap = getMibMaxDisplay(rootId, asset) ?? Number(mibAssetConfig?.maxPips || 0);
                  const mibCap = mibBaseCap > 0 ? mibBaseCap + level1MarkupPips : 0;
                  return sum + mibCap;
                }, 0);
                const totalGiven = assetTypes.reduce((sum, asset) => {
                  const cfg = level1Id ? configs[level1Id]?.assets?.find(a => a.assetType === asset) : null;
                  return sum + Number(cfg?.rebatePips || 0);
                }, 0);
                return (
                  <div>
                    <div className="text-[10px] text-slate-500">Company cap: <span className="font-bold">{totalCap}</span></div>
                    <div className="text-xs font-black text-indigo-700">Allocated: {totalGiven}</div>
                  </div>
                );
              })()}
            </td>

            {/* Total cho từng Sub-IB column */}
            {columns.map(({ level, selectedIbId }, idx) => {
              const totalReceived = assetTypes.reduce((sum, asset) => {
                const cfg = configs[selectedIbId]?.assets?.find(a => a.assetType === asset);
                return sum + Number(cfg?.rebatePips || 0);
              }, 0);

              const nextLevelId = columns[idx + 1]?.selectedIbId;
              const totalGiven = assetTypes.reduce((sum, asset) => {
                const cfg = nextLevelId ? configs[nextLevelId]?.assets?.find(a => a.assetType === asset) : null;
                return sum + Number(cfg?.rebatePips || 0);
              }, 0);

              return (
                <td key={level} className="px-3 py-3 border-r border-slate-200 text-center font-bold text-slate-800">
                  <div>
                    <div className="text-[10px] text-slate-500">Company cap: <span className="font-bold">{totalReceived}</span></div>
                    <div className="text-xs font-black text-slate-900">Allocated: {totalGiven}</div>
                  </div>
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>

      {/* ── 🤖 AI REBATE ENGINE SOLVER BẢNG BÊN DƯỚI ── */}
      {(() => {
        // Collect active branch node IDs: [rootId, col1.selectedIbId, col2.selectedIbId, ...]
        const branchIds = [rootId, ...columns.map(c => c.selectedIbId)];

        const totalMarkupPips = level1MarkupPips || 10;

        // Build solver input for this active branch
        const solverInput: SolverNodeInput[] = branchIds.map((id, idx) => {
          const isRoot = idx === 0;
          const name = isRoot ? (rootIb.name ?? rootIb.email) : (ibNodesById[id]?.name ?? ibNodesById[id]?.email ?? id);
          const lvl = isRoot ? 0 : idx;
          const assets: Record<string, number> = {};

          assetTypes.forEach((asset) => {
            if (isRoot) {
              const mibAssetConfig = configs[rootId]?.assets?.find(a => a.assetType === asset);
              const mibBaseCap = getMibMaxDisplay(rootId, asset) ?? Number(mibAssetConfig?.maxPips || 0);
              assets[asset] = mibBaseCap > 0 ? mibBaseCap + level1MarkupPips : 0;
            } else {
              const cfg = configs[id]?.assets?.find(a => a.assetType === asset);
              assets[asset] = Number(cfg?.rebatePips || 0);
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
          const cfg = configs[id]?.assets?.[0];
          return cfg?.markupPips !== undefined && cfg?.markupPips !== null ? Number(cfg.markupPips) : null;
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

        // Map nodeId -> nodeResult from active scenario
        const scenarioMap: Record<string, { pct: string; white_hold: number }> = {};
        if (activeScenario) {
          activeScenario.nodes.forEach((n) => {
            scenarioMap[n.nodeId] = { pct: n.pct, white_hold: n.white_hold };
          });
        }

        const handleSaveScenario = async () => {
          if (!activeScenario || !activeScenario.nodes || activeScenario.nodes.length === 0) return;
          setIsSavingScenario(true);
          try {
            const payloadNodes = activeScenario.nodes.map((node) => {
              const pctNum = parseFloat(node.pct.replace('%', ''));
              return {
                ibId: node.nodeId,
                markupPercent: isNaN(pctNum) ? 100 : pctNum,
                markupPips: node.white_hold,
              };
            });

            const res = await rebateApi.saveBranchScenario(payloadNodes);
            if (res?.data?.success || res?.success) {
              toast.success(res.data?.message || 'Đã lưu kịch bản phân bổ vào cơ sở dữ liệu thành công!');
              queryClient.invalidateQueries({ queryKey: ['ibTree'] });
              setUserHasSelected(true);
            } else {
              toast.error('Lỗi khi lưu kịch bản phân bổ');
            }
          } catch (err: any) {
            toast.error('Lỗi kết nối khi lưu kịch bản');
          } finally {
            setIsSavingScenario(false);
          }
        };

        return (
          <div className="mt-4 border-t-2 border-slate-300">
            <div className="overflow-x-auto rounded-none border-b border-slate-300 bg-white">
              <div className="bg-indigo-900 text-white text-xs font-extrabold px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span>🤖 AI REBATE ENGINE - KỊCH BẢN PHÂN BỔ TỐI ƯU (SCENARIO {activeScenario ? activeScenario.scenarioId : 1} / {scenarios.length || 1})</span>
                  {scenarios.length > 1 && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedScenarioIndex((prev: number) => (prev + 1) % scenarios.length);
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

                      <button
                        onClick={handleSaveScenario}
                        disabled={isSavingScenario}
                        className="px-3 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold rounded-md shadow transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                      >
                        {isSavingScenario ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {isSavingScenario ? 'Đang lưu...' : 'Lưu Kịch Bản'}
                      </button>
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
                      {level1Node?.accountType || 'STD'} <span className="text-xs font-normal text-slate-500">({totalMarkupPips} Pips)</span>
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
        );
      })()}
    </div>
  );
}
