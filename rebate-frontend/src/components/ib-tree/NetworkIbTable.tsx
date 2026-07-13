'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { useAuthStore } from '@/store/auth.store';
import { Loader2, UserPlus, Eye, Edit, Trash2 } from 'lucide-react';
import { CreateIbModal } from './CreateIbModal';
import { ViewRebateModal } from './ViewRebateModal';
import { useRouter } from '@/i18n/routing';

export function NetworkIbTable() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewIbId, setViewIbId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (id: string) => ibApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ibTree'] });
    }
  });

  const handleDelete = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa (ngừng hợp tác) với IB này?')) {
      deleteMutation.mutate(id);
    }
  };

  const { data: treeData, isLoading } = useQuery({
    queryKey: ['ibTree', user?.id],
    queryFn: () => ibApi.getTree(1),
  });

  const subIbs = (treeData?.data?.children || []).filter((ib: any) => ib.isActive !== false);
  const getAccountType = (ib: any) => ib.accountType || 'Markup 0%';

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-[#0066ff] hover:bg-[#0052cc] text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md shadow-blue-500/20"
        >
          <UserPlus className="h-5 w-5" />
          Tạo sub-IB (Create IB)
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#0066ff]" />
          </div>
        ) : subIbs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Chưa có Sub-IB nào</h3>
            <p className="text-gray-500">Hãy tạo Sub-IB đầu tiên của bạn để bắt đầu xây dựng mạng lưới.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Tên IB</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Loại tài khoản</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subIbs.map((ib) => (
                  <tr key={ib.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {ib.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {ib.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {getAccountType(ib)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setViewIbId(ib.id)}
                          className="p-2 text-gray-400 hover:text-[#0066ff] hover:bg-blue-50 rounded-lg transition-colors group"
                          title="View"
                        >
                          <Eye className="h-4 w-4 group-hover:scale-110 transition-transform" />
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/tree/edit/${ib.id}`)}
                          className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors group"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4 group-hover:scale-110 transition-transform" />
                        </button>
                        <button
                          onClick={() => handleDelete(ib.id)}
                          disabled={deleteMutation.isPending}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors group disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateIbModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        parentId={user?.id || null}
      />
      
      {viewIbId && (
        <ViewRebateModal
          isOpen={true}
          onClose={() => setViewIbId(null)}
          ibId={viewIbId}
        />
      )}
    </div>
  );
}


