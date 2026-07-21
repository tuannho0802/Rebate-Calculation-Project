'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { Loader2, Search, Edit, Trash2 } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { CreateIbModal } from './CreateIbModal';
import { Plus } from 'lucide-react';

export function IbManagementTable() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuthStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const trimmedQ = q.trim();
  const canSearch = trimmedQ.length === 0 || trimmedQ.length >= 2;
  const { data, isFetching, isLoading } = useQuery({
    queryKey: ['ibSearch', trimmedQ, page],
    queryFn: () => ibApi.search(trimmedQ, false, page, 20),
    enabled: canSearch,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: any) => ibApi.update(id, dto),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Cập nhật thành công');
        queryClient.invalidateQueries({ queryKey: ['ibSearch'] });
      } else {
        toast.error(getErrorMessage((res as any).error?.code));
      }
    },
    onError: (err: any) => toast.error(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR')),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => ibApi.deactivate(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Đã vô hiệu hóa');
        queryClient.invalidateQueries({ queryKey: ['ibSearch'] });
      }
    },
  });


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    // query will run due to state change
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 items-center flex-1">
          <div className="relative flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo email hoặc tên (để trống = xem tất cả)"
              className="w-full rounded-lg border border-gray-200 px-4 py-2 pr-10 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600">
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Tạo Sub-IB
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        {isLoading || isFetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          </div>
        ) : !canSearch ? (
          <div className="text-center py-12 text-gray-500">Nhập ít nhất 2 ký tự để tìm kiếm</div>
        ) : (
          (() => {
            const items = data?.data?.items || [];
            if (items.length === 0) {
              return <div className="text-center py-12 text-gray-500">Không tìm thấy kết quả</div>;
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Tên</th>
                      <th className="px-6 py-3">Level</th>
                      <th className="px-6 py-3">Trạng thái</th>
                      <th className="px-6 py-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((ib: any) => (
                      <tr key={ib.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3 font-mono text-gray-900">{ib.email}</td>
                        <td className="px-6 py-3 text-gray-700">{ib.name || '—'}</td>
                        <td className="px-6 py-3 font-semibold">{ib.level}</td>
                        <td className="px-6 py-3">
                          {ib.isActive ? <span className="text-green-600 font-semibold">Active</span> : <span className="text-red-600 font-semibold">Inactive</span>}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => router.push(`/dashboard/tree/edit/${ib.id}`)} className="p-2 text-gray-500 hover:text-amber-500">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button onClick={() => deactivateMutation.mutate(ib.id)} className="p-2 text-gray-500 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-600">Tổng: {data?.data?.total ?? 0}</div>
                  <div className="flex items-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p-1))} className="px-3 py-1 rounded-lg border">Prev</button>
                    <div className="px-3 py-1">{page}</div>
                    <button disabled={items.length < 20} onClick={() => setPage(p => p+1)} className="px-3 py-1 rounded-lg border">Next</button>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>
      
      {/* Modal tạo Sub-IB */}
      {user?.id && (
        <CreateIbModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          parentId={user.id}
        />
      )}
    </div>
  );
}
