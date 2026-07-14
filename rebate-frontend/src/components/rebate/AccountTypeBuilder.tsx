'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { rebateTemplateApi } from '@/lib/api/rebateTemplates';
import { toast } from 'sonner';

const ASSET_TYPES = [
  'D_FOREX', 'FOREX', 'GOLD', 'SILVER_5000', 'SILVER_1000', 'OIL',
  'NATURE_GAS', 'COMMODITIES', 'HKG50', 'A50', 'JPN225', 'US_INDEX',
  'SHARES', 'ETHEREUM', 'PRECIOUS_METAL', 'BITCOIN', 'CRYPTO', 'GAUCNH'
];

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

export interface MarkupLinkRow {
  id: string;
  name: string;
  share: number;
}

function mapAccountTypeTemplate(template: { id: string; name: string; rows: { assetType: string; maxCeiling: string; calcUnit: string }[]; }): AccountTypeTable {
  return {
    id: template.id,
    name: template.name,
    rows: template.rows.map((row, index) => ({
      id: `${template.id}-${row.assetType}-${index}`,
      assetType: row.assetType,
      maxCeiling: row.maxCeiling,
      calcUnit: row.calcUnit,
    })),
  };
}

export function AccountTypeBuilder() {
  const t = useTranslations('Rebate');
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [tables, setTables] = useState<AccountTypeTable[]>([]);
  const [markupLinks, setMarkupLinks] = useState<MarkupLinkRow[]>([]);
  
  const { data: templatesData, isLoading: isTemplatesLoading, isError: isTemplatesError } = useQuery({
    queryKey: ['rebateTemplates', user?.id],
    queryFn: async () => rebateTemplateApi.getTemplates(user!.id),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (templatesData?.success) {
      setTables(templatesData.data.accountTypeTemplates.map(mapAccountTypeTemplate));
      setMarkupLinks(templatesData.data.markupLinkTemplates);
    } else if (isTemplatesError || templatesData?.success === false) {
      console.error('Failed to load rebate templates', 'Unknown error');
    }
  }, [templatesData, isTemplatesError]);

  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('Missing user ID');
      }
      return rebateTemplateApi.saveTemplates(user.id, {
        accountTypeTemplates: tables.map((table) => ({
          id: table.id,
          name: table.name,
          rows: table.rows.map((row) => ({
            assetType: row.assetType,
            maxCeiling: row.maxCeiling,
            calcUnit: row.calcUnit,
          })),
        })),
        markupLinkTemplates: markupLinks.map((link) => ({
          id: link.id,
          name: link.name,
          share: Number(link.share) || 0,
        })),
      });
    },
    onSuccess: (res) => {
      if (res.success) {
        setTables(res.data.accountTypeTemplates.map(mapAccountTypeTemplate));
        setMarkupLinks(res.data.markupLinkTemplates);
        queryClient.invalidateQueries({ queryKey: ['rebateTemplates'] });
        toast.success('Lưu mẫu thành công');
      } else {
        toast.error('Lưu mẫu thất bại');
      }
    },
    onError: (err: any) => {
      console.error('Failed to save rebate templates', err);
      toast.error('Không thể lưu mẫu');
    },
  });

  // Modals state
  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  
  const [isRowModalOpen, setIsRowModalOpen] = useState(false);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [isEditingRow, setIsEditingRow] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  
  // Row form state
  const [newRowAssetType, setNewRowAssetType] = useState('');
  const [newRowMaxCeiling, setNewRowMaxCeiling] = useState('');
  const [newRowCalcUnit, setNewRowCalcUnit] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateTables = (newTables: AccountTypeTable[]) => {
    setTables(newTables);
  };

  const updateMarkupLinks = (newLinks: MarkupLinkRow[]) => {
    setMarkupLinks(newLinks);
  };

  if (!mounted || !(user?.level === 0 && user?.role === 'IB')) return null;

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

  const handleAddMarkupLink = () => {
    updateMarkupLinks([
      ...markupLinks,
      { id: Math.random().toString(36).substring(7), name: '', share: 0 }
    ]);
  };

  const handleUpdateMarkupLink = (id: string, field: 'name' | 'share', value: string) => {
    updateMarkupLinks(markupLinks.map((link) => {
      if (link.id !== id) return link;
      if (field === 'share') {
        const parsed = Number(value);
        return { ...link, share: Number.isNaN(parsed) ? 0 : parsed };
      }
      return { ...link, [field]: value };
    }));
  };

  const handleDeleteMarkupLink = (id: string) => {
    updateMarkupLinks(markupLinks.filter(link => link.id !== id));
  };

  const handleOpenAddRowModal = (tableId: string) => {
    setActiveTableId(tableId);
    setActiveRowId(null);
    setIsEditingRow(false);
    setNewRowAssetType('');
    setNewRowMaxCeiling('');
    setNewRowCalcUnit('');
    setIsRowModalOpen(true);
  };

  const handleOpenEditRowModal = (tableId: string, row: AccountTypeRow) => {
    setActiveTableId(tableId);
    setActiveRowId(row.id);
    setIsEditingRow(true);
    setNewRowAssetType(row.assetType);
    setNewRowMaxCeiling(row.maxCeiling);
    setNewRowCalcUnit(row.calcUnit);
    setIsRowModalOpen(true);
  };

  const handleDeleteTable = (tableId: string) => {
    updateTables(tables.filter(table => table.id !== tableId));
  };

  const handleDeleteRow = (tableId: string, rowId: string) => {
    updateTables(tables.map(table => {
      if (table.id === tableId) {
        return { ...table, rows: table.rows.filter(row => row.id !== rowId) };
      }
      return table;
    }));
  };

  const handleSaveRow = () => {
    if (!activeTableId || !newRowAssetType.trim() || !newRowMaxCeiling.trim() || !newRowCalcUnit.trim()) return;

    updateTables(tables.map(table => {
      if (table.id !== activeTableId) return table;

      const updatedRows = isEditingRow
        ? table.rows.map(row => row.id === activeRowId ? {
            ...row,
            assetType: newRowAssetType.trim(),
            maxCeiling: newRowMaxCeiling.trim(),
            calcUnit: newRowCalcUnit.trim(),
          } : row)
        : [
            ...table.rows,
            {
              id: Math.random().toString(36).substring(7),
              assetType: newRowAssetType.trim(),
              maxCeiling: newRowMaxCeiling.trim(),
              calcUnit: newRowCalcUnit.trim(),
            }
          ];

      return { ...table, rows: updatedRows };
    }));

    setIsRowModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Create Button */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
        <button
          onClick={() => setIsCreateTableModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0066ff] text-white font-medium rounded-lg hover:bg-[#0052cc] transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {t('createAccountTypeBtn')}
        </button>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Đang lưu...' : 'Lưu mẫu'}
        </button>
      </div>

      {/* Markup Link Config Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Cấu hình Link Markup</h3>
            <p className="text-sm text-gray-500">Thêm loại tài khoản cho Sub-IB với tên link và hoa hồng.</p>
          </div>
          <button
            onClick={handleAddMarkupLink}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0066ff] text-white rounded-xl hover:bg-[#0052cc] transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Thêm Link
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-150">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-700 uppercase tracking-wider">
                <th className="p-4 pl-6 whitespace-nowrap">Tên Link</th>
                <th className="p-4 whitespace-nowrap">Hoa hồng</th>
                <th className="p-4 pr-6 whitespace-nowrap text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {markupLinks.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500 text-sm">
                    Chưa có Link Markup nào. Nhấn dấu + để thêm.
                  </td>
                </tr>
              ) : (
                markupLinks.map((link) => (
                  <tr key={link.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-4 pl-6">
                      <input
                        type="text"
                        value={link.name}
                        onChange={(e) => handleUpdateMarkupLink(link.id, 'name', e.target.value)}
                        placeholder="Tên Link"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066ff]/50 focus:border-[#0066ff] transition-all"
                      />
                    </td>
                    <td className="p-4">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={link.share}
                        onChange={(e) => handleUpdateMarkupLink(link.id, 'share', e.target.value)}
                        placeholder="Hoa hồng"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066ff]/50 focus:border-[#0066ff] transition-all"
                      />
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button
                        onClick={() => handleDeleteMarkupLink(link.id)}
                        className="px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Render Tables */}
      <div className="space-y-8">
        {tables.map(table => (
          <div key={table.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Table Header (Row 1) */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{table.name}</h3>
                <p className="text-sm text-gray-500">{table.rows.length} sản phẩm</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenAddRowModal(table.id)}
                  className="p-2 bg-[#0066ff]/10 text-[#0066ff] rounded-md hover:bg-[#0066ff]/20 transition-colors"
                  title="Add Row"
                >
                  <Plus className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDeleteTable(table.id)}
                  className="p-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
                  title="Delete Table"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-150">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-700 uppercase tracking-wider">
                    <th className="p-4 pl-6 whitespace-nowrap">{t('colAssetType')}</th>
                    <th className="p-4 whitespace-nowrap">{t('colMaxCeiling')}</th>
                    <th className="p-4 whitespace-nowrap">{t('colCalcUnit')}</th>
                    <th className="p-4 pr-6 whitespace-nowrap text-right">Hành động</th>
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
                        <td className="p-4 text-gray-700">{row.calcUnit}</td>
                        <td className="p-4 pr-6 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditRowModal(table.id, row)}
                              className="p-2 rounded-md bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors"
                              title="Edit Row"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRow(table.id, row.id)}
                              className="p-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              title="Delete Row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
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
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
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

      {/* Row Modal */}
      {isRowModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{isEditingRow ? 'Chỉnh sửa sản phẩm' : 'Thêm dữ liệu'}</h3>
              <button 
                onClick={() => setIsRowModalOpen(false)}
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
                <select
                  value={newRowAssetType}
                  onChange={(e) => setNewRowAssetType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066ff] focus:border-[#0066ff] transition-colors bg-white"
                  autoFocus
                >
                  <option value="" disabled>Chọn loại sản phẩm...</option>
                  {ASSET_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
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
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between gap-3">
              {isEditingRow && (
                <button
                  onClick={() => {
                    if (activeTableId && activeRowId) handleDeleteRow(activeTableId, activeRowId);
                    setIsRowModalOpen(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Xóa Hàng
                </button>
              )}
              <div className="ml-auto flex items-center gap-3">
                <button
                  onClick={() => setIsRowModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  onClick={handleSaveRow}
                  disabled={!newRowAssetType.trim() || !newRowMaxCeiling.trim() || !newRowCalcUnit.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0066ff] rounded-lg hover:bg-[#0052cc] disabled:bg-blue-300 transition-colors"
                >
                  {isEditingRow ? 'Lưu' : t('createBtn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
