'use client';

import { useEffect, useState } from 'react';
import { Link, useRouter, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api/auth';
import { Loader2, LogOut, LayoutDashboard, Users, Settings, BarChart3, Menu, X, UserCog, CreditCard, TrendingUp, Download, Bell } from 'lucide-react';

import { useQueryClient } from '@tanstack/react-query';

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
          });
        }
      }
      
      // Simulate slight delay for smooth transition and UX
      setTimeout(() => setIsCheckingAuth(false), 300);
    };
    
    checkAuth();
  }, [router, user]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.clear();
      logout();
      router.push('/login');
    }
  };

  // Auth Guard: Show full-page spinner while checking token
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <Loader2 className="h-10 w-10 animate-spin text-[#0066ff]" />
        <p className="mt-4 text-[#0052cc] font-medium">{t('authenticating')}</p>
      </div>
    );
  }

  const navItems = [
    { name: t('overview'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('ibNetwork'), href: '/dashboard/tree', icon: Users },
    { name: t('report'), href: '/dashboard/report', icon: BarChart3 },
    { name: 'IB Management', href: '/dashboard/ib-management', icon: Users },
    { name: 'Payout', href: '/dashboard/payout', icon: CreditCard },
    { name: 'Transaction', href: '/dashboard/transaction', icon: TrendingUp },
    { name: 'Export', href: '/dashboard/export', icon: Download },
    { name: t('config'), href: '/dashboard/rebate', icon: Settings },
    { name: 'Notifications', href: '/dashboard/notification', icon: Bell },
    { name: 'Tài khoản', href: '/account', icon: UserCog },
  ];

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)]
        transform transition-transform duration-300 ease-in-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0066ff] to-[#0052cc] shadow-md shadow-blue-500/20 flex items-center justify-center">
              <span className="text-white font-bold text-xl leading-none">I</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-[#0052cc] to-[#0073e6] bg-clip-text text-transparent">
              IB Portal
            </span>
          </div>
          <button 
            className="ml-auto lg:hidden text-gray-500 hover:text-[#0066ff] transition-colors"
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
                key={item.name}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-[#0066ff]/10 text-[#0066ff]' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-[#0052cc]'
                  }
                `}
              >
                <item.icon className={`h-5 w-5 transition-colors ${isActive ? 'text-[#0066ff]' : 'text-gray-400 group-hover:text-[#0052cc]'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{t('account')}</p>
            <p className="text-sm font-bold text-gray-900 truncate">
              {user?.email || 'admin@example.com'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                Lv {user?.level ?? 0}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0066ff]/10 text-[#0066ff] border border-[#0066ff]/20">
                {user?.role || 'MIB'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc]">
        {/* Header Top Navbar */}
        <header className="h-16 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 text-gray-500 hover:text-[#0066ff] hover:bg-blue-50 rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-lg font-semibold text-gray-800">
                {navItems.find(i => i.href === pathname)?.name || t('dashboard')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-900">{user?.email || 'admin@example.com'}</span>
              <span className="text-xs text-gray-500 font-medium">{t('statusActive')}</span>
            </div>
            
            <div className="h-9 w-9 rounded-full bg-gradient-to-r from-[#0066ff] to-[#0073e6] shadow-md shadow-blue-500/30 flex items-center justify-center text-white font-bold border-2 border-white">
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

        {/* Page Content injected here */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
