'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Bell, MailPlus, Trash2 } from 'lucide-react';
import { notificationApi } from '@/lib/api/notification';
import { NotificationType, Notification } from '@/types';
import { IbSearchAutocomplete } from '@/components/ib-tree/IbSearchAutocomplete';

const notificationTypeOptions = Object.values(NotificationType);

export default function NotificationPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [isReadFilter, setIsReadFilter] = useState<'all' | 'true' | 'false'>('all');
  const [recipientId, setRecipientId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<NotificationType>(NotificationType.MANUAL);
  const [feedback, setFeedback] = useState<string | null>(null);

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
      setFeedback('Thông báo đã gửi.');
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

  const notifications = notificationsRes?.data || [];
  const meta = notificationsRes?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-amber-700" />
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Thông báo</h1>
          <p className="text-gray-600 font-medium">Xem, gửi và quản lý thông báo trong hệ thống.</p>
        </div>
      </div>

      <section className="rounded-3xl border border-amber-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Hộp thư</h2>
            <p className="text-sm text-gray-500">Danh sách thông báo của bạn và trạng thái đã đọc.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={isReadFilter}
              onChange={(event) => {
                setIsReadFilter(event.target.value as 'all' | 'true' | 'false');
                setPage(1);
              }}
              className="rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Tất cả</option>
              <option value="false">Chưa đọc</option>
              <option value="true">Đã đọc</option>
            </select>
            <button
              type="button"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] px-5 py-3 text-sm font-extrabold text-gray-900 transition hover:opacity-95 shadow-md disabled:opacity-50"
            >
              <MailPlus className="h-4 w-4 text-gray-900" />
              Đánh dấu đã đọc tất cả
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-left text-sm">
            <thead className="bg-amber-50/80 font-extrabold text-gray-800 border-b border-amber-200/80">
              <tr>
                <th className="px-4 py-3 font-bold">Tiêu đề</th>
                <th className="px-4 py-3 font-bold">Loại</th>
                <th className="px-4 py-3 font-bold">Ngày</th>
                <th className="px-4 py-3 font-bold">Trạng thái</th>
                <th className="px-4 py-3 font-bold">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-amber-600" />
                  </td>
                </tr>
              ) : notifications.length > 0 ? (
                notifications.map((item: Notification) => (
                  <tr key={item.id} className={`hover:bg-amber-50/40 transition-colors ${item.isRead ? '' : 'bg-amber-50/20 font-bold'}`}>
                    <td className="px-4 py-3 text-gray-900">
                      <p className="font-bold">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.body}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.type}</td>
                    <td className="px-4 py-3 text-slate-700">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.isRead ? 'bg-slate-100 text-slate-800' : 'bg-amber-100 text-amber-800'}`}>
                        {item.isRead ? 'Đã đọc' : 'Chưa đọc'}
                      </span>
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      {!item.isRead && (
                        <button
                          onClick={() => markReadMutation.mutate(item.id)}
                          className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                        >
                          Đánh dấu đọc
                        </button>
                      )}
                      <button
                        onClick={() => removeMutation.mutate(item.id)}
                        className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 transition"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">Chưa có thông báo.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {meta && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>Trang {page} / {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-2 disabled:opacity-40"
              >Trước</button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-2 disabled:opacity-40"
              >Tiếp</button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <MailPlus className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Gửi thông báo</h2>
            <p className="text-sm text-gray-500">Gửi thủ công thông báo đến IB trong subtree của bạn.</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          setFeedback(null);
          if (!recipientId) {
            setFeedback('Vui lòng chọn Recipient IB ID');
            return;
          }
          sendMutation.mutate();
        }}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Recipient IB ID</label>
              <IbSearchAutocomplete
                value={recipientId}
                onChange={(id) => setRecipientId(id)}
                placeholder="Tìm email hoặc tên IB..."
                className="mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Loại thông báo</label>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as NotificationType)}
                className="mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {notificationTypeOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tiêu đề</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tiêu đề thông báo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nội dung</label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              className="mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nội dung thông báo"
            />
          </div>
          <button
            type="submit"
            disabled={sendMutation.isPending}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {sendMutation.isPending ? 'Đang gửi...' : 'Gửi thông báo'}
          </button>
        </form>
        {feedback && <p className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{feedback}</p>}
      </section>
    </div>
  );
}
