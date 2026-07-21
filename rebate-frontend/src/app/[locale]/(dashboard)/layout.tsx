'use client';

import { useEffect, useState } from 'react';
import { Link, useRouter, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api/auth';
import { Loader2, LogOut, Menu, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { filterNavItemsByRole, getNavLabelKeyForPath, isAdminOnlyRoute } from '@/lib/nav-config';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from 'sonner';

const decodeJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const t = useTranslations('Layout');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('ib_access_token');
      if (!token) {
        router.replace('/login');
        return;
      }
      
      if (!user) {
        const payload = decodeJwt(token);
        if (payload && payload.sub) {
          useAuthStore.getState().setUser({
            id: payload.sub,
            email: payload.email,
            level: payload.level,
            role: payload.role,
            isRootAdmin: payload.isRootAdmin || false,
          });
        }
      }
      
      setTimeout(() => setIsCheckingAuth(false), 300);
    };
    
    checkAuth();
  }, [router, user]);

  useEffect(() => {
    if (user && user.role !== 'ADMIN' && isAdminOnlyRoute(pathname)) {
      toast.error(getErrorMessage('AUTH_FORBIDDEN'));
      router.replace('/dashboard');
    }
  }, [user, pathname, router]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.clear();
      logout();
      router.push('/login');
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
        <p className="mt-4 text-amber-950 font-bold">{t('authenticating')}</p>
      </div>
    );
  }

  const navItems = filterNavItemsByRole(user?.role).map((item) => ({
    ...item,
    name: t(item.labelKey),
  }));

  const headerTitle = (() => {
    const labelKey = getNavLabelKeyForPath(pathname);
    return labelKey ? t(labelKey) : t('dashboard');
  })();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#FEF9C3_0%,#FFFFFF_40%,#FFF5F5_100%)] flex font-sans">
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white/95 backdrop-blur-md border-r border-amber-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.03)]
        transform transition-transform duration-300 ease-in-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-white">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Rebate BCR Logo"
              className="w-9 h-9 rounded-lg object-contain shadow-sm border border-amber-300/60"
            />
            <span className="text-xl font-extrabold text-[#EEA727] tracking-tight">
              Rebate BCR
            </span>
          </div>
          <button 
            className="ml-auto lg:hidden text-gray-500 hover:text-amber-600 transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  group flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
                  ${isActive 
                    ? 'bg-gradient-to-r from-amber-100 via-amber-50 to-white text-gray-900 border-l-4 border-red-500 shadow-sm' 
                    : 'text-gray-700 hover:bg-amber-50/60 hover:text-gray-900'
                  }
                `}
              >
                <item.icon className={`h-5 w-5 transition-colors ${isActive ? 'text-red-500' : 'text-gray-400 group-hover:text-amber-600'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-amber-100">
          <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-200/60 shadow-sm">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{t('account')}</p>
            <p className="text-sm font-bold text-gray-900 truncate">
              {user?.email || 'admin@example.com'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                Lv {user?.level ?? 0}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                {user?.role === 'ADMIN' ? 'Admin' : 'MIB'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[linear-gradient(180deg,#FEF9C3_0%,#FFFFFF_40%,#FFF5F5_100%)]">
        <header className="h-16 bg-[linear-gradient(90deg,#FEF9C3_0%,#FFFFFF_50%,#FFF5F5_100%)] border-b border-amber-200/60 shadow-sm flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-lg font-bold text-gray-900">
                {headerTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-gray-900">{user?.email || 'admin@example.com'}</span>
              <span className="text-xs text-gray-600 font-medium">{t('statusActive')}</span>
            </div>
            
            <div className="h-9 w-9 rounded-lg bg-[linear-gradient(180deg,#FDE047_0%,#FFFFFF_50%,#EF4444_100%)] shadow-md border border-amber-300 flex items-center justify-center text-gray-900 font-extrabold text-sm">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>

            <LanguageSwitcher />

            <div className="w-px h-6 bg-gray-200 mx-1"></div>

            <button
              onClick={handleLogout}
              className="group flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
            >
              <LogOut className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
