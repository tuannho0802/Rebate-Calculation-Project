'use client';

import { useState, useMemo } from 'react';
import { ibApi } from '@/lib/api/ib';
import { rebateTemplateApi } from '@/lib/api/rebateTemplates';
import { useAuthStore } from '@/store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from 'sonner';
import { IbNode } from '@/types';
import { X, Link as LinkIcon, Check, Loader2, ShieldAlert } from 'lucide-react';

interface AssignLinkModalProps {
  ib: IbNode;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignLinkModal({ ib, onClose, onSuccess }: AssignLinkModalProps) {
  const { user } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);

  // Fetch markup link templates
  const { data: templateData } = useQuery({
    queryKey: ['rebateTemplates', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Missing user ID');
      return rebateTemplateApi.getTemplates(user.id);
    },
    enabled: !!user?.id,
  });

  // Calculate available account types the parent is allowed to assign
  const availableTypes = useMemo(() => {
    // If logged in user is ADMIN or MIB (level 0), they can assign any system template
    if (user?.role === 'ADMIN' || user?.level === 0) {
      if (templateData?.success && templateData.data?.markupLinkTemplates?.length > 0) {
        const names = templateData.data.markupLinkTemplates.map((t) => t.name).filter(Boolean);
        if (names.length > 0) {
          return Array.from(new Set(names));
        }
      }
      return ['STD', 'STD5', 'STD10', 'STD15', 'STD20'];
    }

    // If logged in user is Sub-IB (level >= 1), they can ONLY assign types they own
    if (user?.accountTypes && user.accountTypes.length > 0) {
      return user.accountTypes;
    }
    return [user?.accountType || 'STD'];
  }, [user, templateData]);

  const initialSelected = useMemo(() => {
    if (ib.accountTypes && ib.accountTypes.length > 0) {
      return ib.accountTypes;
    }
    return [ib.accountType || 'STD'];
  }, [ib]);

  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialSelected);

  const toggleType = (accType: string) => {
    if (selectedTypes.includes(accType)) {
      if (selectedTypes.length === 1) {
        toast.error('Cấp dưới phải có ít nhất 1 loại tài khoản link');
        return;
      }
      setSelectedTypes(selectedTypes.filter((t) => t !== accType));
    } else {
      setSelectedTypes([...selectedTypes, accType]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTypes.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 loại tài khoản link');
      return;
    }

    setIsSaving(true);
    try {
      const res = await ibApi.update(ib.id, {
        accountType: selectedTypes[0],
        accountTypes: selectedTypes,
      });

      if (res.success) {
        toast.success('Cấp loại tài khoản link thành công!');
        onSuccess();
      } else {
        toast.error(getErrorMessage((res as any).error?.code || 'INTERNAL_ERROR'));
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30">
              <LinkIcon className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-base font-bold">Cấp loại tài khoản link</h2>
              <p className="text-xs text-blue-200 truncate max-w-xs">{ib.name || ib.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Danh sách loại tài khoản link khả dụng
            </label>
            {user?.level && user.level >= 1 && (
              <p className="text-xs text-slate-500 mb-3 bg-amber-50 p-2.5 rounded-xl border border-amber-200/70 flex items-start gap-1.5">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Bạn chỉ có thể cấp cho cấp dưới các loại tài khoản link mà bạn đang sở hữu.</span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50/50">
              {availableTypes.map((accType) => {
                const isSelected = selectedTypes.includes(accType);
                return (
                  <button
                    key={accType}
                    type="button"
                    onClick={() => toggleType(accType)}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-white border-white text-amber-600' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-amber-600 stroke-[3]" />}
                    </div>
                    <span className="truncate">{accType}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Xác nhận cấp link</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
