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
        <h1 className="text-2xl font-extrabold text-gray-900">{t('title')}</h1>
        <p className="text-gray-600 mt-1 font-medium">{t('description')}</p>
      </div>

      <div className="bg-white border border-amber-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex border-b border-amber-100 bg-amber-50/40">
          <button
            onClick={() => setActiveTab('password')}
            className={`flex items-center px-6 py-4 text-sm font-bold transition-colors ${
              activeTab === 'password'
                ? 'text-gray-900 border-b-2 border-red-500 bg-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-amber-50/60'
            }`}
          >
            <KeyRound className="w-4 h-4 mr-2 text-amber-700" />
            {t('tabPassword')}
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center px-6 py-4 text-sm font-bold transition-colors ${
              activeTab === 'stats'
                ? 'text-gray-900 border-b-2 border-red-500 bg-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-amber-50/60'
            }`}
          >
            <BarChart3 className="w-4 h-4 mr-2 text-amber-700" />
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
