'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { rebateApi } from '@/lib/api/rebate';
import { exportApi } from '@/lib/api/export';
import { useAuthStore } from '@/store/auth.store';
import { IbNode, MAX_PIPS, AssetType } from '@/types';
import {
  Loader2, ChevronDown, ChevronRight, User, Users, Shield, Sparkles, Filter, CheckCircle2,
  Edit3, Save, RotateCcw, Move, AlertCircle, ZoomIn, ZoomOut, Maximize2, ArrowRightLeft, Send, Mail,
  FileSpreadsheet, Download
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
  // Fix: trước đây có "|| true" ở cuối khiến MỌI user (kể cả MIB/IB) đều được
  // coi là Admin — thấy toolbar Chỉnh Sửa + kéo-thả được dù BE chặn 403 khi Save.
  // Đồng thời bỏ heuristic "email chứa admin" (không đáng tin) — chỉ dựa vào
  // role thật trả về từ JWT/API.
  const isAdmin = user?.role === 'ADMIN' || meRes?.data?.role === 'ADMIN';
  const currentUserId = user?.id || meRes?.data?.id;

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

  // Cross-Tree Move Modal States
  const [crossTreeModalOpen, setCrossTreeModalOpen] = useState<boolean>(false);
  const [crossTreeNode, setCrossTreeNode] = useState<TreeNodeItem | null>(null);
  const [targetParentEmail, setTargetParentEmail] = useState<string>('');
  const [isSubmittingCrossTree, setIsSubmittingCrossTree] = useState<boolean>(false);

  // Excel Export State & Handler
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    toast.info('Đang khởi tạo file báo cáo Excel...');
    try {
      const blob = await exportApi.getRebateTree(selectedMibId || undefined);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rebate_Tree_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Xuất file Excel báo cáo Rebate thành công!');
    } catch (err: any) {
      console.error('Failed to export excel:', err);
      toast.error('Lỗi khi xuất file Excel báo cáo Rebate.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // 2. Fetch list of MIBs for top-left dropdown (chỉ Admin — endpoint /ib/mibs
  // yêu cầu @Roles('ADMIN') ở BE, gọi với MIB/IB sẽ luôn 403).
  const { data: mibsRes, isLoading: isLoadingMibs } = useQuery({
    queryKey: ['mibsList'],
    queryFn: () => ibApi.getMibs(),
    enabled: isAdmin,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const rawMibs = mibsRes?.data || [];
  const mibs = rawMibs.filter((m) => m.isActive !== false);

  // Auto-select first active MIB when loaded (chỉ áp dụng cho Admin)
  useEffect(() => {
    if (isAdmin && mibs.length > 0 && !selectedMibId) {
      setSelectedMibId(mibs[0].id);
    }
  }, [isAdmin, mibs, selectedMibId]);

  // Fix: MIB/IB không có quyền chọn MIB khác (chỉ được xem tính từ nhánh của
  // chính mình trở xuống) — tự động root vào chính mình ngay khi biết mình
  // không phải Admin, không cần chờ/gọi getMibs().
  useEffect(() => {
    if (!isAdmin && currentUserId && !selectedMibId) {
      setSelectedMibId(currentUserId);
    }
  }, [isAdmin, currentUserId, selectedMibId]);

  // Selected MIB data — Admin lấy từ danh sách mibs; MIB/IB dùng chính thông
  // tin bản thân (từ /ib/me) vì họ không nằm trong "mibs" (API Admin-only) và
  // trường hợp của họ selectedMibId luôn === currentUserId.
  const selectedMib =
    mibs.find((m) => m.id === selectedMibId) ||
    (!isAdmin && selectedMibId === currentUserId ? meRes?.data : undefined);

  // 3. Fetch Level 1 children when MIB changes
  const { data: level1Res, isLoading: isLoadingLevel1 } = useQuery({
    queryKey: ['ibChildren', selectedMibId],
    queryFn: () => ibApi.getChildren(selectedMibId, 1, 100),
    enabled: !!selectedMibId,
    staleTime: 0,
    refetchOnMount: 'always',
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

  // Auto refresh tree when switching to page, focusing window, or tree update event is dispatched
  useEffect(() => {
    const handleTreeUpdate = () => {
      reloadTreeData();
    };

    window.addEventListener('ib-tree-updated', handleTreeUpdate);
    window.addEventListener('focus', handleTreeUpdate);

    return () => {
      window.removeEventListener('ib-tree-updated', handleTreeUpdate);
      window.removeEventListener('focus', handleTreeUpdate);
    };
  }, [selectedMibId]);

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
  const parseAccountTypePips = (accType?: string): number => {
    if (!accType || accType === 'STD') return 0;
    const match = accType.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const validateRebatePips = async (movedIb: TreeNodeItem, targetParent: TreeNodeItem): Promise<boolean> => {
    try {
      const [parentConfigRes, movedIbConfigRes] = await Promise.all([
        rebateApi.getConfig(targetParent.id),
        rebateApi.getConfig(movedIb.id),
      ]);

      const parentAssets: any[] = parentConfigRes?.data?.assets || [];
      const movedAssets: any[] = movedIbConfigRes?.data?.assets || [];

      if (movedAssets.length === 0) return true;

      for (const movedAsset of movedAssets) {
        const movedPips = Number(movedAsset.rebatePips || 0);
        if (movedPips <= 0) continue;

        const movedAccType = movedAsset.accountType || 'STD';

        const parentAsset = parentAssets.find(
          (a) =>
            a.assetType === movedAsset.assetType &&
            (a.accountType || 'STD') === movedAccType
        );

        let parentPips = 0;
        if (targetParent.level === 0) {
          const addedMarkup = parseAccountTypePips(movedAccType);
          const baseMax = (parentAsset && Number(parentAsset.maxPips) > 0)
            ? Number(parentAsset.maxPips)
            : (MAX_PIPS[movedAsset.assetType as AssetType] || 0);
          parentPips = baseMax + addedMarkup;
        } else {
          parentPips = Number(parentAsset?.rebatePips || parentAsset?.maxPips || 0);
        }

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

  // ─── CROSS-TREE MOVE HANDLERS ────────────────────────────────────────────────
  const handleOpenCrossTreeModal = (node: TreeNodeItem) => {
    setCrossTreeNode(node);
    setTargetParentEmail('');
    setCrossTreeModalOpen(true);
  };

  const handleConfirmCrossTreeMove = async () => {
    if (!crossTreeNode) return;
    const email = targetParentEmail.trim();
    if (!email) {
      toast.error('Vui lòng nhập Email của IB cha mới.');
      return;
    }

    setIsSubmittingCrossTree(true);
    try {
      // 1. Search for target parent IB by email
      const searchRes = await ibApi.search(email, false, 1, 10, 'all');
      const items = searchRes?.data?.items || [];
      const foundParent = items.find((i) => i.email.toLowerCase() === email.toLowerCase()) || items[0];

      if (!foundParent) {
        toast.error(`Không tìm thấy IB nào với Email: ${email}`);
        return;
      }

      if (foundParent.id === crossTreeNode.id) {
        toast.error('Không thể di chuyển IB sang làm con của chính nó.');
        return;
      }

      // 2. Cycle Detection
      if (isDescendant(foundParent.id, crossTreeNode.id)) {
        toast.error('Không thể di chuyển IB sang làm con của chính con/cháu trong nhánh của nó.');
        return;
      }

      // 3. Account Types Matching Check
      const getLoadedSubtreeAccountTypes = (node: TreeNodeItem, map: Record<string, TreeNodeItem[]>): string[] => {
        const typesSet = new Set<string>();
        if (node.accountType) typesSet.add(node.accountType);
        if (node.accountTypes && Array.isArray(node.accountTypes)) {
          node.accountTypes.forEach((t) => typesSet.add(t));
        }

        const traverse = (nodeId: string) => {
          const children = map[nodeId] || [];
          for (const child of children) {
            if (child.accountType) typesSet.add(child.accountType);
            if (child.accountTypes && Array.isArray(child.accountTypes)) {
              child.accountTypes.forEach((t) => typesSet.add(t));
            }
            traverse(child.id);
          }
        };
        traverse(node.id);

        const result = Array.from(typesSet).filter(Boolean);
        return result.length > 0 ? result : ['STD'];
      };

      const movedTypes = getLoadedSubtreeAccountTypes(crossTreeNode, nodeChildrenMap);
      const parentTypes = (foundParent.accountTypes && foundParent.accountTypes.length > 0)
        ? foundParent.accountTypes
        : [foundParent.accountType || 'STD'];

      const missingAccountTypes = movedTypes.filter((t) => !parentTypes.includes(t));
      if (missingAccountTypes.length > 0) {
        toast.error(
          `Chuyển nhánh thất bại: IB cha (${foundParent.name || foundParent.email}) chưa có loại tài khoản (${missingAccountTypes.join(', ')}). Vui lòng yêu cầu ADMIN cấp loại tài khoản mà IB cha đang thiếu để có thể chuyển nhánh.`
        );
        return;
      }

      // 4. Rebate Pips Validation
      const targetParentItem: TreeNodeItem = {
        ...foundParent,
        level: foundParent.level,
        accountType: foundParent.accountType || 'STD',
        isActive: foundParent.isActive,
        createdAt: foundParent.createdAt,
      };

      const isRebateValid = await validateRebatePips(crossTreeNode, targetParentItem);
      if (!isRebateValid) {
        toast.error('Chuyển nhánh thất bại do số Rebate cấp trên không đủ.');
        return;
      }

      // Validation passed! Open confirmation dialog
      setPendingMove({
        movedIbId: crossTreeNode.id,
        targetParentId: foundParent.id,
        movedIbName: crossTreeNode.name || crossTreeNode.email,
        targetParentName: foundParent.name || foundParent.email,
        oldParentId: crossTreeNode.parentId,
        oldLevel: crossTreeNode.level,
        newLevel: foundParent.level + 1,
        accountType: foundParent.accountType || crossTreeNode.accountType || 'STD',
      });

      setCrossTreeModalOpen(false);
      setShowSuccessModal(true);
      toast.success('Đã kiểm tra điều kiện chuyển nhánh hợp lệ! Vui lòng xác nhận để lưu.');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message;
      toast.error(msg || 'Lỗi khi kiểm tra thông tin IB cha mới.');
    } finally {
      setIsSubmittingCrossTree(false);
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

    // 2. Account Types Matching Check
    const getLoadedSubtreeAccountTypes = (node: TreeNodeItem, map: Record<string, TreeNodeItem[]>): string[] => {
      const typesSet = new Set<string>();
      if (node.accountType) typesSet.add(node.accountType);
      if (node.accountTypes && Array.isArray(node.accountTypes)) {
        node.accountTypes.forEach((t) => typesSet.add(t));
      }

      const traverse = (nodeId: string) => {
        const children = map[nodeId] || [];
        for (const child of children) {
          if (child.accountType) typesSet.add(child.accountType);
          if (child.accountTypes && Array.isArray(child.accountTypes)) {
            child.accountTypes.forEach((t) => typesSet.add(t));
          }
          traverse(child.id);
        }
      };
      traverse(node.id);

      const result = Array.from(typesSet).filter(Boolean);
      return result.length > 0 ? result : ['STD'];
    };

    const movedTypes = getLoadedSubtreeAccountTypes(draggedNode, nodeChildrenMap);

    const parentTypes = (targetParent.accountTypes && targetParent.accountTypes.length > 0)
      ? targetParent.accountTypes
      : [targetParent.accountType || 'STD'];

    const missingAccountTypes = movedTypes.filter((t) => !parentTypes.includes(t));

    if (missingAccountTypes.length > 0) {
      toast.error(
        `Chuyển nhánh thất bại: IB cha (${targetParent.name || targetParent.email}) chưa có loại tài khoản (${missingAccountTypes.join(', ')}). Vui lòng yêu cầu ADMIN cấp loại tài khoản mà IB cha đang thiếu để có thể chuyển nhánh.`
      );
      setDraggedNode(null);
      return;
    }

    // 3. Rebate Pips Validation
    const isRebateValid = await validateRebatePips(draggedNode, targetParent);
    if (!isRebateValid) {
      // Thông báo lỗi chuẩn theo đúng yêu cầu
      toast.error('Chuyển nhánh thất bại do số Rebate cấp trên không đủ.');
      setDraggedNode(null);
      return;
    }

    // 4. Validation Passed! Perform Optimistic Local Subtree Move
    const oldParentId = draggedNode.parentId;
    const newAccountType = targetParent.accountType || draggedNode.accountType || 'STD';

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

  // Helper to safely reload tree data without losing tree structure or requiring F5 refresh
  const reloadTreeData = async () => {
    if (!selectedMibId) return;
    try {
      await queryClient.invalidateQueries({ queryKey: ['mibsList'] });
      await queryClient.invalidateQueries({ queryKey: ['ibChildren'] });
      await queryClient.invalidateQueries({ queryKey: ['ibTree'] });

      // 1. Fetch fresh Level 1 children for selected MIB
      const freshL1 = await ibApi.getChildren(selectedMibId, 1, 100);
      const activeL1 = freshL1?.data?.items
        ? (freshL1.data.items as TreeNodeItem[]).filter((item) => item.isActive !== false)
        : [];

      // 2. Identify all parent nodes currently expanded/loaded
      const expandedParentIds = Object.keys(nodeChildrenMap).filter(
        (id) => id !== selectedMibId && expandedNodes[id]
      );

      // 3. Fetch fresh children for all expanded sub-nodes in parallel
      const subFetchPromises = expandedParentIds.map(async (pId) => {
        try {
          const res = await ibApi.getChildren(pId, 1, 100);
          if (res.data?.items) {
            const activeItems = (res.data.items as TreeNodeItem[]).filter(
              (item) => item.isActive !== false
            );
            return { pId, activeItems };
          }
        } catch (e) {
          console.error(`Error reloading children for node ${pId}:`, e);
        }
        return null;
      });

      const subResults = await Promise.all(subFetchPromises);
      const updatedMap: Record<string, TreeNodeItem[]> = {
        [selectedMibId]: activeL1,
      };

      subResults.forEach((r) => {
        if (r) {
          updatedMap[r.pId] = r.activeItems;
        }
      });

      setNodeChildrenMap(updatedMap);
      setExpandedNodes((prev) => ({
        ...prev,
        [selectedMibId]: true,
      }));
    } catch (err) {
      console.error('Error reloading tree data:', err);
    }
  };

  // Save pending move to PostgreSQL DB
  const handleSaveMove = async () => {
    if (!pendingMove) return;
    setIsSavingMove(true);
    try {
      const res = await ibApi.moveIb(pendingMove.movedIbId, pendingMove.targetParentId);
      if (res && (res.success || res.data)) {
        toast.success(`Đã lưu vị trí nhánh mới cho IB (${pendingMove.movedIbName}) vào cơ sở dữ liệu thành công!`);
        window.dispatchEvent(new CustomEvent('ib-tree-updated'));
        await reloadTreeData();
        setPendingMove(null);
        setShowSuccessModal(false);
        setIsEditingMode(false);
      } else {
        toast.error('Lỗi khi lưu vị trí di chuyển nhánh IB.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message;
      toast.error(msg || 'Lỗi khi lưu vị trí di chuyển nhánh IB.');
      await reloadTreeData();
      setPendingMove(null);
      setShowSuccessModal(false);
      setIsEditingMode(false);
    } finally {
      setIsSavingMove(false);
    }
  };

  const handleCancelMove = async () => {
    setPendingMove(null);
    setShowSuccessModal(false);
    setIsEditingMode(false);
    await reloadTreeData();
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
          className={`group relative flex flex-col justify-between w-64 min-h-[110px] p-4 bg-white border-2 rounded-2xl shadow-sm transition-all duration-200 cursor-pointer ${isTargetDropOver
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

            <div className="flex items-center gap-1">
              {isEditingMode && isAdmin && (
                <button
                  type="button"
                  title="Chuyển sang cây MIB khác"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenCrossTreeModal(node);
                  }}
                  className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all hover:scale-110 active:scale-95"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                </button>
              )}

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
          </div>

          {/* Email */}
          <div className="mt-2 text-xs text-slate-600 font-medium truncate" title={node.email}>
            {node.email}
          </div>

          {/* Account Type Footer (Only displayed for Sub-IBs) */}
          <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Loại tài khoản sở hữu:</span>
              <span className="text-[10px] font-bold text-slate-400">
                ({(node.accountTypes && node.accountTypes.length > 0 ? node.accountTypes : [node.accountType || 'STD']).length})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {((node.accountTypes && node.accountTypes.length > 0)
                ? node.accountTypes
                : [node.accountType || 'STD']
              ).map((accType) => (
                <span
                  key={accType}
                  className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200/70 text-[10px] leading-none shadow-2xs"
                >
                  {accType}
                </span>
              ))}
            </div>
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold rounded-xl shadow-xs transition-all cursor-pointer ${isEditingMode
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

          {/* MIB Select Dropdown — chỉ Admin mới chọn được MIB khác. MIB/IB chỉ
              xem được nhánh của chính mình nên không cần (và không nên) có dropdown. */}
          {isAdmin ? (
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
          ) : (
            <div className="flex items-center gap-3 bg-slate-100 px-4 py-2.5 rounded-2xl border border-slate-200">
              <Users className="h-4 w-4 text-slate-500" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Đang xem</span>
                <span className="text-xs font-extrabold text-slate-800">
                  {selectedMib ? (selectedMib.name || selectedMib.email) : 'Nhánh của bạn'} (chỉ xem)
                </span>
              </div>
            </div>
          )}

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-50"
            title="Xuất file báo cáo Excel lũy tiến theo mẫu cây MIB"
          >
            {isExportingExcel ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {isExportingExcel ? 'Đang Xuất Excel...' : 'Xuất File Excel'}
          </button>
        </div>
      </div>

      {/* Main Org Chart Canvas */}
      <div
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUpOrLeave}
        onMouseLeave={handleCanvasMouseUpOrLeave}
        className={`bg-white p-6 sm:p-8 rounded-3xl border border-amber-200/80 shadow-sm overflow-auto min-h-[600px] relative select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'
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
            {/* Level 0: Root Header */}
            <div className="w-full flex items-center justify-start mb-2 sticky left-4 z-30 pointer-events-none">
              <span className="pointer-events-auto bg-slate-900 text-amber-400 text-xs font-black px-4 py-2 rounded-xl shadow-md border border-slate-700 uppercase tracking-wider">
                {isAdmin ? 'MIB Root' : 'Gốc Nhánh Của Bạn'}
              </span>
            </div>

            {/* Root Box Card (Accepts Drop when in Edit Mode — chỉ Admin) */}
            <div
              onDragOver={(e) => handleDragOver(e, selectedMib as any)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, selectedMib as any)}
              className={`w-72 p-5 bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white rounded-3xl shadow-lg border-2 border-amber-400 flex flex-col gap-2 relative transition-all ${dragOverNodeId === selectedMib.id ? 'ring-4 ring-emerald-400 scale-105' : ''
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                  {isAdmin ? 'MIB Cấp Cao' : 'Chính bạn'}
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
                <span className="text-slate-500 font-medium">Loại tài khoản sở hữu:</span>
                <span className="font-bold text-slate-800">
                  {(draggedNode?.accountTypes && draggedNode.accountTypes.length > 0)
                    ? draggedNode.accountTypes.join(', ')
                    : (draggedNode?.accountType || pendingMove.accountType)}
                </span>
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

      {/* ─── CROSS-TREE MOVE MODAL FORM ────────────────────────────────────────── */}
      {crossTreeModalOpen && crossTreeNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-amber-200 max-w-md w-full p-6 space-y-5 relative overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-2xl">
                <ArrowRightLeft className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Chuyển Nhánh Sang Cây MIB Khác
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Gắn nhánh sang làm tuyến dưới của một IB cha mới
                </p>
              </div>
            </div>

            <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-amber-800 font-medium">Nhánh IB di chuyển:</span>
                <span className="font-bold text-amber-950">{crossTreeNode.name || crossTreeNode.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-800 font-medium">Email hiện tại:</span>
                <span className="font-mono text-amber-900">{crossTreeNode.email}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Email IB cha mới <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="Nhập email IB cha mới (ví dụ: parent@gmail.com)"
                  value={targetParentEmail}
                  onChange={(e) => setTargetParentEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmCrossTreeMove();
                  }}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>
              <p className="text-[11px] text-slate-500 italic">
                * IB cha mới sẽ được kiểm tra loại tài khoản và giới hạn Rebate trước khi chuyển.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCrossTreeModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmCrossTreeMove}
                disabled={isSubmittingCrossTree || !targetParentEmail.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isSubmittingCrossTree ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Kiểm Tra & Chuyển
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}