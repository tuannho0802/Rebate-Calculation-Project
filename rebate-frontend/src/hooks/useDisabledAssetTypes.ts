import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rebateApi } from '@/lib/api/rebate';
import { AssetType } from '@/types';
import { toast } from 'sonner';

const ALL_ASSET_TYPES = Object.values(AssetType);

export function useDisabledAssetTypes() {
  const queryClient = useQueryClient();

  const { data: res, isLoading, refetch } = useQuery({
    queryKey: ['disabledAssetTypes'],
    queryFn: () => rebateApi.getDisabledAssetTypes(),
    staleTime: 1000 * 60 * 5, // 5 mins cache
  });

  const disabledAssetTypes: AssetType[] = res?.success && Array.isArray(res.data) ? res.data : [];

  const activeAssetTypes: AssetType[] = ALL_ASSET_TYPES.filter(
    (asset) => !disabledAssetTypes.includes(asset),
  );

  const isLocked = (assetType: AssetType): boolean => {
    return disabledAssetTypes.includes(assetType);
  };

  const updateMutation = useMutation({
    mutationFn: (newDisabledList: AssetType[]) => rebateApi.updateDisabledAssetTypes(newDisabledList),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.setQueryData(['disabledAssetTypes'], response);
        queryClient.invalidateQueries({ queryKey: ['disabledAssetTypes'] });
      } else {
        toast.error('Không thể cập nhật trạng thái khoá sản phẩm');
      }
    },
    onError: () => {
      toast.error('Lỗi khi cập nhật trạng thái khoá sản phẩm');
    },
  });

  const toggleLock = (assetType: AssetType) => {
    const isCurrentlyLocked = disabledAssetTypes.includes(assetType);
    const updated = isCurrentlyLocked
      ? disabledAssetTypes.filter((a) => a !== assetType)
      : [...disabledAssetTypes, assetType];

    updateMutation.mutate(updated, {
      onSuccess: () => {
        if (isCurrentlyLocked) {
          toast.success(`Đã mở khoá sản phẩm ${assetType}`);
        } else {
          toast.success(`Đã khoá sản phẩm ${assetType}`);
        }
      },
    });
  };

  return {
    disabledAssetTypes,
    activeAssetTypes,
    isLocked,
    toggleLock,
    isUpdating: updateMutation.isPending,
    isLoading,
    refetch,
  };
}
