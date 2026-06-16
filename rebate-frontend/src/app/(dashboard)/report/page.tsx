'use client';

import React, { useEffect, useState } from 'react';
import { reportApi } from '@/lib/api/report';
import { useAuthStore } from '@/store/auth.store';
import { ReportSummary, RebateTransaction } from '@/types';

export default function ReportPage() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [transactions, setTransactions] = useState<RebateTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  const loadReportData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Load summary
      const sumData = await reportApi.getSummary(period);
      setSummary(sumData);

      // Load paginated transactions
      const txsData = await reportApi.getTransactions({
        period,
        page,
        limit,
      });
      setTransactions(txsData.data);
      setTotalPages(Math.ceil((txsData.meta?.total || 0) / limit) || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [period, page, user]);

  // Reset page when period changes
  const handlePeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPeriod(e.target.value);
    setPage(1);
  };

  return (
    <div className="space-y-8">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 border border-slate-800 rounded-2xl p-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Báo cáo doanh số & Rebate</h1>
          <p className="text-slate-400 mt-1">Tổng hợp và chi tiết lịch sử nhận hoa hồng Introducer Broker.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0">
            Tháng báo cáo:
          </label>
          <input
            type="month"
            value={period}
            onChange={handlePeriodChange}
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none text-sm w-full sm:w-auto"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Tổng Rebate Tháng</span>
              <div className="text-3xl font-extrabold text-emerald-400 mt-2">
                ${summary?.totalRebate.toFixed(2) || '0.00'}
              </div>
            </div>
            {summary?.byAsset.map((asset) => (
              <div key={asset.assetType} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  Rebate {asset.assetType}
                </span>
                <div className="text-xl font-bold text-white mt-2">${asset.totalRebate.toFixed(2)}</div>
                <div className="text-xs text-slate-400 mt-1">Tổng Volume: {asset.lots.toFixed(2)} lots</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Summary by Sub-IB */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:col-span-1">
              <h2 className="text-lg font-bold text-white mb-4">Chi tiết theo tài khoản cấp dưới</h2>
              <div className="space-y-3">
                {summary && summary.byIB.length > 0 ? (
                  summary.byIB.map((ib) => (
                    <div key={ib.ibId} className="flex justify-between items-center bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                      <div className="truncate pr-2">
                        <div className="text-xs font-semibold text-slate-300 truncate">{ib.email}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Level {ib.level}</div>
                      </div>
                      <span className="text-sm font-bold text-emerald-400 shrink-0">${ib.totalRebate.toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">Chưa ghi nhận giao dịch của cấp dưới.</p>
                )}
              </div>
            </div>

            {/* Right: Detailed Transactions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
              <h2 className="text-lg font-bold text-white">Lịch sử giao dịch</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs uppercase bg-slate-950 text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Asset</th>
                      <th className="px-4 py-3 text-right">Volume (Lots)</th>
                      <th className="px-4 py-3 text-right">Hoa hồng (USD)</th>
                      <th className="px-4 py-3 text-right">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3.5 font-semibold text-white">{tx.assetType}</td>
                        <td className="px-4 py-3.5 text-right font-medium">{tx.lots} lots</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-emerald-400">
                          +${tx.rebateAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-right text-xs text-slate-500">
                          {new Date(tx.tradedAt).toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                          Chưa có lịch sử giao dịch nào được ghi nhận.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-sm text-slate-400">
                  <span>
                    Trang {page} / {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded transition"
                    >
                      Trước
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded transition"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
