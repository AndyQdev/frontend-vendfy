import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/shared/api/client";
import type {
  BorradorProducto,
  ConversacionGuardada,
  ConversacionResumen,
  ClienteOpcion,
  CompraRegistrada,
  FichaProducto,
  HerramientaGenerada,
  IntencionDisponible,
  LineaContexto,
  ProductoOpcion,
  Propuesta,
  TablaVista,
  VentaCobrada,
  VistaFijada,
  VistaSpec,
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

// ------------------------------------------------------------ vistas (G3)

/**
 * Los datos de UNA pieza de una vista. Cada pieza pide lo suyo y se dibuja
 * apenas llega, sin esperar a las demás. Dos piezas que leen lo mismo
 * comparten la consulta (misma clave).
 *
 * Al cambiar el período se queda el dibujo anterior, atenuado, hasta que
 * llega el nuevo: un esqueleto en cada cambio hace saltar todo el panel.
 */
export function useFuenteVista(storeId: string, fuente: string, params: Record<string, unknown>) {
  return useQuery({ ...consultaFuenteVista(storeId, fuente, params), placeholderData: keepPreviousData });
}

/**
 * La misma consulta, para leerla fuera de un componente (exportar a Excel):
 * misma clave, así que lo que ya dibujó el panel sale del caché.
 */
export function consultaFuenteVista(storeId: string, fuente: string, params: Record<string, unknown>) {
  return {
    queryKey: ["omnibox", "vista", "fuente", storeId, fuente, params],
    queryFn: async () =>
      (
        await apiFetch<TablaVista>("/api/omnibox/vista/fuente", {
          method: "POST",
          body: { storeId, fuente, params },
        })
      ).data!,
    staleTime: 60_000,
  };
}

/** La clave de la conclusión de una vista: para leerla del caché sin volver a pedírsela a la IA. */
export const claveConclusionVista = (storeId: string, pregunta: string, vista: VistaSpec) =>
  ["omnibox", "vista", "conclusion", storeId, pregunta, vista] as const;

/**
 * La conclusión: la escribe el modelo sobre los números ya calculados, y el
 * servidor descarta toda frase con una cifra que no está en los datos.
 * Cuesta una llamada a la IA: no se repite al volver a abrir la misma vista.
 */
export function useConclusionVista(storeId: string, pregunta: string, vista: VistaSpec) {
  return useQuery({
    queryKey: claveConclusionVista(storeId, pregunta, vista),
    queryFn: async () =>
      (
        await apiFetch<{ conclusion: string }>("/api/omnibox/vista/conclusion", {
          method: "POST",
          body: { storeId, pregunta, vista },
        })
      ).data?.conclusion ?? "",
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });
}

// ------------------------------------------------------------ vistas fijadas (G4)

/** El tablero de la tienda: las vistas fijadas. Sin permiso de reportes, vacío. */
export function useVistasFijadas(storeId: string | null) {
  return useQuery({
    queryKey: ["omnibox", "vistas-fijadas", storeId],
    queryFn: async () =>
      (await apiFetch<VistaFijada[]>(`/api/omnibox/vistas-fijadas?storeId=${storeId}`)).data ?? [],
    enabled: Boolean(storeId),
    staleTime: 5 * 60_000,
  });
}

export function useFijarVista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { storeId: string; nombre: string; pregunta: string; vista: VistaSpec }) =>
      (await apiFetch<VistaFijada>("/api/omnibox/vistas-fijadas", { method: "POST", body: vars })).data!,
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["omnibox", "vistas-fijadas", vars.storeId] }),
  });
}

export function useDesfijarVista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { storeId: string; id: string }) =>
      (
        await apiFetch<{ id: string }>(`/api/omnibox/vistas-fijadas/${vars.id}?storeId=${vars.storeId}`, {
          method: "DELETE",
        })
      ).data!,
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["omnibox", "vistas-fijadas", vars.storeId] }),
  });
}

// ------------------------------------------------------------ conversaciones (G5)

/** Mis conversaciones en esta tienda: las últimas, o las que coinciden con `q`. */
export function useConversaciones(storeId: string | null, q: string, activo = true) {
  return useQuery({
    queryKey: ["omnibox", "conversaciones", storeId, q],
    queryFn: async () =>
      (
        await apiFetch<ConversacionResumen[]>(
          `/api/omnibox/conversaciones?storeId=${storeId}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`,
        )
      ).data ?? [],
    enabled: Boolean(storeId) && activo,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}

/** Una conversación entera, para abrirla. */
export async function traerConversacion(storeId: string, id: string): Promise<ConversacionGuardada> {
  return (await apiFetch<ConversacionGuardada>(`/api/omnibox/conversaciones/${id}?storeId=${storeId}`)).data!;
}

/**
 * Guardar la conversación entera. `keepalive`: al cerrar la página, para que
 * el último cambio llegue igual.
 */
export async function guardarConversacion(
  storeId: string,
  id: string,
  cuerpo: { mensajes: unknown[]; mesa: unknown },
  keepalive = false,
): Promise<ConversacionResumen> {
  return (
    await apiFetch<ConversacionResumen>(`/api/omnibox/conversaciones/${id}`, {
      method: "PUT",
      body: { storeId, ...cuerpo },
      keepalive,
    })
  ).data!;
}

export function useRenombrarConversacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { storeId: string; id: string; titulo: string }) =>
      (
        await apiFetch<ConversacionResumen>(`/api/omnibox/conversaciones/${vars.id}`, {
          method: "PATCH",
          body: { storeId: vars.storeId, titulo: vars.titulo },
        })
      ).data!,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["omnibox", "conversaciones"] }),
  });
}

export function useBorrarConversacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { storeId: string; id: string }) =>
      (await apiFetch<{ id: string }>(`/api/omnibox/conversaciones/${vars.id}?storeId=${vars.storeId}`, { method: "DELETE" })).data!,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["omnibox", "conversaciones"] }),
  });
}

// ------------------------------------------------------------ herramientas a medida (G6)

/**
 * Armar una herramienta: el servidor elige los datos, el modelo escribe el
 * componente y se revisa y compila allá. Tarda (30 a 90 s). Sin reintentos
 * automáticos: cada intento es una llamada al modelo más caro.
 */
export function useGenerarHerramienta() {
  return useMutation({
    mutationFn: async (vars: { storeId: string; pregunta: string }) =>
      (await apiFetch<HerramientaGenerada>("/api/omnibox/herramienta", { method: "POST", body: vars })).data!,
    retry: false,
  });
}

/** Se rompió al dibujarse: el error vuelve al modelo una vez, con los mismos datos. */
export function useCorregirHerramienta() {
  return useMutation({
    mutationFn: async (vars: {
      storeId: string;
      pregunta: string;
      plan: HerramientaGenerada["plan"];
      tsx: string;
      error: string;
      datos: HerramientaGenerada["datos"];
    }) =>
      (await apiFetch<{ tsx: string; codigo: string }>("/api/omnibox/herramienta/corregir", { method: "POST", body: vars }))
        .data!,
    retry: false,
  });
}

/** Lo que propuso una herramienta, ya confirmado: todos los precios o ninguno. */
export function useCambiarPrecios() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { storeId: string; cambios: { productId: string; precio: number }[] }) =>
      (await apiFetch<{ resumen: string; datos: { cambiados: number } }>("/api/omnibox/precios", { method: "POST", body: vars }))
        .data!,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["omnibox", "ficha"] });
      qc.invalidateQueries({ queryKey: ["omnibox", "productos"] });
      qc.invalidateQueries({ queryKey: ["omnibox", "vista"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

/**
 * Con dos José, el análisis queda esperando a cuál (G6b): al elegir, el
 * servidor le pone ese filtro a TODAS las piezas y lo vuelve a validar.
 */
export function useFiltrarVista() {
  return useMutation({
    mutationFn: async (vars: { storeId: string; vista: VistaSpec; tipo: "cliente" | "producto" | "categoria"; id: string }) =>
      (await apiFetch<VistaSpec>("/api/omnibox/vista/filtrar", { method: "POST", body: vars })).data!,
    retry: false,
  });
}

// ------------------------------------------------------------ productos y pedidos desde el chat (G7)

/** Lo que se creó: con la forma de un producto del catálogo, para cargarlo a la compra. */
export type ProductoCreado = ProductoOpcion & { compra: BorradorProducto["compra"]; venta?: BorradorProducto["venta"] };

function invalidarProductos(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["omnibox", "ficha"] });
  qc.invalidateQueries({ queryKey: ["omnibox", "productos"] });
  qc.invalidateQueries({ queryKey: ["omnibox", "vista"] });
  qc.invalidateQueries({ queryKey: ["omnibox", "categorias"] });
  qc.invalidateQueries({ queryKey: ["products"] });
}

/** Crear los productos del formulario del chat (G7a). El servidor vuelve a validar todo. */
export function useCrearProductos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { storeId: string; productos: BorradorProducto[] }) =>
      (await apiFetch<{ resumen: string; creados: ProductoCreado[] }>("/api/omnibox/productos", { method: "POST", body: vars })).data!,
    onSuccess: () => invalidarProductos(qc),
  });
}

/** Las categorías de la tienda, para elegir en el formulario de productos. */
export function useCategoriasAsistente(storeId: string | null) {
  return useQuery({
    queryKey: ["omnibox", "categorias", storeId],
    enabled: Boolean(storeId),
    staleTime: 60_000,
    queryFn: async () =>
      (await apiFetch<{ id: string; nombre: string; productos: number }[]>(`/api/omnibox/categorias?storeId=${storeId}`)).data ?? [],
  });
}

/** Cambiar un producto (ya confirmado en la tarjeta): solo los campos que cambian. */
export function useCambiarProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { storeId: string; productId: string; cambios: Record<string, unknown> }) =>
      (
        await apiFetch<{ resumen: string }>(`/api/omnibox/producto/${vars.productId}/cambiar`, {
          method: "POST",
          body: { storeId: vars.storeId, cambios: vars.cambios },
        })
      ).data!,
    onSuccess: () => invalidarProductos(qc),
  });
}

/** Dar de baja un producto (ya confirmado). */
export function useBajaProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { storeId: string; productId: string }) =>
      (await apiFetch<{ resumen: string }>(`/api/omnibox/producto/${vars.productId}/baja`, { method: "POST", body: { storeId: vars.storeId } }))
        .data!,
    onSuccess: () => invalidarProductos(qc),
  });
}

/** Pasar un pedido a otro estado (ya confirmado): el mismo camino que la pantalla de Pedidos. */
export function useEstadoPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { storeId: string; orderId: string; estado: string }) =>
      (
        await apiFetch<{ resumen: string }>(`/api/omnibox/pedido/${vars.orderId}/estado`, {
          method: "POST",
          body: { storeId: vars.storeId, estado: vars.estado },
        })
      ).data!,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["omnibox", "vista"] });
    },
  });
}
