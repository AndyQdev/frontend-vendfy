import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/shared/api/client";
import type {
  ClienteOpcion,
  CompraRegistrada,
  FichaProducto,
  IntencionDisponible,
  LineaContexto,
  Propuesta,
  VentaCobrada,
} from "../model/types";

export interface RespuestaVoz {
  transcripcion: { texto: string; motor: string; ms: number };
  /** null si no se entendió nada: no hay nada que proponer sobre silencio. */
  propuesta: Propuesta | null;
}

export function useIntenciones() {
  return useQuery({
    queryKey: ["omnibox", "intenciones"],
    queryFn: async () =>
      (await apiFetch<IntencionDisponible[]>("/api/omnibox/intenciones")).data,
    // El catálogo sale del código del backend: solo cambia con un despliegue.
    staleTime: Infinity,
  });
}

export function useInterpretar() {
  return useMutation({
    mutationFn: async (vars: {
      texto: string;
      storeId: string;
      /** La venta abierta: sin ella, "que sean 3" no significa nada. */
      contexto?: { venta: { lineas: LineaContexto[] } };
    }) =>
      (
        await apiFetch<Propuesta>("/api/omnibox/interpretar", {
          method: "POST",
          body: vars,
        })
      ).data,
  });
}

export function useConfirmar() {
  return useMutation({
    mutationFn: async (vars: {
      intencion: string;
      entidades: Record<string, unknown>;
      storeId: string;
    }) =>
      (
        await apiFetch<{ resumen: string; datos?: any }>("/api/omnibox/confirmar", {
          method: "POST",
          body: vars,
        })
      ).data,
  });
}

/**
 * ¿El servidor puede transcribir?
 *
 * Si no hay motor configurado, el panel no muestra el micrófono. Un botón que
 * no va a funcionar es peor que no tenerlo.
 */
export function useEstadoVoz() {
  return useQuery({
    queryKey: ["omnibox", "voz"],
    queryFn: async () =>
      (
        await apiFetch<{ disponible: boolean; motor: string | null }>(
          "/api/omnibox/voz/estado",
        )
      ).data,
    staleTime: Infinity,
  });
}

/**
 * Dicta y propone en UNA llamada.
 *
 * Transcribir e interpretar por separado haría esperar dos veces por lo que
 * para quien dicta es un solo gesto.
 */
export function useDictar() {
  return useMutation({
    mutationFn: async (vars: {
      audio: Blob;
      storeId: string;
      contexto?: { venta: { lineas: LineaContexto[] } };
    }) => {
      const forma = new FormData();
      // El nombre importa: sin extensión, algunos servidores no infieren el
      // tipo y el backend rechaza el formato.
      const extension = vars.audio.type.includes("mp4") ? "m4a" : "webm";
      forma.append("audio", vars.audio, `dictado.${extension}`);
      forma.append("storeId", vars.storeId);
      // En multipart no viajan objetos: va como JSON.
      if (vars.contexto) forma.append("contexto", JSON.stringify(vars.contexto));
      return (await apiFetch<RespuestaVoz>("/api/omnibox/voz", {
        method: "POST",
        body: forma,
      })).data;
    },
  });
}

/**
 * La ficha de un producto para el panel. Se cachea un minuto: ir y volver
 * entre dos productos no debe pedir lo mismo cada vez, pero el stock cambia.
 */
export function useFichaProducto(productId: string | undefined, storeId: string) {
  return useQuery({
    queryKey: ["omnibox", "ficha", storeId, productId],
    queryFn: async () =>
      (await apiFetch<FichaProducto>(`/api/omnibox/producto/${productId}?storeId=${storeId}`)).data!,
    enabled: Boolean(productId),
    staleTime: 60_000,
  });
}

/** Clientes parecidos a lo escrito. Sin texto: los que compraron hace menos. */
export function useClientes(storeId: string, q: string, activo = true) {
  return useQuery({
    queryKey: ["omnibox", "clientes", storeId, q],
    queryFn: async () =>
      (
        await apiFetch<ClienteOpcion[]>(
          `/api/omnibox/clientes?storeId=${storeId}&q=${encodeURIComponent(q)}`,
        )
      ).data ?? [],
    enabled: activo,
    staleTime: 30_000,
  });
}

/**
 * Cobrar la venta del panel. Al terminar, las fichas y las búsquedas quedan
 * viejas (cambió el stock): se invalidan para que el próximo vistazo sea real.
 */
export function useCobrar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      storeId: string;
      lineas: { storeProductId: string; cantidad: number; precio: number }[];
      clienteId: string | null;
      pago: "efectivo" | "qr" | "tarjeta";
    }) => (await apiFetch<VentaCobrada>("/api/omnibox/cobrar", { method: "POST", body: vars })).data!,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["omnibox", "ficha"] });
      qc.invalidateQueries({ queryKey: ["omnibox", "productos"] });
      qc.invalidateQueries({ queryKey: ["omnibox", "clientes"] });
    },
  });
}

export function useAnularVenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { orderId: string; storeId: string }) =>
      (
        await apiFetch<{ orderId: string; numero: number; yaEstaba: boolean }>(
          `/api/omnibox/ventas/${vars.orderId}/anular`,
          { method: "POST", body: { storeId: vars.storeId } },
        )
      ).data!,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["omnibox", "ficha"] });
      qc.invalidateQueries({ queryKey: ["omnibox", "productos"] });
    },
  });
}

/**
 * Registrar la compra del panel: la misma orden que la pantalla de Compras,
 * creada y confirmada. Sube el stock y cambia el costo: se invalida todo lo
 * que lo muestra.
 */
export function useRegistrarCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      storeId: string;
      lineas: { productId: string; cantidad: number; costo: number }[];
      proveedor?: string;
      referencia?: string;
      adjunto?: string;
    }) => (await apiFetch<CompraRegistrada>("/api/omnibox/compras", { method: "POST", body: vars })).data!,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["omnibox", "ficha"] });
      qc.invalidateQueries({ queryKey: ["omnibox", "productos"] });
    },
  });
}

/**
 * Leer la factura del proveedor desde una foto o un PDF. Devuelve la compra
 * armada como una propuesta más ("compré…"), con cada renglón cruzado con el
 * catálogo. No registra nada.
 */
export function useLeerFactura() {
  return useMutation({
    mutationFn: async (vars: { archivo: File; storeId: string }) => {
      const forma = new FormData();
      forma.append("foto", vars.archivo, vars.archivo.name || "factura.jpg");
      forma.append("storeId", vars.storeId);
      return (await apiFetch<Propuesta>("/api/omnibox/factura", { method: "POST", body: forma })).data!;
    },
  });
}

/**
 * Dar de alta un producto que llegó en la factura y no existe, sin salir del
 * chat: nombre y precio de venta. Lo demás (fotos, categoría) se completa
 * después en Productos. Crea el mismo producto que la pantalla de alta, con
 * stock en cero: el stock lo sube la compra.
 */
export function useCrearProductoRapido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { storeId: string; nombre: string; precio: number }) =>
      (
        await apiFetch<{ id: string; name: string }>("/api/product", {
          method: "POST",
          body: { storeId: vars.storeId, name: vars.nombre, price: vars.precio },
        })
      ).data!,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["omnibox", "productos"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
