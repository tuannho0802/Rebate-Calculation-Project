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
        <h2 className="text-lg font-extrabold text-gray-900">
          {t('tabStats')} <span className="text-sm font-semibold text-gray-500 ml-2">({t('month')} {data.period.month})</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-amber-50/40 border border-amber-200/60 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600">{t('totalVolume')}</p>
              <p className="text-2xl font-extrabold text-amber-950 mt-1">{data.overall.totalLots.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-amber-700" />
            </div>
          </div>
        </div>

        <div className="bg-amber-50/40 border border-amber-200/60 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600">{t('totalTransactions')}</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">{data.overall.transactionCount}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <Activity className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider mb-4">{t('detailsByAsset')}</h3>
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm text-left text-gray-800">
            <thead className="text-xs uppercase bg-amber-50/80 text-gray-800 border-b border-amber-200/80 font-extrabold">
              <tr>
                <th className="px-5 py-4">{t('tableAsset')}</th>
                <th className="px-5 py-4 text-right">{t('tableVolume')}</th>
                <th className="px-5 py-4 text-right">{t('tableTransactions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {data.byAssetType.length > 0 ? (
                data.byAssetType.map((asset) => (
                  <tr key={asset.assetType} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-5 py-4 font-bold text-gray-900">{asset.assetType}</td>
                    <td className="px-5 py-4 text-right text-amber-950 font-extrabold">
                      {asset.lots.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-right text-gray-700 font-semibold">
                      {asset.count}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-gray-500 font-medium">
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
