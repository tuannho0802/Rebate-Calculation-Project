'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from '@/i18n/routing';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth.store';
import {
  Loader2,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Zap,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Globe,
  Award,
  Activity,
  DollarSign,
  Users,
} from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setGlobalError(null);
    try {
      const response = await authApi.login(data.email, data.password);

      if (response.success) {
        localStorage.setItem('ib_access_token', response.data.accessToken);
        localStorage.setItem('ib_refresh_token', response.data.refreshToken);
        setUser(response.data.user);
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

  const fillQuickLogin = (email: string, pass: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', pass, { shouldValidate: true });
  };

  return (
    <div className="min-h-screen relative w-full overflow-hidden bg-slate-950 flex flex-col justify-between select-none font-sans text-slate-100">
      {/* ─── 1. TOP LIVE TICKER MARQUEE BAR ────────────────────────────────────── */}
      <div className="relative z-20 w-full bg-slate-900/90 border-b border-amber-500/20 backdrop-blur-md py-2 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-amber-400 font-bold shrink-0">
            <Activity className="h-4 w-4 animate-pulse text-amber-400" />
            <span className="hidden sm:inline">BRC MARKET LIVE TICKER:</span>
          </div>

          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar whitespace-nowrap text-[11px]">
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-400 font-bold">XAU/USD (Vàng)</span>
              <span className="text-emerald-400 font-extrabold">$2,418.50</span>
              <span className="text-emerald-400 text-[10px] flex items-center font-bold">
                <TrendingUp className="h-3 w-3" /> +1.45%
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-400 font-bold">EUR/USD</span>
              <span className="text-emerald-400 font-extrabold">1.0892</span>
              <span className="text-emerald-400 text-[10px] flex items-center font-bold">
                <TrendingUp className="h-3 w-3" /> +0.32%
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-400 font-bold">GBP/USD</span>
              <span className="text-rose-400 font-extrabold">1.2905</span>
              <span className="text-rose-400 text-[10px] flex items-center font-bold">
                <TrendingDown className="h-3 w-3" /> -0.12%
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-400 font-bold">BTC/USD</span>
              <span className="text-emerald-400 font-extrabold">$67,820</span>
              <span className="text-emerald-400 text-[10px] flex items-center font-bold">
                <TrendingUp className="h-3 w-3" /> +3.80%
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-300 font-bold">
              <span>⚡ REBATE DISBURSED:</span>
              <span className="text-white font-extrabold">$1,480,250</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. BACKGROUND VISUAL FX & GLOW SPOTLIGHTS ──────────────────────── */}
      {/* Background Graphic Image Overlay */}
      <div className="absolute inset-0 z-0 opacity-20 bg-center bg-cover pointer-events-none mix-blend-luminosity" style={{ backgroundImage: `url('/forex_trading_bg.png')` }} />

      {/* Golden Top Right Radial Spotlight */}
      <div className="absolute -top-40 -right-40 w-[700px] h-[700px] bg-gradient-to-br from-amber-500/30 via-yellow-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      {/* Deep Gold Bottom Left Glow */}
      <div className="absolute -bottom-40 -left-40 w-[700px] h-[700px] bg-gradient-to-tr from-amber-600/25 via-amber-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      {/* Dynamic Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:32px_32px] opacity-15 pointer-events-none" />

      {/* ─── 3. HEADER NAVIGATION BAR ────────────────────────────────────────── */}
      <header className="relative z-20 w-full max-w-7xl mx-auto flex items-center justify-between p-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-yellow-300 rounded-2xl blur-xs opacity-75 group-hover:opacity-100 transition duration-300" />
            <img
              src="/logo.png"
              alt="BRC Logo"
              className="relative w-12 h-12 rounded-xl object-contain bg-slate-900 p-1 border border-amber-400/50 shadow-lg"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-white">BRC</span>
              <span className="text-2xl font-black tracking-tight text-[#f59e0b]">BROKER</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 tracking-wide uppercase">
              Rebate & IB Calculation System
            </p>
          </div>
        </div>

        {/* Header Right Status Pills */}
        <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 text-xs font-bold backdrop-blur-md">
            <Globe className="h-3.5 w-3.5 text-amber-400" /> Forex CFD Platform
          </span>
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Hệ Thống Chuẩn BRC
          </span>
        </div>
      </header>

      {/* ─── 4. MAIN CONTENT AREA (HERO BRANDING + CENTERED LOGIN FORM) ──────── */}
      <main className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* LEFT COLUMN: HERO INTRO & LIVE STATS SHOWCASE */}
          <div className="lg:col-span-7 space-y-6 text-left hidden lg:block">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider backdrop-blur-md">
              <Award className="h-4 w-4 text-amber-400" /> Sàn Giao Dịch BRC Broker • IB Rebate
            </div>

            <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Hệ Thống Quản Lý & <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500">
                Tính Toán Rebate Tự Động
              </span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl font-medium">
              Giải pháp quản lý hoa hồng IB chuyên nghiệp dành riêng cho <strong className="text-amber-400">Sàn Forex BRC</strong>. Minh bạch 100%, phân cấp sơ đồ gia phả đa tầng và tự động hóa toàn bộ luồng chia Rebate theo từng Lot giao dịch.
            </p>

            {/* LIVE CANDLESTICK TRADING CHART PREVIEW CARD */}
            <div className="relative bg-slate-900/80 border border-amber-500/30 rounded-3xl p-6 backdrop-blur-xl shadow-2xl overflow-hidden max-w-xl">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-bold text-slate-200">XAU/USD Live Candlestick & Volume Chart</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                  Rebate Rate: Max 20 Pips/Lot
                </span>
              </div>

              {/* Dynamic Candlestick Chart SVG */}
              <div className="py-4">
                <svg className="w-full h-36 overflow-visible" viewBox="0 0 400 130">
                  {/* Horizontal Grid lines */}
                  <line x1="0" y1="25" x2="400" y2="25" stroke="#334155" strokeDasharray="4 4" opacity="0.3" />
                  <line x1="0" y1="65" x2="400" y2="65" stroke="#334155" strokeDasharray="4 4" opacity="0.3" />
                  <line x1="0" y1="105" x2="400" y2="105" stroke="#334155" strokeDasharray="4 4" opacity="0.3" />

                  {/* Candle 1 (Green) */}
                  <line x1="30" y1="70" x2="30" y2="115" stroke="#10b981" strokeWidth="1.5" />
                  <rect x="22" y="80" width="16" height="25" fill="#10b981" rx="2" />

                  {/* Candle 2 (Red) */}
                  <line x1="70" y1="75" x2="70" y2="110" stroke="#ef4444" strokeWidth="1.5" />
                  <rect x="62" y="82" width="16" height="18" fill="#ef4444" rx="2" />

                  {/* Candle 3 (Green) */}
                  <line x1="110" y1="45" x2="110" y2="95" stroke="#10b981" strokeWidth="1.5" />
                  <rect x="102" y="55" width="16" height="30" fill="#10b981" rx="2" />

                  {/* Candle 4 (Green Surge) */}
                  <line x1="150" y1="20" x2="150" y2="80" stroke="#10b981" strokeWidth="1.5" />
                  <rect x="142" y="30" width="16" height="40" fill="#10b981" rx="2" />

                  {/* Candle 5 (Red pullback) */}
                  <line x1="190" y1="35" x2="190" y2="70" stroke="#ef4444" strokeWidth="1.5" />
                  <rect x="182" y="42" width="16" height="20" fill="#ef4444" rx="2" />

                  {/* Candle 6 (Green Strong) */}
                  <line x1="230" y1="15" x2="230" y2="60" stroke="#10b981" strokeWidth="1.5" />
                  <rect x="222" y="22" width="16" height="32" fill="#10b981" rx="2" />

                  {/* Candle 7 (Red) */}
                  <line x1="270" y1="25" x2="270" y2="55" stroke="#ef4444" strokeWidth="1.5" />
                  <rect x="262" y="30" width="16" height="18" fill="#ef4444" rx="2" />

                  {/* Candle 8 (Golden Breakout Candle) */}
                  <line x1="310" y1="5" x2="310" y2="45" stroke="#f59e0b" strokeWidth="2" />
                  <rect x="302" y="10" width="16" height="28" fill="#f59e0b" rx="2" />

                  {/* Candle 9 (Green Peak) */}
                  <line x1="350" y1="2" x2="350" y2="35" stroke="#10b981" strokeWidth="2" />
                  <rect x="342" y="5" width="16" height="22" fill="#10b981" rx="2" />

                  {/* Smooth Gold Trend Curve */}
                  <path
                    d="M 22 92 Q 110 70, 150 45 T 310 20 T 350 12"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Bottom STATS Grid */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-xs">
                <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
                  <span className="text-slate-400 block text-[10px]">Tự Động Tính:</span>
                  <span className="font-extrabold text-emerald-400">100% Theo Lot</span>
                </div>
                <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
                  <span className="text-slate-400 block text-[10px]">Cấu Trúc IB:</span>
                  <span className="font-extrabold text-amber-300">Level 0 ➔ 5+</span>
                </div>
                <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
                  <span className="text-slate-400 block text-[10px]">Độ Chính Xác:</span>
                  <span className="font-extrabold text-slate-100">Tuyệt Đối</span>
                </div>
              </div>
            </div>

            {/* SYSTEM HIGHLIGHT PILLS */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-300 pt-2">
              <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-3.5 py-2 rounded-xl backdrop-blur-xs">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Bảo mật hệ thống Admin BRC</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-3.5 py-2 rounded-xl backdrop-blur-xs">
                <Zap className="h-4 w-4 text-amber-400" />
                <span>Cơ chế Cascading Max Pips</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-3.5 py-2 rounded-xl backdrop-blur-xs">
                <Users className="h-4 w-4 text-yellow-400" />
                <span>Quản lý sơ đồ nhánh IB</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: CENTERED FORM CONTAINER */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <div className="relative">
              {/* Outer Glowing Ring */}
              <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-500/50 via-yellow-400/40 to-amber-600/50 rounded-3xl blur-xl opacity-70 animate-pulse" />

              <div className="relative bg-slate-900/90 backdrop-blur-2xl border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(245,158,11,0.2)]">
                {/* Brand Logo & Header */}
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="relative mb-4">
                    <div className="absolute -inset-2 bg-gradient-to-tr from-amber-500 to-yellow-300 rounded-2xl blur-md opacity-70" />
                    <div className="relative p-3 bg-slate-950 rounded-2xl border border-amber-400/60 shadow-xl">
                      <img
                        src="/logo.png"
                        alt="BRC Rebate Logo"
                        className="w-12 h-12 rounded-lg object-contain"
                      />
                    </div>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Đăng Nhập <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500">Rebate BRC</span>
                  </h2>
                  <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1.5 max-w-xs">
                    Hệ thống quản lý hoa hồng & phân cấp IB sàn Forex BRC
                  </p>
                </div>

                {/* Global Error Banner */}
                {globalError && (
                  <div className="mb-6 p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 flex items-center gap-3 text-red-200 text-xs font-semibold animate-in fade-in">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                    <p>{globalError}</p>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {/* Email Input Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>{t('emailLabel')}</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-amber-400 transition-colors">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        type="email"
                        {...register('email')}
                        className="block w-full pl-10 pr-3.5 py-3.5 bg-slate-950/90 border border-amber-500/30 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30 transition-all text-sm font-medium"
                        placeholder="admin_test@azrebate.com"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-400 text-xs mt-1 font-semibold">{tErr('VALIDATION_ERROR')}</p>
                    )}
                  </div>

                  {/* Password Input Field with Eye Toggle */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>{t('passwordLabel')}</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-amber-400 transition-colors">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        {...register('password')}
                        className="block w-full pl-10 pr-10 py-3.5 bg-slate-950/90 border border-amber-500/30 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30 transition-all text-sm font-medium"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-amber-400 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-red-400 text-xs mt-1 font-semibold">{tErr('VALIDATION_ERROR')}</p>
                    )}
                  </div>

                  {/* Submit Golden Action Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group relative w-full flex justify-center py-4 px-4 border border-amber-400/40 text-sm font-black rounded-xl text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-xl shadow-amber-500/25 cursor-pointer active:scale-[0.99]"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2 text-slate-950 font-bold">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {t('loggingIn')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 uppercase tracking-wider">
                        {t('loginBtn')}
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    )}
                  </button>
                </form>

                {/* Quick Demo Credentials Assistant */}
                <div className="mt-6 pt-5 border-t border-slate-800">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
                    🔑 Đăng Nhập Nhanh (Thử Nghiệm Admin / IB)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => fillQuickLogin('admin_test@azrebate.com', 'admin123')}
                      className="px-3 py-2 bg-slate-950 hover:bg-amber-500/15 border border-slate-800 hover:border-amber-500/50 rounded-xl text-[11px] font-bold text-amber-300 transition text-center cursor-pointer shadow-xs"
                    >
                      🛡️ Admin Account
                    </button>
                    <button
                      type="button"
                      onClick={() => fillQuickLogin('mib1@azrebate.com', '123456')}
                      className="px-3 py-2 bg-slate-950 hover:bg-amber-500/15 border border-slate-800 hover:border-amber-500/50 rounded-xl text-[11px] font-bold text-slate-300 hover:text-amber-300 transition text-center cursor-pointer shadow-xs"
                    >
                      👤 MIB Level 0
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ─── 5. FOOTER BAR ──────────────────────────────────────────────────────── */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between p-4 sm:px-8 text-xs text-slate-500 border-t border-slate-900 gap-2">
        <p className="font-medium text-center sm:text-left">
          © 2026 <strong className="text-amber-400">BRC Broker</strong>. All rights reserved. Hệ thống Rebate & Hoa hồng tự động.
        </p>
        <div className="flex items-center gap-4 text-[11px] font-medium">
          <span className="hover:text-amber-400 transition cursor-pointer">Chính sách Bảo mật</span>
          <span>•</span>
          <span className="hover:text-amber-400 transition cursor-pointer">Điều khoản BRC</span>
          <span>•</span>
          <span className="hover:text-amber-400 transition cursor-pointer">Hỗ trợ IB</span>
        </div>
      </footer>
    </div>
  );
}
