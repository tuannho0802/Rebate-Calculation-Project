'use client';

import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { rebateApi } from '@/lib/api/rebate';
import { AssetType, RebateConfig, MAX_PIPS, IbTreeNode } from '@/types';
import { Loader2, Table2, Sheet, LayoutGrid, Eye, Download, GitBranch, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { normalizeTreeRoots, flattenIbTree } from '@/lib/tree-utils';
import { PivotArrowOverlay } from '@/components/rebate/PivotArrowOverlay';
import { CompactPivotTable, CompactSelection } from '@/components/rebate/CompactPivotTable';
import { solveBallAllocation, SolverNodeInput } from '@/lib/ai-rebate-solver';

export default function RebateManagementPage() {
  const t = useTranslations('RebateManagement');
  const [viewMode, setViewMode] = useState<'flat' | 'pivot' | 'compact'>('flat');
  const [configs, setConfigs] = useState<Record<string, RebateConfig>>({});
  // Lifted-up selection cho CompactPivotTable: [rootId][level] = ibId
  const [compactSelection, setCompactSelection] = useState<CompactSelection>({});
  // Search & Pagination state (2 MIBs per page)
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 2;

  const mounted = useSyncExternalStore(
    () => () => {},
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
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(g =>
      (g.root.name && g.root.name.toLowerCase().includes(q)) ||
      (g.root.email && g.root.email.toLowerCase().includes(q))
    );
  }, [groups, searchQuery]);

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

  useEffect(() => {
    if (allNodes.length > 0) {
      const loadConfigs = async () => {
        const results = await Promise.allSettled(
          allNodes.map(ib => rebateApi.getConfig(ib.id))
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
  }, [allNodes]);

  const assetTypes = Object.values(AssetType);

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

  const getMibMaxDisplay = (mibId: string, assetType: AssetType) => {
    const mibAssetConfig = getAssetConfig(mibId, assetType);
    return mibAssetConfig ? mibAssetConfig.maxPips : null;
  };

  const handleExportExcel = async () => {
    if (!roots || roots.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Rebate Calculation System';
    workbook.lastModifiedBy = 'Admin';
    workbook.created = new Date();

    function findLeafBranches(rootNode: IbTreeNode): IbTreeNode[][] {
      const branches: IbTreeNode[][] = [];

      function walk(currentNode: IbTreeNode, currentPath: IbTreeNode[]) {
        const activeChildren = (currentNode.children ?? []).filter(c => c.isActive);
        const newPath = [...currentPath, currentNode];

        if (activeChildren.length === 0) {
          branches.push(newPath);
        } else {
          for (const child of activeChildren) {
            walk(child, newPath);
          }
        }
      }

      walk(rootNode, []);
      return branches;
    }

    roots.forEach((rootIb, rIdx) => {
      const mibName = rootIb.name || rootIb.email;
      const rawSheetName = `MIB_${rIdx + 1}_${mibName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const sheetName = rawSheetName.slice(0, 30);

      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: true }],
      });

      const branches = findLeafBranches(rootIb);

      branches.forEach((branch, bIdx) => {
        const colCount = Math.max(branch.length + 3, 5);

        // 1. Branch Banner Header
        const branchTitle = branch
          .map((n, idx) => (idx === 0 ? `MIB: ${n.name || n.email}` : `Level ${idx}: ${n.name || n.email}`))
          .join(' ➔ ');

        const titleRow = worksheet.addRow([`NHÁNH ${bIdx + 1}: ${branchTitle}`]);
        worksheet.mergeCells(titleRow.number, 1, titleRow.number, colCount);
        const titleCell = titleRow.getCell(1);
        titleCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E40AF' } }; // Royal Blue
        titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        titleRow.height = 28;

        worksheet.addRow([]);

        // 2. REBATE TABLE
        const rebateSubTitle = worksheet.addRow(['I. BẢNG REBATE CÒN LẠI (RETAINED PIPS)']);
        worksheet.mergeCells(rebateSubTitle.number, 1, rebateSubTitle.number, colCount);
        const subCell1 = rebateSubTitle.getCell(1);
        subCell1.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: '0F172A' } };
        rebateSubTitle.height = 22;

        const rebateHeaderRow = worksheet.addRow([
          'Asset Type',
          ...branch.map((n, idx) => (idx === 0 ? `MIB (${n.name || n.email})` : `Level ${idx} (${n.name || n.email})`)),
          'Company Cap',
          'Allocated',
        ]);
        rebateHeaderRow.height = 24;

        rebateHeaderRow.eachCell((cell) => {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '334155' } }; // Dark Slate
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: '94A3B8' } },
            left: { style: 'thin', color: { argb: '94A3B8' } },
            bottom: { style: 'thin', color: { argb: '94A3B8' } },
            right: { style: 'thin', color: { argb: '94A3B8' } },
          };
        });

        const level1NodeInBranch = branch[1];
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

        const level1MarkupPips = parseAccountTypePips(level1NodeInBranch?.accountType);

        assetTypes.forEach((asset, aIdx) => {
          const companyCap = MAX_PIPS[asset];
          const mibBaseCap = getMibMaxDisplay(rootIb.id, asset) ?? Number(configs[rootIb.id]?.assets?.find(a => a.assetType === asset)?.maxPips || 0);
          const mibCap = mibBaseCap > 0 ? mibBaseCap + level1MarkupPips : 0;

          const rowCells: any[] = [asset];
          let branchSum = 0;

          for (let i = 0; i < branch.length; i++) {
            const currentNode = branch[i];
            if (i === 0) {
              const nextNode = branch[1];
              const nextRebate = nextNode ? Number(configs[nextNode.id]?.assets?.find(a => a.assetType === asset)?.rebatePips || 0) : 0;
              const mibRetained = nextNode ? Math.max(0, mibCap - nextRebate) : mibCap;
              rowCells.push(mibRetained);
              branchSum += mibRetained;
            } else {
              const currentRebate = Number(configs[currentNode.id]?.assets?.find(a => a.assetType === asset)?.rebatePips || 0);
              const nextNode = branch[i + 1];
              const nextRebate = nextNode ? Number(configs[nextNode.id]?.assets?.find(a => a.assetType === asset)?.rebatePips || 0) : 0;
              const retained = nextNode ? Math.max(0, currentRebate - nextRebate) : currentRebate;
              rowCells.push(retained);
              branchSum += retained;
            }
          }

          rowCells.push(companyCap);
          rowCells.push(branchSum);

          const dataRow = worksheet.addRow(rowCells);
          dataRow.height = 20;

          const isEven = aIdx % 2 === 0;
          const bgColor = isEven ? 'FFFFFF' : 'F8FAFC';

          dataRow.eachCell((cell, colIdx) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
            cell.alignment = { vertical: 'middle', horizontal: colIdx === 1 ? 'left' : 'center' };
            cell.font = {
              name: 'Segoe UI',
              size: 10,
              bold: colIdx > 1,
              color: { argb: colIdx === rowCells.length ? '059669' : (colIdx === rowCells.length - 1 ? '047857' : '0F172A') },
            };
            cell.border = {
              top: { style: 'thin', color: { argb: 'E2E8F0' } },
              left: { style: 'thin', color: { argb: 'E2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
              right: { style: 'thin', color: { argb: 'E2E8F0' } },
            };
          });
        });

        worksheet.addRow([]);

        // 3. MARKUP OPTION TABLE (AI REBATE ENGINE)
        const markupSubTitle = worksheet.addRow(['II. BẢNG CẤU HÌNH MARKUP OPTION (TỶ LỆ % & PIPS THỰC NHẬN)']);
        worksheet.mergeCells(markupSubTitle.number, 1, markupSubTitle.number, branch.length + 1);
        const subCell2 = markupSubTitle.getCell(1);
        subCell2.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: '0F172A' } };
        markupSubTitle.height = 22;

        const markupHeaderRow = worksheet.addRow([
          'Markup Option',
          ...branch.map((n, idx) => (idx === 0 ? `MIB (${n.name || n.email})` : `Level ${idx} (${n.name || n.email})`)),
        ]);
        markupHeaderRow.height = 24;

        markupHeaderRow.eachCell((cell) => {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4338CA' } }; // Indigo Header
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: '818CF8' } },
            left: { style: 'thin', color: { argb: '818CF8' } },
            bottom: { style: 'thin', color: { argb: '818CF8' } },
            right: { style: 'thin', color: { argb: '818CF8' } },
          };
        });

        // Run AI Rebate Engine Solver for this branch
        const solverInput: SolverNodeInput[] = branch.map((node, idx) => {
          const isRoot = idx === 0;
          const name = isRoot ? (rootIb.name ?? rootIb.email) : (node.name ?? node.email);
          const lvl = node.level;
          const assets: Record<string, number> = {};

          assetTypes.forEach((asset) => {
            if (isRoot) {
              const mibAssetConfig = configs[rootIb.id]?.assets?.find(a => a.assetType === asset);
              const mibBaseCap = getMibMaxDisplay(rootIb.id, asset) ?? Number(mibAssetConfig?.maxPips || 0);
              assets[asset] = mibBaseCap > 0 ? mibBaseCap + level1MarkupPips : 0;
            } else {
              const cfg = configs[node.id]?.assets?.find(a => a.assetType === asset);
              assets[asset] = Number(cfg?.rebatePips || 0);
            }
          });

          return {
            nodeId: node.id,
            nodeName: name,
            level: lvl,
            assets,
          };
        });

        const scenarios = solveBallAllocation(solverInput, level1MarkupPips || 10, assetTypes);
        const topScenario = scenarios[0];
        const scenarioMap: Record<string, { pct: string; white_hold: number }> = {};
        if (topScenario) {
          topScenario.nodes.forEach((n) => {
            scenarioMap[n.nodeId] = { pct: n.pct, white_hold: n.white_hold };
          });
        }

        const percentRowVals: any[] = ['Tỷ Lệ % Giữ Lại'];
        branch.forEach((n) => {
          const cfg = configs[n.id]?.assets?.[0];
          const pctFromDb = cfg?.markupPercent !== undefined && cfg?.markupPercent !== null ? `${cfg.markupPercent}%` : null;
          percentRowVals.push(pctFromDb ?? scenarioMap[n.id]?.pct ?? '0%');
        });
        const percentRow = worksheet.addRow(percentRowVals);
        percentRow.height = 22;

        percentRow.eachCell((cell, colIdx) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } }; // Warm Amber
          cell.alignment = { vertical: 'middle', horizontal: colIdx === 1 ? 'left' : 'center' };
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: '92400E' } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FDE68A' } },
            left: { style: 'thin', color: { argb: 'FDE68A' } },
            bottom: { style: 'thin', color: { argb: 'FDE68A' } },
            right: { style: 'thin', color: { argb: 'FDE68A' } },
          };
        });

        const optRowVals: any[] = [`${level1NodeInBranch?.accountType || 'STD'} (${level1MarkupPips || 10} Pips)`];
        branch.forEach((n) => {
          const cfg = configs[n.id]?.assets?.[0];
          const pipsFromDb = cfg?.markupPips !== undefined && cfg?.markupPips !== null ? Number(cfg.markupPips) : null;
          optRowVals.push(pipsFromDb ?? scenarioMap[n.id]?.white_hold ?? 0);
        });
        const optRow = worksheet.addRow(optRowVals);
        optRow.height = 20;

        optRow.eachCell((cell, colIdx) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F9FF' } }; // Light Sky Blue
          cell.alignment = { vertical: 'middle', horizontal: colIdx === 1 ? 'left' : 'center' };
          cell.font = { name: 'Segoe UI', size: 10, bold: colIdx > 1, color: { argb: '1E40AF' } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'BAE6FD' } },
            left: { style: 'thin', color: { argb: 'BAE6FD' } },
            bottom: { style: 'thin', color: { argb: 'BAE6FD' } },
            right: { style: 'thin', color: { argb: 'BAE6FD' } },
          };
        });

        worksheet.addRow([]);
        worksheet.addRow([]);
      });

      worksheet.columns.forEach((column, colIdx) => {
        if (colIdx === 0) {
          column.width = 25;
        } else {
          column.width = 28;
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Bang_Gon_Rebate_Markup_All_Branches_${new Date().toISOString().slice(0, 10)}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header bar: Search MIB (Trái) + Phân Trang 1 2 3... Next (Giữa) + Export Excel (Phải) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 border border-gray-300 shadow-sm">
        {/* Ô Tìm Kiếm MIB */}
        <div className="relative flex-1 max-w-md">
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
          <div key={root.id} className="rounded-none border border-gray-300 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-300 bg-indigo-50/70 flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-none text-[10px] font-bold bg-indigo-100 text-indigo-700">MIB</span>
              <span className="font-semibold text-gray-900">{root.name || root.email}</span>
              <span className="text-xs text-gray-500">({root.email})</span>
            </div>
            {ibs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">{t('noIbs')}</div>
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
                onSelectionChange={handleCompactSelectionChange}
                onCascadeReset={handleCascadeReset}
              />
            )}
          </div>
        ))
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
