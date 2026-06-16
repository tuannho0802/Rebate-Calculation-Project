'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { ibApi } from '@/lib/api/ib';
import { authApi } from '@/lib/api/auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, logout } = useAuthStore();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('ib_access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        if (!user) {
          const profile = await ibApi.getMe();
          setUser({
            id: profile.id,
            email: profile.email,
            level: profile.level,
            role: profile.level === 0 ? 'MIB' : 'IB',
          });
        }
        setCheckingAuth(false);
      } catch (err) {
        logout();
        router.push('/login');
      }
    };

    initAuth();
  }, [router, user, setUser, logout]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.error(e);
    }
    logout();
    router.push('/login');
  };

  if (checkingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium">Loading session...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Cây IB Tree', href: '/tree' },
    { name: 'Báo cáo Rebate', href: '/report' },
  ];

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white tracking-wide">IB Rebate</h2>
          {user && (
            <div className="mt-2 text-xs text-slate-400 truncate">
              {user.email} <span className="text-emerald-500 font-semibold">(Lv{user.level})</span>
            </div>
          )}
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-900/20 hover:text-red-300 transition text-left"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-8">
        <div className="max-w-6xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
