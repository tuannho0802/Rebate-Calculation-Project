'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMutation } from '@tanstack/react-query';
import { rebateApi } from '@/lib/api/rebate';
import { rebateTemplateApi } from '@/lib/api/rebateTemplates';
import { ibApi } from '@/lib/api/ib';
import { useAuthStore } from '@/store/auth.store';
import { Loader2, Save, ArrowLeft, Mail } from 'lucide-react';
import { AssetType, IbNode, RebateAssetConfig, RebateType, MAX_PIPS, RebateConfig } from '@/types';
import { MarkupLinkRow } from '@/components/rebate/AccountTypeBuilder';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from 'sonner';

export default function EditIbRebatePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { user } = useAuthStore();
  
  useEffect(() => {
    try {
      console.log('EditIbRebatePage target IB', { targetId: id, configPath: `/rebate/config/${id}` });
    } catch (e) {
      // ignore logging errors
    }
  }, [id]);
  
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<IbNode | null>(null);
  const [targetIb, setTargetIb] = useState<IbNode | null>(null);
  const [markupLinks, setMarkupLinks] = useState<MarkupLinkRow[]>([]);
  const [subIbAccountType, setSubIbAccountType] = useState('Markup 0%');
  const [accountTypeTemplates, setAccountTypeTemplates] = useState<any>([]);

  const [parentConfig, setParentConfig] = useState<RebateConfig | null>(null);
  const [unitMap, setUnitMap] = useState<Record<string, string>>({});

  const [globalMarkup, setGlobalMarkup] = useState<string>('');
  const [rebateValues, setRebateValues] = useState<Record<string, string>>({});
  
  const [assetsToUpdateState, setAssetsToUpdateState] = useState<any[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!user?.id) return;

    const loadData = async () => {
      try {
        const [profileRes, targetRes, targetConfigRes] = await Promise.all([
          ibApi.getMe().catch(() => null),
          ibApi.getById(id).catch(() => null),
          rebateApi.getConfig(id).catch(() => null),
        ]);

        let loadedProfile: IbNode | null = null;
        if (profileRes?.data) {
          loadedProfile = profileRes.data;
          setProfile(loadedProfile);
        }

        if (targetRes?.data) {
          setTargetIb(targetRes.data);
          const acc = targetRes.data.accountType;
          setSubIbAccountType(acc && acc !== 'SEA STD' ? acc : 'STD');
        }

        // Get templates (account types and markup links) from MIB
        // For MIB: fetch own templates
        // For Sub-IB: fetch parent's templates
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

            // If target IB does not have a valid accountType set, fallback to "STD"
            if (targetRes?.data && (!targetRes.data.accountType || targetRes.data.accountType === 'SEA STD')) {
              setSubIbAccountType('STD');
            }
          }
        }
        
        // Get parent config for comparing max values
        // Always use the logged-in user's config because the logged-in user IS the parent of targetIb
        const parentConfigSourceId = loadedProfile?.id;
        if (parentConfigSourceId) {
          const pConfigRes = await rebateApi.getConfig(parentConfigSourceId).catch(() => null);
          if (pConfigRes?.data) {
            setParentConfig(pConfigRes.data);
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
          setGlobalMarkup(initialMarkup || '0');
        }

      } catch (error) {
        console.error('Failed to load data', error);
      }
    };

    loadData();
  }, [id, user?.id]);


  const updateConfigMutation = useMutation({
    mutationFn: (assets: RebateAssetConfig[]) => rebateApi.updateConfig(id, assets),
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

  const updateAccountTypeMutation = useMutation({
    mutationFn: (newType: string) => ibApi.update(id, { accountType: newType }),
    onSuccess: (res, variables) => {
      if (res.success) {
        setSubIbAccountType(variables);
        toast.success('Cập nhật Loại tài khoản (Link) thành công');
      } else {
        toast.error(getErrorMessage((res as any).error?.code));
      }
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err.response?.data?.error?.code || 'INTERNAL_ERROR'));
    }
  });

  if (!mounted) return null;

  const parsePipsValue = (value: string) => {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const isMib = profile?.level === 0;

  const getRebateMax = (asset: AssetType) => {
    return getCombinedRebateMax(asset);
  };

  const isMibEditingLevel1 = profile?.level === 0 && targetIb?.level === 1;

  const getAddedMarkupPips = (accountTypeStr: string, links: MarkupLinkRow[]): number => {
    if (!isMibEditingLevel1) return 0; // Markup pips only added ONCE at Level 1 by MIB
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
      const activeTemplate = accountTypeTemplates.find((t: any) => t.name === profile?.accountType);
      if (activeTemplate && activeTemplate.rows) {
        const row = activeTemplate.rows.find((r: any) => r.assetType === asset);
        if (row) return Number(row.maxCeiling) || 0;
      }
      return MAX_PIPS[asset] || 0;
    }

    // For Sub-IB Level 1, 2, ...: budget available to give child is EXACTLY parent's rebatePips
    if (parentConfig?.assets) {
      const pAsset = parentConfig.assets.find(a => a.assetType === asset);
      if (pAsset) return Number(pAsset.rebatePips || 0);
    }
    return 0;
  };

  const getCombinedRebateMax = (asset: AssetType) => {
    const available = getAvailableBudget(asset);
    return available + addedMarkupPips;
  };

  const isAnyRebateInvalid = Object.values(AssetType).some(asset => parsePipsValue(rebateValues[asset] || '0') > getCombinedRebateMax(asset));
  const isFormInvalid = isAnyRebateInvalid;

  const handleSave = () => {
    const assetsToUpdate: RebateAssetConfig[] = [];

    Object.values(AssetType).forEach((asset) => {
      const rebateVal = rebateValues[asset] || '0';
      const parsedRebate = parsePipsValue(rebateVal);
      const rMax = getCombinedRebateMax(asset); // Validation limit & combined max

      assetsToUpdate.push({
        assetType: asset,
        rebateType: RebateType.STP_REBATE,
        rebatePips: parsedRebate,
        markupPips: addedMarkupPips,
        maxPips: rMax,
        markupPercent: 100,
      });
    });

    if (assetsToUpdate.length > 0) {
      setAssetsToUpdateState(assetsToUpdate);
      setIsConfirmModalOpen(true);
    }
  };

  const handleConfirmSave = async () => {
    setIsConfirmModalOpen(false);
    if (targetIb && targetIb.accountType !== subIbAccountType) {
      await updateAccountTypeMutation.mutateAsync(subIbAccountType);
    }
    if (assetsToUpdateState.length > 0) {
      updateConfigMutation.mutate(assetsToUpdateState);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <button onClick={() => router.back()} className="flex items-center text-gray-500 hover:text-gray-900 transition-colors mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
            <h1 className="text-xl font-bold text-gray-900">{targetIb?.name || '---'}</h1>
            <div className="hidden md:block w-px h-6 bg-gray-200"></div>
            <div className="flex items-center gap-2 bg-amber-50/80 px-3.5 py-1.5 rounded-full border border-amber-200/80 shadow-sm">
              <Mail className="w-4 h-4 text-amber-700" />
              <span className="text-amber-950 font-bold text-sm">{targetIb?.email || '---'}</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-gray-200"></div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">Loại tài khoản:</span>
              {isMibEditingLevel1 && markupLinks.length > 0 ? (
                <select
                  value={subIbAccountType}
                  onChange={(e) => {
                    setSaveSuccess(false);
                    setSubIbAccountType(e.target.value);
                  }}
                  className="font-bold text-gray-900 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-300 shadow-sm focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer text-sm"
                >
                  {markupLinks.map((link) => (
                    <option key={link.id || link.name} value={link.name}>
                      {link.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-semibold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg border border-gray-200 text-sm">
                  {subIbAccountType}
                </span>
              )}
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

      {/* Bảng Rebate Max */}
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
                <th className="px-6 py-4">Rebate Max của IB</th>
                <th className="px-6 py-4 w-64">Chia cho cấp dưới</th>
                <th className="px-6 py-4">Đơn vị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Object.values(AssetType).map((asset) => {
                const combinedMax = getCombinedRebateMax(asset); // Mức trần đã cộng Markup Pips
                const unit = unitMap[asset] || 'pips';
                
                const currentVal = rebateValues[asset] || '0';
                const isRebateInvalid = parsePipsValue(currentVal) > combinedMax;
                
                return (
                  <tr key={asset} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{asset}</td>
                    <td className="px-6 py-4 text-amber-950 font-bold">
                      Rebate Max: {combinedMax}
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
    </div>
  );
}
