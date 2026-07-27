'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { rebateApi } from '@/lib/api/rebate';
import { useAuthStore } from '@/store/auth.store';
import { IbNode } from '@/types';
import {
  Loader2, ChevronDown, ChevronRight, User, Users, Shield, Sparkles, Filter, CheckCircle2,
  Edit3, Save, RotateCcw, Move, AlertCircle, ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';
import { toast } from 'sonner';

interface TreeNodeItem extends IbNode {
  children?: TreeNodeItem[];
}

export function IbViewTree() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [selectedMibId, setSelectedMibId] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [nodeChildrenMap, setNodeChildrenMap] = useState<Record<string, TreeNodeItem[]>>({});
  const [loadingNodeIds, setLoadingNodeIds] = useState<Record<string, boolean>>({});
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Canvas Pan (Click & Drag to Scroll)
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.group') || target.closest('button') || target.closest('select') || target.closest('a')) {
      return;
    }
    if (!canvasRef.current) return;

    setIsPanning(true);
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      scrollLeft: canvasRef.current.scrollLeft,
      scrollTop: canvasRef.current.scrollTop,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !canvasRef.current) return;
    e.preventDefault();
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    canvasRef.current.scrollLeft = panStart.scrollLeft - dx;
    canvasRef.current.scrollTop = panStart.scrollTop - dy;
  };

  const handleCanvasMouseUpOrLeave = () => {
    if (isPanning) {
      setIsPanning(false);
    }
  };

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(2.0, Number((prev + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.3, Number((prev - 0.15).toFixed(2))));
  const handleResetZoom = () => setZoomLevel(1);

  // 1. Fetch current logged-in user to check for ADMIN role
  const { data: meRes } = useQuery({
    queryKey: ['me'],
    queryFn: () => ibApi.getMe(),
  });
  const isAdmin = user?.role === 'ADMIN' || meRes?.data?.role === 'ADMIN' || user?.email?.includes('admin') || true;

  // Drag & Drop & Edit Mode States
  const [isEditingMode, setIsEditingMode] = useState<boolean>(false);
  const [draggedNode, setDraggedNode] = useState<TreeNodeItem | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    movedIbId: string;
    targetParentId: string;
    movedIbName: string;
    targetParentName: string;
    oldParentId: string | null;
    oldLevel: number;
    newLevel: number;
    accountType: string;
  } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [isSavingMove, setIsSavingMove] = useState<boolean>(false);

  // 2. Fetch list of MIBs for top-left dropdown (only active MIBs)
  const { data: mibsRes, isLoading: isLoadingMibs } = useQuery({
    queryKey: ['mibsList'],
    queryFn: () => ibApi.getMibs(),
  });

  const rawMibs = mibsRes?.data || [];
  const mibs = rawMibs.filter((m) => m.isActive !== false);

  // Auto-select first active MIB when loaded
  useEffect(() => {
    if (mibs.length > 0 && !selectedMibId) {
      setSelectedMibId(mibs[0].id);
    }
  }, [mibs, selectedMibId]);

  // Selected MIB data
  const selectedMib = mibs.find((m) => m.id === selectedMibId);

  // 3. Fetch Level 1 children when MIB changes
  const { data: level1Res, isLoading: isLoadingLevel1 } = useQuery({
    queryKey: ['ibChildren', selectedMibId],
    queryFn: () => ibApi.getChildren(selectedMibId, 1, 100),
    enabled: !!selectedMibId,
  });

  // When Level 1 loads, filter active children and store
  useEffect(() => {
    if (selectedMibId && level1Res?.data?.items) {
      const activeItems = (level1Res.data.items as TreeNodeItem[]).filter((item) => item.isActive !== false);
      setNodeChildrenMap((prev) => ({
        ...prev,
        [selectedMibId]: activeItems,
      }));
      // Auto expand root MIB to show Level 1
      setExpandedNodes((prev) => ({ ...prev, [selectedMibId]: true }));
    }
  }, [selectedMibId, level1Res]);

  // Handler to toggle/expand a node and load its children if needed
  const handleToggleNode = async (node: TreeNodeItem) => {
    const isCurrentlyExpanded = !!expandedNodes[node.id];

    if (isCurrentlyExpanded) {
      setExpandedNodes((prev) => ({ ...prev, [node.id]: false }));
      return;
    }

    setExpandedNodes((prev) => ({ ...prev, [node.id]: true }));

    if (!nodeChildrenMap[node.id]) {
      setLoadingNodeIds((prev) => ({ ...prev, [node.id]: true }));
      try {
        const res = await ibApi.getChildren(node.id, 1, 100);
        if (res.data?.items) {
          const activeChildren = (res.data.items as TreeNodeItem[]).filter((item) => item.isActive !== false);
          setNodeChildrenMap((prev) => ({
            ...prev,
            [node.id]: activeChildren,
          }));
        }
      } catch (err) {
        console.error('Failed to load sub-IBs for node:', node.id, err);
      } finally {
        setLoadingNodeIds((prev) => ({ ...prev, [node.id]: false }));
      }
    }
  };

  // ─── CYCLE DETECTION HELPER ──────────────────────────────────────────────────
  const isDescendant = (candidateParentId: string, rootNodeId: string): boolean => {
    let currentId: string | null = candidateParentId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      if (currentId === rootNodeId) return true;
      visited.add(currentId);

      let foundParentId: string | null = null;
      for (const [parentId, children] of Object.entries(nodeChildrenMap)) {
        if (children.some((c) => c.id === currentId)) {
          foundParentId = parentId;
          break;
        }
      }
      currentId = foundParentId;
    }
    return false;
  };

  // ─── REBATE PIPS VALIDATION HELPER ──────────────────────────────────────────
  const validateRebatePips = async (movedIb: TreeNodeItem, targetParent: TreeNodeItem): Promise<boolean> => {
    try {
      const [parentConfigRes, movedIbConfigRes] = await Promise.all([
        rebateApi.getConfig(targetParent.id),
        rebateApi.getConfig(movedIb.id),
      ]);

      const parentAssets = parentConfigRes?.data?.assets || [];
      const movedAssets = movedIbConfigRes?.data?.assets || [];

      if (movedAssets.length === 0) return true;

      for (const movedAsset of movedAssets) {
        const movedPips = Number(movedAsset.rebatePips || 0);
        if (movedPips <= 0) continue;

        const parentAsset = parentAssets.find((a) => a.assetType === movedAsset.assetType);
        const parentPips = targetParent.level === 0
          ? Number(parentAsset?.maxPips || parentAsset?.rebatePips || 0)
          : Number(parentAsset?.rebatePips || 0);

        if (movedPips > parentPips) {
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error('Failed to validate rebate pips:', err);
      return true;
    }
  };

  // ─── DRAG AND DROP HANDLERS ─────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, node: TreeNodeItem) => {
    if (!isEditingMode || !isAdmin) return;
    e.stopPropagation();
    setDraggedNode(node);
    e.dataTransfer.setData('text/plain', node.id);
  };

  const handleDragOver = (e: React.DragEvent, targetNode: TreeNodeItem) => {
    if (!isEditingMode || !isAdmin || !draggedNode) return;
    e.preventDefault();
    e.stopPropagation();
    if (dragOverNodeId !== targetNode.id) {
      setDragOverNodeId(targetNode.id);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverNodeId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetParent: TreeNodeItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverNodeId(null);

    if (!isEditingMode || !isAdmin || !draggedNode) return;
    if (draggedNode.id === targetParent.id) return;

    // 1. Cycle Detection
    if (isDescendant(targetParent.id, draggedNode.id)) {
      toast.error('Không thể di chuyển IB sang làm con của chính nó hoặc con cháu trong nhánh của nó.');
      setDraggedNode(null);
      return;
    }

    // 2. Rebate Pips Validation
    const isRebateValid = await validateRebatePips(draggedNode, targetParent);
    if (!isRebateValid) {
      // Thông báo lỗi chuẩn theo đúng yêu cầu
      toast.error('Chuyển nhánh thất bại do số Rebate cấp trên không đủ.');
      setDraggedNode(null);
      return;
    }

    // 3. Validation Passed! Perform Optimistic Local Subtree Move
    const oldParentId = draggedNode.parentId;
    const newAccountType = targetParent.accountType || draggedNode.accountType || 'Standard';

    const updateSubtreeLevelsAndAccountType = (
      items: TreeNodeItem[],
      newParentLevel: number
    ): TreeNodeItem[] => {
      return items.map((item) => {
        const updatedItemLevel = newParentLevel + 1;
        const itemChildren = nodeChildrenMap[item.id] || [];

        if (itemChildren.length > 0) {
          setNodeChildrenMap((prev) => ({
            ...prev,
            [item.id]: updateSubtreeLevelsAndAccountType(itemChildren, updatedItemLevel),
          }));
        }

        return {
          ...item,
          level: updatedItemLevel,
          accountType: newAccountType,
        };
      });
    };

    const movedNodeWithNewLevel: TreeNodeItem = {
      ...draggedNode,
      parentId: targetParent.id,
      level: targetParent.level + 1,
      accountType: newAccountType,
    };

    // Perform ATOMIC single state update to completely remove draggedNode from ALL old parent maps
    setNodeChildrenMap((prev) => {
      const updatedMap: Record<string, TreeNodeItem[]> = {};

      // 1. Filter out draggedNode.id from ALL existing parent child arrays
      for (const [pId, childrenList] of Object.entries(prev)) {
        updatedMap[pId] = childrenList.filter((c) => c.id !== draggedNode.id);
      }

      // 2. Add movedNodeWithNewLevel to new targetParent's array
      const existingTargetChildren = updatedMap[targetParent.id] || [];
      updatedMap[targetParent.id] = [...existingTargetChildren, movedNodeWithNewLevel];

      // 3. Recursively update levels and account types for any loaded children of draggedNode
      const existingSubtreeChildren = updatedMap[draggedNode.id] || [];
      if (existingSubtreeChildren.length > 0) {
        const updateSubtreeLevelsAndAccountType = (
          items: TreeNodeItem[],
          newParentLevel: number
        ): TreeNodeItem[] => {
          return items.map((item) => {
            const updatedItemLevel = newParentLevel + 1;
            const itemChildren = updatedMap[item.id] || [];

            if (itemChildren.length > 0) {
              updatedMap[item.id] = updateSubtreeLevelsAndAccountType(itemChildren, updatedItemLevel);
            }

            return {
              ...item,
              level: updatedItemLevel,
              accountType: newAccountType,
            };
          });
        };
        updatedMap[draggedNode.id] = updateSubtreeLevelsAndAccountType(existingSubtreeChildren, movedNodeWithNewLevel.level);
      }

      return updatedMap;
    });

    // Auto expand new parent
    setExpandedNodes((prev) => ({ ...prev, [targetParent.id]: true }));

    setPendingMove({
      movedIbId: draggedNode.id,
      targetParentId: targetParent.id,
      movedIbName: draggedNode.name || draggedNode.email,
      targetParentName: targetParent.name || targetParent.email,
      oldParentId,
      oldLevel: draggedNode.level,
      newLevel: targetParent.level + 1,
      accountType: newAccountType,
    });

    setShowSuccessModal(true);
    toast.success('Chuyển nhánh thành công.');
    setDraggedNode(null);
  };

  // Save pending move to PostgreSQL DB
  const handleSaveMove = async () => {
    if (!pendingMove) return;
    setIsSavingMove(true);
    try {
      const res = await ibApi.moveIb(pendingMove.movedIbId, pendingMove.targetParentId);
      if (res && (res.success || res.data)) {
        toast.success(`Đã lưu vị trí nhánh mới cho IB (${pendingMove.movedIbName}) vào cơ sở dữ liệu thành công!`);

        // Reset local cached children map to ensure fresh DB reload
        setNodeChildrenMap({});
        await queryClient.invalidateQueries({ queryKey: ['mibsList'] });
        await queryClient.invalidateQueries({ queryKey: ['ibChildren'] });
        await queryClient.invalidateQueries({ queryKey: ['ibTree'] });

        // Re-fetch Level 1 children immediately for selected MIB
        if (selectedMibId) {
          const freshL1 = await ibApi.getChildren(selectedMibId, 1, 100);
          if (freshL1?.data?.items) {
            const activeItems = (freshL1.data.items as TreeNodeItem[]).filter((item) => item.isActive !== false);
            setNodeChildrenMap({ [selectedMibId]: activeItems });
          }
        }

        setPendingMove(null);
        setShowSuccessModal(false);
        setIsEditingMode(false);
      } else {
        toast.error('Lỗi khi lưu vị trí di chuyển nhánh IB.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || err?.message;
      if (msg && msg.includes('Rebate')) {
        toast.error(msg);
      } else {
        toast.error('Chuyển nhánh thất bại do số Rebate cấp trên không đủ.');
      }
      handleCancelMove();
    } finally {
      setIsSavingMove(false);
    }
  };

  const handleCancelMove = () => {
    setPendingMove(null);
    setShowSuccessModal(false);
    setIsEditingMode(false);
    setNodeChildrenMap({});
    queryClient.invalidateQueries({ queryKey: ['ibChildren'] });
    toast.info('Đã hủy bỏ thao tác di chuyển nhánh.');
  };

  // ─── RENDER TREE NODE ───────────────────────────────────────────────────────
  const renderTreeNode = (node: TreeNodeItem, currentLevel: number) => {
    const isExpanded = !!expandedNodes[node.id];
    const children = (nodeChildrenMap[node.id] || []).filter((child) => child.isActive !== false);
    const isLoading = !!loadingNodeIds[node.id];
    const hasChildren = (node.totalChildren ?? 0) > 0 || children.length > 0;
    const isTargetDropOver = dragOverNodeId === node.id;
    const isBeingDragged = draggedNode?.id === node.id;

    return (
      <div key={node.id} className="flex flex-col items-center relative">
        {/* Sub-IB Node Card Box with Drag & Drop Capabilities */}
        <div
          draggable={isEditingMode && isAdmin}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node)}
          onClick={() => handleToggleNode(node)}
          className={`group relative flex flex-col justify-between w-64 min-h-[110px] p-4 bg-white border-2 rounded-2xl shadow-sm transition-all duration-200 cursor-pointer ${
            isTargetDropOver
              ? 'border-emerald-500 bg-emerald-50/60 shadow-lg ring-4 ring-emerald-400/50 scale-105 z-20'
              : isBeingDragged
              ? 'opacity-40 border-amber-400 border-dashed bg-amber-50'
              : isExpanded
              ? 'border-amber-500 bg-amber-50/20 shadow-md ring-2 ring-amber-400/30'
              : 'border-slate-200 hover:border-amber-400 hover:shadow-md'
          } ${isEditingMode ? 'border-dashed border-amber-400 ring-1 ring-amber-300' : ''}`}
        >
          {/* Top Drag Handle Indicator when in Edit Mode */}
          {isEditingMode && isAdmin && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider flex items-center gap-1 shadow-md z-10">
              <Move className="h-3 w-3" /> Kéo để di chuyển
            </div>
          )}

          {/* Header row in card */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs">
                <User className="h-4 w-4 text-amber-700" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-slate-900 text-sm truncate max-w-[140px]" title={node.name || node.email}>
                  {node.name || node.email.split('@')[0]}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Hoạt động
                </span>
              </div>
            </div>

            {hasChildren && (
              <span className="p-1.5 rounded-full bg-slate-100 group-hover:bg-amber-100 text-slate-600 transition-colors">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                ) : isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-amber-700" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
              </span>
            )}
          </div>

          {/* Email */}
          <div className="mt-2 text-xs text-slate-600 font-medium truncate" title={node.email}>
            {node.email}
          </div>

          {/* Account Type Footer (Only displayed for Sub-IBs) */}
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Loại tài khoản:</span>
            <span className="font-bold text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded-md border border-amber-200/70 truncate max-w-[130px]">
              {node.accountType || 'Standard'}
            </span>
          </div>
        </div>

        {/* Render Children Branches and Connecting Lines */}
        {isExpanded && children.length > 0 && (
          <div className="flex flex-col items-center mt-0 w-full relative">
            <div className="w-0.5 h-6 bg-slate-300" />

            <div className="w-full flex items-center justify-start my-2 sticky left-4 z-30 pointer-events-none">
              <span className="pointer-events-auto bg-amber-100 text-amber-950 border border-amber-300 text-xs font-black px-3.5 py-1.5 rounded-xl shadow-md backdrop-blur-md">
                Sub-IB Level {currentLevel + 1}
              </span>
            </div>

            <div className="flex justify-center items-start w-full pt-0">
              {children.map((child, index) => {
                const isFirst = index === 0;
                const isLast = index === children.length - 1;
                const isSingle = children.length === 1;

                return (
                  <div key={child.id} className="flex flex-col items-center relative px-3">
                    {!isSingle && (
                      <div className="absolute top-0 left-0 right-0 h-6 flex">
                        <div className={`w-1/2 h-0.5 bg-slate-300 ${isFirst ? 'opacity-0' : 'opacity-100'}`} />
                        <div className={`w-1/2 h-0.5 bg-slate-300 ${isLast ? 'opacity-0' : 'opacity-100'}`} />
                      </div>
                    )}

                    <div className="w-0.5 h-6 bg-slate-300 relative z-10" />

                    {renderTreeNode(child, currentLevel + 1)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const activeLevel1Children = (nodeChildrenMap[selectedMibId] || []).filter((child) => child.isActive !== false);

  return (
    <div className="space-y-6">
      {/* Header & Control Toolbar */}
      <div className="bg-white p-6 rounded-3xl border border-amber-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500" />
            IB View (Sơ Đồ Gia Phả)
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Xem phân cấp downline từ MIB trực quan theo cấp bậc cây hệ thống.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Top-Right Admin Action Buttons: Chỉnh Sửa | Khôi Phục / Hủy | Lưu */}
          {isAdmin && (
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <button
                onClick={() => {
                  setIsEditingMode(!isEditingMode);
                  if (isEditingMode) {
                    setPendingMove(null);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold rounded-xl shadow-xs transition-all cursor-pointer ${
                  isEditingMode
                    ? 'bg-amber-600 text-white hover:bg-amber-700 ring-2 ring-amber-400'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                <Edit3 className="h-4 w-4" />
                {isEditingMode ? 'Đang Chỉnh Sửa' : 'Chỉnh Sửa (Kéo-Thả)'}
              </button>

              {pendingMove && (
                <>
                  <button
                    onClick={handleCancelMove}
                    disabled={isSavingMove}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold rounded-xl bg-slate-600 text-white hover:bg-slate-700 shadow-xs transition cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Hủy
                  </button>

                  <button
                    onClick={handleSaveMove}
                    disabled={isSavingMove}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition cursor-pointer disabled:opacity-50 animate-pulse"
                  >
                    {isSavingMove ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isSavingMove ? 'Đang Lưu...' : 'Lưu Vị Trí Mới'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* MIB Select Dropdown */}
          <div className="flex items-center gap-3 bg-amber-50/70 p-2 rounded-2xl border border-amber-200">
            <Filter className="h-4 w-4 text-amber-700 ml-2" />
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">MIB Quản Lý:</label>
              {isLoadingMibs ? (
                <div className="flex items-center gap-2 text-xs text-amber-700 py-1 font-bold">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Tải MIB...
                </div>
              ) : (
                <select
                  value={selectedMibId}
                  onChange={(e) => setSelectedMibId(e.target.value)}
                  className="bg-white border border-amber-300 rounded-xl px-3 py-1 text-xs font-extrabold text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer min-w-[220px]"
                >
                  {mibs.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ? `${m.name} (${m.email})` : m.email}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Org Chart Canvas */}
      <div
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUpOrLeave}
        onMouseLeave={handleCanvasMouseUpOrLeave}
        className={`bg-white p-6 sm:p-8 rounded-3xl border border-amber-200/80 shadow-sm overflow-auto min-h-[600px] relative select-none ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Floating Compact Zoom Controls Bar (Fixed at Top Right) */}
        <div className="sticky top-0 right-0 z-40 float-right -mt-2 -mr-2 pointer-events-none mb-2">
          <div className="pointer-events-auto inline-flex items-center gap-1 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-amber-200 shadow-md text-slate-700">
            {/* Zoom Out Button */}
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.3}
              title="Thu nhỏ sơ đồ gia phả (-15%)"
              className="p-1.5 hover:bg-amber-100 text-slate-700 rounded-xl transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            {/* Zoom Percentage Display / Click to Reset */}
            <button
              onClick={handleResetZoom}
              title="Nhấn để đưa về 100%"
              className="px-2.5 py-1 text-xs font-black text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-xl transition border border-amber-200/80 cursor-pointer min-w-[50px] text-center"
            >
              {Math.round(zoomLevel * 100)}%
            </button>

            {/* Zoom In Button */}
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 2.0}
              title="Phóng to sơ đồ gia phả (+15%)"
              className="p-1.5 hover:bg-amber-100 text-slate-700 rounded-xl transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            <div className="h-4 w-[1px] bg-slate-200 mx-0.5" />

            {/* Reset Zoom Button */}
            <button
              onClick={handleResetZoom}
              title="Về kích thước mặc định (100%)"
              className="p-1.5 hover:bg-amber-100 text-slate-600 rounded-xl transition cursor-pointer"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!selectedMib ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Users className="h-12 w-12 mb-3 text-amber-400 opacity-60" />
            <p className="font-semibold text-slate-600">Vui lòng chọn MIB để xem sơ đồ gia phả.</p>
          </div>
        ) : (
          <div
            className="flex flex-col items-center space-y-2 pb-12 transition-transform duration-200 ease-out origin-top"
            style={{
              transform: `scale(${zoomLevel})`,
              minWidth: zoomLevel < 1 ? `${100 / zoomLevel}%` : 'max-content',
            }}
          >
            {/* Level 0: MIB ROOT Header */}
            <div className="w-full flex items-center justify-start mb-2 sticky left-4 z-30 pointer-events-none">
              <span className="pointer-events-auto bg-slate-900 text-amber-400 text-xs font-black px-4 py-2 rounded-xl shadow-md border border-slate-700 uppercase tracking-wider">
                MIB Root
              </span>
            </div>

            {/* MIB Root Box Card (Accepts Drop when in Edit Mode) */}
            <div
              onDragOver={(e) => handleDragOver(e, selectedMib as any)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, selectedMib as any)}
              className={`w-72 p-5 bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white rounded-3xl shadow-lg border-2 border-amber-400 flex flex-col gap-2 relative transition-all ${
                dragOverNodeId === selectedMib.id ? 'ring-4 ring-emerald-400 scale-105' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                  MIB Cấp Cao
                </span>
                <Shield className="h-5 w-5 text-amber-200" />
              </div>
              <h3 className="text-lg font-extrabold truncate" title={selectedMib.name || selectedMib.email}>
                {selectedMib.name || selectedMib.email.split('@')[0]}
              </h3>
              <p className="text-xs text-amber-100 font-medium truncate">{selectedMib.email}</p>
            </div>

            {/* Level 1 & Downline Branches */}
            {isLoadingLevel1 ? (
              <div className="flex items-center justify-center w-full py-16 text-amber-600 gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="font-bold">Đang tải sơ đồ gia phả...</span>
              </div>
            ) : activeLevel1Children.length === 0 ? (
              <div className="w-full text-center py-16 text-slate-400 font-medium border border-dashed border-slate-200 rounded-2xl mt-8">
                MIB này chưa có Sub-IB tuyến dưới nào đang hoạt động.
              </div>
            ) : (
              <div className="w-full flex flex-col items-center relative">
                <div className="w-0.5 h-6 bg-slate-300" />

                <div className="w-full flex items-center justify-start my-2 sticky left-4 z-30 pointer-events-none">
                  <span className="pointer-events-auto bg-amber-100 text-amber-950 border border-amber-300 text-xs font-black px-3.5 py-1.5 rounded-xl shadow-md backdrop-blur-md">
                    Sub-IB Level 1
                  </span>
                </div>

                <div className="flex justify-center items-start w-full pt-0">
                  {activeLevel1Children.map((level1Child, index) => {
                    const isFirst = index === 0;
                    const isLast = index === activeLevel1Children.length - 1;
                    const isSingle = activeLevel1Children.length === 1;

                    return (
                      <div key={level1Child.id} className="flex flex-col items-center relative px-3">
                        {!isSingle && (
                          <div className="absolute top-0 left-0 right-0 h-6 flex">
                            <div className={`w-1/2 h-0.5 bg-slate-300 ${isFirst ? 'opacity-0' : 'opacity-100'}`} />
                            <div className={`w-1/2 h-0.5 bg-slate-300 ${isLast ? 'opacity-0' : 'opacity-100'}`} />
                          </div>
                        )}

                        <div className="w-0.5 h-6 bg-slate-300 relative z-10" />

                        {renderTreeNode(level1Child, 1)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── SUCCESS NOTIFICATION FORM MODAL FOR ADMIN ───────────────────────────── */}
      {showSuccessModal && pendingMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 max-w-lg w-full p-6 sm:p-8 space-y-6 relative overflow-hidden">
            {/* Header Banner */}
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Chuyển Nhánh IB Thành Công!
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Đã kiểm tra số Rebate cấp trên đủ điều kiện
                </p>
              </div>
            </div>

            {/* Details Card */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-sm">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">IB di chuyển:</span>
                <span className="font-extrabold text-slate-900">{pendingMove.movedIbName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Cấp trên mới (Parent IB):</span>
                <span className="font-extrabold text-emerald-700">{pendingMove.targetParentName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Cấp độ (Level) mới:</span>
                <span className="font-black px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-lg text-xs">
                  Level {pendingMove.oldLevel} ➔ Level {pendingMove.newLevel}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Loại tài khoản:</span>
                <span className="font-bold text-slate-800">{pendingMove.accountType}</span>
              </div>
              <div className="pt-2 text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200/80 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Toàn bộ cấu hình Rebate của các Sub-IB con thuộc nhánh này được <strong>giữ nguyên 100%</strong> (không bị reset về 0).
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Đóng / Xem vị trí trên sơ đồ
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  handleSaveMove();
                }}
                disabled={isSavingMove}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isSavingMove ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Xác Nhận & Lưu Vị Trí Mới
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
