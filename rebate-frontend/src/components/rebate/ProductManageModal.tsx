'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Product, CreateProductInput, UpdateProductInput } from '@/types';

interface ProductManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  onSave: (data: CreateProductInput | UpdateProductInput) => Promise<any>;
}

export function ProductManageModal({
  isOpen,
  onClose,
  productToEdit,
  onSave,
}: ProductManageModalProps) {
  const isEditing = !!productToEdit;

  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [defaultMax, setDefaultMax] = useState('');
  const [calcUnit, setCalcUnit] = useState('pips');
  const [order, setOrder] = useState('');
  const [allowMarkup, setAllowMarkup] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (productToEdit) {
      setSymbol(productToEdit.symbol);
      setName(productToEdit.name);
      setCategory(productToEdit.category || '');
      setDefaultMax(String(productToEdit.defaultMax));
      setCalcUnit(productToEdit.calcUnit || 'pips');
      setOrder(String(productToEdit.order ?? 0));
      setAllowMarkup(productToEdit.allowMarkup ?? true);
    } else {
      setSymbol('');
      setName('');
      setCategory('');
      setDefaultMax('');
      setCalcUnit('pips');
      setOrder('');
      setAllowMarkup(true);
    }
    setErrorMsg('');
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedSymbol = symbol.trim().toUpperCase();
    const trimmedName = name.trim();
    const numMax = Number(defaultMax);

    if (!trimmedSymbol) {
      setErrorMsg('Vui lòng nhập mã sản phẩm (Symbol)');
      return;
    }

    if (!/^[A-Z0-9_]+$/.test(trimmedSymbol)) {
      setErrorMsg('Mã sản phẩm chỉ được chứa chữ cái in hoa (A-Z), chữ số (0-9) và dấu gạch dưới (_)');
      return;
    }

    if (!trimmedName) {
      setErrorMsg('Vui lòng nhập tên hiển thị cho sản phẩm');
      return;
    }

    if (defaultMax.trim() === '' || Number.isNaN(numMax) || numMax < 0) {
      setErrorMsg('Mức trần mặc định phải là số >= 0');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await onSave({
          symbol: trimmedSymbol,
          name: trimmedName,
          category: category.trim() || undefined,
          defaultMax: numMax,
          calcUnit: calcUnit.trim() || 'pips',
          order: order.trim() !== '' ? Number(order) : undefined,
          allowMarkup,
        });
      } else {
        await onSave({
          symbol: trimmedSymbol,
          name: trimmedName,
          category: category.trim() || undefined,
          defaultMax: numMax,
          calcUnit: calcUnit.trim() || 'pips',
          order: order.trim() !== '' ? Number(order) : undefined,
          allowMarkup,
        });
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi lưu sản phẩm');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {isEditing ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới của sàn'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isEditing
                ? `Cập nhật thông tin cho sản phẩm ${productToEdit?.symbol}`
                : 'Thêm cặp tiền, kim loại, chỉ số hoặc crypto mới'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-semibold">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Mã sản phẩm (Symbol) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="VD: GOLD, FOREX, SOLANA, BTCUSD"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold uppercase tracking-wider text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              required
            />
            <span className="text-[11px] text-gray-500 mt-0.5 block">
              Chữ hoa, số và gạch dưới. Mã này dùng để tính toán Rebate.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Tên hiển thị <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Vàng (XAUUSD), Ngoại hối, Solana..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Trần mặc định <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={defaultMax}
                onChange={(e) => setDefaultMax(e.target.value)}
                placeholder="VD: 20"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Đơn vị tính
              </label>
              <select
                value={calcUnit}
                onChange={(e) => setCalcUnit(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
              >
                <option value="pips">pips</option>
                <option value="USD">USD</option>
                <option value="%">%</option>
                <option value="points">points</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Danh mục
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Forex, Metals, Crypto..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Thứ tự hiển thị
              </label>
              <input
                type="number"
                min="0"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>

          {/* iOS Toggle Switch for allowMarkup */}
          <div className="flex items-center justify-between p-3.5 bg-gray-50/80 rounded-xl border border-gray-200">
            <div className="pr-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-extrabold text-gray-900">Cho phép cộng Link Markup</p>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  allowMarkup ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                }`}>
                  {allowMarkup ? 'Đang Bật' : 'Đang Tắt'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Bật nếu sản phẩm này được sàn BCR cho phép cộng thêm pips từ các gói Link Markup.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={allowMarkup}
              onClick={() => setAllowMarkup(!allowMarkup)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none shadow-inner ${
                allowMarkup ? 'bg-[#34C759]' : 'bg-gray-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                  allowMarkup ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-extrabold text-gray-900 bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] rounded-xl hover:opacity-95 shadow-md disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : isEditing ? (
                'Cập nhật'
              ) : (
                'Thêm sản phẩm'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
