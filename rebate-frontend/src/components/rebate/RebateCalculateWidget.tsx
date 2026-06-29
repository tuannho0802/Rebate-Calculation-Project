'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { rebateApi } from '@/lib/api/rebate';
import { AssetType } from '@/types';
import { getErrorMessage } from '@/lib/error-messages';
import { Calculator, Loader2, DollarSign, Users, Calendar, Search } from 'lucide-react';

export function RebateCalculateWidget() {
  const [ibId, setIbId] = useState('');
  const [assetType, setAssetType] = useState<AssetType>(AssetType.FOREX);
  const [lots, setLots] = useState<number | ''>(1);
  const [period, setPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [shouldCalculate, setShouldCalculate] = useState(false);

  const { data: response, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['rebateCalculate', ibId, assetType, lots, period],
    queryFn: () => rebateApi.calculate(ibId, assetType, lots as number, period),
    enabled: shouldCalculate && !!ibId && lots !== '' && Number(lots) > 0,
  });

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    if (ibId && lots !== '' && Number(lots) > 0) {
      setShouldCalculate(true);
    }
  };

  const result = response?.data;
  const isApiError = response && !response.success;
  const errorMessage = isApiError ? getErrorMessage((response as any).error?.code) : (isError ? 'Đã có lỗi xảy ra' : null);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Form Input Side */}
      <div className="p-6 md:w-1/3 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col justify-center">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-[#0066ff]" />
            Mô Phỏng Hoa Hồng
          </h2>
          <p className="text-sm text-gray-500 mt-1">Tính toán phân bổ tiền theo thời gian thực.</p>
        </div>

        <form onSubmit={handleCalculate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Mã IB</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={ibId}
                onChange={(e) => { setIbId(e.target.value); setShouldCalculate(false); }}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066ff]/50 focus:border-[#0066ff] transition-all"
                placeholder="Nhập IB ID"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Loại Tài Sản</label>
            <select
              value={assetType}
              onChange={(e) => { setAssetType(e.target.value as AssetType); setShouldCalculate(false); }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066ff]/50 focus:border-[#0066ff] transition-all bg-white"
            >
              {Object.values(AssetType).map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Khối lượng (Lots)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={lots}
                onChange={(e) => { setLots(e.target.value === '' ? '' : parseFloat(e.target.value)); setShouldCalculate(false); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066ff]/50 focus:border-[#0066ff] transition-all"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Tháng</label>
              <input
                type="month"
                value={period}
                onChange={(e) => { setPeriod(e.target.value); setShouldCalculate(false); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066ff]/50 focus:border-[#0066ff] transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!ibId || lots === '' || isLoading || isFetching}
            className="w-full mt-2 py-2.5 bg-[#0066ff] hover:bg-[#0052cc] text-white text-sm font-bold rounded-lg transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {(isLoading || isFetching) && <Loader2 className="h-4 w-4 animate-spin" />}
            Chạy Mô Phỏng
          </button>
        </form>
      </div>

      {/* Result Side */}
      <div className="p-6 md:w-2/3 flex flex-col justify-center min-h-[300px]">
        {!shouldCalculate ? (
          <div className="text-center text-gray-400">
            <Calculator className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nhập thông tin và bấm chạy mô phỏng để xem kết quả phân bổ.</p>
          </div>
        ) : isLoading || isFetching ? (
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-[#0066ff] mb-4" />
            <p className="text-gray-500">Đang tính toán...</p>
          </div>
        ) : errorMessage ? (
          <div className="text-center text-red-500 p-6 bg-red-50 rounded-xl border border-red-100">
            <p className="font-semibold">{errorMessage}</p>
          </div>
        ) : result ? (
          <div className="space-y-6">
            {/* Self Receive */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-5 rounded-2xl border border-green-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-green-800 uppercase tracking-wide flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Thực nhận của IB
                  </h3>
                  <p className="text-xs text-green-600 mt-1">Dựa trên {result.rebatePips} Pips Rebate</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-green-600">
                    {result.breakdown.self.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm font-bold text-green-700 ml-1">{result.currency}</span>
                </div>
              </div>
            </div>

            {/* Distributed */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2 mb-3">
                <Users className="h-4 w-4" />
                Phân bổ lên tuyến trên
              </h3>
              
              {result.breakdown.distributed.length > 0 ? (
                <div className="space-y-2">
                  {result.breakdown.distributed.map((dist, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-200 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold">Lv{dist.level}</span>
                        <span className="text-sm font-medium text-gray-800">{dist.ibId}</span>
                      </div>
                      <div className="text-sm font-bold text-blue-600">
                        {dist.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {result.currency}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  Không có tuyến trên để phân bổ.
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <span className="text-sm font-bold text-gray-500">Tổng cộng khối lượng:</span>
              <span className="text-sm font-bold text-gray-900">{result.lots} Lots {result.assetType}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
