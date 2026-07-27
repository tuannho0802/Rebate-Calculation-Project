'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { ibApi } from '@/lib/api/ib';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from 'sonner';
import { IbSearchAutocomplete } from './IbSearchAutocomplete';
import { Plus } from 'lucide-react';

type UserMode = 'mib' | 'sub-ib';

export function AdminCreateUserModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<UserMode>('mib');
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState('STD');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  
  // For "create sub-IB" mode
  const [targetParentId, setTargetParentId] = useState('');
  const [targetParentEmail, setTargetParentEmail] = useState('');
  const [parentPreview, setParentPreview] = useState<{ name: string; level: number; accountType: string } | null>(null);
  const [parentLoading, setParentLoading] = useState(false);

  const handleParentChange = async (id: string, email?: string) => {
    setTargetParentId(id);
    setTargetParentEmail(email || '');
    setParentLoading(true);
    try {
      const res = await ibApi.getById(id);
      if (res.success && res.data) {
        setParentPreview({
          name: res.data.name || '',
          level: res.data.level || 0,
          accountType: res.data.accountType || 'STD',
        });
        // Auto-inherit accountType from parent
        setAccountType(res.data.accountType || 'STD');
      } else {
        setParentPreview(null);
        setAccountType('STD');
      }
    } catch (err) {
      setParentPreview(null);
      setAccountType('STD');
    } finally {
      setParentLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!email || !name || !password) {
      toast.error('Vui lòng điền đầy đủ email, tên và mật khẩu');
      return;
    }

    if (mode === 'sub-ib' && !targetParentId) {
      toast.error('Vui lòng chọn node cha cho Sub-IB mới');
      return;
    }

    if (password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setIsCreating(true);

    try {
      let result: any;

      if (mode === 'mib') {
        result = await ibApi.createMib({ email, name, password, accountType, phone, country });
      } else {
        result = await ibApi.createSubIbByAdmin({
          email,
          name,
          password,
          accountType,
          phone,
          country,
          targetParentId,
        });
      }

      if (result.success) {
        toast.success(mode === 'mib' ? 'Tạo MIB thành công' : 'Tạo Sub-IB thành công');
        onClose();
        // Redirect to user management page
        router.push('/dashboard/ib-management');
      } else {
        const code = result.error?.code || 'INTERNAL_ERROR';
        toast.error(getErrorMessage(code));
      }
    } catch (err: any) {
      const code = err.response?.data?.error?.code || 'INTERNAL_ERROR';
      toast.error(getErrorMessage(code));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'mib' ? 'Tạo MIB mới' : 'Tạo Sub-IB'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {/* Mode selector */}
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => {
              setMode('mib');
              setTargetParentId('');
              setParentPreview(null);
            }}
            className={`rounded-md py-2 text-sm font-medium transition-colors ${
              mode === 'mib' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Tạo MIB mới
          </button>
          <button
            onClick={() => setMode('sub-ib')}
            className={`rounded-md py-2 text-sm font-medium transition-colors ${
              mode === 'sub-ib' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Tạo Sub-IB
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Common fields */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="email@azrebate.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tên hiển thị</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Tên IB"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="******"
            />
            <p className="mt-1 text-xs text-gray-500">Mật khẩu phải có ít nhất 6 ký tự</p>
          </div>

          {mode === 'sub-ib' && parentPreview && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm">
              <p className="font-medium text-blue-800">Người tạo: {parentPreview.name}</p>
              <p className="text-blue-700">Level con sẽ tạo: {parentPreview.level + 1}</p>
              <p className="text-blue-700">Loại tài khoản kế thừa: {parentPreview.accountType}</p>
            </div>
          )}

          {/* Mode-specific fields */}
          {mode === 'mib' ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Loại tài khoản</label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="STD">STD (Mặc định)</option>
                  <option value="PRO">PRO</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Số điện thoại (tùy chọn)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="090xxxxxxx"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Quốc gia (tùy chọn)</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Việt Nam"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Chọn node cha</label>
                <p className="mb-2 text-xs text-gray-500">
                  Chọn IB/MIB sẽ là cha của user mới (không thể chọn chính mình)
                </p>
                <IbSearchAutocomplete
                  value={targetParentId}
                  onChange={handleParentChange}
                  placeholder="Tìm và chọn node cha..."
                />
                {targetParentId && !parentPreview && !parentLoading && (
                  <p className="mt-2 text-sm text-red-600">Không tìm thấy node cha</p>
                )}
                {parentLoading && (
                  <p className="mt-2 text-sm text-gray-500">Đang tải thông tin node cha...</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Loại tài khoản</label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="STD">STD (Mặc định)</option>
                  <option value="PRO">PRO</option>
                  <option value="VIP">VIP</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Mặc định kế thừa từ node cha ({parentPreview?.accountType || 'STD'})
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Số điện thoại (tùy chọn)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="090xxxxxxx"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Quốc gia (tùy chọn)</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Việt Nam"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
            >
              {isCreating ? 'Đang tạo...' : mode === 'mib' ? 'Tạo MIB' : 'Tạo Sub-IB'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}