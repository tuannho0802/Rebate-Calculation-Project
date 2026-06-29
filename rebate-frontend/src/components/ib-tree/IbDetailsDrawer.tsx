'use client';

import { useQuery } from '@tanstack/react-query';
import { ibApi } from '@/lib/api/ib';
import { Loader2, X, User, Calendar, Shield, Users, Plus } from 'lucide-react';

interface IbDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ibId: string | null;
  onOpenCreate: () => void;
}

export function IbDetailsDrawer({ isOpen, onClose, ibId, onOpenCreate }: IbDetailsDrawerProps) {
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['ibDetails', ibId],
    queryFn: () => ibApi.getById(ibId!),
    enabled: !!ibId && isOpen,
  });

  if (!isOpen) return null;

  const node = response?.data;

  return (
    <>
      <div 
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-gray-200 flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-900">Chi tiết Đại lý</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-[#0066ff]" />
              <p className="text-sm text-gray-500 mt-4">Đang tải thông tin...</p>
            </div>
          ) : isError || !node ? (
            <div className="text-center text-red-500 p-4 bg-red-50 rounded-xl border border-red-100">
              <p className="font-semibold">Lỗi khi tải thông tin chi tiết.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0066ff] to-[#0047b3] flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 truncate max-w-[200px]" title={node.email}>
                    {node.email}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold uppercase">
                      Level {node.level}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-white">
                  <Shield className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Mã IB (ID)</p>
                    <p className="text-sm font-semibold text-gray-900 break-all">{node.id}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-white">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Ngày tham gia</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(node.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-white">
                  <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Số IB tuyến dưới trực tiếp</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {node.totalChildren ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onOpenCreate}
            className="w-full flex items-center justify-center gap-2 bg-[#0066ff] hover:bg-[#0052cc] text-white py-3 rounded-xl font-bold transition-all shadow-md shadow-blue-500/20"
          >
            <Plus className="h-5 w-5" />
            Thêm IB cấp dưới
          </button>
        </div>
      </div>
    </>
  );
}
