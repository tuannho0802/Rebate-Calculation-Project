'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Bell, Trash2, Check, AlertTriangle, Eye, X, ScrollText } from 'lucide-react';
import { auditApi } from '@/lib/api/audit';
import { useAuthStore } from '@/store/auth.store';
import { ibApi } from '@/lib/api/ib';

// Action code -> Việt Nam context mapping (common audit actions)
const ACTION_LABELS: Record<string, string> = {
  IB_CREATE: 'Tạo IB mới',
  IB_UPDATE: 'Cập nhật thông tin IB',
  IB_DEACTIVATE: 'Vô hiệu hóa IB',
  IB_RESTORE: 'Khôi phục IB',
  IB_MOVE_SUBTREE: 'Di chuyển IB sang nhánh khác',
  REBATE_CONFIG_UPDATE: 'Cập nhật cấu hình Rebate',
  REBATE_CONFIG_CREATE: 'Tạo cấu hình Rebate mới',
  TRANSACTION_CREATE: 'Tạo giao dịch Rebate mới',
  TRANSACTION_UPDATE: 'Cập nhật giao dịch Rebate',
  PAYOUT_REQUEST: 'Yêu cầu rút tiền',
  PAYOUT_APPROVE: 'Duyệt yêu cầu rút tiền',
  PAYOUT_REJECT: 'Từ chối yêu cầu rút tiền',
  PAYOUT_PAY: 'Thực hiện thanh toán',
  ACCOUNT_TYPE_CREATE: 'Tạo loại tài khoản & gói phí',
  ACCOUNT_TYPE_UPDATE: 'Cập nhật loại tài khoản & gói phí',
  MARKUP_LINK_CREATE: 'Tạo template link markup',
  MARKUP_LINK_UPDATE: 'Cập nhật template link markup',
  SYSTEM_CONFIG_UPDATE: 'Cập nhật cấu hình hệ thống',
  NOTIFICATION_SEND: 'Gửi thông báo hệ thống',
  ADMIN_CREATE: 'Tạo Admin mới',
  ADMIN_UPDATE: 'Cập nhật Admin',
};

// targetType -> Trang đích tương ứng (nếu có)
const TARGET_TYPE_ROUTE: Record<string, string | null> = {
  IB: '/dashboard/tree/edit',
  REBATE_CONFIG: '/dashboard/rebate-management',
  REBATE_TEMPLATES: null, // Chưa có trang
  REBATE_CONFIG_BRANCH: null, // Chưa có trang
  TRANSACTION: null, // Chưa có trang chi tiết
  PAYOUT: null, // Chưa có trang chi tiết
  ADMIN: null, // Chưa có trang chi tiết
  SYSTEM_CONFIG: null, // Chưa có trang chi tiết
};

// targetType -> Label tiếng Việt (cho các targetType không map được IB)
const TARGET_TYPE_LABEL: Record<string, string> = {
  TRANSACTION: 'Giao dịch',
  PAYOUT: 'Yêu cầu rút tiền',
  ADMIN: 'Tài khoản Admin',
  SYSTEM_CONFIG: 'Cấu hình hệ thống',
  REBATE_TEMPLATES: 'Mẫu Rebate',
  REBATE_CONFIG_BRANCH: 'Cấu hình nhánh',
};

export default function AuditLogPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const userLevel = user?.level ?? -1;

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [actorId, setActorId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const hasSelectedItems = selectedIds.size > 0;

  // Cache children IDs để check con trực tiếp
  const [childrenCache, setChildrenCache] = useState<Record<string, string[]>>({});
  const [canNavigateMap, setCanNavigateMap] = useState<Record<string, boolean>>({});

  const params = {
    page,
    limit,
    actorId: actorId || undefined,
    targetId: targetId || undefined,
    action: action || undefined,
    targetType: targetType || undefined,
  };

  const { data: auditLogsRes, isLoading, refetch } = useQuery({
    queryKey: ['auditLogs', params],
    queryFn: () => auditApi.getLogs(params),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => auditApi.dismissLog(id),
    onSuccess: (_, auditLogId) => {
      setFeedback('Đã ẩn khỏi danh sách của bạn');
      // Optimistic update: xoá dòng này khỏi danh sách
      queryClient.setQueryData(['auditLogs', params], (oldData: any) => {
        if (!oldData?.data?.items) return oldData;
        return {
          ...oldData,
          data: {
            ...oldData.data,
            items: oldData.data.items.filter((item: any) => item.id !== auditLogId),
          },
        };
      });
      // Refetch để đảm bảo tổng số đúng (vì meta.total không đổi trong optimistic update)
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['auditLogs', params] }), 500);
    },
    onError: () => {
      setFeedback('Không thể ẩn dòng nhật ký này');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => auditApi.deleteBulk(ids),
    onSuccess: (response) => {
      setFeedback(response.data.message);
      // Clear selection after success
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['auditLogs', params] });
    },
    onError: () => {
      setFeedback('Không thể thực hiện thao tác');
    },
  });

  const allDeleteMutation = useMutation({
    mutationFn: () => auditApi.deleteAll(params),
    onSuccess: (response) => {
      setFeedback(response.data.message);
      // Clear selection after success
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['auditLogs', params] });
    },
    onError: () => {
      setFeedback('Không thể thực hiện thao tác');
    },
  });

  // Lấy danh sách con trực tiếp và check quyền click-navigate
  useEffect(() => {
    const fetchAndCheckNavigate = async () => {
      if (!user || userLevel !== 0) return;

      const newCanNavigate: Record<string, boolean> = {};
      const children = childrenCache[user.id] || (await fetchChildren(user.id));

      if (auditLogsRes?.data?.items) {
        for (const item of auditLogsRes.data.items) {
          const targetId = item.targetId;
          // Admin luôn cho phép, MIB check theo rule
          if (isAdmin) {
            newCanNavigate[item.id] = true;
          } else if (userLevel === 0) {
            const canNav = targetId === user.id || item.actorId === user.id || children.includes(targetId);
            newCanNavigate[item.id] = canNav;
          } else {
            newCanNavigate[item.id] = false;
          }
        }
      }

      setCanNavigateMap(newCanNavigate);
    };

    fetchAndCheckNavigate();
  }, [auditLogsRes, user, userLevel, isAdmin, childrenCache]);

  // Lấy danh sách con trực tiếp
  const fetchChildren = async (parentId: string): Promise<string[]> => {
    if (childrenCache[parentId]) return childrenCache[parentId];
    try {
      const res = await ibApi.getChildren(parentId);
      const childrenIds = res.data.items.map((c: any) => c.id);
      setChildrenCache((prev) => ({ ...prev, [parentId]: childrenIds }));
      return childrenIds;
    } catch {
      return [];
    }
  };

  const auditLogs = auditLogsRes?.data?.items || [];
  const meta = auditLogsRes?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;
  const isAllOnPageSelected = auditLogs.length > 0 && auditLogs.every((item: any) => selectedIds.has(item.id));

  // Get navigate URL cho target (Admin: vào rebate-management, MIB: vào dashboard hoặc tree/edit nếu con trực tiếp)
  const getNavigateUrl = (targetType: string, targetId: string): string | null => {
    if (!TARGET_TYPE_ROUTE[targetType]) return null;

    if (!user) return null;

    if (isAdmin) {
      // Admin luôn vào rebate-management với ibId
      if (targetType === 'IB') {
        return `/dashboard/rebate-management?ibId=${targetId}`;
      }
      return null;
    }

    if (userLevel === 0 && user.id) {
      // MIB
      if (targetType === 'IB') {
        if (targetId === user.id) {
          return '/dashboard';
        }
        // Kiểm tra con trực tiếp
        const children = childrenCache[user.id] || [];
        if (children.includes(targetId)) {
          return `/dashboard/tree/edit/${targetId}`;
        }
      }
    }

    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-100/70 rounded-2xl border border-slate-200">
            <ScrollText className="h-6 w-6 text-slate-800" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Nhật ký hành động</h1>
            <p className="text-slate-500 font-medium text-sm">
              Theo dõi toàn bộ thao tác trong hệ thống (Admin: toàn hệ thống, MIB: toàn subtree của mình).
            </p>
          </div>
        </div>
      </div>

      {/* Audit Log List Card */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Nhật ký thao tác</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Danh sách các thao tác quan trọng đã thực hiện trong hệ thống.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {hasSelectedItems && (
              <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 px-3 py-2">
                <span className="text-xs font-bold text-rose-700">Đã chọn {selectedIds.size} dòng</span>
                <button
                  type="button"
                  onClick={() => {
                    if (isAdmin) {
                      const ok = window.confirm(
                        `Bạn sắp XOÁ VĨNH VIỄN ${selectedIds.size} dòng nhật ký. Hành động này KHÔNG THỂ khôi phục. Tiếp tục?`
                      );
                      if (!ok) return;
                    }
                    bulkDeleteMutation.mutate([...selectedIds]);
                  }}
                  disabled={bulkDeleteMutation.isPending}
                  className="inline-flex items-center gap-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold px-3 py-1.5 transition disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isAdmin ? 'Xoá vĩnh viễn' : 'Ẩn khỏi danh sách của tôi'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="p-1 text-rose-500 hover:text-rose-700"
                  title="Bỏ chọn"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                const confirmMsg = isAdmin
                  ? 'Bạn sắp XOÁ VĨNH VIỄN toàn bộ nhật ký khớp bộ lọc hiện tại. Hành động này KHÔNG THỂ khôi phục. Tiếp tục?'
                  : 'Ẩn toàn bộ nhật ký khớp bộ lọc hiện tại khỏi danh sách của bạn?';
                const ok = window.confirm(confirmMsg);
                if (!ok) return;
                allDeleteMutation.mutate();
              }}
              disabled={allDeleteMutation.isPending || auditLogs.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-100 px-4 py-2.5 text-xs font-extrabold text-rose-700 transition hover:bg-rose-200 shadow-sm disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {isAdmin ? 'Xoá vĩnh viễn tất cả' : 'Ẩn tất cả khỏi danh sách của tôi'}
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-slate-700 shadow-sm disabled:opacity-50"
            >
              <Loader2 className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Tải lại
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <input
            type="text"
            value={actorId}
            onChange={(e) => { setActorId(e.target.value); setPage(1); }}
            className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="Filter by Actor ID..."
          />
          <input
            type="text"
            value={targetId}
            onChange={(e) => { setTargetId(e.target.value); setPage(1); }}
            className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="Filter by Target ID..."
          />
          <input
            type="text"
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="Filter by Action..."
          />
          <select
            value={targetType}
            onChange={(e) => { setTargetType(e.target.value); setPage(1); }}
            className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <option value="">All Target Types</option>
            <option value="IB">IB</option>
            <option value="REBATE_CONFIG">REBATE_CONFIG</option>
            <option value="TRANSACTION">TRANSACTION</option>
            <option value="PAYOUT">PAYOUT</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SYSTEM_CONFIG">SYSTEM_CONFIG</option>
          </select>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50/60 font-extrabold text-slate-800 border-b border-slate-200/60 text-xs">
              <tr>
                <th className="px-4 py-3.5 font-bold w-10">
                  <input
                    type="checkbox"
                    checked={isAllOnPageSelected}
                    onChange={(e) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) {
                          auditLogs.forEach((item: any) => next.add(item.id));
                        } else {
                          auditLogs.forEach((item: any) => next.delete(item.id));
                        }
                        return next;
                      });
                    }}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-3.5 font-bold">Thời gian</th>
                <th className="px-4 py-3.5 font-bold">Người thực hiện</th>
                <th className="px-4 py-3.5 font-bold">Hành động</th>
                <th className="px-4 py-3.5 font-bold">Đối tượng bị tác động</th>
                <th className="px-4 py-3.5 font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-600 mb-2" />
                    <span>Đang tải nhật ký hành động...</span>
                  </td>
                </tr>
              ) : auditLogs.length > 0 ? (
                auditLogs.map((item: any) => {
                  const actionLabel = ACTION_LABELS[item.action] || item.action;
                  const navigateUrl = getNavigateUrl(item.targetType, item.targetId);
                  const canNavigate = canNavigateMap[item.id] ?? false;

                  const handleNavigate = () => {
                    if (!navigateUrl) return;
                    router.push(navigateUrl);
                  };

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/30 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(item.id);
                              else next.delete(item.id);
                              return next;
                            });
                          }}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-slate-600 text-xs">
                        {new Date(item.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-900 font-medium text-sm">
                          {item.actor?.email || item.actorId}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-900 font-medium text-sm">
                          {actionLabel}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {item.targetLabel ? (
                          <div className="text-slate-900 font-medium text-sm">
                            {item.targetLabel}
                          </div>
                        ) : (
                          <div className="text-slate-700 text-xs">
                            <span className="font-semibold">
                              {TARGET_TYPE_LABEL[item.targetType] || item.targetType}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {/* Nút "Xem chi tiết" / Click-navigate nếu đủ điều kiện */}
                          {navigateUrl && canNavigate ? (
                            <button
                              onClick={handleNavigate}
                              className="inline-flex items-center gap-1 bg-slate-600 hover:bg-slate-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl transition shadow-sm"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Xem chi tiết
                            </button>
                          ) : (
                            <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-500 text-xs px-2.5 py-1 rounded-xl">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span className="font-bold">Tĩnh</span>
                            </div>
                          )}

                          {/* Nút "Xoá" (thực chất là dismiss) */}
                          <button
                            onClick={() => dismissMutation.mutate(item.id)}
                            disabled={dismissMutation.isPending}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded-lg hover:bg-rose-50 disabled:opacity-50"
                            title="Ẩn khỏi danh sách của bạn (kh��ng xoá thật)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    Chưa có nhật ký hành động nào trong khoảng thời gian này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {meta && (
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              Trang {page} / {totalPages} (Tổng {meta.total} dòng)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 disabled:opacity-40 font-bold"
              >
                Trước
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 disabled:opacity-40 font-bold"
              >
                Tiếp
              </button>
            </div>
          </div>
        )}
      </section>

      {feedback && (
        <p className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-900">
          {feedback}
        </p>
      )}
    </div>
  );
}