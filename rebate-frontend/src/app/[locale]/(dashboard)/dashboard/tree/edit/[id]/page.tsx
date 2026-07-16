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
          setSubIbAccountType(targetRes.data.accountType || 'Markup 0%');
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
          }
        }
        
        // Get parent config for comparing max values
        // For MIB: use own config
        // For Sub-IB: use parent's config
        const parentConfigSourceId = loadedProfile?.level === 0 ? loadedProfile.id : loadedProfile?.parentId;
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

  const getMarkupMax = () => {
    // For both MIB and Sub-IB, markup max comes from the template markup links
    const link = markupLinks.find(l => l.name === subIbAccountType);
    return link ? Number(link.share) : 0;
  };

  const getRebateMax = (asset: AssetType) => {
    // Get maxCeiling from account type templates (the configured max for this asset)
    // Iterate through all templates and find the row with this asset
    for (const template of accountTypeTemplates) {
      for (const row of template.rows) {
        if (row.assetType === asset) {
          return Number(row.maxCeiling) || 0;
        }
      }
    }
    // Fallback to MAX_PIPS if not found in templates
    return MAX_PIPS[asset] || 0;
  };

  const markupMax = getMarkupMax();

  const isMarkupInvalid = parsePipsValue(globalMarkup) > markupMax;
  const isAnyRebateInvalid = Object.values(AssetType).some(asset => parsePipsValue(rebateValues[asset] || '0') > getRebateMax(asset));
  const isFormInvalid = isMarkupInvalid || isAnyRebateInvalid;

  const handleSave = () => {
    const assetsToUpdate: RebateAssetConfig[] = [];
    const parsedMarkup = parsePipsValue(globalMarkup);

    Object.values(AssetType).forEach((asset) => {
      const rebateVal = rebateValues[asset] || '0';
      const parsedRebate = parsePipsValue(rebateVal);
      const rMax = getRebateMax(asset);

      assetsToUpdate.push({
        assetType: asset,
        rebateType: RebateType.STP_REBATE,
        rebatePips: parsedRebate,
        markupPips: parsedMarkup,
        maxPips: rMax,
        markupPercent: 100,
      });
    });

    if (assetsToUpdate.length > 0) {
      updateConfigMutation.mutate(assetsToUpdate);
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
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
              <Mail className="w-4 h-4 text-blue-600" />
              <span className="text-blue-700 font-semibold text-sm">{targetIb?.email || '---'}</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-gray-200"></div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">Loại tài khoản:</span>
              {markupLinks.length > 0 ? (
                <div className="relative">
                  <select
                    value={subIbAccountType}
                    onChange={(e) => updateAccountTypeMutation.mutate(e.target.value)}
                    disabled={updateAccountTypeMutation.isPending}
                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066ff] focus:border-[#0066ff] text-sm font-medium disabled:opacity-50 min-w-[140px]"
                  >
                    {markupLinks.map((link) => (
                      <option key={link.id} value={link.name}>{link.name}</option>
                    ))}
                    {!markupLinks.some(l => l.name === subIbAccountType) && (
                      <option value={subIbAccountType}>{subIbAccountType}</option>
                    )}
                  </select>
                </div>
              ) : (
                <span className="font-semibold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">{subIbAccountType}</span>
              )}
            </div>
          </div>
          
          <button
            onClick={handleSave}
            disabled={updateConfigMutation.isPending || isFormInvalid}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all shadow-md disabled:opacity-50 ${saveSuccess ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20 text-white' : 'bg-[#0066ff] hover:bg-[#0052cc] shadow-blue-500/20 text-white'}`}
          >
            {updateConfigMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {saveSuccess ? 'Đã lưu thành công' : 'Lưu Thay Đổi'}
          </button>
        </div>
      </div>

      {/* Bảng 1: Markup max */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6">
        <h3 className="font-bold text-lg text-gray-900 mb-4">Cấu hình Markup</h3>
        <div className="flex items-center gap-8 bg-blue-50/50 p-6 rounded-xl border border-blue-100">
          <div className="flex items-center gap-3">
            <span className="text-gray-600 font-medium">Markup max:</span>
            <span className="text-xl font-bold text-[#0066ff]">{markupMax}</span>
          </div>
          <div className="w-px h-8 bg-blue-200"></div>
          <div className="flex items-center gap-3 flex-1 max-w-sm">
            <label className="text-gray-600 font-medium">Chia cho cấp dưới:</label>
            <div className="flex-1 flex flex-col">
              <input
                type="text"
                value={globalMarkup}
                onChange={(e) => {
                  if (e.target.value && !/^\d*\.?\d*$/.test(e.target.value)) return;
                  setSaveSuccess(false);
                  setGlobalMarkup(e.target.value);
                }}
                placeholder="0.0"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 transition-all text-lg font-semibold ${isMarkupInvalid ? 'border-red-500 text-red-600 focus:ring-red-500 focus:border-red-500 bg-red-50' : 'border-gray-300 focus:ring-[#0066ff] focus:border-[#0066ff]'}`}
              />
              {isMarkupInvalid && <span className="text-red-500 text-xs mt-1 font-medium">Vượt quá mức cho phép ({markupMax})</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Bảng 2: Rebate Max */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-900">Cấu hình Rebate cho từng sản phẩm</h3>
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
                const rMax = getRebateMax(asset);
                const unit = unitMap[asset] || 'pips / usd';
                
                const currentVal = rebateValues[asset] || '0';
                const isRebateInvalid = parsePipsValue(currentVal) > rMax;
                
                return (
                  <tr key={asset} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{asset}</td>
                    <td className="px-6 py-4 text-[#0066ff] font-semibold">
                      Rebate Max: {rMax}
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
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-all font-medium ${isRebateInvalid ? 'border-red-500 text-red-600 focus:ring-red-500 focus:border-red-500 bg-red-50' : 'border-gray-200 focus:ring-[#0066ff]/50 focus:border-[#0066ff] bg-white'}`}
                        />
                        {isRebateInvalid && <span className="text-red-500 text-xs mt-1 font-medium">Vượt quá {rMax}</span>}
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
    </div>
  );
}
