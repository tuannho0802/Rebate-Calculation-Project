'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Bell, MailPlus, Trash2, Check, AlertTriangle, MessageSquare, X } from 'lucide-react';
import { notificationApi } from '@/lib/api/notification';
import { NotificationType, Notification } from '@/types';
import { IbSearchAutocomplete } from '@/components/ib-tree/IbSearchAutocomplete';
import { useAuthStore } from '@/store/auth.store';

const notificationTypeOptions = Object.values(NotificationType);

export default function NotificationPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [isReadFilter, setIsReadFilter] = useState<'all' | 'true' | 'false'>('all');
  const [recipientId, setRecipientId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<NotificationType>(NotificationType.MANUAL);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Reject Reason Modal state
  const [rejectNotificationId, setRejectNotificationId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const params = {
    page,
    limit,
    isRead: isReadFilter === 'all' ? undefined : isReadFilter === 'true',
  };

  const { data: notificationsRes, isLoading } = useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationApi.getMyNotifications(params),
  });

  const sendMutation = useMutation({
    mutationFn: () => notificationApi.sendNotification({ recipientId, title, body, type }),
    onSuccess: () => {
      setFeedback('Thông báo đã gửi thành công.');
      setRecipientId('');
      setTitle('');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => {
      setFeedback('Không thể gửi thông báo.');
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => notificationApi.removeNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'APPROVED' | 'REJECTED'; reason?: string }) =>
      notificationApi.reviewNotification(id, { status, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setRejectNotificationId(null);
      setRejectReason('');
    },
  });

  const notifications = notificationsRes?.data || [];
  const meta = notificationsRes?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;

  const handleOpenRejectModal = (id: string) => {
    setRejectNotificationId(id);
    setRejectReason('');
  };

  const handleConfirmReject = () => {
    if (!rejectNotificationId) return;
    reviewMutation.mutate({
      id: rejectNotificationId,
      status: 'REJECTED',
      reason: rejectReason || 'Vui lòng kiểm tra lại thông số và cài đặt hoa hồng trên hệ thống.',
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100/70 rounded-2xl border border-amber-200">
            <Bell className="h-6 w-6 text-amber-800" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Thông Báo Hệ Thống</h1>
            <p className="text-slate-500 font-medium text-sm">
              Theo dõi biến động, xem và duyệt thao tác từ MIB / IB trong hệ thống.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications Inbox Card */}
      <section className="rounded-3xl border border-amber-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-amber-100 pb-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Hộp Thư Thông Báo</h2>
            <p className="text-xs text-slate-500 mt-0.5">Danh sách tin nhắn, cập nhật thao tác và phản hồi.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={isReadFilter}
              onChange={(event) => {
                setIsReadFilter(event.target.value as 'all' | 'true' | 'false');
                setPage(1);
              }}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Tất cả thông báo</option>
              <option value="false">Chưa đọc</option>
              <option value="true">Đã đọc</option>
            </select>
            <button
              type="button"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-amber-600 shadow-sm disabled:opacity-50"
            >
              <MailPlus className="h-4 w-4" />
              Đánh dấu đã đọc tất cả
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-amber-50/60 font-extrabold text-slate-800 border-b border-amber-200/60 text-xs">
              <tr>
                <th className="px-4 py-3.5 font-bold">Nội dung thông báo</th>
                <th className="px-4 py-3.5 font-bold">Loại</th>
                <th className="px-4 py-3.5 font-bold">Thời gian</th>
                <th className="px-4 py-3.5 font-bold">Trạng thái đọc</th>
                <th className="px-4 py-3.5 font-bold">Thao tác Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-600 mb-2" />
                    <span>Đang tải thông báo...</span>
                  </td>
                </tr>
              ) : notifications.length > 0 ? (
                notifications.map((item: Notification) => {
                  const meta = (item.metadata as Record<string, any>) || {};
                  const reviewStatus = meta.reviewStatus;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-amber-50/30 transition-colors ${
                        item.isRead ? '' : 'bg-amber-50/20 font-semibold'
                      }`}
                    >
                      <td className="px-4 py-4 text-slate-900 max-w-md">
                        <div className="flex items-start gap-2">
                          <div>
                            <p className="font-extrabold text-slate-900 text-sm">{item.title}</p>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.body}</p>

                            {/* Show details if present */}
                            {meta.actorEmail && (
                              <div className="mt-1.5 text-[11px] text-amber-950 font-medium bg-amber-100/50 px-2 py-0.5 rounded inline-block">
                                Người gửi/thực hiện: {meta.actorEmail}
                              </div>
                            )}

                            {meta.reviewReason && (
                              <div className="mt-1.5 text-[11px] text-red-700 font-medium bg-red-50 border border-red-100 px-2 py-1 rounded-lg">
                                Lý do lỗi: {meta.reviewReason}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700 text-xs font-medium">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-bold text-[10px]">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600 text-xs whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                            item.isRead ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {item.isRead ? 'Đã đọc' : 'Chưa đọc'}
                        </span>
                      </td>

                      {/* Action buttons (Duyệt / Lỗi) */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isAdmin && reviewStatus === 'PENDING' && (
                            <>
                              <button
                                onClick={() => reviewMutation.mutate({ id: item.id, status: 'APPROVED' })}
                                disabled={reviewMutation.isPending}
                                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl transition shadow-sm disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Duyệt
                              </button>
                              <button
                                onClick={() => handleOpenRejectModal(item.id)}
                                disabled={reviewMutation.isPending}
                                className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl transition shadow-sm disabled:opacity-50"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Lỗi
                              </button>
                            </>
                          )}

                          {reviewStatus === 'APPROVED' && (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-black px-2.5 py-1 rounded-xl">
                              <Check className="h-3.5 w-3.5" />
                              Đã Duyệt
                            </span>
                          )}

                          {reviewStatus === 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 bg-rose-100 border border-rose-300 text-rose-800 text-xs font-black px-2.5 py-1 rounded-xl">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Báo Lỗi
                            </span>
                          )}

                          {!item.isRead && !reviewStatus && (
                            <button
                              onClick={() => markReadMutation.mutate(item.id)}
                              className="text-xs font-bold text-slate-600 hover:text-amber-700 underline"
                            >
                              Đánh dấu đọc
                            </button>
                          )}

                          <button
                            onClick={() => removeMutation.mutate(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded-lg hover:bg-rose-50"
                            title="Xóa thông báo"
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
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Chưa có thông báo nào trong hộp thư.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {meta && (
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              Trang {page} / {totalPages} (Tổng {meta.total} thông báo)
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

      {/* Manual Send Notification Section */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <MailPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Gửi Thông Báo Thủ Công</h2>
            <p className="text-xs text-slate-500">Gửi thông báo trực tiếp đến IB tuyến dưới.</p>
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setFeedback(null);
            if (!recipientId) {
              setFeedback('Vui lòng chọn người nhận IB');
              return;
            }
            sendMutation.mutate();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Chọn IB người nhận</label>
              <IbSearchAutocomplete
                value={recipientId}
                onChange={(id) => setRecipientId(id)}
                placeholder="Tìm email hoặc tên IB..."
                className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Loại thông báo</label>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as NotificationType)}
                className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
              >
                {notificationTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề thông báo</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              placeholder="Tiêu đề thông báo..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Nội dung chi tiết</label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              placeholder="Nội dung thông báo gửi tới IB..."
            />
          </div>

          <button
            type="submit"
            disabled={sendMutation.isPending}
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-amber-600 disabled:opacity-50 shadow-sm"
          >
            {sendMutation.isPending ? 'Đang gửi...' : 'Gửi thông báo ngay'}
          </button>

          {feedback && (
            <p className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs font-bold text-amber-900">
              {feedback}
            </p>
          )}
        </form>
      </section>

      {/* Reject Modal */}
      {rejectNotificationId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                Báo Lỗi Thao Tác IB
              </h3>
              <button
                onClick={() => setRejectNotificationId(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Vui lòng nhập thông tin chi tiết về lỗi hoặc lý do yêu cầu MIB/IB kiểm tra lại thao tác của họ:
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Ví dụ: Cấu hình tỷ lệ hoa hồng chưa khớp với thỏa thuận hệ thống, vui lòng kiểm tra lại..."
              className="w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium bg-slate-50"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectNotificationId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={reviewMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-sm disabled:opacity-50"
              >
                {reviewMutation.isPending ? 'Đang gửi...' : 'Gửi Thông Báo Lỗi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
