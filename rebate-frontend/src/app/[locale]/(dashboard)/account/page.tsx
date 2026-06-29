'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/auth.store';
import ChangePasswordForm from '@/components/account/ChangePasswordForm';
import ProjectStatistics from '@/components/account/ProjectStatistics';
import { KeyRound, BarChart3 } from 'lucide-react';

export default function AccountPage() {
  const t = useTranslations('Account');
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'password' | 'stats'>('password');

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
        <p className="text-slate-400 mt-1">{t('description')}</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('password')}
            className={`flex items-center px-6 py-4 text-sm font-semibold transition-colors ${
              activeTab === 'password'
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-800/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <KeyRound className="w-4 h-4 mr-2" />
            {t('tabPassword')}
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center px-6 py-4 text-sm font-semibold transition-colors ${
              activeTab === 'stats'
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-800/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            {t('tabStats')}
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'password' && <ChangePasswordForm />}
          {activeTab === 'stats' && <ProjectStatistics userId={user.id} />}
        </div>
      </div>
    </div>
  );
}
