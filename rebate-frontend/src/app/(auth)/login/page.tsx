'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth.store';
import { getErrorMessage } from '@/lib/error-messages';

const loginSchema = z.object({
  email: z.string().email('Email không đúng định dạng').nonempty('Email không được để trống'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').nonempty('Mật khẩu không được để trống'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await authApi.login(values.email, values.password);
      
      localStorage.setItem('ib_access_token', data.accessToken);
      localStorage.setItem('ib_refresh_token', data.refreshToken);
      
      setUser(data.user);
      router.push('/dashboard');
    } catch (err: any) {
      const code = err.response?.data?.error?.code || 'INTERNAL_ERROR';
      setErrorMsg(getErrorMessage(code));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-white">
            IB Rebate System
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Đăng nhập hệ thống Introduce Broker
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {errorMsg && (
            <div className="rounded-md bg-red-900/30 border border-red-800 p-3 text-sm text-red-200">
              {errorMsg}
            </div>
          )}
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                id="email-address"
                type="email"
                {...register('email')}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none text-sm"
                placeholder="ib@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                {...register('password')}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none text-sm"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none disabled:opacity-55 transition"
            >
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
