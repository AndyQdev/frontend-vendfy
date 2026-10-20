import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/shared/api/client";
import type {
  EstadoIa,
  GenerarImagenInput,
  ImagenIa,
  Promocion,
  PromocionInput,
} from "../model/types";

/**
 * Todo lo que el panel le pide a Promociones y a las imágenes con IA.
 * Una clave de caché por tienda para cada lista; toda mutación invalida la suya.
 */

const PROMOCIONES = "promociones";
const IMAGENES_IA = "imagenes-ia";
const ESTADO_IA = "imagenes-ia-estado";

// ─────────────────────────────────────────────────────────── promociones

export function usePromociones(storeId?: string) {
  return useQuery<Promocion[]>({
    queryKey: [PROMOCIONES, storeId],
    queryFn: async () => {
      const res = await apiFetch<Promocion[]>(`/api/promotion?storeId=${storeId}`);
      return res.data ?? [];
    },
    enabled: !!storeId && storeId !== "all",
  });
}

export function useCrearPromocion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PromocionInput) => {
      const res = await apiFetch<Promocion>("/api/promotion", { method: "POST", body: input });
      return res.data as Promocion;
    },
    onSuccess: (_p, input) => qc.invalidateQueries({ queryKey: [PROMOCIONES, input.storeId] }),
  });
}

export function useEditarPromocion(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cambios }: { id: string; cambios: Partial<Omit<PromocionInput, "storeId">> }) => {
      const res = await apiFetch<Promocion>(`/api/promotion/${id}`, { method: "PATCH", body: cambios });
      return res.data as Promocion;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROMOCIONES, storeId] }),
  });
}

export function useEliminarPromocion(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/promotion/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROMOCIONES, storeId] }),
  });
}

// ─────────────────────────────────────────────────────────── imágenes con IA

export function useImagenesIa(storeId?: string) {
  return useQuery<ImagenIa[]>({
    queryKey: [IMAGENES_IA, storeId],
    queryFn: async () => {
      const res = await apiFetch<ImagenIa[]>(`/api/ai-image?storeId=${storeId}`);
      return res.data ?? [];
    },
    enabled: !!storeId && storeId !== "all",
  });
}

/** Si el servidor tiene la IA conectada y cuántas imágenes quedan hoy. */
export function useEstadoIa(storeId?: string) {
  return useQuery<EstadoIa>({
    queryKey: [ESTADO_IA, storeId],
    queryFn: async () => (await apiFetch<EstadoIa>(`/api/ai-image/status?storeId=${storeId}`)).data as EstadoIa,
    enabled: !!storeId && storeId !== "all",
    staleTime: 30_000,
  });
}

/** Tarda entre 10 y 40 segundos: la pantalla tiene que mostrarlo. */
export function useGenerarImagenIa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GenerarImagenInput) => {
      const res = await apiFetch<ImagenIa>("/api/ai-image/generate", { method: "POST", body: input });
      return res.data as ImagenIa;
    },
    onSuccess: (_i, input) => {
      qc.invalidateQueries({ queryKey: [IMAGENES_IA, input.storeId] });
      qc.invalidateQueries({ queryKey: [ESTADO_IA, input.storeId] });
    },
  });
}

export function useEliminarImagenIa(storeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/ai-image/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [IMAGENES_IA, storeId] }),
  });
}
