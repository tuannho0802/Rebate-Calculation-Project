import { NetworkIbTable } from '@/components/ib-tree/NetworkIbTable';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mạng lưới IB | IB Portal',
};

export default function TreePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Mạng Lưới IB (Tree View)</h1>
        <p className="text-gray-500 mt-1">
          Quản lý toàn bộ cấu trúc phân tầng và danh sách thành viên tuyến dưới của tổ chức.
        </p>
      </div>
      
      <NetworkIbTable />
    </div>
  );
}
