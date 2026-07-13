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
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-[#0066ff] hover:bg-blue-50 rounded-lg transition-all duration-200"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline font-semibold uppercase">{locale === 'vi' ? 'VI' : 'EN'}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-lg py-2 z-20 border border-gray-100 overflow-hidden">
            <button
              onClick={() => switchLocale('vi')}
              className={`flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm transition-colors ${locale === 'vi' ? 'bg-blue-50 text-[#0066ff] font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <span className="text-lg">🇻🇳</span>
              <span>Việt Nam</span>
            </button>
            <button
              onClick={() => switchLocale('en')}
              className={`flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm transition-colors ${locale === 'en' ? 'bg-blue-50 text-[#0066ff] font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
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
