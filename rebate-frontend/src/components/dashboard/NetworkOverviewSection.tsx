'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Users, TrendingUp, Layers, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { dashboardApi } from '@/lib/api/dashboard';
import MetricCard from './MetricCard';
import BarChart from './BarChart';

interface NetworkOverviewSectionProps {
  scopeTitle: string;
  scopeHint: string;
  showWallet?: boolean;
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function fmtUsd(v: number): string {
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/**
 * Phần "Tổng quan mạng lưới" dùng CHUNG cho cả 3 role (Admin / MIB / Lv1+).
 * Không có logic phân quyền nào ở FE — chỉ gọi đúng 4 endpoint tự-phục-vụ,
 * BE tự trả về đúng phạm vi theo role (xem dashboard.service.ts). Props
 * scopeTitle/scopeHint/showWallet chỉ đổi CHỮ hiển thị, không đổi dữ liệu.
 */
export default function NetworkOverviewSection({ scopeTitle, scopeHint, showWallet = true }: NetworkOverviewSectionProps) {
  const [period, setPeriod] = useState(currentPeriod());
  const [perfPage, setPerfPage] = useState(1);
  const perfLimit = 8;

  const { data: overviewRes, isLoading: overviewLoading } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => dashboardApi.getOverview(),
  });

  const { data: rebateSummaryRes, isLoading: rebateSummaryLoading } = useQuery({
    queryKey: ['dashboard', 'rebate-summary', period],
    queryFn: () => dashboardApi.getRebateSummary(period),
  });

  const { data: perfRes, isLoading: perfLoading } = useQuery({
    queryKey: ['dashboard', 'ib-performance', period, perfPage],
    queryFn: () => dashboardApi.getIbPerformance(period, perfPage, perfLimit),
  });

  const overview = overviewRes?.data;
  const rebateSummary = rebateSummaryRes?.data;
  const perf = perfRes?.data;

  const totalPerfPages = perf ? Math.max(1, Math.ceil(perf.total / perfLimit)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">{scopeTitle}</h2>
          <p className="text-sm text-gray-500 font-medium">{scopeHint}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kỳ báo cáo</label>
          <input
            type="month"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value || currentPeriod());
              setPerfPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-900 focus:border-amber-500 focus:ring-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Metric cards */}
      <div className={`grid grid-cols-2 gap-4 ${showWallet ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
        {showWallet && (
          <MetricCard
            label="Số dư ví"
            value={overview ? fmtUsd(overview.wallet.balance) : '—'}
            icon={Wallet}
            sublabel={overview?.wallet.currency}
          />
        )}
        <MetricCard
          label="Rebate tháng này"
          value={overview ? fmtUsd(overview.rebate.thisMonth) : '—'}
          icon={TrendingUp}
          changePercent={overview?.rebate.changePercent}
          sublabel="so với tháng trước"
        />
        <MetricCard
          label="Lots tháng này"
          value={overview ? overview.lots.thisMonth.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
          icon={Layers}
        />
        <MetricCard
          label="IB trong mạng lưới"
          value={overview ? String(overview.subtree.totalIbs) : '—'}
          icon={Users}
          sublabel={overview ? `${overview.subtree.activeIbs} đang hoạt động (30 ngày)` : undefined}
        />
        <MetricCard
          label="Tổng Rebate kỳ đã chọn"
          value={rebateSummary ? fmtUsd(rebateSummary.total) : '—'}
          sublabel={period}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rebate breakdown by asset */}
        <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-extrabold text-gray-900 mb-4 uppercase tracking-wider">Rebate theo Asset</h3>
          {rebateSummaryLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-amber-600" /></div>
          ) : (
            <BarChart
              data={(rebateSummary?.byAsset ?? []).slice(0, 8).map((a) => ({ label: a.assetType, value: a.rebate }))}
              valueFormatter={fmtUsd}
              emptyLabel="Chưa có giao dịch trong kỳ này"
            />
          )}
        </div>

        {/* Top IBs */}
        <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-extrabold text-gray-900 mb-4 uppercase tracking-wider">Top IB tháng này</h3>
          {overviewLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-amber-600" /></div>
          ) : (overview?.topIbs.length ?? 0) === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500 font-medium">Chưa có dữ liệu tháng này</div>
          ) : (
            <div className="space-y-2">
              {overview!.topIbs.map((ib, idx) => (
                <div key={`${ib.email}-${idx}`} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-amber-50/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <span className="text-sm font-semibold text-gray-800 truncate">{ib.email}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-extrabold text-amber-950">{fmtUsd(ib.rebate)}</div>
                    <div className="text-xs text-gray-400 font-medium">{ib.lots.toLocaleString('en-US', { maximumFractionDigits: 2 })} lots</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* IB performance table */}
      <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-extrabold text-gray-900 mb-4 uppercase tracking-wider">Hiệu suất IB trong kỳ</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-800">
            <thead className="text-xs uppercase bg-amber-50/80 text-gray-800 border-b border-amber-200/80 font-extrabold">
              <tr>
                <th className="px-4 py-3 font-bold">IB</th>
                <th className="px-4 py-3 font-bold">Level</th>
                <th className="px-4 py-3 text-right font-bold">Lots</th>
                <th className="px-4 py-3 text-right font-bold">Rebate</th>
                <th className="px-4 py-3 text-right font-bold">Giao dịch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {perfLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-amber-600 mx-auto" /></td></tr>
              ) : (perf?.items.length ?? 0) === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500 font-medium">Không có IB nào trong phạm vi của bạn.</td></tr>
              ) : (
                perf!.items.map((item) => (
                  <tr key={item.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-900">
                      {item.name || item.email}
                      <div className="text-xs text-gray-400 font-medium">{item.email}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-600">Level {item.level}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">{item.lots.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-amber-950">{fmtUsd(item.rebate)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">{item.txCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {perf && perf.total > perfLimit && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <span className="text-xs text-gray-500 font-medium">
              Trang {perfPage}/{totalPerfPages} — {perf.total} IB
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPerfPage((p) => Math.max(1, p - 1))}
                disabled={perfPage <= 1}
                className="rounded-lg p-1.5 border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPerfPage((p) => Math.min(totalPerfPages, p + 1))}
                disabled={perfPage >= totalPerfPages}
                className="rounded-lg p-1.5 border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
