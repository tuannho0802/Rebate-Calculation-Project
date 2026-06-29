import { RebateConfigTable } from '@/components/rebate/RebateConfigTable';
import { RebateCalculateWidget } from '@/components/rebate/RebateCalculateWidget';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cấu hình Hoa Hồng | IB Portal',
};

export default function RebatePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Cấu Hình Hoa Hồng</h1>
        <p className="text-gray-500 mt-1">
          Chỉnh sửa mức chia sẻ hoa hồng (Rebate) và phí chênh lệch (Markup) cho tuyến dưới.
        </p>
      </div>
      
      <RebateConfigTable />

      <div className="pt-4 border-t border-gray-100">
        <RebateCalculateWidget />
      </div>
    </div>
  );
}
