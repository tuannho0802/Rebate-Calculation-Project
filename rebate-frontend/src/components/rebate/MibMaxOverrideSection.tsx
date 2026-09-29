'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Unlock, Plus, Pencil, Trash2, Search, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { ibApi } from '@/lib/api/ib';
import { rebateApi } from '@/lib/api/rebate';
import { productApi } from '@/lib/api/product';
import { normalizeTreeRoots } from '@/lib/tree-utils';
import { RebateType, Product } from '@/types';
import { useProducts } from '@/hooks/useProducts';
import { ProductManageModal } from './ProductManageModal';

type OverrideRow = {
  symbol: string;
  customMax: string;
};

export function MibMaxOverrideSection() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const {
    products,
    isLoading: isLoadingProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductActive,
    isUpdating,
  } = useProducts(true); // true = include inactive for admin

  const [selectedMibId, setSelectedMibId] = useState('');
  const [rows, setRows] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Product modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const { data: treeRes } = useQuery({
    queryKey: ['ibTree', 'admin-mib-override'],
    queryFn: () => ibApi.getTree('all'),
    enabled: user?.role === 'ADMIN',
  });

  const mibs = useMemo(
    () => normalizeTreeRoots(treeRes?.data).filter((n) => n.level === 0),
    [treeRes?.data],
  );

  useEffect(() => {
    if (!selectedMibId && mibs.length > 0) {
      setSelectedMibId(mibs[0].id);
    }
  }, [mibs, selectedMibId]);

  // Synchronize rows with products defaultMax initially
  useEffect(() => {
    if (products.length > 0 && Object.keys(rows).length === 0) {
      const initialMap: Record<string, string> = {};
      products.forEach((p) => {
        initialMap[p.symbol] = String(p.defaultMax);
      });
      setRows(initialMap);
    }
  }, [products, rows]);

  useEffect(() => {
    if (!selectedMibId) return;
    rebateApi.getConfig(selectedMibId).then((res) => {
      if (!res.success) return;
      const initialMap: Record<string, string> = {};
      products.forEach((p) => {
        initialMap[p.symbol] = String(p.defaultMax);
      });
      res.data.assets.forEach((a) => {
        if (a.rebateType === RebateType.STP_REBATE && a.maxPips !== undefined && Number(a.maxPips) > 0) {
          initialMap[a.assetType] = String(a.maxPips);
        }
      });
      setRows(initialMap);
    });
  }, [selectedMibId]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.symbol.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)),
    );
  }, [products, searchQuery]);

  const hasValidationError = Object.values(rows).some((val) => {
    if (!val || !val.trim()) return false;
    const num = Number(val);
    return Number.isNaN(num) || num < 0;
  });

  const handleSave = async () => {
    if (hasValidationError) return;

    setSaving(true);
    try {
      // 1. Cập nhật mức pips defaultMax trực tiếp cho từng sản phẩm nếu có thay đổi
      const productUpdatePromises: Promise<any>[] = [];
      products.forEach((p) => {
        const val = rows[p.symbol];
        if (val !== undefined && val.trim() !== '') {
          const num = Number(val);
          if (!Number.isNaN(num) && num >= 0 && num !== p.defaultMax) {
            productUpdatePromises.push(productApi.updateProduct(p.id, { defaultMax: num }));
          }
        }
      });

      if (productUpdatePromises.length > 0) {
        await Promise.all(productUpdatePromises);
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }

      // 2. Nếu có MIB được chọn, lưu mức max overrides cho MIB đó và cascade xuống tuyến
      if (selectedMibId) {
        const overrides = Object.entries(rows)
          .filter(([_, val]) => val !== undefined && val.trim() !== '')
          .map(([symbol, val]) => ({
            assetType: symbol as any,
            rebateType: RebateType.STP_REBATE,
            maxPips: Number(val),
          }));

        if (overrides.length > 0) {
          const res = await rebateApi.setMibMaxOverride(selectedMibId, overrides);
          if (!res.success) {
            throw new Error('Lưu trần cho MIB thất bại');
          }
        }
      }

      toast.success('Đã lưu mức Max Pips thành công');
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(code ?? (err as Error)?.message ?? 'Không thể lưu mức Max Pips');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setIsModalOpen(true);
  };

  const handleDelete = async (p: Product) => {
    const confirmMsg = `Bạn có chắc chắn muốn xoá/vô hiệu hoá sản phẩm "${p.symbol} - ${p.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteProduct(p.id);
    } catch (err: any) {
      // toast error handled by hook
    }
  };

  const handleSaveProductModal = async (data: any) => {
    if (editingProduct) {
      await updateProduct({ id: editingProduct.id, input: data });
    } else {
      await createProduct(data);
    }
  };

  if (user?.role !== 'ADMIN') return null;

  return (
    <div className="bg-white rounded-2xl border border-amber-200/80 shadow-sm p-5 space-y-5">
      {/* Header with Title and Add Product Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            Tuỳ chỉnh Max Rebate (Pips/USD) cho MIB
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
              {products.length} sản phẩm
            </span>
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý danh sách sản phẩm sàn và gán mức trần hoa hồng tối đa cho từng MIB (Level 0).
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] text-gray-900 font-extrabold rounded-xl hover:opacity-95 transition-all shadow-md active:scale-95"
        >
          <Plus className="h-4 w-4 text-gray-900 stroke-[2.5]" />
          Thêm sản phẩm mới
        </button>
      </div>

      {/* Select MIB & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
        <div className="flex items-center gap-3">
          <label className="text-sm font-extrabold text-gray-800 whitespace-nowrap">Chọn MIB:</label>
          <select
            value={selectedMibId}
            onChange={(e) => setSelectedMibId(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-amber-500 shadow-sm min-w-[220px]"
          >
            {mibs.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email} ({m.email})
              </option>
            ))}
          </select>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã, tên, danh mục..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-sm"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-amber-50/90 text-gray-900 font-extrabold border-b border-amber-200">
            <tr>
              <th className="p-3.5">Mã & Tên Sản Phẩm</th>
              <th className="p-3.5">Mức Max Pips (Pips/USD)</th>
              <th className="p-3.5 text-center min-w-[280px]">Quản Lý & Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoadingProducts ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                    Đang tải danh sách sản phẩm...
                  </div>
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-gray-500">
                  Không tìm thấy sản phẩm nào. Nhấn "+ Thêm sản phẩm mới" để tạo.
                </td>
              </tr>
            ) : (
              filteredProducts.map((prod) => {
                const val = (rows[prod.symbol] || '').trim();
                const invalid = val !== '' && (Number.isNaN(Number(val)) || Number(val) < 0);
                const locked = !prod.isActive;

                return (
                  <tr
                    key={prod.id}
                    className={`transition-colors ${
                      locked
                        ? 'bg-red-50/30 hover:bg-red-50/50'
                        : 'hover:bg-amber-50/40'
                    }`}
                  >
                    {/* Sản phẩm */}
                    <td className="p-3.5">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-gray-900 tracking-wide">
                            {prod.symbol}
                          </span>
                          {prod.category && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                              {prod.category}
                            </span>
                          )}
                          {locked && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                              Đã khoá
                            </span>
                          )}
                          {prod.allowMarkup === false && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-500 border border-gray-200"
                              title="Sản phẩm này không cộng Link Markup Pips theo chính sách sàn BCR"
                            >
                              Không Markup
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 mt-0.5">{prod.name}</span>
                      </div>
                    </td>

                    {/* Mức Max Pips */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={rows[prod.symbol] !== undefined ? rows[prod.symbol] : String(prod.defaultMax)}
                          placeholder={`Mặc định: ${prod.defaultMax}`}
                          disabled={locked}
                          onChange={(e) =>
                            setRows((prev) => ({
                              ...prev,
                              [prod.symbol]: e.target.value,
                            }))
                          }
                          className={`w-full max-w-[170px] px-3 py-1.5 border rounded-lg font-semibold text-gray-900 shadow-sm ${
                            locked
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                              : invalid
                              ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                              : 'border-gray-300 focus:ring-2 focus:ring-amber-500'
                          }`}
                        />
                        <span className="text-xs text-gray-500 font-medium">{prod.calcUnit}</span>
                      </div>
                      {invalid && (
                        <p className="text-xs text-red-600 mt-1 font-semibold">Giá trị phải &gt;= 0</p>
                      )}
                    </td>

                    {/* Thao tác */}
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center justify-center gap-3">
                        {/* iOS Alarm Style Toggle Switch for Link Markup */}
                        <div
                          className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-gray-50/80 border border-gray-200/80 shadow-xs"
                          title={`Link Markup BCR: ${(prod.allowMarkup ?? true) ? 'Đang BẬT (Được cộng thêm Pips từ Link)' : 'Đang TẮT (Không cộng thêm Pips)'}`}
                        >
                          <button
                            type="button"
                            role="switch"
                            aria-checked={prod.allowMarkup ?? true}
                            disabled={isUpdating}
                            onClick={() =>
                              updateProduct({
                                id: prod.id,
                                input: { allowMarkup: !(prod.allowMarkup ?? true) },
                              })
                            }
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none shadow-inner ${
                              (prod.allowMarkup ?? true) ? 'bg-[#34C759]' : 'bg-gray-300'
                            } ${isUpdating ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'}`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                                (prod.allowMarkup ?? true) ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`text-xs font-black tracking-tight select-none ${
                              (prod.allowMarkup ?? true) ? 'text-emerald-700' : 'text-gray-400'
                            }`}
                          >
                            {(prod.allowMarkup ?? true) ? 'Markup ON' : 'Markup OFF'}
                          </span>
                        </div>

                        {/* Separator */}
                        <div className="h-5 w-px bg-gray-200" />

                        {/* Action buttons */}
                        <div className="inline-flex items-center gap-1.5">
                          {/* Lock / Unlock button */}
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => toggleProductActive(prod)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                              locked
                                ? 'bg-red-100 text-red-700 border border-red-300 hover:bg-red-200'
                                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-amber-100 hover:text-amber-900 hover:border-amber-400'
                            }`}
                            title={locked ? 'Mở khoá sản phẩm' : 'Khoá sản phẩm'}
                          >
                            {locked ? (
                              <>
                                <Unlock className="w-3.5 h-3.5" /> Mở
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" /> Khoá
                              </>
                            )}
                          </button>

                          {/* Edit product button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(prod)}
                            className="p-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors shadow-sm"
                            title="Chỉnh sửa sản phẩm"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete / Deactivate button */}
                          <button
                            type="button"
                            onClick={() => handleDelete(prod)}
                            className="p-1.5 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors shadow-sm"
                            title="Xoá / Ẩn sản phẩm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Save Button */}
      <div className="pt-2 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          💡 Nhập mức Max Pips cho từng sản phẩm. Mức Pips này sẽ áp dụng trực tiếp cho sản phẩm và phân bổ cho MIB.
        </p>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || hasValidationError}
          className="px-6 py-2.5 bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] text-gray-900 rounded-xl font-extrabold hover:opacity-95 shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            'Lưu mức Max Pips'
          )}
        </button>
      </div>

      {/* Modal Add / Edit Product */}
      <ProductManageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productToEdit={editingProduct}
        onSave={handleSaveProductModal}
      />
    </div>
  );
}
