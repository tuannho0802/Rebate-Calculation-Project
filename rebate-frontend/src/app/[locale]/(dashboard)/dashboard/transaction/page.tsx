'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, TrendingUp, PlusCircle } from 'lucide-react';
import { reportApi } from '@/lib/api/report';
import { transactionApi } from '@/lib/api/transaction';
import { AssetType, RebateTransaction } from '@/types';
import { IbSearchAutocomplete } from '@/components/ib-tree/IbSearchAutocomplete';

const assetTypeOptions = Object.values(AssetType);

export default function TransactionPage() {
  const queryClient = useQueryClient();
  const [ibId, setIbId] = useState('');
  const [assetType, setAssetType] = useState<AssetType>(AssetType.FOREX);
  const [lots, setLots] = useState('0.01');
  const [rebateAmount, setRebateAmount] = useState('0.00');
  const [tradedAt, setTradedAt] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  const [note, setNote] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: transactionsRes, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['reportTransactions', page, limit],
    queryFn: () => reportApi.getTransactions({ page, limit }),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    if (!ibId) {
      setFeedback('Vui lòng chọn IB ID');
      return;
    }
    createMutation.mutate();
  };

  const createMutation = useMutation({
    mutationFn: () =>
      transactionApi.create({
        ibId,
        assetType,
        lots: Number(lots) || 0,
        rebateAmount: Number(rebateAmount) || 0,
        tradedAt: tradedAt ? new Date(tradedAt).toISOString() : new Date().toISOString(),
        note: note || undefined,
      }),
    onSuccess: () => {
      setFeedback('Giao dịch đã được tạo.');
      setIbId('');
      setLots('0.01');
      setRebateAmount('0.00');
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['reportTransactions'] });
    },
    onError: () => {
      setFeedback('Không thể tạo giao dịch. Vui lòng kiểm tra dữ liệu và thử lại.');
    },
  });

  const transactions = transactionsRes?.data || [];
  const meta = transactionsRes?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Giao dịch</h1>
          <p className="text-gray-500">Tạo giao dịch mới và xem lịch sử giao dịch gần nhất.</p>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Tạo giao dịch</h2>
              <p className="text-sm text-gray-500">Nhập dữ liệu giao dịch để ghi nhận rebate cho IB.</p>
            </div>
            <PlusCircle className="h-5 w-5 text-blue-600" />
          </div>
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault();
            setFeedback(null);
            createMutation.mutate();
          }}>
            <div>
              <label className="block text-sm font-medium text-gray-700">IB ID</label>
              <IbSearchAutocomplete
                value={ibId}
                onChange={(id) => setIbId(id)}
                placeholder="Tìm email hoặc tên IB..."
                className="mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tài sản</label>
                <select
                  value={assetType}
                  onChange={(event) => setAssetType(event.target.value as AssetType)}
                  className="mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {assetTypeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Số lot</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={lots}
                  onChange={(event) => setLots(event.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Rebate (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={rebateAmount}
                  onChange={(event) => setRebateAmount(event.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ngày giao dịch</label>
                <input
                  type="datetime-local"
                  value={tradedAt}
                  onChange={(event) => setTradedAt(event.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ghi chú</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                className="mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ghi chú (tùy chọn)"
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo giao dịch'}
            </button>
            {feedback && <p className="text-sm text-green-600">{feedback}</p>}
          </form>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Giao dịch gần nhất</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-600">ID</th>
                  <th className="px-4 py-3 font-medium text-slate-600">IB (Tên/ID)</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Tài sản</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Lots</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Hoa hồng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoadingTransactions ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-600" />
                    </td>
                  </tr>
                ) : transactions.length > 0 ? (
                  transactions.map((transaction: RebateTransaction) => (
                    <tr key={transaction.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700 text-xs font-mono">#{transaction.id.slice(-8)}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium text-blue-600">{transaction.ibName || `#${transaction.ibId.slice(-8)}`}</td>
                      <td className="px-4 py-3 text-slate-700">{transaction.assetType}</td>
                      <td className="px-4 py-3 text-slate-700">{transaction.lots.toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-700">{transaction.rebateAmount.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">Không có giao dịch nào.</td>
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
        </div>
      </section>
    </div>
  );
}
