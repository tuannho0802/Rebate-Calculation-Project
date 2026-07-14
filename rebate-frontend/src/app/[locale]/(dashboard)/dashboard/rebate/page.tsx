import { AccountTypeBuilder } from '@/components/rebate/AccountTypeBuilder';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gói Phí & Mẫu Hoa Hồng | IB Portal',
};

export default function RebatePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gói Phí & Mẫu Hoa Hồng</h1>
        <p className="text-gray-500 mt-1">
          Tạo các mẫu Gói Phí (Account Types) và Mẫu Link Markup để gán cho các IB tuyến dưới khi tạo mới.
        </p>
      </div>
      
      <AccountTypeBuilder />
    </div>
  );
}
