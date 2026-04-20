import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type { Product, ProductsResponse, ProductQueryParams, Category, Brand } from "../model/types";
import type { ProductInput } from "../model/schema";

export function useProducts(params: ProductQueryParams = {}) {
  const queryParams = new URLSearchParams();
  
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());
  if (params.order) queryParams.append('order', params.order);
  if (params.attr && params.value) {
    queryParams.append('attr', params.attr);
    queryParams.append('value', params.value);
  }
  if (params.categoryId) queryParams.append('categoryId', params.categoryId);
  if (params.brandId) queryParams.append('brandId', params.brandId);

  return useQuery<ProductsResponse>({
    queryKey: ["products", params],
    queryFn: async () => {
      const response = await apiFetch<Product[]>(`/api/product?${queryParams.toString()}`);
      return {
        statusCode: response.statusCode,
        data: response.data || [],
        countData: response.countData || 0
      };
    }
  });
}

export function useProduct(id: string | undefined) {
  return useQuery<Product>({
    queryKey: ["product", id],
    queryFn: async () => {
      if (!id) throw new Error("Product ID is required");
      const response = await apiFetch<Product>(`/api/product/${id}`);
      return response.data as Product;
    },
    enabled: !!id, // Solo ejecuta la query si hay un ID
  });
}

export function useCategories(storeId?: string) {
  const queryParams = new URLSearchParams();
  if (storeId && storeId !== 'all') {
    queryParams.append('storeId', storeId);
  }

  return useQuery<Category[]>({
    queryKey: ["categories", storeId],
    queryFn: async () => {
      const url = queryParams.toString() 
        ? `/api/category?${queryParams.toString()}` 
        : '/api/category';
      const response = await apiFetch<Category[]>(url);
      return response.data || [];
    }
  });
}

export function useBrands() {
  return useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: async () => {
      const response = await apiFetch<Brand[]>('/api/brand');
      return response.data || [];
    }
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ProductInput) => {
      const response = await apiFetch<Product>("/api/product", { method: "POST", body: data });
      return response.data as Product;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] })
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductInput> }) => {
      const response = await apiFetch<Product>(`/api/product/${id}`, { method: "PATCH", body: data });
      return response.data as Product;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] })
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/product/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] })
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; icon?: string | null; userId: string }) => {
      const response = await apiFetch<Category>("/api/category", { method: "POST", body: data });
      return response.data as Category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] })
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; icon?: string | null } }) => {
      const response = await apiFetch<Category>(`/api/category/${id}`, { method: "PATCH", body: data });
      return response.data as Category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] })
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/category/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] })
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; userId: string }) => {
      const response = await apiFetch<Brand>("/api/brand", { method: "POST", body: data });
      return response.data as Brand;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] })
  });
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string } }) => {
      const response = await apiFetch<Brand>(`/api/brand/${id}`, { method: "PATCH", body: data });
      return response.data as Brand;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] })
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/brand/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] })
  });
}

