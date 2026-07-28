import React from 'react';
import { LucideIcon, TrendingDown, TrendingUp } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  changePercent?: number | null;
  sublabel?: string;
}

/**
 * Card số liệu dùng chung cho Dashboard (Admin/MIB/IB) — giữ đúng ngôn ngữ
 * thiết kế sẵn có của app (nền trắng, viền amber-200/80, bo góc 2xl, nhãn
 * uppercase in đậm màu xám, số liệu chính in đậm màu đen), không tạo hệ màu
 * mới để tránh lệch với phần còn lại của giao diện đã có.
 */
export default function MetricCard({ label, value, icon: Icon, changePercent, sublabel }: MetricCardProps) {
  const hasChange = changePercent !== undefined && changePercent !== null;
  const isPositive = hasChange && changePercent! >= 0;

  return (
    <div className="bg-white border border-amber-200/80 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">{label}</div>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-amber-700" />
          </div>
        )}
      </div>
      <div className="text-2xl font-extrabold text-gray-900 mt-2">{value}</div>
      <div className="flex items-center gap-2 mt-1 min-h-[20px]">
        {hasChange && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'
              }`}
          >
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(changePercent!).toFixed(1)}%
          </span>
        )}
        {sublabel && <span className="text-xs text-gray-400 font-medium">{sublabel}</span>}
      </div>
    </div>
  );
}
