'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, XCircle, CreditCard } from 'lucide-react';
import { payoutApi } from '@/lib/api/payout';
import { useAuthStore } from '@/store/auth.store';
import { PayoutStatus } from '@/types';

const statusOptions: { label: string; value: PayoutStatus | '' }[] = [
  { label: 'Tất cả', value: '' },
  { label: 'Pending', value: PayoutStatus.PENDING },
  { label: 'Approved', value: PayoutStatus.APPROVED },
  { label: 'Rejected', value: PayoutStatus.REJECTED },
  { label: 'Paid', value: PayoutStatus.PAID },
];

export default function PayoutPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [status, setStatus] = useState<PayoutStatus | ''>('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const params = useMemo(() => ({ status: status || undefined, page, limit }), [status, page, limit]);

  const {
    data: payoutsRes,
    isLoading: isLoadingPayouts,
  } = useQuery({
    queryKey: ['payouts', params],
    queryFn: () => payoutApi.listPayouts(params),
    enabled: !!user,
  });

  const {
    data: pendingRes,
    isLoading: isLoadingPending,
  } = useQuery({
    queryKey: ['payouts-pending', page, limit],
    queryFn: () => payoutApi.getPendingPayouts(page, limit),
    enabled: !!user && isAdmin,
  });

  const requestMutation = useMutation({
    mutationFn: () => payoutApi.requestPayout(Number(amount), paymentMethod, note || undefined),
    onSuccess: () => {
      setFeedback('Yêu cầu rút tiền đã được gửi.');
      setAmount('');
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
    },
    onError: () => {
      setFeedback('Không thể gửi yêu cầu rút tiền. Vui lòng thử lại.');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => payoutApi.approvePayout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts-pending'] });
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => payoutApi.rejectPayout(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts-pending'] });
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
    },
  });

  const payouts = payoutsRes?.data || [];
  const payoutsMeta = payoutsRes?.meta;
  const pendingPayouts = pendingRes?.data || [];

  const totalPages = payoutsMeta ? Math.ceil(payoutsMeta.total / payoutsMeta.limit) : 1;

  const handleRequestSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    requestMutation.mutate();
  };

  const handleApprove = (id: string) => approveMutation.mutate(id);

  const handleReject = async (id: string) => {
    const reason = window.prompt('Nhập lý do từ chối (tối thiểu 10 ký tự)');
    if (!reason || reason.length < 10) return;
    rejectMutation.mutate({ id, reason });
  };

  if (!user) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Payout</h1>
          <p className="text-gray-500">Gửi yêu cầu rút tiền và theo dõi trạng thái payout.</p>
        </div>
      </div>

      {!isAdmin && (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Yêu cầu rút tiền mới</h2>
            <form className="space-y-4" onSubmit={handleRequestSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700">Số tiền</label>
                <input
                  type="number"
                  step="0.01"
                  min="10"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phương thức thanh toán</label>
                <input
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="bank_transfer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ghi chú</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ghi chú thêm..."
                />
              </div>
              <button
                type="submit"
                disabled={requestMutation.isPending}
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {requestMutation.isPending ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </button>
            </form>
            {feedback && <p className="mt-4 text-sm text-green-600">{feedback}</p>}
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Trạng thái tài khoản</h2>
            <p className="text-sm text-gray-500">Bạn có thể theo dõi lịch sử request payout và trạng thái hiện tại.</p>
          </section>
        </div>
      )}

      {isAdmin && (
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Danh sách yêu cầu Payout đang chờ duyệt</h2>
              <p className="text-sm text-gray-500">Chỉ có MIB / admin mới thấy danh sách này.</p>
            </div>
            <div className="inline-flex items-center rounded-2xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              Tổng: {pendingPayouts.length}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-600">IB ID</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Số tiền</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Phương thức</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Ngày</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoadingPending ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-600" />
                    </td>
                  </tr>
                ) : pendingPayouts.length > 0 ? (
                  pendingPayouts.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{item.ibId}</td>
                      <td className="px-4 py-3 text-slate-700">{Number(item.amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-700">{item.paymentMethod || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{new Date(item.requestedAt).toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3 space-x-2">
                        <button
                          onClick={() => handleApprove(item.id)}
                          disabled={approveMutation.isPending}
                          className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                        >
                          Duyệt
                        </button>
                        <button
                          onClick={() => handleReject(item.id)}
                          disabled={rejectMutation.isPending}
                          className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 transition"
                        >
                          Từ chối
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">Không có yêu cầu nào.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Lịch sử yêu cầu Payout</h2>
            <p className="text-sm text-gray-500">Xem các request đã gửi và trạng thái hiện tại.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as PayoutStatus | '');
                setPage(1);
              }}
              className="rounded-2xl border border-gray-200 bg-slate-50 px-4 py-2 text-sm text-slate-900"
            >
              {statusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">ID</th>
                <th className="px-4 py-3 font-medium text-slate-600">IB ID</th>
                <th className="px-4 py-3 font-medium text-slate-600">Số tiền</th>
                <th className="px-4 py-3 font-medium text-slate-600">Trạng thái</th>
                <th className="px-4 py-3 font-medium text-slate-600">Ngày yêu cầu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoadingPayouts ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-600" />
                  </td>
                </tr>
              ) : payouts.length > 0 ? (
                payouts.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700 text-xs font-mono">{item.id}</td>
                    <td className="px-4 py-3 text-slate-700">{item.ibId}</td>
                    <td className="px-4 py-3 text-slate-700">{Number(item.amount).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.status === PayoutStatus.APPROVED ? 'bg-emerald-100 text-emerald-800' : item.status === PayoutStatus.REJECTED ? 'bg-rose-100 text-rose-800' : item.status === PayoutStatus.PAID ? 'bg-slate-100 text-slate-800' : 'bg-amber-100 text-amber-800'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{new Date(item.requestedAt).toLocaleString('vi-VN')}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">Không có bản ghi nào phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {payoutsMeta && (
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
    </div>
  );
}
