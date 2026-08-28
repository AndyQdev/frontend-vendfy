import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type { Presentation, PresentationInput } from "../model/types";

const clave = (storeProductId?: string | null) => [
  "presentations",
  storeProductId,
];

/**
 * Formas de venta de un producto en una tienda.
 *
 * El listado es público en el backend porque lo consumen la tienda web y los
 * storefronts hechos por MCP; acá se usa el mismo endpoint para el panel.
 */
export function usePresentations(storeProductId?: string | null) {
  return useQuery<Presentation[]>({
    queryKey: clave(storeProductId),
    queryFn: async () => {
      const response = await apiFetch<Presentation[]>(
        `/api/presentation/store-product/${storeProductId}`,
      );
      return response.data || [];
    },
    enabled: !!storeProductId,
  });
}

export function useCreatePresentation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: PresentationInput) => {
      const response = await apiFetch<Presentation>("/api/presentation", {
        method: "POST",
        body: data,
      });
      return response.data as Presentation;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: clave(vars.storeProductId) }),
  });
}

export function useUpdatePresentation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<PresentationInput>;
      storeProductId: string;
    }) => {
      const response = await apiFetch<Presentation>(`/api/presentation/${id}`, {
        method: "PATCH",
        body: data,
      });
      return response.data as Presentation;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: clave(vars.storeProductId) }),
  });
}

/**
 * Baja lógica: los pedidos viejos siguen apuntando a la presentación, y si
 * desapareciera el historial no podría explicar qué se vendió.
 */
export function useRemovePresentation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; storeProductId: string }) => {
      await apiFetch(`/api/presentation/${id}`, { method: "DELETE" });
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: clave(vars.storeProductId) }),
  });
}
