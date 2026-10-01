import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type {
  CreateAuctionInput,
  CreateLiveInput,
  LiveAccount,
  LiveAuction,
  LiveItem,
  LiveSession,
  LiveSessionDetail,
  PostorEnCola,
  ProductoReutilizable,
  QuickItemInput,
} from "../model/types";

/**
 * Todo lo que el panel le pide al Modo Live.
 *
 * Una sola clave de caché por Live (`["live", id]`) y otra para la lista.
 * Casi toda mutación invalida las dos, porque agregar una prenda cambia el
 * detalle y también el contador que se ve en el listado.
 */

const LIVES = "lives";
const LIVE = "live";

// ─────────────────────────────────────────────────────────── sesiones

export function useLives(params: {
  storeId?: string;
  status?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const qs = new URLSearchParams();
  if (params.storeId && params.storeId !== "all") qs.append("storeId", params.storeId);
  if (params.status) qs.append("status", params.status);
  if (params.limit) qs.append("limit", String(params.limit));
  if (params.offset) qs.append("offset", String(params.offset));

  return useQuery({
    queryKey: [LIVES, params],
    queryFn: async () => {
      const res = await apiFetch<LiveSession[]>(`/api/live?${qs.toString()}`);
      return { data: res.data ?? [], countData: res.countData ?? 0 };
    },
  });
}

export function useLive(id?: string, opciones: { refrescarCada?: number } = {}) {
  return useQuery<LiveSessionDetail>({
    queryKey: [LIVE, id],
    queryFn: async () => {
      const res = await apiFetch<LiveSessionDetail>(`/api/live/${id}`);
      return res.data as LiveSessionDetail;
    },
    enabled: !!id,
    // Durante la transmisión conviene refrescar: el stock se mueve por la caja
    // y por los compradores, no solo por lo que hace esta pantalla.
    refetchInterval: opciones.refrescarCada,
  });
}

export function useCreateLive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLiveInput) => {
      const res = await apiFetch<LiveSession>("/api/live", { method: "POST", body: input });
      return res.data as LiveSession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIVES] }),
  });
}

export function useUpdateLive(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CreateLiveInput>) => {
      const res = await apiFetch<LiveSession>(`/api/live/${id}`, { method: "PATCH", body: input });
      return res.data as LiveSession;
    },
    onSuccess: () => invalidar(qc, id),
  });
}

/** start / finish / cancel: los tres cambian el estado y refrescan lo mismo. */
function useAccionDeLive(accion: "start" | "finish" | "cancel", id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch<LiveSession>(`/api/live/${id}/${accion}`, { method: "POST" });
      return res.data as LiveSession;
    },
    onSuccess: () => invalidar(qc, id),
  });
}

export const useStartLive = (id?: string) => useAccionDeLive("start", id);
export const useFinishLive = (id?: string) => useAccionDeLive("finish", id);
export const useCancelLive = (id?: string) => useAccionDeLive("cancel", id);

// ─────────────────────────────────────────────────────────── prendas

export function useAddLiveItems(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (storeProductIds: string[]) => {
      const res = await apiFetch<LiveItem[]>(`/api/live/${id}/items`, {
        method: "POST",
        body: { storeProductIds },
      });
      return res.data ?? [];
    },
    onSuccess: () => invalidar(qc, id),
  });
}

export function useQuickAddItem(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: QuickItemInput) => {
      const res = await apiFetch<LiveItem>(`/api/live/${id}/items/quick`, {
        method: "POST",
        body: input,
      });
      return res.data as LiveItem;
    },
    onSuccess: () => {
      invalidar(qc, id);
      // El alta rápida crea un producto de verdad: la lista de productos y el
      // inventario dejan de estar al día.
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useUpdateLiveItem(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { itemId: string; sortOrder?: number; featured?: boolean }) => {
      const { itemId, ...body } = vars;
      const res = await apiFetch<LiveItem>(`/api/live/${id}/items/${itemId}`, {
        method: "PATCH",
        body,
      });
      return res.data as LiveItem;
    },
    onSuccess: () => invalidar(qc, id),
  });
}

/** Corregir nombre, precio o foto de una prenda sin salir del Live. */
export function useEditarPrenda(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      itemId: string;
      name?: string;
      price?: number;
      imageUrl?: string;
    }) => {
      const { itemId, ...body } = vars;
      const res = await apiFetch<LiveItem>(`/api/live/${id}/items/${itemId}/product`, {
        method: "PATCH",
        body,
      });
      return res.data as LiveItem;
    },
    onSuccess: () => {
      invalidar(qc, id);
      // Cambia el producto de verdad, no solo su ficha en el Live.
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

/**
 * Borrar el producto, no solo sacarlo del Live.
 *
 * `useRemoveLiveItem` lo deja disponible para la próxima transmisión; esto lo
 * da de baja del inventario. Es para lo que se cargó por error.
 */
export function useEliminarProducto(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      await apiFetch(`/api/live/${id}/items/${itemId}/product`, { method: "DELETE" });
    },
    onSuccess: () => {
      invalidar(qc, id);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useRemoveLiveItem(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiFetch<LiveItem>(`/api/live/${id}/items/${itemId}`, {
        method: "DELETE",
      });
      return res.data as LiveItem;
    },
    onSuccess: () => invalidar(qc, id),
  });
}

/** Lo que sobró de Lives anteriores y todavía tiene stock. */
export function useProductosReutilizables(storeId?: string, excluirLiveId?: string) {
  const qs = new URLSearchParams();
  if (storeId) qs.append("storeId", storeId);
  if (excluirLiveId) qs.append("excludeSessionId", excluirLiveId);

  return useQuery<ProductoReutilizable[]>({
    queryKey: ["live-reutilizables", storeId, excluirLiveId],
    queryFn: async () => {
      const res = await apiFetch<ProductoReutilizable[]>(
        `/api/live/available-products?${qs.toString()}`,
      );
      return res.data ?? [];
    },
    enabled: !!storeId && storeId !== "all",
  });
}

// ─────────────────────────────────────────────────────────── subastas

export function usePrepararSubasta(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { itemId: string } & CreateAuctionInput) => {
      const { itemId, ...body } = vars;
      const res = await apiFetch<LiveAuction>(`/api/live/${id}/items/${itemId}/auction`, {
        method: "POST",
        body,
      });
      return res.data as LiveAuction;
    },
    onSuccess: () => invalidar(qc, id),
  });
}

function useAccionDeSubasta(accion: "open" | "close" | "cancel", id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (auctionId: string) => {
      const res = await apiFetch<LiveAuction>(
        `/api/live/${id}/auctions/${auctionId}/${accion}`,
        { method: "POST" },
      );
      return res.data as LiveAuction;
    },
    onSuccess: () => invalidar(qc, id),
  });
}

export const useAbrirSubasta = (id?: string) => useAccionDeSubasta("open", id);
export const useCerrarSubasta = (id?: string) => useAccionDeSubasta("close", id);
export const useCancelarSubasta = (id?: string) => useAccionDeSubasta("cancel", id);

/** La cola de postores. Con teléfonos: es la pantalla para llamar al siguiente. */
export function useColaDePostores(
  id?: string,
  auctionId?: string,
  opciones: { refrescarCada?: number } = {},
) {
  return useQuery<PostorEnCola[]>({
    queryKey: ["live-cola", id, auctionId],
    queryFn: async () => {
      const res = await apiFetch<PostorEnCola[]>(
        `/api/live/${id}/auctions/${auctionId}/queue`,
      );
      return res.data ?? [];
    },
    enabled: !!id && !!auctionId,
    refetchInterval: opciones.refrescarCada,
  });
}

/** El premiado no contestó: se le ofrece al siguiente, a SU monto. */
export function usePasarAlSiguiente(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (auctionId: string) => {
      const res = await apiFetch<PostorEnCola[]>(
        `/api/live/${id}/auctions/${auctionId}/next`,
        { method: "POST" },
      );
      return res.data ?? [];
    },
    onSuccess: () => {
      invalidar(qc, id);
      qc.invalidateQueries({ queryKey: ["live-cola"] });
    },
  });
}

export function usePremiarPuja(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { auctionId: string; bidId: string }) => {
      const res = await apiFetch<PostorEnCola[]>(
        `/api/live/${id}/auctions/${vars.auctionId}/award/${vars.bidId}`,
        { method: "POST" },
      );
      return res.data ?? [];
    },
    onSuccess: () => {
      invalidar(qc, id);
      qc.invalidateQueries({ queryKey: ["live-cola"] });
    },
  });
}

// ─────────────────────────────────────────────────────────── cuentas

/** Lo que cada cliente se lleva. Es lo que el vendedor mira para cobrar. */
export function useCuentasDelLive(id?: string, opciones: { refrescarCada?: number } = {}) {
  return useQuery<LiveAccount[]>({
    queryKey: ["live-cuentas", id],
    queryFn: async () => {
      const res = await apiFetch<LiveAccount[]>(`/api/live/${id}/accounts`);
      return res.data ?? [];
    },
    enabled: !!id,
    refetchInterval: opciones.refrescarCada,
  });
}

// ─────────────────────────────────────────────────────────── interno

function invalidar(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: [LIVE, id] });
  qc.invalidateQueries({ queryKey: [LIVES] });
  qc.invalidateQueries({ queryKey: ["live-cuentas", id] });
  qc.invalidateQueries({ queryKey: ["live-reutilizables"] });
}
