'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { useAuthStore } from '@/store/auth.store';
import { flattenAllRoots, normalizeTreeRoots } from '@/lib/tree-utils';
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

  const isAdmin = user?.role === 'ADMIN';
  const treeDepth = isAdmin ? 'all' : 1;

  const { data: treeData, isLoading } = useQuery({
    queryKey: ['ibTree', treeDepth, user?.id],
    queryFn: () => ibApi.getTree(treeDepth),
  });

  const subIbs = useMemo(() => {
    if (!treeData?.data) return [];
    if (isAdmin) {
      return flattenAllRoots(treeData.data).filter((ib) => ib.level > 0 && ib.isActive !== false);
    }
    const roots = normalizeTreeRoots(treeData.data);
    return (roots[0]?.children || []).filter((ib) => ib.isActive !== false);
  }, [treeData?.data, isAdmin]);
  const getAccountType = (ib: any) => ib.accountType || 'Markup 0%';

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] text-gray-900 px-5 py-2.5 rounded-xl font-extrabold transition-all shadow-md hover:opacity-95"
        >
          <UserPlus className="h-5 w-5 text-gray-900" />
          Tạo sub-IB (Create IB)
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-amber-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          </div>
        ) : subIbs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Chưa có sub-IB nào</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-amber-50/80 text-gray-800 font-extrabold border-b border-amber-200/80">
                <tr>
                  <th className="px-6 py-4">Tên IB</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Mức Cấp</th>
                  <th className="px-6 py-4">Loại Tài Khoản (Link)</th>
                  <th className="px-6 py-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subIbs.map((ib) => (
                  <tr key={ib.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{ib.name || '---'}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{ib.email}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        Level {ib.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-800">
                      {getAccountType(ib)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setViewIbId(ib.id)}
                          className="p-2 text-gray-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors group"
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


