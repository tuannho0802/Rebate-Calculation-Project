'use client';

import { Suspense, use, useState, useEffect } from 'react';
import { useRouter, Link } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { rebateApi } from '@/lib/api/rebate';
import { rebateTemplateApi } from '@/lib/api/rebateTemplates';
import { ibApi } from '@/lib/api/ib';
import { useAuthStore } from '@/store/auth.store';
import { Loader2, Save, ArrowLeft, Mail, Plus } from 'lucide-react';
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
  const [markupLinks, setMarkupLinks] = useState<MarkupLinkRow[]>([]);
  const [accountTypeTemplates, setAccountTypeTemplates] = useState<any[]>([]);
  const [unitMap, setUnitMap] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  // Maps by accountType:
  // parentConfigsMap[accType] -> RebateConfig of parent for that accType
  const [parentConfigsMap, setParentConfigsMap] = useState<Record<string, RebateConfig>>({});
  
  // rebateValues keyed by `${accType}:${assetType}`
  const [rebateValues, setRebateValues] = useState<Record<string, string>>({});
  const [initialRebateValues, setInitialRebateValues] = useState<Record<string, string>>({});

  // Filter state for Position 1 (ALL or specific accountType)
  const [selectedAccountTypeFilter, setSelectedAccountTypeFilter] = useState<string>('ALL');

  const [pendingUpdates, setPendingUpdates] = useState<Record<string, RebateAssetConfig[]>>({});
  const [isSaving, setIsSaving] = useState(false);
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

        // Fetch configs for all target account types concurrently
        const pConfigsMap: Record<string, RebateConfig> = {};
        const initRebateVals: Record<string, string> = {};

        const parentSourceId = targetRes?.data?.parentId || loadedProfile?.id;

        await Promise.all(
          targetTypes.map(async (accType) => {
            const [tConfigRes, pConfigRes] = await Promise.all([
              rebateApi.getConfig(id, accType).catch(() => null),
              parentSourceId ? rebateApi.getConfig(parentSourceId, accType).catch(() => null) : null,
            ]);

            if (pConfigRes?.data) {
              pConfigsMap[accType] = pConfigRes.data;
            }

            if (tConfigRes?.data?.assets) {
              tConfigRes.data.assets.forEach((asset: RebateAssetConfig) => {
                const key = `${accType}:${asset.assetType}`;
                initRebateVals[key] = String(asset.rebatePips);
              });
            }
          })
        );

        setParentConfigsMap(pConfigsMap);
        setRebateValues(initRebateVals);
        setInitialRebateValues(initRebateVals);

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
          }
        }
        setUnitMap(tempUnitMap);
      } catch (error) {
        console.error('Failed to load data', error);
      }
    };

    loadData();
  }, [id, user?.id]);

  const loadMissingAccountTypes = async (typesToLoad: string[], currentTargetIb: IbNode | null) => {
    const parentSourceId = currentTargetIb?.parentId || targetIb?.parentId || profile?.id;
    const pConfigsMap = { ...parentConfigsMap };
    const newRebateVals = { ...rebateValues };

    await Promise.all(
      typesToLoad.map(async (accType) => {
        const [tConfigRes, pConfigRes] = await Promise.all([
          rebateApi.getConfig(id, accType).catch(() => null),
          parentSourceId ? rebateApi.getConfig(parentSourceId, accType).catch(() => null) : null,
        ]);

        if (pConfigRes?.data) {
          pConfigsMap[accType] = pConfigRes.data;
        }

        if (tConfigRes?.data?.assets) {
          tConfigRes.data.assets.forEach((asset: RebateAssetConfig) => {
            const key = `${accType}:${asset.assetType}`;
            if (newRebateVals[key] === undefined) {
              newRebateVals[key] = String(asset.rebatePips);
            }
          });
        }
      })
    );

    setParentConfigsMap(pConfigsMap);
    setRebateValues(newRebateVals);
  };

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
        const updatedIb = res.data || (targetIb ? {
          ...targetIb,
          accountType: tempSelectedTypes[0],
          accountTypes: tempSelectedTypes,
        } : null);

        setTargetIb(updatedIb as IbNode);
        setIsManageTypesModalOpen(false);

        // Load configs for newly added types if any
        await loadMissingAccountTypes(tempSelectedTypes, updatedIb as IbNode);
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

  const availableAccountTypes = (targetIb?.accountTypes && targetIb.accountTypes.length > 0)
    ? targetIb.accountTypes
    : [targetIb?.accountType || 'STD'];

  const displayedAccountTypes = selectedAccountTypeFilter === 'ALL'
    ? availableAccountTypes
    : availableAccountTypes.filter((t) => t === selectedAccountTypeFilter);

  const isMibNode = targetIb?.level === 0;

  const getAddedMarkupPips = (accountTypeStr: string, links: MarkupLinkRow[]): number => {
    const matched = links.find((l) => l.name === accountTypeStr);
    if (matched !== undefined && matched !== null && matched.share !== undefined && Number(matched.share) > 0) {
      return Number(matched.share);
    }
    if (accountTypeStr === 'STD' || !accountTypeStr) return 0;
    const match = accountTypeStr.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const getAvailableBudget = (accType: string, asset: AssetType) => {
    const parentConfig = parentConfigsMap[accType];

    if (!targetIb || targetIb.level === 0 || targetIb.level === 1) {
      const addedMarkup = getAddedMarkupPips(accType, markupLinks);
      if (parentConfig?.assets) {
        const ownAsset = parentConfig.assets.find((a) => a.assetType === asset);
        if (ownAsset && Number(ownAsset.maxPips) > 0) {
          return Number(ownAsset.maxPips) + addedMarkup;
        }
      }
      return (MAX_PIPS[asset] || 0) + addedMarkup;
    }

    if (parentConfig?.assets) {
      const pAsset = parentConfig.assets.find((a) => a.assetType === asset);
      if (pAsset) return Number(pAsset.rebatePips || 0);
    }
    return 0;
  };

  const getCombinedRebateMax = (accType: string, asset: AssetType) => {
    return getAvailableBudget(accType, asset);
  };

  // Check form validity across displayed account types
  const isAnyRebateInvalid = displayedAccountTypes.some((accType) =>
    activeAssetTypes.some((asset) => {
      const key = `${accType}:${asset}`;
      const maxBudget = getCombinedRebateMax(accType, asset);
      return parsePipsValue(rebateValues[key] || '0') > maxBudget;
    })
  );

  const isFormInvalid = isAnyRebateInvalid;

  const handleSave = () => {
    const updatesByAccType: Record<string, RebateAssetConfig[]> = {};
    let totalChangesCount = 0;

    availableAccountTypes.forEach((accType) => {
      const assetsToUpdate: RebateAssetConfig[] = [];
      const addedMarkup = getAddedMarkupPips(accType, markupLinks);

      activeAssetTypes.forEach((asset) => {
        const key = `${accType}:${asset}`;
        const rebateVal = rebateValues[key] || '0';
        const parsedRebate = parsePipsValue(rebateVal);
        const initialRebate = parsePipsValue(initialRebateValues[key] || '0');

        if (parsedRebate !== initialRebate) {
          assetsToUpdate.push({
            assetType: asset,
            rebateType: RebateType.STP_REBATE,
            accountType: accType,
            rebatePips: parsedRebate,
            markupPips: addedMarkup,
            markupPercent: 100,
          });
        }
      });

      if (assetsToUpdate.length > 0) {
        updatesByAccType[accType] = assetsToUpdate;
        totalChangesCount += assetsToUpdate.length;
      }
    });

    if (totalChangesCount > 0) {
      setPendingUpdates(updatesByAccType);
      setIsConfirmModalOpen(true);
    } else {
      toast.info('Không có thay đổi nào để lưu');
    }
  };

  const handleConfirmSave = async () => {
    setIsConfirmModalOpen(false);
    setIsSaving(true);

    try {
      const updateEntries = Object.entries(pendingUpdates);

      for (const [accType, assets] of updateEntries) {
        const res = await rebateApi.updateConfig(id, assets, accType);
        if (!res.success) {
          throw new Error((res as any).error?.code || 'UPDATE_FAILED');
        }
      }

      setSaveSuccess(true);
      setInitialRebateValues({ ...rebateValues });
      toast.success('Cập nhật cấu hình hoa hồng thành công!');
      setTimeout(() => {
        router.push('/dashboard/ib-management');
      }, 1200);
    } catch (err: any) {
      toast.error(getErrorMessage(err.response?.data?.error?.code || err.message || 'INTERNAL_ERROR'));
    } finally {
      setIsSaving(false);
    }
  };

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
            
            {/* Vị trí 1 & 2: Dropdown Filter và Badges loại link sở hữu */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Vị trí 1: Filter Select theo loại link (Có tùy chọn ALL) */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">Chỉnh sửa cho link:</span>
                <select
                  value={selectedAccountTypeFilter}
                  onChange={(e) => setSelectedAccountTypeFilter(e.target.value)}
                  className="font-bold text-gray-900 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-300 shadow-sm focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer text-sm"
                >
                  <option value="ALL">All (Tất cả loại link)</option>
                  {availableAccountTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vị trí 2: Badges loại link sở hữu */}
              <div className="flex items-center gap-1 flex-wrap">
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
            disabled={isSaving || isFormInvalid}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-extrabold transition-all shadow-md disabled:opacity-50 ${saveSuccess ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20 text-white' : 'bg-[linear-gradient(180deg,#FDE047_0%,#FACC15_60%,#EF4444_100%)] hover:opacity-95 text-gray-900 shadow-amber-500/20'}`}
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5 text-gray-900" />}
            {saveSuccess ? 'Đã lưu thành công' : 'Lưu Thay Đổi'}
          </button>
        </div>
      </div>

      {/* Vị trí 3: Hiển thị các bảng cấu hình Rebate tương ứng với các loại tài khoản sở hữu / lọc */}
      <div className="space-y-8">
        {displayedAccountTypes.map((accType) => (
          <div key={accType} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-lg text-gray-900">Cấu hình Rebate cho từng sản phẩm</h3>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3.5 py-1 rounded-full shadow-sm">
                Gói Link Markup: {accType}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-100 text-sm">
                  <tr>
                    <th className="px-6 py-4">Tên sản phẩm</th>
                    <th className="px-6 py-4">Hoa hồng được nhận cho MIB và IB</th>
                    {!isMibNode && <th className="px-6 py-4 w-64">Chia cho cấp dưới</th>}
                    <th className="px-6 py-4">Đơn vị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeAssetTypes.map((asset) => {
                    const combinedMax = getCombinedRebateMax(accType, asset);
                    const unit = unitMap[asset] || 'pips';
                    const key = `${accType}:${asset}`;

                    const currentVal = rebateValues[key] || '0';
                    const isRebateInvalid = parsePipsValue(currentVal) > combinedMax;
                    const isHighlighted = highlightAssets.has(asset);

                    return (
                      <tr
                        key={asset}
                        className={`transition-colors ${
                          isHighlighted
                            ? 'ring-2 ring-inset ring-amber-500 bg-amber-50/70'
                            : 'hover:bg-gray-50/50'
                        }`}
                      >
                        <td className="px-6 py-4 font-bold text-gray-900">{asset}</td>
                        <td className="px-6 py-4 text-amber-950 font-bold">
                          Hoa hồng được nhận: {combinedMax}
                        </td>
                        {!isMibNode && (
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <input
                                type="text"
                                value={rebateValues[key] || ''}
                                onChange={(e) => {
                                  if (e.target.value && !/^\d*\.?\d*$/.test(e.target.value)) return;
                                  setSaveSuccess(false);
                                  setRebateValues((prev) => ({ ...prev, [key]: e.target.value }));
                                }}
                                placeholder="0.0"
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-all font-medium ${
                                  isRebateInvalid
                                    ? 'border-red-500 text-red-600 focus:ring-red-500 focus:border-red-500 bg-red-50'
                                    : 'border-gray-300 focus:ring-amber-500 focus:border-amber-500 bg-white'
                                }`}
                              />
                              {isRebateInvalid && (
                                <span className="text-red-500 text-xs mt-1 font-medium">
                                  Bạn chỉ còn có thể chia tối đa {combinedMax}
                                </span>
                              )}
                            </div>
                          </td>
                        )}
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
        ))}
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