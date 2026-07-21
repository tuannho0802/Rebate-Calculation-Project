'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '@/lib/api/report';
import { Loader2, DollarSign, Activity, Calendar, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

export default function ReportPage() {
  const [period, setPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [page, setPage] = useState(1);
  const limit = 10;

  // Query Tổng quan (Summary)
  const { data: summaryRes, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['reportSummary', period],
    queryFn: () => reportApi.getSummary(period || undefined),
  });

  // Query Danh sách giao dịch phân trang
  const { data: txRes, isLoading: isLoadingTx } = useQuery({
    queryKey: ['reportTransactions', period, page, limit],
    queryFn: () => reportApi.getTransactions({ period: period || undefined, page, limit }),
  });

  const summary = summaryRes?.data;
  const transactions = txRes?.data || [];
  const meta = txRes?.meta;

  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;

  const handlePrevPage = () => {
    if (page > 1) setPage(p => p - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(p => p + 1);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header và Bộ lọc */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Báo Cáo Tổng Hợp</h1>
          <p className="text-gray-500 mt-1">
            Theo dõi dòng tiền hoa hồng và lịch sử giao dịch chi tiết tuyến dưới.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
          <label className="text-sm font-semibold text-gray-600 pl-2">Tháng:</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-4 w-4 text-blue-500" />
            </div>
            <input
              type="month"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPage(1); // Trở về trang 1 khi đổi bộ lọc
              }}
              className="pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 bg-gray-50/50 hover:bg-white transition-colors"
            />
          </div>
        </div>
      </div>

      {/* --- PHẦN TRÊN: SUMMARY CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card Tổng Hoa Hồng */}
        <div className="bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] rounded-2xl p-6 text-gray-900 shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-20 blur-2xl group-hover:opacity-30 transition-opacity"></div>
          <div className="flex items-center gap-3 mb-4 text-gray-900">
            <div className="p-2 bg-white/40 rounded-lg backdrop-blur-sm shadow-sm">
              <DollarSign className="h-5 w-5 text-gray-900" />
            </div>
            <h3 className="font-extrabold text-lg tracking-wide text-gray-900">Tổng Hoa Hồng</h3>
          </div>
          {isLoadingSummary ? (
            <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-gray-900">
                {summary?.totalRebate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xl font-bold text-gray-900">{summary?.currency || 'USD'}</span>
            </div>
          )}
        </div>

        {/* Breakdown theo loại tài sản */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-amber-200/80 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4 text-gray-900">
            <Activity className="h-5 w-5 text-amber-700" />
            <h3 className="font-bold text-lg text-gray-900">Phân bổ theo tài sản</h3>
          </div>
          
          {isLoadingSummary ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : summary?.byAsset && summary.byAsset.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {summary.byAsset.map(asset => (
                <div key={asset.assetType} className="bg-amber-50/40 rounded-xl p-4 border border-amber-200/60 flex flex-col hover:border-amber-300 hover:bg-amber-100/40 transition-colors cursor-default group">
                  <span className="text-xs font-bold text-gray-600 mb-1 group-hover:text-amber-900 transition-colors">{asset.assetType}</span>
                  <span className="text-lg font-extrabold text-gray-900 group-hover:text-amber-950 transition-colors">
                    {asset.totalRebate.toLocaleString()} <span className="text-xs font-semibold text-gray-500">USD</span>
                  </span>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
                    <TrendingUp className="h-3 w-3 text-emerald-600" />
                    {asset.lots} Lots
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Không có dữ liệu phân bổ</p>
          )}
        </div>
      </div>

      {/* --- PHẦN DƯỚI: BẢNG LỊCH SỬ GIAO DỊCH --- */}
      <div className="bg-white rounded-2xl border border-amber-200/80 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-amber-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-lg text-gray-900">Lịch sử giao dịch hoa hồng</h3>
            <p className="text-xs text-gray-500 mt-0.5">Danh sách các lệnh đã được tính hoa hồng theo kỳ</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-amber-50/80 text-gray-800 font-extrabold border-b border-amber-200/80">
              <tr>
                <th className="px-5 py-3.5">Ticket ID</th>
                <th className="px-5 py-3.5">Account ID</th>
                <th className="px-5 py-3.5">Sản Phẩm</th>
                <th className="px-5 py-3.5 text-right">Volume (Lots)</th>
                <th className="px-5 py-3.5 text-right">Hoa Hồng (USD)</th>
                <th className="px-5 py-3.5 text-center">Thời Gian Lệnh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoadingTx ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto mb-2" />
                    Đang tải danh sách giao dịch...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 font-medium">
                    Không có lịch sử giao dịch nào trong kỳ này
                  </td>
                </tr>
              ) : (
                transactions.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-gray-900">#{tx.id.slice(-8)}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-700">{tx.ibName || `#${tx.ibId.slice(-8)}`}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-900">{tx.assetType}</td>
                    <td className="px-5 py-3.5 text-right font-extrabold text-gray-900">{tx.lots.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-right font-extrabold text-amber-950">
                      +${tx.rebateAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {tx.currency}
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs text-gray-500 font-medium">
                      {new Date(tx.tradedAt).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Cụm phân trang (Pagination) */}
        <div className="p-4 border-t border-amber-100 bg-amber-50/40 flex items-center justify-between">
          <div className="text-sm text-gray-500 font-medium">
            Trang <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm mx-1">{page}</span> / {totalPages}
            {meta && <span className="ml-3 text-gray-400">Tổng cộng {meta.total} bản ghi</span>}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handlePrevPage}
              disabled={page === 1 || isLoadingTx}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
              Trước
            </button>
            <button
              onClick={handleNextPage}
              disabled={page === totalPages || isLoadingTx}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Tiếp
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
