'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from '@/i18n/routing';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth.store';
import { Loader2, Mail, Lock, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const t = useTranslations('Login');
  const tErr = useTranslations('Error');
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setGlobalError(null);
    try {
      const response = await authApi.login(data.email, data.password);
      
      if (response.success) {
        // Store tokens (Client-side localStorage)
        localStorage.setItem('ib_access_token', response.data.accessToken);
        localStorage.setItem('ib_refresh_token', response.data.refreshToken);
        
        // Update Zustand store
        setUser(response.data.user);
        
        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        setGlobalError(tErr('AUTH_INVALID_CREDENTIALS'));
      }
    } catch (err: any) {
      const code = err.response?.data?.error?.code || 'INTERNAL_ERROR';
      try {
        setGlobalError(tErr(code as any));
      } catch {
        setGlobalError(tErr('DEFAULT'));
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(180deg,#FEF9C3_0%,#FFFFFF_45%,#FFF5F5_100%)] p-4">
      <div className="w-full max-w-md relative">
        <div className="relative bg-white/90 backdrop-blur-xl border border-amber-200/80 rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col items-center text-center mb-8">
            <img
              src="/logo.png"
              alt="Rebate BCR Logo"
              className="w-16 h-16 rounded-xl object-contain shadow-lg border border-amber-300/60 mb-3"
            />
            <h1 className="text-3xl font-extrabold text-[#EEA727] tracking-tight">
              Rebate BCR
            </h1>
            <p className="text-gray-600 mt-2 text-sm font-medium">
              Đăng nhập hệ thống quản lý Rebate & Hoa hồng
            </p>
          </div>

          {globalError && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-600"></div>
              <p className="text-red-700 text-sm font-semibold">{globalError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">{t('emailLabel')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  {...register('email')}
                  className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all sm:text-sm font-medium"
                  placeholder={t('emailPlaceholder')}
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-xs mt-1 font-medium">{tErr('VALIDATION_ERROR')}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">{t('passwordLabel')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  {...register('password')}
                  className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all sm:text-sm font-medium"
                  placeholder={t('passwordPlaceholder')}
                />
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1 font-medium">{tErr('VALIDATION_ERROR')}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-extrabold rounded-lg text-gray-900 bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2 text-white">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('loggingIn')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t('loginBtn')}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
