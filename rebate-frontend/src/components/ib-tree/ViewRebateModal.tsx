'use client';

import { useQuery } from '@tanstack/react-query';
import { rebateApi } from '@/lib/api/rebate';
import { Loader2, X } from 'lucide-react';
import { AssetType } from '@/types';

interface ViewRebateModalProps {
  isOpen: boolean;
  onClose: () => void;
  ibId: string;
}

export function ViewRebateModal({ isOpen, onClose, ibId }: ViewRebateModalProps) {
  const { data: configData, isLoading } = useQuery({
    queryKey: ['rebateConfig', ibId],
    queryFn: () => rebateApi.getConfig(ibId),
    enabled: isOpen && !!ibId,
  });

  if (!isOpen) return null;

  const assets = configData?.data?.assets || [];

  return (
    <>
      <div 
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl pointer-events-auto transform transition-all flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">Chi tiết Hoa Hồng chia sẻ</h2>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
              </div>
            ) : assets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Chưa có cấu hình hoa hồng nào cho IB này.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-amber-200/80">
                <table className="w-full text-sm text-left">
                  <thead className="bg-amber-50/80 text-gray-800 font-extrabold border-b border-amber-200/80">
                    <tr>
                      <th className="px-6 py-4">Sản Phẩm (Asset Type / Symbol)</th>
                      <th className="px-6 py-4">Mức Pips được chia</th>
                      <th className="px-6 py-4">Đơn Vị Tính (Calculation Unit)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {assets.map((asset) => (
                      <tr key={asset.assetType} className="hover:bg-amber-50/40 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900">
                          {asset.assetType}
                        </td>
                        <td className="px-6 py-4 text-amber-950 font-bold">
                          {asset.markupPips}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {asset.assetType === AssetType.D_FOREX || asset.assetType === AssetType.FOREX || asset.assetType === AssetType.GOLD ? 'USD/Lot' : 'Pips'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          <div className="p-6 border-t border-gray-100 flex justify-end">
            <button
              onClick={onClose}
              className="py-2.5 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
