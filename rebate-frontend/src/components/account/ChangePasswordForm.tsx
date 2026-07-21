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
      <h2 className="text-lg font-extrabold text-gray-900 mb-6">{t('formTitle')}</h2>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm font-semibold">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 text-sm font-semibold">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            {t('oldPasswordLabel')}
          </label>
          <input
            type="password"
            {...register('oldPassword')}
            className={`w-full rounded-lg border bg-gray-50 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors font-medium ${
              errors.oldPassword ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-amber-500'
            }`}
          />
          {errors.oldPassword && (
            <p className="mt-1 text-sm text-red-500 font-medium">{errors.oldPassword.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            {t('newPasswordLabel')}
          </label>
          <input
            type="password"
            {...register('newPassword')}
            className={`w-full rounded-lg border bg-gray-50 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors font-medium ${
              errors.newPassword ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-amber-500'
            }`}
          />
          {errors.newPassword && (
            <p className="mt-1 text-sm text-red-500 font-medium">{errors.newPassword.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            {t('confirmPasswordLabel')}
          </label>
          <input
            type="password"
            {...register('confirmPassword')}
            className={`w-full rounded-lg border bg-gray-50 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors font-medium ${
              errors.confirmPassword ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-amber-500'
            }`}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-500 font-medium">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-6 rounded-lg bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] px-4 py-3 text-sm font-extrabold text-gray-900 hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
        >
          {isSubmitting ? t('processing') : t('updateBtn')}
        </button>
      </form>
    </div>
  );
}
