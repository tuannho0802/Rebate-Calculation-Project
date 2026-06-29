'use client';

import React, { useEffect, useState } from 'react';
import { ibApi } from '@/lib/api/ib';
import { IbPerformanceResponse } from '@/types';
import { Loader2, TrendingUp, Activity } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ProjectStatisticsProps {
  userId: string;
}

export default function ProjectStatistics({ userId }: ProjectStatisticsProps) {
  const t = useTranslations('Account');
  const [data, setData] = useState<IbPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        setLoading(true);
        // Lấy dữ liệu tháng hiện tại (không truyền tháng để backend tự lấy tháng hiện tại)
        const response = await ibApi.getPerformance(userId);
        setData(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('statsError'));
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchPerformance();
    }
  }, [userId, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white">
          {t('tabStats')} <span className="text-sm font-normal text-slate-400 ml-2">({t('month')} {data.period.month})</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">{t('totalVolume')}</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{data.overall.totalLots.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">{t('totalTransactions')}</p>
              <p className="text-2xl font-bold text-white mt-1">{data.overall.transactionCount}</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Activity className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">{t('detailsByAsset')}</h3>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs uppercase bg-slate-900 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-4">{t('tableAsset')}</th>
                <th className="px-5 py-4 text-right">{t('tableVolume')}</th>
                <th className="px-5 py-4 text-right">{t('tableTransactions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/50">
              {data.byAssetType.length > 0 ? (
                data.byAssetType.map((asset) => (
                  <tr key={asset.assetType} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-white">{asset.assetType}</td>
                    <td className="px-5 py-4 text-right text-emerald-400 font-medium">
                      {asset.lots.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-300">
                      {asset.count}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-500">
                    {t('noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
