import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type { Product, ProductsResponse, ProductQueryParams, Category, Brand } from "../model/types";
import type { ProductInput } from "../model/schema";
import type { EnriquecimientoIa, ResultadoEscaneo } from "../model/escaneo";
import { markOnboardingStep, ONBOARDING_STEPS } from "@/entities/user/api/onboarding";

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
  if (params.storeId && params.storeId !== 'all') queryParams.append('storeId', params.storeId);

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

/**
 * Busca un código escaneado. Es una clave exacta con índice: no busca
 * parecidos, así que es rápido aunque el comercio tenga miles de productos.
 */
export async function buscarPorCodigo(codigo: string, signal?: AbortSignal): Promise<ResultadoEscaneo> {
  const response = await apiFetch<ResultadoEscaneo>(
    `/api/product/scan?codigo=${encodeURIComponent(codigo)}`,
    { signal },
  );
  return response.data as ResultadoEscaneo;
}

export const claveEscaneo = (codigo: string) => ["product-scan", codigo] as const;
export const claveEscaneoIa = (codigo: string) => ["product-scan-ia", codigo] as const;

/** Cómo va la foto y la ficha que la IA arma para un código. */
export async function estadoIa(codigo: string, signal?: AbortSignal): Promise<EnriquecimientoIa> {
  const response = await apiFetch<EnriquecimientoIa>(
    `/api/product/scan/ia?codigo=${encodeURIComponent(codigo)}`,
    { signal },
  );
  return response.data as EnriquecimientoIa;
}

/** Sube una foto de producto (queda en WebP en Storage) y devuelve su URL. */
export async function subirFotoProducto(archivo: File): Promise<string> {
  const datos = new FormData();
  datos.append("image", archivo);
  const response = await apiFetch<{ url: string }>("/api/product/upload-image", { method: "POST", body: datos });
  return response.data!.url;
}

/** Foto profesional a partir de la que subió el comercio. Tarda 10-30 s. */
export async function mejorarFotoConIa(params: { imagenUrl: string; codigo?: string; nombre?: string }): Promise<string> {
  const response = await apiFetch<{ imagenUrl: string }>("/api/product/scan/ia/mejorar", { method: "POST", body: params });
  return response.data!.imagenUrl;
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      markOnboardingStep(ONBOARDING_STEPS.FIRST_PRODUCT);
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductInput> }) => {
      const response = await apiFetch<Product>(`/api/product/${id}`, { method: "PATCH", body: data });
      return response.data as Product;
    },
    // La ficha vive en ["product", id] y la lista en ["products"]: son claves
    // distintas, asi que invalidar solo la lista dejaba la ficha con los datos
    // viejos. Al volver a abrir el producto recien editado se veia la imagen
    // anterior hasta que la consulta terminara de refrescar.
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", variables.id] });
    },
  });
}

/**
 * Cambiar una de las banderas por tienda de un producto.
 *
 * `visibleOnWeb` (se muestra en la tienda online) y `sellWithoutStock` (se
 * puede pedir sin stock) viven las dos en la pivote `store_product`, igual que
 * el precio: sin decir de qué tienda no significan nada. Por eso `storeId` no
 * es opcional acá aunque lo sea en el PATCH.
 */
export function useSetProductStoreFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      storeId,
      campo,
      valor,
    }: {
      id: string;
      storeId: string;
      campo: "visibleOnWeb" | "sellWithoutStock";
      valor: boolean;
    }) => {
      const response = await apiFetch<Product>(`/api/product/${id}`, {
        method: "PATCH",
        body: { storeId, [campo]: valor },
      });
      return response.data as Product;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      // El listado de inventario muestra los mismos productos.
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
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
    mutationFn: async (data: { name: string; description?: string; icon?: string | null; imageUrl?: string | null; userId: string }) => {
      const response = await apiFetch<Category>("/api/category", { method: "POST", body: data });
      return response.data as Category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] })
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; icon?: string | null; imageUrl?: string | null } }) => {
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

