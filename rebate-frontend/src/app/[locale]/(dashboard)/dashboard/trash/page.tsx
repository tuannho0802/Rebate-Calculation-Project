'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trashApi } from '@/lib/api/trash';
import { Loader2, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from 'sonner';

export default function TrashManagementPage() {
  const queryClient = useQueryClient();

  const { data: trashRes, isLoading } = useQuery({
    queryKey: ['trashUsers'],
    queryFn: () => trashApi.getAll(),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => trashApi.restore(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Khôi phục tài khoản thành công');
        queryClient.invalidateQueries({ queryKey: ['trashUsers'] });
      } else {
        toast.error(getErrorMessage((res as any).error?.code));
      }
    },
    onError: (err: any) => toast.error(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR')),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: (id: string) => trashApi.hardDelete(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Xóa vĩnh viễn thành công');
        queryClient.invalidateQueries({ queryKey: ['trashUsers'] });
      } else {
        toast.error(getErrorMessage((res as any).error?.code));
      }
    },
    onError: (err: any) => toast.error(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR')),
  });

  const items = trashRes?.data || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-red-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Thùng rác hệ thống</h1>
          <p className="text-gray-500">Quản lý các tài khoản IB / Admin đã bị vô hiệu hóa.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200/80 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-left text-sm">
            <thead className="bg-amber-50/80 font-extrabold text-gray-800 border-b border-amber-200/80">
              <tr>
                <th className="px-4 py-3 font-bold">ID</th>
                <th className="px-4 py-3 font-bold">Email</th>
                <th className="px-4 py-3 font-bold">Level</th>
                <th className="px-4 py-3 font-bold">Role</th>
                <th className="px-4 py-3 font-bold text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-600" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-medium">
                    Thùng rác trống.
                  </td>
                </tr>
              ) : (
                items.map((user) => (
                  <tr key={user.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-gray-500 font-bold">{user.id}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{user.email}</td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">Level {user.level}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-extrabold border ${user.role === 'ADMIN' ? 'bg-amber-100 text-amber-950 border-amber-200' : 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => restoreMutation.mutate(user.id)}
                          disabled={restoreMutation.isPending}
                          className="rounded-lg p-2 text-gray-400 hover:bg-green-50 hover:text-green-600 transition disabled:opacity-50"
                          title="Khôi phục"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Cảnh báo: Hành động này sẽ xóa vĩnh viễn tài khoản khỏi hệ thống và KHÔNG THỂ khôi phục. Bạn có chắc chắn?')) {
                              hardDeleteMutation.mutate(user.id);
                            }
                          }}
                          disabled={hardDeleteMutation.isPending}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
                          title="Xóa vĩnh viễn"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
