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
        <span className="hidden sm:inline uppercase">{locale}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-100">
            <button
              onClick={() => switchLocale('vi')}
              className={`block w-full text-left px-4 py-2 text-sm ${locale === 'vi' ? 'bg-blue-50 text-[#0066ff] font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              Tiếng Việt
            </button>
            <button
              onClick={() => switchLocale('en')}
              className={`block w-full text-left px-4 py-2 text-sm ${locale === 'en' ? 'bg-blue-50 text-[#0066ff] font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              English
            </button>
          </div>
        </>
      )}
    </div>
  );
}
