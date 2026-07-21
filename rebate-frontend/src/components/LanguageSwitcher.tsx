'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { Globe } from 'lucide-react';
import { useState, useTransition } from 'react';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  const switchLocale = (newLocale: 'vi' | 'en') => {
    setIsOpen(false);
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition-all duration-200"
      >
        <Globe className="h-4 w-4 text-amber-700" />
        <span className="hidden sm:inline font-extrabold uppercase">{locale === 'vi' ? 'VI' : 'EN'}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-lg py-2 z-20 border border-amber-200/80 overflow-hidden">
            <button
              onClick={() => switchLocale('vi')}
              className={`flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm transition-colors ${locale === 'vi' ? 'bg-amber-100/60 text-amber-950 font-extrabold' : 'text-gray-700 hover:bg-amber-50'}`}
            >
              <span className="text-lg">🇻🇳</span>
              <span>Việt Nam</span>
            </button>
            <button
              onClick={() => switchLocale('en')}
              className={`flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm transition-colors ${locale === 'en' ? 'bg-amber-100/60 text-amber-950 font-extrabold' : 'text-gray-700 hover:bg-amber-50'}`}
            >
              <span className="text-lg">🇺🇸</span>
              <span>English</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
