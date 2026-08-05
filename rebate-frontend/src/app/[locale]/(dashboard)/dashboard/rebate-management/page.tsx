'use client';

import { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { rebateApi } from '@/lib/api/rebate';
import { exportApi } from '@/lib/api/export';
import { AssetType, RebateConfig, MAX_PIPS, IbTreeNode } from '@/types';
import { Loader2, Table2, Sheet, LayoutGrid, Eye, Download, GitBranch, Search, Edit3, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { normalizeTreeRoots, flattenIbTree } from '@/lib/tree-utils';
import { PivotArrowOverlay } from '@/components/rebate/PivotArrowOverlay';
import { CompactPivotTable, CompactSelection, nodeHasAccountType } from '@/components/rebate/CompactPivotTable';
import { useDisabledAssetTypes } from '@/hooks/useDisabledAssetTypes';
import { solveBallAllocation, SolverNodeInput } from '@/lib/ai-rebate-solver';

function RebateManagementPageInner() {
  const { activeAssetTypes } = useDisabledAssetTypes();
  const t = useTranslations('RebateManagement');
  const searchParams = useSearchParams();
  // Deep-link từ trang Notification: /dashboard/rebate-management?ibId=xxx
  const deepLinkIbId = searchParams.get('ibId');
  const [highlightIbId, setHighlightIbId] = useState<string | undefined>(deepLinkIbId || undefined);
  const [viewMode, setViewMode] = useState<'flat' | 'pivot' | 'compact'>('flat');
  const [configs, setConfigs] = useState<Record<string, RebateConfig>>({});
  // Lifted-up selection cho CompactPivotTable: [rootId][level] = ibId
  const [compactSelection, setCompactSelection] = useState<CompactSelection>({});
  // Search & Pagination state (2 MIBs per page)
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAccountType, setSelectedAccountType] = useState<string>('STD');
  const ITEMS_PER_PAGE = 2;

  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  );

  const { data: treeRes, isLoading: isLoadingTree } = useQuery({
    queryKey: ['ibTree', 'all', 'rebate-management'],
    queryFn: () => ibApi.getTree('all'),
  });

  const roots = useMemo(() => normalizeTreeRoots(treeRes?.data), [treeRes?.data]);

  const parentById = useMemo(() => {
    const map: Record<string, string | null> = {};

    const walk = (node: IbTreeNode, parentId: string | null) => {
      map[node.id] = parentId;
      for (const child of node.children ?? []) {
        if (child.isActive) walk(child, node.id);
      }
    };

    for (const root of roots) {
      walk(root, null);
    }

    return map;
  }, [roots]);

  const groups = useMemo(() => {
    return roots.map(root => ({
      root,
      ibs: flattenIbTree(root).filter(ib => ib.level > 0),
    }));
  }, [roots]);

  const filteredGroups = useMemo(() => {
    let result = groups;

    if (selectedAccountType) {
      result = result.filter(g => nodeHasAccountType(g.root, selectedAccountType, configs));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(g =>
        (g.root.name && g.root.name.toLowerCase().includes(q)) ||
        (g.root.email && g.root.email.toLowerCase().includes(q))
      );
    }

    return result;
  }, [groups, searchQuery, selectedAccountType, configs]);

  const totalPages = Math.ceil(filteredGroups.length / ITEMS_PER_PAGE) || 1;

  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredGroups.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredGroups, currentPage]);

  const allNodes = useMemo(() => groups.flatMap(group => [group.root, ...group.ibs]), [groups]);

  const ibNodesById = useMemo(() => {
    const map: Record<string, IbTreeNode> = {};
    for (const n of allNodes) map[n.id] = n;
    return map;
  }, [allNodes]);

  const [configRefreshTrigger, setConfigRefreshTrigger] = useState(0);

  const handleRefreshConfigs = () => {
    setConfigRefreshTrigger(prev => prev + 1);
  };

  const handleOptimisticUpdateConfigs = (
    updates: Record<string, Record<string, number>>
  ) => {
    setConfigs(prev => {
      const next = { ...prev };
      for (const [ibId, assetMap] of Object.entries(updates)) {
        if (next[ibId]) {
          next[ibId] = {
            ...next[ibId],
            assets: next[ibId].assets.map(a => ({
              ...a,
              rebatePips: assetMap[a.assetType] !== undefined ? assetMap[a.assetType] : a.rebatePips,
            })),
          };
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (allNodes.length > 0) {
      const loadConfigs = async () => {
        const results = await Promise.allSettled(
          allNodes.map(ib => rebateApi.getConfig(ib.id, selectedAccountType))
        );

        const newConfigs: Record<string, RebateConfig> = {};
        results.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value.success) {
            newConfigs[allNodes[idx].id] = res.value.data;
          }
        });
        setConfigs(newConfigs);
      };
      loadConfigs();
    }
  }, [allNodes, configRefreshTrigger, selectedAccountType]);

  const assetTypes = activeAssetTypes;

  const getAssetConfig = (ibId: string | null | undefined, assetType: AssetType) => {
    if (!ibId) return undefined;
    return configs[ibId]?.assets.find(a => a.assetType === assetType);
  };

  const handleCompactSelectionChange = (rootId: string, level: number, ibId: string) => {
    setCompactSelection(prev => ({
      ...prev,
      [rootId]: { ...(prev[rootId] ?? {}), [level]: ibId },
    }));
  };

  const handleCascadeReset = (rootId: string, fromLevel: number) => {
    setCompactSelection(prev => {
      const rootSel = prev[rootId];
      if (!rootSel) return prev;
      const next: Record<number, string> = {};
      for (const [lvl, ibId] of Object.entries(rootSel)) {
        if (Number(lvl) < fromLevel) next[Number(lvl)] = ibId;
      }
      return { ...prev, [rootId]: next };
    });
  };

  const getMibMaxDisplay = (mibId: string, assetType: AssetType): number | null => {
    const mibAssetConfig = getAssetConfig(mibId, assetType);
    return mibAssetConfig ? (mibAssetConfig.maxPips ?? null) : null;
  };

  // Deep-link từ Notification: khi có ?ibId=xxx trên URL, tự động:
  // 1) dựng lại chuỗi tổ tiên (MIB -> ... -> ibId) để set compactSelection đúng nhánh
  // 2) nhảy tới đúng trang (paginatedGroups) chứa MIB gốc của nhánh đó
  // 3) tô sáng đúng cột (highlightIbId, đọc bởi CompactPivotTable)
  const deepLinkAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!deepLinkIbId || allNodes.length === 0) return;
    if (deepLinkAppliedRef.current === deepLinkIbId) return; // chỉ áp dụng 1 lần / mỗi ibId

    // Dựng đường đi từ root -> ibId dựa trên parentById
    const path: string[] = [];
    let current: string | null = deepLinkIbId;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
      seen.add(current);
      path.unshift(current);
      current = parentById[current] ?? null;
    }

    if (path.length === 0 || !ibNodesById[deepLinkIbId]) {
      // ibId trên URL không tồn tại trong cây hiện tại (đã bị xoá/đổi quyền xem...)
      deepLinkAppliedRef.current = deepLinkIbId;
      return;
    }

    const rootId = path[0];

    if (path.length > 1) {
      const selectionForRoot: Record<number, string> = {};
      for (let level = 1; level < path.length; level += 1) {
        selectionForRoot[level] = path[level];
      }
      setCompactSelection(prev => ({ ...prev, [rootId]: selectionForRoot }));
    }

    const groupIndex = groups.findIndex(g => g.root.id === rootId);
    if (groupIndex >= 0) {
      setCurrentPage(Math.floor(groupIndex / ITEMS_PER_PAGE) + 1);
    }

    setHighlightIbId(deepLinkIbId);
    deepLinkAppliedRef.current = deepLinkIbId;
  }, [deepLinkIbId, allNodes.length, parentById, ibNodesById, groups]);

  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    toast.info('Đang khởi tạo file báo cáo Excel toàn bộ các MIB...');
    try {
      const blob = await exportApi.getRebateTree();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_Cao_Rebate_Tat_Ca_MIB_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Xuất file Excel báo cáo toàn bộ MIB thành công!');
    } catch (err: any) {
      console.error('Failed to export excel:', err);
      toast.error('Lỗi khi xuất file Excel báo cáo Rebate.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header bar: Search MIB (Trái) + Select Loại tài khoản link + Phân Trang 1 2 3... Next (Giữa) + Export Excel (Phải) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 border border-gray-300 shadow-sm">
        {/* Ô Tìm Kiếm MIB & Select Box Loại tài khoản link */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm kiếm theo tên hoặc email của MIB..."
              className="w-full pl-9 pr-8 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-gray-600 whitespace-nowrap">Loại link:</span>
            <select
              value={selectedAccountType}
              onChange={(e) => {
                setSelectedAccountType(e.target.value);
                setCurrentPage(1);
              }}
              className="py-2 px-3 border border-amber-300 bg-amber-50 font-bold text-amber-950 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer rounded-none"
            >
              {['STD', 'STD5', 'STD10', 'STD15', 'STD20'].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cụm Phân Trang 1 2 3 ... Next */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1 text-sm font-semibold text-gray-700">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-2.5 py-1.5 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 border transition ${currentPage === page ? 'bg-blue-600 border-blue-600 text-white font-bold' : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-700'}`}
              >
                {page}
              </button>
            ))}

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1.5 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Nút Export Excel */}
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-sm font-semibold transition shadow-md hover:shadow-lg whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          Xuất Excel Bảng Gọn
        </button>
      </div>

      {isLoadingTree ? (
        <div className="rounded-none border border-gray-300 bg-white shadow-sm flex flex-col items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-500">{t('loading')}</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-none border border-gray-300 bg-white shadow-sm p-12 text-center text-gray-500">
          Không tìm thấy MIB nào phù hợp với từ khóa &quot;{searchQuery}&quot;.
        </div>
      ) : (
        // Render tối đa 2 MIB (paginatedGroups) per page
        paginatedGroups.map(({ root, ibs }) => (
          <MibBranchCard
            key={root.id}
            root={root}
            ibs={ibs}
            assetTypes={assetTypes}
            configs={configs}
            getMibMaxDisplay={getMibMaxDisplay}
            parentById={parentById}
            ibNodesById={ibNodesById}
            compactSelection={compactSelection}
            onSelectionChange={handleCompactSelectionChange}
            onCascadeReset={handleCascadeReset}
            noIbsText={t('noIbs')}
            onRefreshConfigs={handleRefreshConfigs}
            onOptimisticUpdateConfigs={handleOptimisticUpdateConfigs}
            highlightIbId={highlightIbId}
            selectedAccountType={selectedAccountType}
          />
        ))
      )}
    </div>
  );
}

export default function RebateManagementPage() {
  return (
    <Suspense fallback={null}>
      <RebateManagementPageInner />
    </Suspense>
  );
}

interface MibBranchCardProps {
  root: IbTreeNode;
  ibs: IbTreeNode[];
  assetTypes: AssetType[];
  configs: Record<string, RebateConfig>;
  getMibMaxDisplay: (mibId: string, assetType: AssetType) => number | null;
  parentById: Record<string, string | null>;
  ibNodesById: Record<string, IbTreeNode>;
  compactSelection: CompactSelection;
  onSelectionChange: (rootId: string, level: number, ibId: string) => void;
  onCascadeReset: (rootId: string, fromLevel: number) => void;
  noIbsText: string;
  onRefreshConfigs: () => void;
  onOptimisticUpdateConfigs: (updates: Record<string, Record<string, number>>) => void;
  highlightIbId?: string;
  selectedAccountType: string;
}

function MibBranchCard({
  root,
  ibs,
  assetTypes,
  configs,
  getMibMaxDisplay,
  parentById,
  ibNodesById,
  compactSelection,
  onSelectionChange,
  onCascadeReset,
  noIbsText,
  onRefreshConfigs,
  onOptimisticUpdateConfigs,
  highlightIbId,
  selectedAccountType,
}: MibBranchCardProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [draftPips, setDraftPips] = useState<Record<string, Record<string, number>>>({});
  const [historyStack, setHistoryStack] = useState<Array<Record<string, Record<string, number>>>>([]);
  const [activeScenarioNodes, setActiveScenarioNodes] = useState<Array<{ nodeId: string; pct: string; white_hold: number }>>([]);
  const [hasScenarioChanged, setHasScenarioChanged] = useState<boolean>(false);
  const initialScenarioKeyRef = useRef<string | null>(null);

  const handleActiveScenarioChange = useCallback((nodes: Array<{ nodeId: string; pct: string; white_hold: number }>) => {
    const key = JSON.stringify(nodes);
    if (initialScenarioKeyRef.current === null) {
      initialScenarioKeyRef.current = key;
    } else if (initialScenarioKeyRef.current !== key) {
      setHasScenarioChanged(true);
    }
    setActiveScenarioNodes(nodes);
  }, []);

  // Lưu giữ bảng snapshot cấu hình thực tế trong DB ngay TRƯỚC KHI thực hiện mỗi lần nhấn LƯU
  const [savedSnapshotHistory, setSavedSnapshotHistory] = useState<
    Array<Record<string, Record<string, number>>>
  >([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleToggleEdit = () => {
    if (!isEditing) {
      setIsEditing(true);
      toast.info(`Đã bật chế độ chỉnh sửa trực tiếp cho nhánh MIB: ${root.name || root.email}`);
    } else {
      setIsEditing(false);
      toast.info(`Đã tắt chế độ chỉnh sửa cho nhánh MIB: ${root.name || root.email}`);
    }
  };

  const handleCellEdit = (ibId: string, assetType: AssetType, newPips: number) => {
    // Luu snapshot vao historyStack cho chuc nang Khoi phuc thao tac go
    setHistoryStack(prev => [...prev, JSON.parse(JSON.stringify(draftPips))]);

    setDraftPips(prev => ({
      ...prev,
      [ibId]: {
        ...(prev[ibId] || {}),
        [assetType]: newPips,
      },
    }));
  };

  const handleRestore = async () => {
    // 1. In-memory Undo stack cho các thao tác gõ chưa lưu
    if (historyStack.length > 0) {
      const lastSnapshot = historyStack[historyStack.length - 1];
      setDraftPips(lastSnapshot);
      setHistoryStack(prev => prev.slice(0, -1));
      toast.success(`Đã khôi phục về thao tác gõ trước đó của nhánh.`);
      return;
    }

    // 2. Nếu đang có ô nhập dở chưa lưu, hủy nháp và reset về DB hiện tại
    if (Object.keys(draftPips).length > 0) {
      setDraftPips({});
      setHistoryStack([]);
      setIsEditing(false);
      onRefreshConfigs();
      toast.success(`Đã hủy bỏ các chỉnh sửa chưa lưu và quay lại cấu hình DB hiện tại.`);
      return;
    }

    // 3. Rollback cấu hình DB về bản lưu trước đó trong savedSnapshotHistory
    if (savedSnapshotHistory.length > 0) {
      setIsSaving(true);
      try {
        const previousSavedState = savedSnapshotHistory[savedSnapshotHistory.length - 1];

        // 🚀 OPTIMISTIC UPDATE REALTIME (0ms): Cập nhật trực tiếp lên màn hình lập tức
        onOptimisticUpdateConfigs(previousSavedState);

        const revertItems = Object.entries(previousSavedState).map(([ibId, assetMap]) => {
          const existingAssets = configs[ibId]?.assets || [];
          return {
            ibId,
            assets: Object.entries(assetMap).map(([assetType, rebatePips]) => {
              const existing = existingAssets.find(a => a.assetType === assetType);
              return {
                assetType: assetType as AssetType,
                rebateType: (existing?.rebateType || 'STP_REBATE') as any,
                maxPips: Number(existing?.maxPips || MAX_PIPS[assetType as AssetType] || 0),
                rebatePips,
                markupPips: Number(existing?.markupPips || 0),
                markupPercent: Number(existing?.markupPercent || 100),
              };
            }),
          };
        });

        const res = await rebateApi.bulkUpdateConfig(revertItems);
        if (res && res.failCount === 0 && res.successCount > 0) {
          toast.success(`Đã khôi phục thành công cấu hình nhánh MIB (${root.name || root.email}) về thiết lập trước khi lưu!`);
          queryClient.invalidateQueries({ queryKey: ['ibTree'] });
          onRefreshConfigs();
          setSavedSnapshotHistory(prev => prev.slice(0, -1));
          setDraftPips({});
          setHistoryStack([]);
          setIsEditing(false);
        } else {
          toast.error('Lỗi khi khôi phục cấu hình trước đó.');
          onRefreshConfigs();
        }
      } catch (err: any) {
        toast.error('Lỗi kết nối khi khôi phục cấu hình');
        onRefreshConfigs();
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // 4. Nếu chưa có bản lưu trước đó
    toast.info(`Chưa có bản lưu trước đó để khôi phục cho nhánh ${root.name || root.email}.`);
    setDraftPips({});
    setHistoryStack([]);
    setIsEditing(false);
    onRefreshConfigs();
  };

  const handleSave = async () => {
    const editedIbIds = Object.keys(draftPips);
    const hasScenarioToSave = activeScenarioNodes.length > 0 && (hasScenarioChanged || editedIbIds.length > 0);

    if (editedIbIds.length === 0 && !hasScenarioToSave) {
      toast.info('Không có thay đổi nào cần lưu.');
      setIsEditing(false);
      return;
    }

    // Capture snapshot của cấu hình DB hiện tại ngay trước khi Lưu mới
    const snapshotBeforeSave: Record<string, Record<string, number>> = {};
    const branchNodes = [root, ...ibs];
    for (const node of branchNodes) {
      const assetMap: Record<string, number> = {};
      const existingAssets = configs[node.id]?.assets || [];
      for (const a of existingAssets) {
        assetMap[a.assetType] = Number(a.rebatePips || 0);
      }
      snapshotBeforeSave[node.id] = assetMap;
    }

    // 🚀 OPTIMISTIC UPDATE REALTIME (0ms) khi Lưu
    if (editedIbIds.length > 0) {
      onOptimisticUpdateConfigs(draftPips);
    }

    setIsSaving(true);
    try {
      // 1. Lưu thay đổi cấu hình Rebate Pips nếu có gõ nháp
      if (editedIbIds.length > 0) {
        const items = editedIbIds.map(ibId => {
          const existingAssets = configs[ibId]?.assets || [];
          const assetMap = draftPips[ibId];

          return {
            ibId,
            accountType: selectedAccountType,
            assets: Object.entries(assetMap).map(([assetType, rebatePips]) => {
              const existing = existingAssets.find(a => a.assetType === assetType);
              return {
                assetType: assetType as AssetType,
                rebateType: (existing?.rebateType || 'STP_REBATE') as any,
                maxPips: Number(existing?.maxPips || MAX_PIPS[assetType as AssetType] || 0),
                rebatePips,
                markupPips: Number(existing?.markupPips || 0),
                markupPercent: Number(existing?.markupPercent || 100),
                accountType: selectedAccountType,
              };
            }),
          };
        });

        const bulkRes = await rebateApi.bulkUpdateConfig(items, undefined, selectedAccountType);
        if (bulkRes && bulkRes.failCount > 0) {
          const failedItems = bulkRes.results?.filter((r: any) => !r.success) || [];
          const errMsg = failedItems.map((f: any) => f.error?.message || 'Lỗi lưu cấu hình').join('; ');
          toast.error(`Không thể lưu cấu hình cho một số IB: ${errMsg}`);
          onRefreshConfigs();
          setIsSaving(false);
          return;
        }
      }

      // 2. Đồng thời lưu Kịch bản Markup Option (Tỷ lệ % & Số Pips Giữ Lại) vào DB
      if (hasScenarioToSave) {
        const payloadNodes = activeScenarioNodes.map((node) => {
          const pctNum = parseFloat(node.pct.replace('%', ''));
          return {
            ibId: node.nodeId,
            accountType: selectedAccountType,
            markupPercent: isNaN(pctNum) ? 100 : pctNum,
            markupPips: node.white_hold,
          };
        });
        await rebateApi.saveBranchScenario(payloadNodes, selectedAccountType);
      }

      toast.success(`Đã lưu đồng thời Cấu hình Rebate & Kịch bản Markup cho nhánh ${root.name || root.email} vào cơ sở dữ liệu thành công!`);
      queryClient.invalidateQueries({ queryKey: ['ibTree'] });
      setSavedSnapshotHistory(prev => [...prev, snapshotBeforeSave]);
      onRefreshConfigs();
      setDraftPips({});
      setHistoryStack([]);
      setHasScenarioChanged(false);
      initialScenarioKeyRef.current = JSON.stringify(activeScenarioNodes);
      setIsEditing(false);
    } catch (err: any) {
      toast.error('Lỗi kết nối khi lưu cấu hình');
      onRefreshConfigs();
    } finally {
      setIsSaving(false);
    }
  };

  const isSaveDisabled = isSaving || (!isEditing && Object.keys(draftPips).length === 0 && !hasScenarioChanged);

  return (
    <div className="rounded-none border border-gray-300 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Card Header with 3 Action Buttons on Top-Right as requested */}
      <div className="px-4 py-3 border-b border-gray-300 bg-indigo-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded-none text-[10px] font-bold bg-indigo-100 text-indigo-700">MIB</span>
          <span className="font-semibold text-gray-900">{root.name || root.email}</span>
          <span className="text-xs text-gray-500">({root.email})</span>
        </div>

        {/* 3 Action Buttons per Branch Table: Chỉnh Sửa | Khôi Phục | Lưu */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleEdit}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer ${isEditing ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-400' : ''
              }`}
          >
            <Edit3 className="h-3.5 w-3.5" />
            {isEditing ? 'Đang Chỉnh Sửa' : 'Chỉnh Sửa'}
          </button>

          <button
            onClick={handleRestore}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded bg-slate-600 hover:bg-slate-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Khôi phục về cấu hình trước đó của nhánh"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Khôi Phục
          </button>

          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer disabled:opacity-40"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isSaving ? 'Đang Lưu...' : 'Lưu'}
          </button>
        </div>
      </div>

      {ibs.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm">{noIbsText}</div>
      ) : (
        <CompactPivotTable
          rootId={root.id}
          rootIb={root}
          ibs={ibs}
          assetTypes={assetTypes}
          configs={configs}
          getMibMaxDisplay={getMibMaxDisplay}
          parentById={parentById}
          ibNodesById={ibNodesById}
          selection={compactSelection}
          onSelectionChange={onSelectionChange}
          onCascadeReset={onCascadeReset}
          isEditing={isEditing}
          draftPips={draftPips}
          onCellEdit={handleCellEdit}
          onActiveScenarioChange={handleActiveScenarioChange}
          highlightIbId={highlightIbId}
          selectedAccountType={selectedAccountType}
        />
      )}
    </div>
  );
}

/**
 * Bảng dạng Google Sheet mẫu: dòng = Asset Type, cột = từng Level trong nhánh MIB.
 * Hỗ trợ SVG overlay mũi tên cha-con khi showArrows=true.
 */
function PivotTable({
  rootId,
  ibs,
  assetTypes,
  configs,
  getMibMaxDisplay,
  parentById,
  showArrows,
}: {
  rootId: string;
  ibs: IbTreeNode[];
  assetTypes: AssetType[];
  configs: Record<string, RebateConfig>;
  getMibMaxDisplay: (mibId: string, assetType: AssetType) => number | null;
  parentById: Record<string, string | null>;
  showArrows: boolean;
}) {
  const t = useTranslations('RebateManagement');
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Composite key hoveredArrowKey = "${ib.id}__${assetType}" — chỉ highlight đúng hàng đang hover
  const [hoveredArrowKey, setHoveredArrowKey] = useState<string | null>(null);

  const maxLevel = ibs.reduce((max, ib) => Math.max(max, ib.level), 0);
  const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);
  const ibsByLevel = (lvl: number) => ibs.filter(ib => ib.level === lvl);

  // Tập hợp cặp cha-con trực tiếp để vẽ arrow
  const parentChildPairs = useMemo(() => {
    return ibs
      .filter(ib => parentById[ib.id] !== null && parentById[ib.id] !== undefined)
      .map(ib => ({ parentId: parentById[ib.id]!, childId: ib.id }))
      // Chỉ vẽ quan hệ cha-con nội bộ trong subtree này (cha cũng phải trong ibs hoặc là root)
      .filter(({ parentId }) => ibs.some(n => n.id === parentId) || parentId === rootId);
  }, [ibs, parentById, rootId]);

  return (
    <div ref={containerRef} className="overflow-auto relative">
      {/* SVG Arrow Overlay — chỉ render khi showArrows=true */}
      <PivotArrowOverlay
        enabled={showArrows}
        parentChildPairs={parentChildPairs}
        assetTypes={assetTypes}
        containerRef={containerRef}
        hoveredArrowKey={hoveredArrowKey}
      />
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
            <th className="px-4 py-3 border-b border-gray-200 min-w-[160px] text-center bg-emerald-50 text-emerald-700">
              {t('capColumn')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {assetTypes.map(asset => {
            const companyMax = MAX_PIPS[asset];
            const mibMax = getMibMaxDisplay(rootId, asset);
            const isOverride = mibMax !== null && mibMax !== companyMax;

            return (
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
                        const allocated = Number(assetConfig.maxPips);
                        const parentId = parentById[ib.id];
                        const parentAssetConfig = parentId ? configs[parentId]?.assets.find(a => a.assetType === asset) : null;

                        const remaining = (() => {
                          if (!parentId) return allocated;
                          if (!parentAssetConfig) return null;
                          return Math.max(0, Number(parentAssetConfig.maxPips) - allocated);
                        })();
                        return (
                          <div
                            key={ib.id}
                            className="flex flex-col items-center"
                            onMouseEnter={() => setHoveredArrowKey(`${ib.id}__${asset}`)}
                            onMouseLeave={() => setHoveredArrowKey(null)}
                          >
                            <div className="text-xs text-gray-400">Cấp: {allocated}</div>
                            <div
                              data-arrow-id={`${ib.id}__${asset}`}
                              className="text-lg font-bold text-emerald-700 px-2 py-0.5"
                            >
                              {remaining !== null ? remaining : '—'}
                            </div>
                            <span className="text-[9px] text-gray-400 truncate max-w-[90px]" title={ib.email}>
                              {ib.name || ib.email}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                ))}
                <td className="px-4 py-2 text-center bg-emerald-50/40">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-medium text-emerald-700">{t('companyCap', { max: companyMax })}</div>
                    <div className={`text-[10px] ${isOverride ? 'font-semibold text-amber-700' : 'text-emerald-700'}`}>
                      {t('mibCap', { max: mibMax ?? '—' })}
                    </div>
                    {isOverride ? (
                      <div className="inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                        {t('overrideBadge')}
                      </div>
                    ) : null}
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