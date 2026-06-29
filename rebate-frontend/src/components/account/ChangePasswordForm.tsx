'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { authApi } from '@/lib/api/auth';
import { ChangePasswordDto } from '@/types';
import { useTranslations } from 'next-intl';

export default function ChangePasswordForm() {
  const t = useTranslations('Account');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordSchema = z.object({
    oldPassword: z.string().min(1, t('oldPasswordReq')),
    newPassword: z.string().min(6, t('newPasswordReq')),
    confirmPassword: z.string().min(1, t('confirmPasswordReq')),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('passwordMismatch'),
    path: ['confirmPassword'],
  });

  type PasswordFormValues = z.infer<typeof passwordSchema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data: PasswordFormValues) => {
    setError(null);
    setSuccess(null);
    try {
      const dto: ChangePasswordDto = {
        oldPassword: data.oldPassword,
        newPassword: data.newPassword,
      };
      await authApi.changePassword(dto);
      setSuccess(t('successMsg'));
      reset();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  return (
    <div className="max-w-md">
      <h2 className="text-lg font-bold text-white mb-6">{t('formTitle')}</h2>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-500 px-4 py-3 rounded-lg mb-6 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            {t('oldPasswordLabel')}
          </label>
          <input
            type="password"
            {...register('oldPassword')}
            className={`w-full rounded-lg border bg-slate-950 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors ${
              errors.oldPassword ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-emerald-500'
            }`}
          />
          {errors.oldPassword && (
            <p className="mt-1 text-sm text-red-500">{errors.oldPassword.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            {t('newPasswordLabel')}
          </label>
          <input
            type="password"
            {...register('newPassword')}
            className={`w-full rounded-lg border bg-slate-950 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors ${
              errors.newPassword ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-emerald-500'
            }`}
          />
          {errors.newPassword && (
            <p className="mt-1 text-sm text-red-500">{errors.newPassword.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            {t('confirmPasswordLabel')}
          </label>
          <input
            type="password"
            {...register('confirmPassword')}
            className={`w-full rounded-lg border bg-slate-950 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors ${
              errors.confirmPassword ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-emerald-500'
            }`}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-6 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSubmitting ? t('processing') : t('updateBtn')}
        </button>
      </form>
    </div>
  );
}
