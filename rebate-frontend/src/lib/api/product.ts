import { ApiResponse, Product, CreateProductInput, UpdateProductInput } from '@/types';
import { apiClient } from './client';

export const productApi = {
  getProducts: async (includeInactive = false): Promise<ApiResponse<Product[]>> => {
    const query = includeInactive ? '?includeInactive=true' : '';
    const response = await apiClient.get<ApiResponse<Product[]>>(`/products${query}`);
    return response.data;
  },

  getProduct: async (id: string): Promise<ApiResponse<Product>> => {
    const response = await apiClient.get<ApiResponse<Product>>(`/products/${id}`);
    return response.data;
  },

  createProduct: async (input: CreateProductInput): Promise<ApiResponse<Product>> => {
    const response = await apiClient.post<ApiResponse<Product>>('/products', input);
    return response.data;
  },

  updateProduct: async (id: string, input: UpdateProductInput): Promise<ApiResponse<Product>> => {
    const response = await apiClient.patch<ApiResponse<Product>>(`/products/${id}`, input);
    return response.data;
  },

  deleteProduct: async (id: string): Promise<ApiResponse<{ id: string; deleted?: boolean; isActive?: boolean }>> => {
    const response = await apiClient.delete<ApiResponse<{ id: string; deleted?: boolean; isActive?: boolean }>>(`/products/${id}`);
    return response.data;
  },
};
