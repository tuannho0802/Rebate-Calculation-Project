'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { Loader2, Search } from 'lucide-react';

interface IbSearchAutocompleteProps {
  value: string; // The selected IB ID
  onChange: (id: string, email?: string) => void;
  placeholder?: string;
  className?: string;
}

export function IbSearchAutocomplete({
  value,
  onChange,
  placeholder = 'Tìm theo email hoặc tên...',
  className = '',
}: IbSearchAutocompleteProps) {
  const [q, setQ] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['ibSearchAutocomplete', q],
    queryFn: () => ibApi.search(q, false, 1, 10),
    enabled: q.trim().length >= 2,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When value changes from outside (e.g., cleared), we might want to clear q if value is empty
  useEffect(() => {
    if (!value) {
      setQ('');
    }
  }, [value]);

  const items = data?.data?.items || [];

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIsOpen(true);
            if (e.target.value === '') {
              onChange('');
            }
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={className || "mt-2 block w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </div>
      </div>

      {isOpen && q.trim().length >= 2 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {items.length > 0 ? (
            <ul className="py-1 text-sm text-gray-700">
              {items.map((ib: any) => (
                <li
                  key={ib.id}
                  className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex flex-col"
                  onClick={() => {
                    onChange(ib.id, ib.email);
                    setQ(ib.email);
                    setIsOpen(false);
                  }}
                >
                  <span className="font-medium text-gray-900">{ib.name || 'No Name'}</span>
                  <span className="text-gray-500 text-xs">{ib.email}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500">
              Không tìm thấy kết quả.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
