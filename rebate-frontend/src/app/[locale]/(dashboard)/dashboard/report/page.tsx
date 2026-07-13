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
              className="pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-gray-50/50 hover:bg-white transition-colors"
            />
          </div>
        </div>
      </div>

      {/* --- PHẦN TRÊN: SUMMARY CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card Tổng Hoa Hồng */}
        <div className="bg-gradient-to-br from-[#0066ff] to-[#0047b3] rounded-2xl p-6 text-white shadow-xl shadow-blue-500/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 blur-2xl group-hover:opacity-20 transition-opacity"></div>
          <div className="flex items-center gap-3 mb-4 opacity-90">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <DollarSign className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-lg tracking-wide">Tổng Hoa Hồng</h3>
          </div>
          {isLoadingSummary ? (
            <Loader2 className="h-8 w-8 animate-spin opacity-50" />
          ) : (
            <div className="flex items-baseline gap-2 drop-shadow-md">
              <span className="text-4xl font-extrabold tracking-tight">
                {summary?.totalRebate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xl font-bold opacity-80">{summary?.currency || 'USD'}</span>
            </div>
          )}
        </div>

        {/* Breakdown theo loại tài sản */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4 text-gray-800">
            <Activity className="h-5 w-5 text-[#0066ff]" />
            <h3 className="font-bold text-lg">Phân bổ theo tài sản</h3>
          </div>
          
          {isLoadingSummary ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-[#0066ff]" />
            </div>
          ) : summary?.byAsset && summary.byAsset.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {summary.byAsset.map(asset => (
                <div key={asset.assetType} className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-default group">
                  <span className="text-xs font-bold text-gray-500 mb-1 group-hover:text-blue-600 transition-colors">{asset.assetType}</span>
                  <span className="text-lg font-bold text-gray-900 group-hover:text-blue-800 transition-colors">
                    {asset.totalRebate.toLocaleString()} <span className="text-xs font-semibold text-gray-400">USD</span>
                  </span>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    {asset.lots} Lots
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Không có dữ liệu phân bổ trong kỳ này.</p>
          )}
        </div>
      </div>

      {/* --- PHẦN DƯỚI: BẢNG LỊCH SỬ GIAO DỊCH (CÓ PHÂN TRANG) --- */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-lg">Lịch Sử Giao Dịch</h3>
          <p className="text-sm text-gray-500 mt-1">Chi tiết các khoản hoa hồng đổ về từ thành viên nhánh dưới.</p>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-bold text-gray-600 uppercase tracking-wider">
                <th className="p-4 pl-6">Mã Giao Dịch</th>
                <th className="p-4">Thời Gian</th>
                <th className="p-4">IB (Tên/ID)</th>
                <th className="p-4">Tài Sản</th>
                <th className="p-4 text-right">Khối Lượng (Lots)</th>
                <th className="p-4 pr-6 text-right">Hoa Hồng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoadingTx ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#0066ff] mx-auto" />
                  </td>
                </tr>
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="p-4 pl-6 font-mono text-xs text-gray-500">#{tx.id.slice(-8)}</td>
                    <td className="p-4 text-sm font-medium text-gray-700">{new Date(tx.tradedAt).toLocaleString('vi-VN')}</td>
                    <td className="p-4 text-sm font-bold text-[#0052cc]">{tx.ibName || `#${tx.ibId.slice(-8)}`}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-bold border border-gray-200">
                        {tx.assetType}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-700 font-bold text-right">{tx.lots.toFixed(2)}</td>
                    <td className="p-4 pr-6 text-right font-black text-green-600">
                      +{tx.rebateAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] font-bold text-green-600/70">{tx.currency}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-500 text-sm font-medium">
                    Chưa có giao dịch phát sinh nào trong khoảng thời gian này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cụm phân trang (Pagination) */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-500 font-medium">
            Trang <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm mx-1">{page}</span> / {totalPages}
            {meta && <span className="ml-3 text-gray-400">Tổng cộng {meta.total} bản ghi</span>}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handlePrevPage}
              disabled={page === 1 || isLoadingTx}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-[#0066ff] hover:border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
              Trước
            </button>
            <button
              onClick={handleNextPage}
              disabled={page === totalPages || isLoadingTx}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-[#0066ff] hover:border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
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
