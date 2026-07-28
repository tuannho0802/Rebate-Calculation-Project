import React from 'react';

interface BarChartDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarChartDatum[];
  valueFormatter?: (v: number) => string;
  emptyLabel?: string;
}

/**
 * Biểu đồ thanh ngang bằng SVG thuần — KHÔNG dùng recharts/chart.js vì repo
 * chưa cài lib chart nào (xem package.json), cố tình tránh thêm dependency
 * mới chỉ để vẽ vài thanh đơn giản. Đủ dùng cho các bảng phân bổ nhỏ
 * (byAsset, byRebateType, byLevel) trong Dashboard.
 */
export default function BarChart({ data, valueFormatter, emptyLabel = 'Chưa có dữ liệu' }: BarChartProps) {
  const fmt = valueFormatter ?? ((v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-500 font-medium">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = Math.max(2, (d.value / maxValue) * 100);
        return (
          <div key={d.label} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-xs font-bold text-gray-700 truncate" title={d.label}>
              {d.label}
            </div>
            <div className="flex-1 h-6 rounded-md bg-amber-50 overflow-hidden">
              <div
                className="h-full rounded-md bg-[linear-gradient(90deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-20 shrink-0 text-right text-xs font-extrabold text-gray-900">{fmt(d.value)}</div>
          </div>
        );
      })}
    </div>
  );
}
