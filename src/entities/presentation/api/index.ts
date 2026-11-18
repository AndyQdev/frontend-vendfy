import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/shared/api/client";
import { toast } from "sonner";
import type { Presentation, PresentationInput } from "../model/types";

/** Las formas de venta activas de un producto de la tienda. */
export function usePresentations(storeProductId: string | null) {
  return useQuery<Presentation[]>({
    queryKey: ["presentations", storeProductId],
    queryFn: async () => {
      const response = await apiFetch<Presentation[]>(
        `/api/presentation/store-product/${storeProductId}`
      );
      return response.data ?? [];
    },
    enabled: Boolean(storeProductId),
  });
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>, storeProductId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["presentations", storeProductId] });
}

export function useCreatePresentation(storeProductId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PresentationInput) => {
      const response = await apiFetch<Presentation>("/api/presentation", {
        method: "POST",
        body: data,
      });
      return response.data;
    },
    onSuccess: () => {
      invalidar(queryClient, storeProductId);
      toast.success("Forma de venta creada");
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : "No se pudo crear la forma de venta");
    },
  });
}

export function useUpdatePresentation(storeProductId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PresentationInput> }) => {
      const response = await apiFetch<Presentation>(`/api/presentation/${id}`, {
        method: "PATCH",
        body: data,
      });
      return response.data;
    },
    onSuccess: () => {
      invalidar(queryClient, storeProductId);
      toast.success("Forma de venta actualizada");
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : "No se pudo actualizar la forma de venta");
    },
  });
}

export function useDeletePresentation(storeProductId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/presentation/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      invalidar(queryClient, storeProductId);
      toast.success("Forma de venta eliminada");
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : "No se pudo eliminar la forma de venta");
    },
  });
}
