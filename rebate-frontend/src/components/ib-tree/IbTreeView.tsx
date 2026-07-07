'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { TreeNode } from './TreeNode';
import { Loader2, AlertCircle } from 'lucide-react';
import { IbDetailsDrawer } from './IbDetailsDrawer';
import { CreateIbModal } from './CreateIbModal';
import { useAuthStore } from '@/store/auth.store';

export function IbTreeView() {
  const [selectedIbId, setSelectedIbId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { user } = useAuthStore();
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['ibTree', 'all', user?.id],
    queryFn: () => ibApi.getTree('all'),
  });

  const handleNodeClick = (id: string) => {
    setSelectedIbId(id);
    setIsDrawerOpen(true);
  };

  const handleOpenCreateModal = () => {
    setIsDrawerOpen(false);
    setIsCreateModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-gray-200 shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-[#0066ff] mb-4" />
        <p className="text-gray-500 font-medium">Đang vẽ cây mạng lưới IB...</p>
      </div>
    );
  }

  if (isError || !response?.success || !response.data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-red-50 rounded-xl border border-red-100 text-red-500">
        <AlertCircle className="h-10 w-10 mb-4 text-red-400" />
        <p className="font-semibold">Lỗi khi tải dữ liệu cây IB.</p>
        <p className="text-sm mt-1 text-red-400">Vui lòng thử tải lại trang hoặc liên hệ quản trị.</p>
      </div>
    );
  }

  const rootNode = response.data;

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-sm overflow-x-auto min-h-[500px]">
      <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
        <h2 className="text-lg font-bold text-gray-800">
          Cấu Trúc Cây Tuyến Dưới
        </h2>
        <div className="text-sm font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
          Tổng Node: <span className="text-[#0066ff] font-bold">{(rootNode.totalChildren || 0) + 1}</span>
        </div>
      </div>
      
      <div className="pl-2">
        <TreeNode node={rootNode} onNodeClick={handleNodeClick} />
      </div>

      <IbDetailsDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        ibId={selectedIbId}
        onOpenCreate={handleOpenCreateModal}
      />

      <CreateIbModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        parentId={selectedIbId}
      />
    </div>
  );
}
