'use client';

import { useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import { exportApi } from '@/lib/api/export';
import { IbSearchAutocomplete } from '@/components/ib-tree/IbSearchAutocomplete';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [ibId, setIbId] = useState('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleExportConfig = async () => {
    setFeedback(null);
    setIsLoadingConfig(true);
    try {
      const blob = await exportApi.getRebateConfig(period);
      downloadBlob(blob, `rebate-config-${period}.xlsx`);
      setFeedback('Tải xuống file cấu hình rebate thành công.');
    } catch {
      setFeedback('Không thể xuất file cấu hình.');
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleExportTransactions = async () => {
    setFeedback(null);
    setIsLoadingTransactions(true);
    try {
      const blob = await exportApi.getTransactions(period, ibId || undefined);
      downloadBlob(blob, `transactions-${period}.xlsx`);
      setFeedback('Tải xuống file lịch sử giao dịch thành công.');
    } catch {
      setFeedback('Không thể xuất file giao dịch.');
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Download className="h-6 w-6 text-amber-700" />
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Xuất dữ liệu</h1>
          <p className="text-gray-600 font-medium">Tải file Excel chứa cấu hình rebate hoặc lịch sử giao dịch.</p>
        </div>
      </div>

      <section className="rounded-3xl border border-amber-200/80 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-amber-50/40 p-6 border border-amber-200/60">
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">Xuất cấu hình rebate</h2>
            <p className="text-sm text-gray-600 mb-4 font-medium">Tải file Excel chứa cấu hình rebate hiện tại cho IB.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700">Tháng</label>
                <input
                  type="month"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={handleExportConfig}
                disabled={isLoadingConfig}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] px-6 py-3 text-sm font-extrabold text-gray-900 transition hover:opacity-95 shadow-md disabled:opacity-50"
              >
                {isLoadingConfig ? 'Đang tải...' : 'Tải file cấu hình'}
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-amber-50/40 p-6 border border-amber-200/60">
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">Xuất lịch sử giao dịch</h2>
            <p className="text-sm text-gray-600 mb-4 font-medium">Tải lịch sử giao dịch theo tháng và IB tùy chọn.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700">Tháng</label>
                <input
                  type="month"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700">IB ID</label>
                <IbSearchAutocomplete
                  value={ibId}
                  onChange={(id) => setIbId(id)}
                  placeholder="Để trống để lấy tất cả hoặc chọn 1 IB"
                  className="mt-2 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={handleExportTransactions}
                disabled={isLoadingTransactions}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] px-6 py-3 text-sm font-extrabold text-gray-900 transition hover:opacity-95 shadow-md disabled:opacity-50"
              >
                {isLoadingTransactions ? 'Đang tải...' : 'Tải file giao dịch'}
              </button>
            </div>
          </div>
        </div>

        {feedback && <p className="mt-6 text-sm font-semibold text-green-700">{feedback}</p>}
      </section>
    </div>
  );
}
