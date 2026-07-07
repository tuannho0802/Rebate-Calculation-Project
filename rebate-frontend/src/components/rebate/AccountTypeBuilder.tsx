'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

export interface AccountTypeRow {
  id: string;
  assetType: string;
  maxCeiling: string;
  calcUnit: string;
}

export interface AccountTypeTable {
  id: string;
  name: string;
  rows: AccountTypeRow[];
}

export function AccountTypeBuilder() {
  const t = useTranslations('Rebate');
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [tables, setTables] = useState<AccountTypeTable[]>([]);
  
  // Modals state
  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  
  const [isAddRowModalOpen, setIsAddRowModalOpen] = useState(false);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  
  // Row form state
  const [newRowAssetType, setNewRowAssetType] = useState('');
  const [newRowMaxCeiling, setNewRowMaxCeiling] = useState('');
  const [newRowCalcUnit, setNewRowCalcUnit] = useState('');

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('accountTypeTemplates');
    if (saved) {
      try {
        setTables(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse accountTypeTemplates', e);
      }
    }
  }, []);

  const updateTables = (newTables: AccountTypeTable[]) => {
    setTables(newTables);
    localStorage.setItem('accountTypeTemplates', JSON.stringify(newTables));
  };

  if (!mounted || user?.role !== 'MIB') return null;

  const handleCreateTable = () => {
    if (!newTableName.trim()) return;
    
    const newTable: AccountTypeTable = {
      id: Math.random().toString(36).substring(7),
      name: newTableName.trim(),
      rows: []
    };
    
    updateTables([...tables, newTable]);
    setNewTableName('');
    setIsCreateTableModalOpen(false);
  };

  const handleOpenAddRowModal = (tableId: string) => {
    setActiveTableId(tableId);
    setNewRowAssetType('');
    setNewRowMaxCeiling('');
    setNewRowCalcUnit('');
    setIsAddRowModalOpen(true);
  };

  const handleAddRow = () => {
    if (!activeTableId || !newRowAssetType.trim() || !newRowMaxCeiling.trim() || !newRowCalcUnit.trim()) return;

    updateTables(tables.map(table => {
      if (table.id === activeTableId) {
        return {
          ...table,
          rows: [
            ...table.rows,
            {
              id: Math.random().toString(36).substring(7),
              assetType: newRowAssetType.trim(),
              maxCeiling: newRowMaxCeiling.trim(),
              calcUnit: newRowCalcUnit.trim()
            }
          ]
        };
      }
      return table;
    }));
    
    setIsAddRowModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Create Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setIsCreateTableModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0066ff] text-white font-medium rounded-lg hover:bg-[#0052cc] transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {t('createAccountTypeBtn')}
        </button>
      </div>

      {/* Render Tables */}
      <div className="space-y-8">
        {tables.map(table => (
          <div key={table.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Table Header (Row 1) */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">{table.name}</h3>
              <button
                onClick={() => handleOpenAddRowModal(table.id)}
                className="p-1.5 bg-[#0066ff]/10 text-[#0066ff] rounded-md hover:bg-[#0066ff]/20 transition-colors"
                title="Add Row"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            
            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-700 uppercase tracking-wider">
                    <th className="p-4 pl-6 whitespace-nowrap">{t('colAssetType')}</th>
                    <th className="p-4 whitespace-nowrap">{t('colMaxCeiling')}</th>
                    <th className="p-4 pr-6 whitespace-nowrap">{t('colCalcUnit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {table.rows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-gray-500 text-sm">
                        Chưa có dữ liệu. Nhấn dấu + để thêm.
                      </td>
                    </tr>
                  ) : (
                    table.rows.map(row => (
                      <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-4 pl-6 font-medium text-gray-900">{row.assetType}</td>
                        <td className="p-4 text-gray-700">{row.maxCeiling}</td>
                        <td className="p-4 pr-6 text-gray-700">{row.calcUnit}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Create Table Modal */}
      {isCreateTableModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{t('createAccountTypeModalTitle')}</h3>
              <button 
                onClick={() => setIsCreateTableModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('tableNameLabel')}
                </label>
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder={t('tableNamePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066ff] focus:border-[#0066ff] transition-colors"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setIsCreateTableModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('cancelBtn')}
              </button>
              <button
                onClick={handleCreateTable}
                disabled={!newTableName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#0066ff] rounded-lg hover:bg-[#0052cc] disabled:bg-blue-300 transition-colors"
              >
                {t('createBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Row Modal */}
      {isAddRowModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Thêm Dữ Liệu</h3>
              <button 
                onClick={() => setIsAddRowModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('colAssetType')}
                </label>
                <input
                  type="text"
                  value={newRowAssetType}
                  onChange={(e) => setNewRowAssetType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066ff] focus:border-[#0066ff] transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('colMaxCeiling')}
                </label>
                <input
                  type="text"
                  value={newRowMaxCeiling}
                  onChange={(e) => setNewRowMaxCeiling(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066ff] focus:border-[#0066ff] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('colCalcUnit')}
                </label>
                <input
                  type="text"
                  value={newRowCalcUnit}
                  onChange={(e) => setNewRowCalcUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066ff] focus:border-[#0066ff] transition-colors"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setIsAddRowModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('cancelBtn')}
              </button>
              <button
                onClick={handleAddRow}
                disabled={!newRowAssetType.trim() || !newRowMaxCeiling.trim() || !newRowCalcUnit.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#0066ff] rounded-lg hover:bg-[#0052cc] disabled:bg-blue-300 transition-colors"
              >
                {t('createBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
