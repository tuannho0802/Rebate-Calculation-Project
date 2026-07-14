'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { Loader2, Plus, Edit2, Trash2, UserCog, AlertCircle } from 'lucide-react';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from 'sonner';

export default function AdminManagementPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
  });

  const { data: adminRes, isLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => adminApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: () => adminApi.create(formData.email, formData.password, formData.name),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Thêm Admin thành công');
        queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
        setIsCreateModalOpen(false);
        setFormData({ email: '', name: '', password: '' });
      } else {
        toast.error(getErrorMessage((res as any).error?.code));
      }
    },
    onError: (err: any) => toast.error(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR')),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: any = { email: formData.email, name: formData.name };
      if (formData.password) payload.password = formData.password;
      return adminApi.update(editingAdmin.id, payload);
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Cập nhật Admin thành công');
        queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
        setIsEditModalOpen(false);
        setEditingAdmin(null);
      } else {
        toast.error(getErrorMessage((res as any).error?.code));
      }
    },
    onError: (err: any) => toast.error(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR')),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => adminApi.deactivate(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Đã vô hiệu hóa Admin (chuyển vào thùng rác)');
        queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      } else {
        toast.error(getErrorMessage((res as any).error?.code));
      }
    },
    onError: (err: any) => toast.error(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditModalOpen) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const openCreateModal = () => {
    setFormData({ email: '', name: '', password: '' });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (admin: any) => {
    setEditingAdmin(admin);
    setFormData({ email: admin.email, name: admin.name || '', password: '' });
    setIsEditModalOpen(true);
  };

  const admins = adminRes?.data || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCog className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản trị Admin</h1>
            <p className="text-gray-500">Thêm, sửa, vô hiệu hóa tài khoản quản trị viên.</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 shadow-md shadow-blue-500/20"
        >
          <Plus className="h-4 w-4" />
          Thêm Admin
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600">ID</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Tên</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Email</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Loại Admin</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Không có tài khoản Admin nào.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{admin.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{admin.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{admin.email}</td>
                    <td className="px-4 py-3">
                      {admin.isRootAdmin ? (
                        <span className="inline-flex rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
                          Root Admin
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                          Admin
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(admin)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition"
                          title="Sửa thông tin"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Bạn có chắc chắn muốn vô hiệu hóa Admin này? Tài khoản sẽ được chuyển vào thùng rác.')) {
                              deactivateMutation.mutate(admin.id);
                            }
                          }}
                          disabled={deactivateMutation.isPending}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
                          title="Vô hiệu hóa"
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

      {/* Modal */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); }} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">
                {isEditModalOpen ? 'Sửa thông tin Admin' : 'Thêm Admin mới'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên hiển thị</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Mật khẩu {isEditModalOpen && <span className="text-gray-400 font-normal">(để trống nếu không đổi)</span>}
                </label>
                <input
                  type="password"
                  required={!isEditModalOpen}
                  value={formData.password}
                  onChange={(e) => setFormData(f => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder={isEditModalOpen ? '••••••••' : 'Nhập mật khẩu'}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); }}
                  className="rounded-xl px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-70"
                >
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
