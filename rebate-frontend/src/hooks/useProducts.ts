import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi } from '@/lib/api/product';
import { Product, CreateProductInput, UpdateProductInput } from '@/types';
import { toast } from 'sonner';

export function useProducts(includeInactive = false) {
  const queryClient = useQueryClient();

  const { data: res, isLoading, refetch } = useQuery({
    queryKey: ['products', includeInactive],
    queryFn: () => productApi.getProducts(includeInactive),
    staleTime: 1000 * 60 * 2, // 2 mins cache
  });

  const products: Product[] = res?.success && Array.isArray(res.data) ? res.data : [];
  const activeProducts: Product[] = products.filter((p) => p.isActive);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['disabledAssetTypes'] });
    queryClient.invalidateQueries({ queryKey: ['rebateConfig'] });
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateProductInput) => productApi.createProduct(input),
    onSuccess: (response) => {
      if (response.success) {
        invalidateAll();
        toast.success(`Đã thêm sản phẩm ${response.data.symbol} thành công`);
      } else {
        toast.error('Không thể tạo sản phẩm mới');
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi tạo sản phẩm';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      productApi.updateProduct(id, input),
    onSuccess: (response) => {
      if (response.success) {
        invalidateAll();
        toast.success(`Đã cập nhật sản phẩm ${response.data.symbol} thành công`);
      } else {
        toast.error('Không thể cập nhật sản phẩm');
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi cập nhật sản phẩm';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.deleteProduct(id),
    onSuccess: (response) => {
      if (response.success) {
        invalidateAll();
        toast.success('Thao tác xoá/vô hiệu hoá sản phẩm thành công');
      } else {
        toast.error('Không thể xoá sản phẩm');
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi xoá sản phẩm';
      toast.error(msg);
    },
  });

  const toggleProductActive = (product: Product) => {
    updateMutation.mutate({
      id: product.id,
      input: { isActive: !product.isActive },
    });
  };

  return {
    products,
    activeProducts,
    isLoading,
    refetch,
    createProduct: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateProduct: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteProduct: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    toggleProductActive,
  };
}
