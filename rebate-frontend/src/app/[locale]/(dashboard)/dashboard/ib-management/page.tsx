'use client';

import React from 'react';
import { IbManagementTable } from '@/components/ib-tree/IbManagementTable';

export default function IbManagementPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">IB Management</h1>
        <p className="text-sm text-gray-500">Tìm kiếm, chỉnh sửa và khôi phục IB trong mạng lưới của bạn.</p>
      </div>

      <IbManagementTable />
    </div>
  );
}
