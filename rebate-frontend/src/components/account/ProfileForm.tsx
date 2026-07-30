'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { ibApi } from '@/lib/api/ib';
import { getErrorMessage } from '@/lib/error-messages';
import { IbProfile } from '@/types';
import {
  Loader2, Phone, Globe2, Landmark, Wallet as WalletIcon,
  Copy, Check, ShieldCheck, BadgeCheck,
} from 'lucide-react';

interface ProfileFormProps {
  userId: string;
}

const COUNTRY_OPTIONS = [
  'Việt Nam', 'United States', 'United Kingdom', 'Singapore', 'Malaysia',
  'Thailand', 'Indonesia', 'Philippines', 'Japan', 'South Korea', 'China',
  'India', 'Australia', 'Canada', 'Germany', 'France', 'United Arab Emirates',
  'Hong Kong', 'Taiwan', 'Other',
];

interface ApiErrorShape {
  error?: { code?: string };
}

function extractErrorCode(err: unknown): string {
  const axiosErr = err as AxiosError<ApiErrorShape>;
  return axiosErr?.response?.data?.error?.code || 'INTERNAL_ERROR';
}

/**
 * Data-fetching shell: shows loading/error states, then mounts the actual
 * form only once `profile` is available so form state can be initialized
 * directly from data (no effect needed to sync async data into state).
 */
export default function ProfileForm({ userId }: ProfileFormProps) {
  const t = useTranslations('Account.profile');

  const { data: profileRes, isLoading, isError } = useQuery({
    queryKey: ['ibProfile', userId],
    queryFn: () => ibApi.getProfile(userId),
    enabled: !!userId,
  });

  const profile = profileRes?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-semibold">
        {t('loadError')}
      </div>
    );
  }

  return <ProfileFormFields key={userId} userId={userId} profile={profile} />;
}

interface ProfileFormFieldsProps {
  userId: string;
  profile: IbProfile;
}

function ProfileFormFields({ userId, profile }: ProfileFormFieldsProps) {
  const t = useTranslations('Account.profile');
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  // Lazily initialized once from the already-loaded profile — no effect
  // needed since this component only mounts after data is ready.
  const [form, setForm] = useState(() => ({
    phone: profile.phone || '',
    country: profile.country || '',
    bankName: profile.bankAccount?.bankName || '',
    bankAccountNumber: profile.bankAccount?.accountNumber || '',
    bankAccountHolder: profile.bankAccount?.accountHolder || '',
    paymentMethod: profile.paymentInfo?.method || '',
    paymentDetails: profile.paymentInfo?.details || '',
  }));

  const updateMutation = useMutation({
    mutationFn: () => {
      const bankAccount = (form.bankName || form.bankAccountNumber || form.bankAccountHolder)
        ? JSON.stringify({
            bankName: form.bankName || undefined,
            accountNumber: form.bankAccountNumber || undefined,
            accountHolder: form.bankAccountHolder || undefined,
          })
        : undefined;
      const paymentInfo = (form.paymentMethod || form.paymentDetails)
        ? JSON.stringify({
            method: form.paymentMethod || undefined,
            details: form.paymentDetails || undefined,
          })
        : undefined;

      return ibApi.updateProfile(userId, {
        phone: form.phone,
        country: form.country,
        bankAccount,
        paymentInfo,
      });
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('saveSuccess'));
        queryClient.invalidateQueries({ queryKey: ['ibProfile', userId] });
      } else {
        toast.error(getErrorMessage((res as { error?: { code?: string } }).error?.code || 'INTERNAL_ERROR'));
      }
    },
    onError: (err: unknown) => toast.error(getErrorMessage(extractErrorCode(err))),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  const handleCopyReferral = async () => {
    if (!profile.referralCode) return;
    try {
      await navigator.clipboard.writeText(profile.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard may be unavailable — silently ignore
    }
  };

  const levelLabel = profile.level === 0 ? t('levelMib') : t('levelSub', { level: profile.level });
  const lastUpdated = profile.profileUpdatedAt
    ? new Date(profile.profileUpdatedAt).toLocaleString('vi-VN')
    : t('neverUpdated');

  return (
    <div className="max-w-3xl space-y-8">
      {/* Summary header */}
      <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] text-lg font-extrabold text-gray-900 shadow-md">
              {(profile.name || profile.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-extrabold text-gray-900">{profile.name || '—'}</p>
              <p className="text-sm font-medium text-gray-600">{profile.email}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  <BadgeCheck className="h-3 w-3" />
                  {levelLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="rounded-xl bg-white/70 border border-amber-200/60 px-4 py-2.5 text-right">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{t('walletBalanceLabel')}</p>
              <p className="text-base font-extrabold text-gray-900">${Number(profile?.wallet?.balance || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-xl bg-white/70 border border-amber-200/60 px-4 py-2.5 text-right">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{t('walletEarnedLabel')}</p>
              <p className="text-base font-extrabold text-gray-900">${Number(profile?.wallet?.totalEarned || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {profile.referralCode && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-amber-300 bg-white/70 px-4 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('referralCodeLabel')}</span>
            <code className="rounded bg-amber-100 px-2 py-0.5 text-sm font-mono font-bold text-amber-900">{profile.referralCode}</code>
            <button
              type="button"
              onClick={handleCopyReferral}
              className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100 transition"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('copied') : t('copyBtn')}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs font-medium text-slate-600">
        <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
        {t('readOnlyNotice')}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Contact section */}
        <section>
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-gray-900 mb-3">
            <Phone className="h-4 w-4 text-amber-700" />
            {t('contactSectionTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('phoneLabel')}</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder={t('phonePlaceholder')}
                maxLength={20}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5 text-gray-400" />
                {t('countryLabel')}
              </label>
              <select
                value={form.country}
                onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors font-medium"
              >
                <option value="">{t('countryPlaceholder')}</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Bank section */}
        <section>
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-gray-900 mb-3">
            <Landmark className="h-4 w-4 text-amber-700" />
            {t('bankSectionTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('bankNameLabel')}</label>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => setForm(f => ({ ...f, bankName: e.target.value }))}
                placeholder={t('bankNamePlaceholder')}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('bankAccountNumberLabel')}</label>
              <input
                type="text"
                value={form.bankAccountNumber}
                onChange={(e) => setForm(f => ({ ...f, bankAccountNumber: e.target.value }))}
                placeholder={t('bankAccountNumberPlaceholder')}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors font-medium"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('bankAccountHolderLabel')}</label>
              <input
                type="text"
                value={form.bankAccountHolder}
                onChange={(e) => setForm(f => ({ ...f, bankAccountHolder: e.target.value.toUpperCase() }))}
                placeholder={t('bankAccountHolderPlaceholder')}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors font-medium"
              />
            </div>
          </div>
        </section>

        {/* Other payment section */}
        <section>
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-gray-900 mb-3">
            <WalletIcon className="h-4 w-4 text-amber-700" />
            {t('paymentSectionTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('paymentMethodLabel')}</label>
              <input
                type="text"
                value={form.paymentMethod}
                onChange={(e) => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                placeholder={t('paymentMethodPlaceholder')}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('paymentDetailsLabel')}</label>
              <input
                type="text"
                value={form.paymentDetails}
                onChange={(e) => setForm(f => ({ ...f, paymentDetails: e.target.value }))}
                placeholder={t('paymentDetailsPlaceholder')}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors font-medium"
              />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400">
            {t('lastUpdatedLabel')}: {lastUpdated}
          </p>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] px-6 py-2.5 text-sm font-extrabold text-gray-900 hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {updateMutation.isPending ? t('saving') : t('saveBtn')}
          </button>
        </div>
      </form>
    </div>
  );
}
