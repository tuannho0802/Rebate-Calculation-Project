'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { Loader2, Search, Edit, Trash2, Crown, Users, Layers, Plus } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { CreateIbModal } from './CreateIbModal';
import { AdminCreateUserModal } from './AdminCreateUserModal';

type TabType = 'mib' | 'sub-ib' | 'all';

export function IbManagementTable() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('mib');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const trimmedQ = q.trim();
  const canSearch = trimmedQ.length === 0 || trimmedQ.length >= 2;
  const isAdmin = user?.role === 'ADMIN';

  const { data, isFetching, isLoading } = useQuery({
    queryKey: ['ibSearch', trimmedQ, page, activeTab],
    queryFn: () => ibApi.search(trimmedQ, false, page, 20, activeTab),
    enabled: canSearch,
  });

  const { data: mibCountData } = useQuery({
    queryKey: ['ibCount', 'mib'],
    queryFn: () => ibApi.search('', false, 1, 1, 'mib'),
  });

  const { data: subIbCountData } = useQuery({
    queryKey: ['ibCount', 'sub-ib'],
    queryFn: () => ibApi.search('', false, 1, 1, 'sub-ib'),
  });

  const mibTotal = mibCountData?.data?.total ?? 0;
  const subIbTotal = subIbCountData?.data?.total ?? 0;
  const allTotal = mibTotal + subIbTotal;

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: any) => ibApi.update(id, dto),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Cập nhật thành công');
        queryClient.invalidateQueries({ queryKey: ['ibSearch'] });
        queryClient.invalidateQueries({ queryKey: ['ibCount'] });
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
        queryClient.invalidateQueries({ queryKey: ['ibCount'] });
      }
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Tabs Phân Chia Quản Lý: MIB (Level 0) & IB Con (Level >= 1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-2">
        <div className="flex items-center gap-2 bg-gray-100/80 p-1.5 rounded-xl border border-gray-200/80">
          <button
            onClick={() => handleTabChange('mib')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'mib'
                ? 'bg-white text-purple-700 shadow-sm border border-purple-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Crown className={`h-4 w-4 ${activeTab === 'mib' ? 'text-purple-600' : 'text-gray-400'}`} />
            <span>Danh sách MIB (Level 0)</span>
            <span
              className={`ml-1 px-2 py-0.5 text-xs rounded-full font-extrabold ${
                activeTab === 'mib' ? 'bg-purple-100 text-purple-800' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {mibTotal}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('sub-ib')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'sub-ib'
                ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className={`h-4 w-4 ${activeTab === 'sub-ib' ? 'text-blue-600' : 'text-gray-400'}`} />
            <span>Danh sách IB thường (Level ≥ 1)</span>
            <span
              className={`ml-1 px-2 py-0.5 text-xs rounded-full font-extrabold ${
                activeTab === 'sub-ib' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {subIbTotal}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className={`h-4 w-4 ${activeTab === 'all' ? 'text-amber-500' : 'text-gray-400'}`} />
            <span>Tất cả ({allTotal})</span>
          </button>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md hover:shadow-lg text-sm"
        >
          <Plus className="h-4 w-4" />
          {isAdmin ? (activeTab === 'mib' ? 'Tạo MIB mới' : 'Tạo IB mới') : 'Tạo Sub-IB'}
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex gap-4 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 items-center flex-1">
          <div className="relative flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                activeTab === 'mib'
                  ? 'Tìm MIB theo email hoặc tên...'
                  : activeTab === 'sub-ib'
                  ? 'Tìm IB con theo email hoặc tên...'
                  : 'Tìm kiếm tất cả IB theo email hoặc tên...'
              }
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-10 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium shadow-sm bg-white"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600">
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-4">
        {isLoading || isFetching ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : !canSearch ? (
          <div className="text-center py-12 text-gray-500">Nhập ít nhất 2 ký tự để tìm kiếm</div>
        ) : (
          (() => {
            const items = data?.data?.items || [];
            if (items.length === 0) {
              return (
                <div className="text-center py-16 text-gray-500">
                  <p className="font-semibold text-gray-700">Không tìm thấy kết quả nào</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {activeTab === 'mib'
                      ? 'Chưa có tài khoản MIB nào phù hợp'
                      : activeTab === 'sub-ib'
                      ? 'Chưa có tài khoản Sub-IB nào phù hợp'
                      : 'Không có dữ liệu trong hệ thống'}
                  </p>
                </div>
              );
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50/80 text-gray-700 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3.5">Email</th>
                      <th className="px-6 py-3.5">Tên hiển thị</th>
                      <th className="px-6 py-3.5">Phân cấp (Level)</th>
                      <th className="px-6 py-3.5">Loại link sở hữu</th>
                      <th className="px-6 py-3.5">Trạng thái</th>
                      <th className="px-6 py-3.5 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((ib: any) => {
                      const isMib = ib.level === 0;
                      const displayAccountTypes = (ib.accountTypes && ib.accountTypes.length > 0)
                        ? ib.accountTypes.join(', ')
                        : (ib.accountType || 'STD');

                      return (
                        <tr key={ib.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-6 py-4 font-mono font-medium text-gray-900">{ib.email}</td>
                          <td className="px-6 py-4 font-semibold text-gray-800">{ib.name || '—'}</td>
                          <td className="px-6 py-4">
                            {isMib ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                                <Crown className="w-3.5 h-3.5 text-purple-600" />
                                MIB (Level 0)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                Sub-IB (Level {ib.level})
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-block bg-amber-50 text-amber-900 border border-amber-200 text-xs px-2.5 py-1 rounded-md font-bold">
                              {displayAccountTypes}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {ib.isActive ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              <button
                                onClick={() => router.push(`/dashboard/tree/edit/${ib.id}`)}
                                title="Chỉnh sửa cấu hình Rebate"
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-all shadow-sm"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span>Chỉnh Rebate</span>
                              </button>
                              <button
                                onClick={() => deactivateMutation.mutate(ib.id)}
                                title="Vô hiệu hóa IB"
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-100">
                  <div className="text-sm font-medium text-gray-600">
                    Hiển thị tổng số: <span className="font-bold text-gray-900">{data?.data?.total ?? 0}</span> tài khoản
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3.5 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Trang trước
                    </button>
                    <div className="px-3 py-1 text-sm font-extrabold text-blue-600 bg-blue-50 rounded-lg border border-blue-200">
                      Trang {page}
                    </div>
                    <button
                      disabled={items.length < 20}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-3.5 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Modal tạo IB cho User thường */}
      {user?.id && !isAdmin && (
        <CreateIbModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          parentId={user.id}
        />
      )}

      {/* Modal tạo IB cho Admin */}
      {isAdmin && isCreateModalOpen && (
        <AdminCreateUserModal onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}
