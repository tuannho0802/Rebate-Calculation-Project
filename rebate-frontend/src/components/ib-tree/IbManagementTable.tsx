'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { trashApi } from '@/lib/api/trash';
import { Loader2, Search, Edit, Trash2, RefreshCw } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from 'sonner';

export function IbManagementTable() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isFetching } = useQuery({
    queryKey: ['ibSearch', q, includeInactive, page],
    queryFn: () => ibApi.search(q, includeInactive, page, 20),
    enabled: q.trim().length >= 2 || includeInactive,
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

  const restoreMutation = useMutation({
    mutationFn: (id: string) => trashApi.restore(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Đã khôi phục');
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
      <form onSubmit={handleSearch} className="flex gap-2 items-center">
        <div className="relative flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo email hoặc tên (ít nhất 2 ký tự)"
            className="w-full rounded-lg border border-gray-200 px-4 py-2 pr-10"
          />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">
            <Search className="h-4 w-4" />
          </button>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} /> Bao gồm đã vô hiệu hóa
        </label>
      </form>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        {isFetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#0066ff]" />
          </div>
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
                            {ib.isActive ? (
                              <button onClick={() => deactivateMutation.mutate(ib.id)} className="p-2 text-gray-500 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : (
                              <button onClick={() => restoreMutation.mutate(ib.id)} className="p-2 text-gray-500 hover:text-green-600">
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            )}
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
    </div>
  );
}
