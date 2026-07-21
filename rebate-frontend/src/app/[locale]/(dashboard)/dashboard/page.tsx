'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ibApi } from '@/lib/api/ib';
import { rebateApi } from '@/lib/api/rebate';
import { useAuthStore } from '@/store/auth.store';
import { AssetType, RebateConfig, RebateCalculation } from '@/types';

export default function DashboardPage() {
  const t = useTranslations('DashboardPage');
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [config, setConfig] = useState<RebateConfig | null>(null);
  
  // Calculator States
  const [calcAsset, setCalcAsset] = useState<AssetType>(AssetType.FOREX);
  const [calcLots, setCalcLots] = useState<number>(10);
  const [calcResult, setCalcResult] = useState<RebateCalculation | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const loadDashboardData = async () => {
        try {
          const profileData = await ibApi.getMe();
          let pData = profileData.data;
          
          if (pData.parent) {
            pData.parentEmail = pData.parent.email;
            pData.parentName = pData.parent.name;
          }
          
          setProfile(pData);
          const configData = await rebateApi.getConfig(user.id);
          setConfig(configData.data);
        } catch (e) {
          console.error(e);
        }
      };
      loadDashboardData();
    }
  }, [user]);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCalcLoading(true);
    try {
      const result = await rebateApi.calculate(user.id, calcAsset, calcLots);
      setCalcResult(result.data);
    } catch (e) {
      console.error(e);
    } finally {
      setCalcLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Card */}
      <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-gray-900">{t('welcome')}, {user?.email}</h1>
        <p className="text-gray-600 mt-1 font-medium">{t('description')}</p>

        {profile && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-amber-100">
            <div>
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">{t('level')}</div>
              <div className="text-lg font-extrabold text-gray-900 mt-1">Level {profile.level}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">{t('directDownlines')}</div>
              <div className="text-lg font-extrabold text-gray-900 mt-1">{profile.totalChildren}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">IB Tuyến Trên</div>
              <div className="text-sm font-bold text-amber-950 mt-1 truncate" title={profile.parentEmail || profile.parentId || 'N/A'}>
                {profile.parentEmail ? (profile.parentName ? `${profile.parentName} - ${profile.parentEmail}` : profile.parentEmail) : (profile.parentId || 'N/A')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">{t('joinedDate')}</div>
              <div className="text-sm font-bold text-gray-800 mt-1">
                {new Date(profile.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configurations Table */}
        <div className="lg:col-span-2 bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-gray-900 mb-4">{t('currentConfig')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-800">
              <thead className="text-xs uppercase bg-amber-50/80 text-gray-800 border-b border-amber-200/80 font-extrabold">
                <tr>
                  <th className="px-4 py-3 font-bold">{t('assetType')}</th>
                  <th className="px-4 py-3 text-right font-bold">{t('rebatePips')}</th>
                  <th className="px-4 py-3 text-right font-bold">{t('markupPips')}</th>
                  <th className="px-4 py-3 text-right font-bold">{t('maxPips')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {config && config.assets?.filter(a => a.rebatePips > 0 || a.markupPips > 0).map((asset, idx) => (
                  <tr key={`${asset.assetType}-${idx}`} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-900">{asset.assetType}</td>
                    <td className="px-4 py-3 text-right text-amber-950 font-extrabold">{asset.rebatePips} pips</td>
                    <td className="px-4 py-3 text-right text-gray-600 font-semibold">{asset.markupPips} pips</td>
                    <td className="px-4 py-3 text-right text-gray-500 font-medium">{asset.maxPips} pips</td>
                  </tr>
                ))}
                {(!config || !config.assets || config.assets.filter(a => a.rebatePips > 0 || a.markupPips > 0).length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-500 font-medium">
                      {t('noConfig')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rebate Calculator */}
        <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-gray-900 mb-4">{t('calculatorTitle')}</h2>
          <form onSubmit={handleCalculate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('calcAssetLabel')}
              </label>
              <select
                value={calcAsset}
                onChange={(e) => setCalcAsset(e.target.value as AssetType)}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 focus:border-amber-500 focus:ring-amber-500 focus:outline-none text-sm font-semibold"
              >
                {Object.values(AssetType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('calcLotsLabel')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={calcLots}
                onChange={(e) => setCalcLots(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 focus:border-amber-500 focus:ring-amber-500 focus:outline-none text-sm font-semibold"
                placeholder="10"
              />
            </div>
            <button
              type="submit"
              disabled={calcLoading}
              className="w-full rounded-lg bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] px-4 py-2.5 text-sm font-extrabold text-gray-900 hover:opacity-95 focus:outline-none disabled:opacity-55 transition shadow-md"
            >
              {calcLoading ? t('calculating') : t('calculateBtn')}
            </button>
          </form>

          {calcResult && (
            <div className="mt-6 pt-6 border-t border-amber-100 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-semibold">{t('selfRebate')}</span>
                <span className="font-extrabold text-amber-950 text-xl">${calcResult.breakdown.self.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-semibold">{t('totalDistributed')}</span>
                <span className="font-bold text-gray-900">${calcResult.totalRebate.toFixed(2)}</span>
              </div>
              {calcResult.breakdown.distributed.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">{t('downlineDetails')}</div>
                  {calcResult.breakdown.distributed.map((dist, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-gray-700 font-medium">
                      <span>Lv{dist.level}:</span>
                      <span>${dist.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
