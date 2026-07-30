'use client';

import { Suspense, use, useState, useEffect } from 'react';
import { useRouter, Link } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { rebateApi } from '@/lib/api/rebate';
import { rebateTemplateApi } from '@/lib/api/rebateTemplates';
import { ibApi } from '@/lib/api/ib';
import { useAuthStore } from '@/store/auth.store';
import { Loader2, Save, ArrowLeft, Mail, Plus, Settings2, SlidersHorizontal } from 'lucide-react';
import { AssetType, IbNode, RebateAssetConfig, RebateType, MAX_PIPS, RebateConfig } from '@/types';
import { MarkupLinkRow } from '@/components/rebate/AccountTypeBuilder';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from 'sonner';

import { useDisabledAssetTypes } from '@/hooks/useDisabledAssetTypes';

function EditIbRebatePageInner({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const unwrappedParams = use(params);
  const id = unwrappedParams.id;

  const { activeAssetTypes } = useDisabledAssetTypes();

  const user = useAuthStore((s) => s.user);
  const [targetIb, setTargetIb] = useState<IbNode | null>(null);
  const [profile, setProfile] = useState<IbNode | null>(null);
  const [parentIbNode, setParentIbNode] = useState<IbNode | null>(null);
  const [subIbAccountType, setSubIbAccountType] = useState<string>('STD');
  const [markupLinks, setMarkupLinks] = useState<MarkupLinkRow[]>([]);
  const [accountTypeTemplates, setAccountTypeTemplates] = useState<any[]>([]);
  const [unitMap, setUnitMap] = useState<Record<string, string>>({});
  const [parentConfig, setParentConfig] = useState<RebateConfig | null>(null);
  const [mounted, setMounted] = useState(false);

  const [globalMarkup, setGlobalMarkup] = useState<string>('');
  const [rebateValues, setRebateValues] = useState<Record<string, string>>({});
  const [initialRebateValues, setInitialRebateValues] = useState<Record<string, string>>({});

  const [assetsToUpdateState, setAssetsToUpdateState] = useState<any[]>([]);
  const [selectedAccountType, setSelectedAccountType] = useState<string>('STD');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // State for Add/Remove Account Types Modal
  const [isManageTypesModalOpen, setIsManageTypesModalOpen] = useState(false);
  const [tempSelectedTypes, setTempSelectedTypes] = useState<string[]>([]);
  const [isSavingTypes, setIsSavingTypes] = useState(false);

  const highlightAssets = new Set(
    (searchParams.get('highlightAssets') || '').split(',').filter(Boolean),
  );

  useEffect(() => {
    setMounted(true);
    if (!user?.id) return;

    const loadData = async () => {
      try {
        const [profileRes, targetRes] = await Promise.all([
          ibApi.getMe().catch(() => null),
          ibApi.getById(id).catch(() => null),
        ]);

        let loadedProfile: IbNode | null = null;
        if (profileRes?.data) {
          loadedProfile = profileRes.data;
          setProfile(loadedProfile);
        }

        let targetTypes = ['STD'];
        if (targetRes?.data) {
          setTargetIb(targetRes.data);
          const acc = targetRes.data.accountType;
          setSubIbAccountType(acc && acc !== 'SEA STD' ? acc : 'STD');
          if (targetRes.data.accountTypes && targetRes.data.accountTypes.length > 0) {
            targetTypes = targetRes.data.accountTypes;
          } else if (acc) {
            targetTypes = [acc];
          }

          if (targetRes.data.parentId) {
            const pNodeRes = await ibApi.getById(targetRes.data.parentId).catch(() => null);
            if (pNodeRes?.data) {
              setParentIbNode(pNodeRes.data);
            }
          }
        }

        const initialType = targetTypes[0] || 'STD';
        setSelectedAccountType(initialType);

        const [targetConfigRes, pConfigRes] = await Promise.all([
          rebateApi.getConfig(id, initialType).catch(() => null),
          loadedProfile?.id ? rebateApi.getConfig(loadedProfile.id, initialType).catch(() => null) : null,
        ]);

        if (pConfigRes?.data) {
          setParentConfig(pConfigRes.data);
        }

        let mLinks: MarkupLinkRow[] = [];
        const tempUnitMap: Record<string, string> = {};

        const templateSourceId = loadedProfile?.level === 0 ? loadedProfile.id : loadedProfile?.parentId || loadedProfile?.id;
        if (templateSourceId && loadedProfile) {
          const templatesRes = await rebateTemplateApi.getTemplates(templateSourceId).catch(() => null);
          if (templatesRes?.data) {
            mLinks = templatesRes.data.markupLinkTemplates;
            setMarkupLinks(mLinks);
            setAccountTypeTemplates(templatesRes.data.accountTypeTemplates);

            templatesRes.data.accountTypeTemplates.forEach((t: any) => {
              t.rows.forEach((r: any) => {
                tempUnitMap[r.assetType] = r.calcUnit;
              });
            });

            if (targetRes?.data && (!targetRes.data.accountType || targetRes.data.accountType === 'SEA STD')) {
              setSubIbAccountType('STD');
            }
          }
        }
        setUnitMap(tempUnitMap);

        if (targetConfigRes?.data?.assets) {
          const initialRebate: Record<string, string> = {};
          let initialMarkup = '';

          targetConfigRes.data.assets.forEach((asset: RebateAssetConfig) => {
            initialRebate[asset.assetType] = String(asset.rebatePips);
            if (!initialMarkup) {
              initialMarkup = String(asset.markupPips);
            }
          });

          setRebateValues(initialRebate);
          setInitialRebateValues(initialRebate);
          setGlobalMarkup(initialMarkup || '0');
        }

      } catch (error) {
        console.error('Failed to load data', error);
      }
    };

    loadData();
  }, [id, user?.id]);

  const handleAccountTypeChange = async (newType: string) => {
    setSelectedAccountType(newType);
    setSaveSuccess(false);
    try {
      const parentConfigSourceId = profile?.id;
      const [targetConfigRes, pConfigRes] = await Promise.all([
        rebateApi.getConfig(id, newType).catch(() => null),
        parentConfigSourceId ? rebateApi.getConfig(parentConfigSourceId, newType).catch(() => null) : null,
      ]);

      if (pConfigRes?.data) {
        setParentConfig(pConfigRes.data);
      }

      if (targetConfigRes?.data?.assets) {
        const initialRebate: Record<string, string> = {};
        let initialMarkup = '';

        targetConfigRes.data.assets.forEach((asset: RebateAssetConfig) => {
          initialRebate[asset.assetType] = String(asset.rebatePips);
          if (!initialMarkup) {
            initialMarkup = String(asset.markupPips);
          }
        });

        setRebateValues(initialRebate);
        setInitialRebateValues(initialRebate);
        setGlobalMarkup(initialMarkup || '0');
      } else {
        setRebateValues({});
        setInitialRebateValues({});
      }
    } catch (e) {
      console.error('Error switching account type config', e);
    }
  };

  const updateConfigMutation = useMutation({
    mutationFn: (assets: RebateAssetConfig[]) => rebateApi.updateConfig(id, assets, selectedAccountType),
    onSuccess: (res) => {
      if (res.success) {
        setSaveSuccess(true);
        toast.success('Cập nhật cấu hình hoa hồng thành công');
        setTimeout(() => {
          router.push('/dashboard/ib-management');
        }, 1200);
      } else {
        toast.error(getErrorMessage((res as any).error?.code));
      }
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR'));
    }
  });

  const openManageTypesModal = () => {
    const currentTypes = (targetIb?.accountTypes && targetIb.accountTypes.length > 0)
      ? targetIb.accountTypes
      : [targetIb?.accountType || 'STD'];
    setTempSelectedTypes(currentTypes);
    setIsManageTypesModalOpen(true);
  };

  const handleSaveAccountTypes = async () => {
    if (tempSelectedTypes.length === 0) {
      toast.error('IB phải sở hữu ít nhất 1 loại tài khoản link');
      return;
    }

    setIsSavingTypes(true);
    try {
      const res = await ibApi.update(id, {
        accountType: tempSelectedTypes[0],
        accountTypes: tempSelectedTypes,
      });

      if (res.success) {
        toast.success('Cập nhật các loại tài khoản link cho IB thành công!');
        setTargetIb((prev) => prev ? {
          ...prev,
          accountType: tempSelectedTypes[0],
          accountTypes: tempSelectedTypes,
        } : null);

        if (!tempSelectedTypes.includes(selectedAccountType)) {
          handleAccountTypeChange(tempSelectedTypes[0]);
        }
        setIsManageTypesModalOpen(false);
      } else {
        toast.error(getErrorMessage((res as any).error?.code));
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR'));
    } finally {
      setIsSavingTypes(false);
    }
  };

  if (!mounted) return null;

  const parsePipsValue = (value: string) => {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const isMibEditingLevel1 = profile?.level === 0 && targetIb?.level === 1;

  const getAddedMarkupPips = (accountTypeStr: string, links: MarkupLinkRow[]): number => {
    if (!isMibEditingLevel1) return 0;
    const matched = links.find((l) => l.name === accountTypeStr);
    if (matched !== undefined && matched !== null) {
      return Number(matched.share || 0);
    }
    if (accountTypeStr === 'STD' || !accountTypeStr || accountTypeStr === 'SEA STD') return 0;
    const match = accountTypeStr.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const addedMarkupPips = getAddedMarkupPips(subIbAccountType, markupLinks);

  const getAvailableBudget = (asset: AssetType) => {
    if (profile?.level === 0) {
      if (parentConfig?.assets) {
        const ownAsset = parentConfig.assets.find((a) => a.assetType === asset);
        if (ownAsset) {
          return Number(ownAsset.maxPips);
        }
      }
      return MAX_PIPS[asset] || 0;
    }

    if (parentConfig?.assets) {
      const pAsset = parentConfig.assets.find(a => a.assetType === asset);
      if (pAsset) return Number(pAsset.rebatePips || 0);
    }
    return 0;
  };

  const getCombinedRebateMax = (asset: AssetType) => {
    return getAvailableBudget(asset);
  };

  const isAnyRebateInvalid = activeAssetTypes.some(asset => parsePipsValue(rebateValues[asset] || '0') > getCombinedRebateMax(asset));
  const isFormInvalid = isAnyRebateInvalid;

  const handleSave = () => {
    const assetsToUpdate: RebateAssetConfig[] = [];
    const accountTypeChanged = !!targetIb && targetIb.accountType !== subIbAccountType;

    activeAssetTypes.forEach((asset) => {
      const rebateVal = rebateValues[asset] || '0';
      const parsedRebate = parsePipsValue(rebateVal);
      const initialRebate = parsePipsValue(initialRebateValues[asset] || '0');
      const rebateChanged = parsedRebate !== initialRebate;
      const needsMarkupRefresh = accountTypeChanged && parsedRebate > 0;

      if (!rebateChanged && !needsMarkupRefresh) return;

      assetsToUpdate.push({
        assetType: asset,
        rebateType: RebateType.STP_REBATE,
        accountType: selectedAccountType,
        rebatePips: parsedRebate,
        markupPips: addedMarkupPips,
        markupPercent: 100,
      });
    });

    if (assetsToUpdate.length > 0 || accountTypeChanged) {
      setAssetsToUpdateState(assetsToUpdate);
      setIsConfirmModalOpen(true);
    }
  };

  const handleConfirmSave = async () => {
    setIsConfirmModalOpen(false);
    if (targetIb && targetIb.accountType !== subIbAccountType) {
      await ibApi.update(id, { accountType: subIbAccountType });
      setTargetIb((prev) => prev ? { ...prev, accountType: subIbAccountType } : null);
    }
    if (assetsToUpdateState.length > 0) {
      updateConfigMutation.mutate(assetsToUpdateState);
    }
  };

  const availableAccountTypes = (targetIb?.accountTypes && targetIb.accountTypes.length > 0)
    ? targetIb.accountTypes
    : [targetIb?.accountType || 'STD'];

  const isTargetMib = targetIb?.level === 0;
  const parentAccountTypesList = (parentIbNode?.accountTypes && parentIbNode.accountTypes.length > 0)
    ? parentIbNode.accountTypes
    : [parentIbNode?.accountType || 'STD'];

  const assignableAccountTypesOptions = isTargetMib
    ? Array.from(new Set([
        ...markupLinks.map((l) => l.name),
        ...accountTypeTemplates.map((t) => t.name),
        'STD', 'STD5', 'STD10', 'STD15', 'STD20',
      ])).filter(Boolean)
    : parentAccountTypesList;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/ib-management"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách IB
        </Link>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
            <h1 className="text-xl font-bold text-gray-900">{targetIb?.name || '---'}</h1>
            <div className="hidden md:block w-px h-6 bg-gray-200"></div>
            <div className="flex items-center gap-2 bg-amber-50/80 px-3.5 py-1.5 rounded-full border border-amber-200/80 shadow-sm">
              <Mail className="w-4 h-4 text-amber-700" />
              <span className="text-amber-950 font-bold text-sm">{targetIb?.email || '---'}</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-gray-200"></div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">Chỉnh sửa cho link:</span>
                <select
                  value={selectedAccountType}
                  onChange={(e) => handleAccountTypeChange(e.target.value)}
                  className="font-bold text-gray-900 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-300 shadow-sm focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer text-sm"
                >
                  {availableAccountTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={openManageTypesModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-xs transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm / Xóa loại link</span>
              </button>

              <div className="flex items-center gap-1">
                {availableAccountTypes.map((t) => (
                  <span key={t} className="px-2 py-0.5 text-[11px] font-extrabold rounded bg-gray-100 text-gray-700 border border-gray-200">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={updateConfigMutation.isPending || isFormInvalid}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-extrabold transition-all shadow-md disabled:opacity-50 ${saveSuccess ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20 text-white' : 'bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] hover:opacity-95 text-gray-900 shadow-amber-500/20'}`}
          >
            {updateConfigMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5 text-gray-900" />}
            {saveSuccess ? 'Đã lưu thành công' : 'Lưu Thay Đổi'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-900">Cấu hình Rebate cho từng sản phẩm</h3>
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            Gói Link Markup: {subIbAccountType}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Tên sản phẩm</th>
                <th className="px-6 py-4">Hoa hồng được nhận cho MIB và IB</th>
                <th className="px-6 py-4 w-64">Chia cho cấp dưới</th>
                <th className="px-6 py-4">Đơn vị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {activeAssetTypes.map((asset) => {
                const combinedMax = getCombinedRebateMax(asset); // Trần thật (KHÔNG cộng Markup Pips)
                const unit = unitMap[asset] || 'pips';

                const currentVal = rebateValues[asset] || '0';
                const isRebateInvalid = parsePipsValue(currentVal) > combinedMax;

                const isHighlighted = highlightAssets.has(asset);

                return (
                  <tr
                    key={asset}
                    className={`transition-colors ${isHighlighted
                      ? 'ring-2 ring-inset ring-amber-500 bg-amber-50/70'
                      : 'hover:bg-gray-50/50'
                      }`}
                  >
                    <td className="px-6 py-4 font-bold text-gray-900">{asset}</td>
                    <td className="px-6 py-4 text-amber-950 font-bold">
                      Hoa hồng được nhận: {combinedMax}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <input
                          type="text"
                          value={rebateValues[asset] || ''}
                          onChange={(e) => {
                            if (e.target.value && !/^\d*\.?\d*$/.test(e.target.value)) return;
                            setSaveSuccess(false);
                            setRebateValues(prev => ({ ...prev, [asset]: e.target.value }));
                          }}
                          placeholder="0.0"
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-all font-medium ${isRebateInvalid ? 'border-red-500 text-red-600 focus:ring-red-500 focus:border-red-500 bg-red-50' : 'border-gray-300 focus:ring-amber-500 focus:border-amber-500 bg-white'}`}
                        />
                        {isRebateInvalid && <span className="text-red-500 text-xs mt-1 font-medium">Bạn chỉ còn có thể chia tối đa {combinedMax}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-medium uppercase text-sm">
                      {unit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isConfirmModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 transition-opacity"
            onClick={() => setIsConfirmModalOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto transform transition-all overflow-hidden">
              <div className="bg-amber-500/10 border-b border-amber-500/20 p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Xác nhận thay đổi</h3>
                  <p className="text-sm text-gray-500 mt-1">Hành động này sẽ ảnh hưởng đến cấp dưới</p>
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-700 font-medium">Bạn có chắc muốn thay đổi không?</p>
                <p className="text-gray-500 text-sm mt-2">
                  Nếu Đồng ý thì số Pip ở nhánh đó từ khúc được sửa đổi sẽ bị reset số Pip lại đều bằng không hết.
                  Và sẽ có thông báo tự động gửi về cho toàn bộ người dùng trong nhánh đó.
                </p>
                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSave}
                    className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors shadow-md shadow-amber-500/20"
                  >
                    Đồng ý
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Quản lý / Thêm / Xóa Loại Tài Khoản Link */}
      {isManageTypesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Quản lý Loại tài khoản link</h3>
                <p className="text-xs text-gray-500 font-medium">Thêm hoặc xóa các loại link cấp cho IB ({targetIb?.name || targetIb?.email})</p>
              </div>
              <button
                onClick={() => setIsManageTypesModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                Danh sách loại tài khoản link khả dụng
              </label>
              <p className="text-xs text-gray-500 leading-relaxed">
                {isTargetMib
                  ? 'Loại tài khoản link được lấy từ bảng Cấu hình hoa hồng Markup hệ thống.'
                  : `Được giới hạn bởi các loại link mà Cấp trên sở hữu (${parentAccountTypesList.join(', ')}).`}
              </p>

              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1.5 border border-gray-200 rounded-xl bg-gray-50/50">
                {assignableAccountTypesOptions.map((type) => {
                  const isChecked = tempSelectedTypes.includes(type);
                  return (
                    <label
                      key={type}
                      className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border cursor-pointer text-sm font-semibold transition-all ${
                        isChecked
                          ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-sm font-bold'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            if (tempSelectedTypes.length > 1) {
                              setTempSelectedTypes(tempSelectedTypes.filter((t) => t !== type));
                            } else {
                              toast.error('IB phải sở hữu ít nhất 1 loại tài khoản link');
                            }
                          } else {
                            setTempSelectedTypes([...tempSelectedTypes, type]);
                          }
                        }}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <span>{type}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsManageTypesModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveAccountTypes}
                disabled={isSavingTypes}
                className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingTypes && <Loader2 className="h-4 w-4 animate-spin" />}
                Xác nhận cập nhật
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditIbRebatePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <EditIbRebatePageInner params={params} />
    </Suspense>
  );
}