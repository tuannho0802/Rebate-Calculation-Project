'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { rebateTemplateApi, RebateTemplatesResponse } from '@/lib/api/rebateTemplates';
import { ApiResponse } from '@/types';
import { getErrorMessage } from '@/lib/error-messages';
import { Loader2, X, Mail, Lock, User, Briefcase } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

interface CreateIbModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string | null;
}

export function CreateIbModal({ isOpen, onClose, parentId }: CreateIbModalProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('123456');
  const [selectedAccountTypes, setSelectedAccountTypes] = useState<string[]>(['STD']);
  const [accountTypeOptions, setAccountTypeOptions] = useState<string[]>(['STD']);
  const [errorMsg, setErrorMsg] = useState('');

  const toggleAccountType = (type: string) => {
    setSelectedAccountTypes((prev) =>
      prev.includes(type)
        ? prev.length > 1
          ? prev.filter((t) => t !== type)
          : prev
        : [...prev, type]
    );
  };

  const createMutation = useMutation({
    mutationFn: () => ibApi.create(
      email,
      password,
      name,
      selectedAccountTypes[0] || 'STD',
      undefined,
      selectedAccountTypes,
    ),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['ibTree'] });
        onClose();
        setName('');
        setEmail('');
        setPassword('123456');
        setSelectedAccountTypes(accountTypeOptions.slice(0, 1));
        setErrorMsg('');
      } else {
        setErrorMsg(getErrorMessage((res as any).error?.code));
      }
    },
    onError: (err: any) => {
      setErrorMsg(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR'));
    }
  });

  const { data: templateData, isError: isTemplateError } = useQuery({
    queryKey: ['rebateTemplates', user?.id],
    queryFn: async (): Promise<ApiResponse<RebateTemplatesResponse>> => {
      if (!user?.id) {
        throw new Error('Missing user ID');
      }
      return rebateTemplateApi.getTemplates(user.id);
    },
    enabled: !!user?.id && isOpen,
    staleTime: 0,
  });

  const { data: parentIbData } = useQuery({
    queryKey: ['ibNode', parentId],
    queryFn: () => ibApi.getById(parentId!),
    enabled: !!parentId && isOpen,
  });

  useEffect(() => {
    if (!isOpen) return;

    if (parentIbData?.success && parentIbData.data) {
      const pTypes = (parentIbData.data.accountTypes && parentIbData.data.accountTypes.length > 0)
        ? parentIbData.data.accountTypes
        : [parentIbData.data.accountType || 'STD'];
      setAccountTypeOptions(pTypes);
      setSelectedAccountTypes(pTypes);
    } else if (templateData?.success) {
      const options = Array.from(new Set(templateData.data.markupLinkTemplates.map((item) => item.name))).filter(Boolean);
      const normalizedOptions = options.length > 0 ? options : ['STD'];
      setAccountTypeOptions(normalizedOptions);
      setSelectedAccountTypes(normalizedOptions);
    } else {
      setAccountTypeOptions(['STD']);
      setSelectedAccountTypes(['STD']);
    }
  }, [isOpen, templateData, parentIbData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || selectedAccountTypes.length === 0) {
      setErrorMsg('Vui lòng nhập đầy đủ thông tin và chọn ít nhất 1 loại tài khoản link');
      return;
    }
    createMutation.mutate();
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto transform transition-all">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">Thêm IB Cấp Dưới</h2>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tên IB</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066ff]/50 focus:border-[#0066ff] transition-all"
                  placeholder="Nhập tên IB"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email IB</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066ff]/50 focus:border-[#0066ff] transition-all"
                  placeholder="Nhập địa chỉ email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Mật khẩu</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066ff]/50 focus:border-[#0066ff] transition-all"
                  placeholder="Nhập mật khẩu (mặc định 123456)"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Cấp loại tài khoản link cho cấp dưới</label>
              <p className="text-xs text-gray-500 mb-2">Chọn các loại link cấp dưới được phép sở hữu (từ danh sách bạn đang có)</p>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 p-3 bg-gray-50/50">
                {accountTypeOptions.map((option) => {
                  const isSelected = selectedAccountTypes.includes(option);
                  return (
                    <label
                      key={option}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-sm font-bold'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAccountType(option)}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1 py-2.5 px-4 bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] text-gray-900 rounded-xl font-extrabold transition-all shadow-md hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
                Xác nhận
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
