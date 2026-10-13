import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type { Store, StoreConfig } from "../model/types";

export function useStores() {
  return useQuery<Store[]>({
    queryKey: ["stores"],
    queryFn: async () => {
      const response = await apiFetch<Store[]>("/api/store");
      return response.data || [];
    }
  });
}

export function useStore(id?: string) {
  return useQuery<Store>({
    queryKey: ["store", id],
    queryFn: async () => {
      const response = await apiFetch<Store>(`/api/store/${id}`);
      return response.data as Store;
    },
    enabled: !!id
  });
}

export function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Store> }) => {
      const response = await apiFetch<Store>(`/api/store/${id}`, { 
        method: "PATCH", 
        body: data 
      });
      return response.data as Store;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: ["store"] });
      // La fuente del dólar vive en la configuración de la tienda.
      qc.invalidateQueries({ queryKey: ["dolar"] });
    }
  });
}

export function useCreateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; slug: string; description?: string; config?: StoreConfig }) => {
      const response = await apiFetch<Store>("/api/store", { 
        method: "POST", 
        body: data 
      });
      return response.data as Store;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stores"] })
  });
}

export function useDeleteStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/store/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stores"] })
  });
}

// Legacy exports for compatibility
export async function getStores(): Promise<Store[]> {
  const response = await apiFetch<Store[]>("/api/store", { method: "GET" });
  return response.data || [];
}

export async function getStoreById(id: string): Promise<Store> {
  const response = await apiFetch<Store>(`/api/store/${id}`, { method: "GET" });
  return response.data as Store;
}

