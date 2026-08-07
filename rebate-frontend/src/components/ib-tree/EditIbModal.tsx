'use client';

import { useState, useMemo } from 'react';
import { ibApi } from '@/lib/api/ib';
import { rebateTemplateApi } from '@/lib/api/rebateTemplates';
import { useAuthStore } from '@/store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from 'sonner';
import { IbNode } from '@/types';
import { X, User, Mail, Phone, Globe, Lock, FileText, Check, Loader2, Shield } from 'lucide-react';

interface EditIbModalProps {
  ib: IbNode;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditIbModal({ ib, onClose, onSuccess }: EditIbModalProps) {
  const { user } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);

  // Fetch markup link templates configured in system
  const { data: templateData } = useQuery({
    queryKey: ['rebateTemplates', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Missing user ID');
      return rebateTemplateApi.getTemplates(user.id);
    },
    enabled: !!user?.id,
  });

  const availableAccountTypes = useMemo(() => {
    if (templateData?.success && templateData.data?.markupLinkTemplates?.length > 0) {
      const names = templateData.data.markupLinkTemplates.map((t) => t.name).filter(Boolean);
      if (names.length > 0) {
        return Array.from(new Set(names));
      }
    }
    // Include current types if any are missing from standard list
    const currentTypes = ib.accountTypes && ib.accountTypes.length > 0 ? ib.accountTypes : [ib.accountType || 'STD'];
    const base = ['STD', 'STD5', 'STD10', 'STD15', 'STD20'];
    return Array.from(new Set([...base, ...currentTypes]));
  }, [templateData, ib]);

  // Form State
  const [name, setName] = useState(ib.name || '');
  const [email, setEmail] = useState(ib.email || '');
  const [phone, setPhone] = useState((ib as any).phone || '');
  const [country, setCountry] = useState((ib as any).country || '');
  const [notes, setNotes] = useState((ib as any).notes || '');
  const [newPassword, setNewPassword] = useState('');
  
  const initialTypes = ib.accountTypes && ib.accountTypes.length > 0 
    ? ib.accountTypes 
    : [ib.accountType || 'STD'];
  const [selectedAccountTypes, setSelectedAccountTypes] = useState<string[]>(initialTypes);

  const toggleAccountType = (accType: string) => {
    if (selectedAccountTypes.includes(accType)) {
      if (selectedAccountTypes.length === 1) {
        toast.error('IB phải sở hữu ít nhất 1 loại tài khoản');
        return;
      }
      setSelectedAccountTypes(selectedAccountTypes.filter((t) => t !== accType));
    } else {
      setSelectedAccountTypes([...selectedAccountTypes, accType]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên hiển thị');
      return;
    }
    if (!email.trim()) {
      toast.error('Vui lòng nhập email');
      return;
    }
    if (selectedAccountTypes.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 loại tài khoản sở hữu');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update Profile & Account Types
      const updateRes = await ibApi.update(ib.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        country: country.trim() || undefined,
        notes: notes.trim() || undefined,
        accountTypes: selectedAccountTypes,
        accountType: selectedAccountTypes[0],
      });

      if (!updateRes.success) {
        toast.error(getErrorMessage((updateRes as any).error?.code || 'INTERNAL_ERROR'));
        setIsSaving(false);
        return;
      }

      // 2. Reset Password if provided
      if (newPassword.trim()) {
        if (newPassword.trim().length < 6) {
          toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
          setIsSaving(false);
          return;
        }

        const passRes = await ibApi.resetPassword(ib.id, newPassword.trim());
        if (!passRes.success) {
          toast.error(`Đã cập nhật thông tin nhưng lỗi reset mật khẩu: ${getErrorMessage((passRes as any).error?.code)}`);
          setIsSaving(false);
          return;
        }
      }

      toast.success('Cập nhật thông tin IB thành công!');
      onSuccess();
    } catch (err: any) {
      toast.error(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR'));
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabel = ib.level === 0 ? 'MIB (Level 0)' : `Sub-IB Level ${ib.level}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden my-8 transform transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
              <User className="h-5 w-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Chỉnh sửa thông tin IB</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-300">{ib.email}</span>
                <span className="text-[10px] font-extrabold bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-300/30">
                  {roleLabel}
                </span>
              </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tên hiển thị */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-slate-500" />
                <span>Tên hiển thị *</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên hiển thị..."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                <span>Email tài khoản *</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                required
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                <span>Số điện thoại</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+84 901 234 567"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Country */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Globe className="h-3.5 w-3.5 text-slate-500" />
                <span>Quốc gia</span>
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Vietnam"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Account Types Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-slate-500" />
                <span>Cấp loại tài khoản sở hữu *</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                Đã chọn ({selectedAccountTypes.length})
              </span>
            </label>
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-32 overflow-y-auto">
              {availableAccountTypes.map((accType) => {
                const isSelected = selectedAccountTypes.includes(accType);
                return (
                  <button
                    key={accType}
                    type="button"
                    onClick={() => toggleAccountType(accType)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                    <span>{accType}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-amber-600" />
              <span>Đổi mật khẩu mới (Bỏ trống nếu không muốn đổi)</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <span>Ghi chú nội bộ</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú thông tin IB..."
              rows={2}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
            />
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
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
