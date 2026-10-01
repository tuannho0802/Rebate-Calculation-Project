import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rebateApi } from '@/lib/api/rebate';
import { productApi } from '@/lib/api/product';
import { AssetType } from '@/types';
import { toast } from 'sonner';

export function useDisabledAssetTypes() {
  const queryClient = useQueryClient();

  const { data: prodRes } = useQuery({
    queryKey: ['products', true],
    queryFn: () => productApi.getProducts(true),
    staleTime: 1000 * 60 * 2,
  });

  const { data: res, isLoading, refetch } = useQuery({
    queryKey: ['disabledAssetTypes'],
    queryFn: () => rebateApi.getDisabledAssetTypes(),
    staleTime: 1000 * 60 * 2,
  });

  const products = prodRes?.success && Array.isArray(prodRes.data) ? prodRes.data : [];
  const allSymbols = products.length > 0
    ? products.map((p) => p.symbol as AssetType)
    : Object.values(AssetType);

  const disabledAssetTypes: AssetType[] = res?.success && Array.isArray(res.data)
    ? (res.data as AssetType[])
    : products.filter((p) => !p.isActive).map((p) => p.symbol as AssetType);

  const activeAssetTypes: AssetType[] = allSymbols.filter(
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
