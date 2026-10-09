import type { Mensaje } from "./mensaje";
import { COMPRA_VACIA, MESA_INICIAL, VENTA_VACIA, type Mesa } from "./mesa";

/**
 * Las conversaciones guardadas (Fase G5), del lado de la pantalla: qué se
 * guarda de cada mensaje y de la mesa, cómo se vuelve a armar al abrirla, y
 * cómo se agrupa la lista.
 *
 * Se guarda TODO junto (mensajes + mesa) para volver exactamente a donde se
 * estaba: la venta a medio armar, el análisis abierto. Lo que solo vive en
 * esta pestaña (la foto local de una factura, una respuesta que no llegó) se
 * convierte en algo que tenga sentido al abrirlo otro día.
 *
 * Puro: se prueba en e2e/logic/conversacion.spec.ts.
 */

/** Cuánto se espera sin cambios antes de guardar: no se guarda en cada tecla. */
export const ESPERA_GUARDADO = 700;

export const SIN_RESPUESTA = "No llegó la respuesta: la página se cerró o se recargó antes. Probá de nuevo.";
export const HERRAMIENTA_CORTADA = "Se cortó mientras se armaba: la página se cerró o se recargó. Pedila de nuevo.";

/**
 * Lo que estaba en camino no va a llegar a la conversación guardada: una
 * herramienta a medio armar queda como error, y unos precios a medio aplicar
 * vuelven a esperar confirmación (aplicarlos de nuevo deja el mismo precio).
 */
function sinLoQueEstabaEnCamino(m: Record<string, any>): Record<string, unknown> {
  const fuera: Record<string, unknown> = {};
  if (m.herramienta?.fase === "armando") fuera.herramienta = { fase: "error", error: HERRAMIENTA_CORTADA };
  if (m.precios?.estado === "aplicando") fuera.precios = { ...m.precios, estado: "pendiente" };
  return fuera;
}

/** Un mensaje como se guarda: fechas en texto, sin direcciones locales. */
export function serializarMensajes(mensajes: Mensaje[]): Record<string, unknown>[] {
  return mensajes.map((m) => {
    const base: Record<string, unknown> = {
      ...m,
      hora: m.hora instanceof Date ? m.hora.toISOString() : String(m.hora),
    };
    // Lo que estaba pensando no va a llegar a esta conversación guardada.
    if (m.fase === "pensando") {
      base.fase = "error";
      base.error = SIN_RESPUESTA;
    }
    if (m.adjunto) base.adjunto = adjuntoGuardable(m);
    return { ...base, ...sinLoQueEstabaEnCamino(m) };
  });
}

/**
 * La foto de una factura se muestra con una dirección local (blob:) que no
 * sobrevive a la recarga. Se guarda la que quedó en el servidor al leerla, o
 * ninguna (queda el nombre del archivo).
 */
function adjuntoGuardable(m: Mensaje): Mensaje["adjunto"] {
  const a = m.adjunto!;
  const subida = (m.propuesta?.entidades as Record<string, unknown> | undefined)?.adjunto;
  const url =
    typeof subida === "string" && /^https?:\/\//.test(subida) ? subida : /^https?:\/\//.test(a.url) ? a.url : "";
  return { ...a, url };
}

/** La mesa como se guarda: tal cual, sin el "ampliado" (eso es de la pantalla de ahora). */
export function serializarMesa(m: Mesa): Record<string, unknown> {
  return { ...m, ampliada: false };
}

/** Los mensajes guardados, de vuelta. Lo que no tenga forma de mensaje se descarta. */
export function restaurarMensajes(crudos: unknown): Mensaje[] {
  if (!Array.isArray(crudos)) return [];
  return crudos.flatMap((c): Mensaje[] => {
    if (!c || typeof c !== "object" || typeof (c as { id?: unknown }).id !== "string") return [];
    const m = c as Record<string, any>;
    const hora = new Date(m.hora);
    const fase: Mensaje["fase"] = m.fase === "error" || m.fase === "pensando" ? "error" : "listo";
    return [
      {
        ...(m as Mensaje),
        texto: typeof m.texto === "string" ? m.texto : null,
        porVoz: Boolean(m.porVoz),
        hora: Number.isNaN(hora.getTime()) ? new Date() : hora,
        fase,
        ...(m.fase === "pensando" ? { error: SIN_RESPUESTA } : {}),
        ...sinLoQueEstabaEnCamino(m),
        ...(m.adjunto && typeof m.adjunto === "object" ? { adjunto: { url: String(m.adjunto.url ?? ""), nombre: String(m.adjunto.nombre ?? "Archivo"), esPdf: Boolean(m.adjunto.esPdf) } } : {}),
      },
    ];
  });
}

const lineas = <T,>(x: unknown): T[] =>
  Array.isArray(x) ? (x.filter((l) => l && typeof l === "object" && typeof (l as { productId?: unknown }).productId === "string") as T[]) : [];

/**
 * La mesa guardada, de vuelta y saneada: lo que falte toma el valor inicial,
 * así una conversación guardada con una versión anterior igual se abre.
 */
export function restaurarMesa(cruda: unknown): Mesa {
  const m = (cruda && typeof cruda === "object" ? cruda : {}) as Partial<Mesa> & Record<string, any>;
  const analisis =
    m.analisis && typeof m.analisis === "object" && Array.isArray(m.analisis.vista?.piezas) && typeof m.analisis.mensajeId === "string"
      ? m.analisis
      : null;
  const herramienta =
    m.herramienta && typeof m.herramienta === "object" && typeof m.herramienta.mensajeId === "string" && typeof m.herramienta.titulo === "string"
      ? { mensajeId: m.herramienta.mensajeId, titulo: m.herramienta.titulo }
      : null;
  // G9a: la lista guarda su consulta (se vuelve a pedir al abrir); la ficha, a qué apunta.
  const lista =
    m.lista && typeof m.lista === "object" && typeof m.lista.mensajeId === "string" && typeof m.lista.consulta?.recurso === "string"
      ? { mensajeId: m.lista.mensajeId, titulo: String(m.lista.titulo ?? ""), consulta: m.lista.consulta }
      : null;
  const ficha =
    m.ficha && typeof m.ficha === "object" && typeof m.ficha.recurso === "string" && typeof m.ficha.id === "string"
      ? { recurso: m.ficha.recurso, id: m.ficha.id, titulo: String(m.ficha.titulo ?? ""), desdeLista: Boolean(m.ficha.desdeLista) && Boolean(lista) }
      : null;
  const abierta =
    m.abierta === "venta" || m.abierta === "compra"
      ? m.abierta
      : m.abierta === "analisis" && analisis
        ? "analisis"
        : m.abierta === "herramienta" && herramienta
          ? "herramienta"
          : m.abierta === "lista" && lista
            ? "lista"
            : m.abierta === "ficha" && ficha
              ? "ficha"
              : null;
  const productos = m.productos && typeof m.productos.mensajeId === "string" ? { mensajeId: m.productos.mensajeId } : null;
  return {
    ...MESA_INICIAL,
    abierta,
    pestana: m.pestana === "borrador" ? "borrador" : "producto",
    producto: m.producto && typeof m.producto === "object" ? m.producto : null,
    ampliada: false,
    venta: { ...VENTA_VACIA, ...(m.venta ?? {}), lineas: lineas(m.venta?.lineas) },
    compra: {
      ...COMPRA_VACIA,
      ...(m.compra ?? {}),
      lineas: lineas(m.compra?.lineas),
      porResolver: Array.isArray(m.compra?.porResolver) ? m.compra!.porResolver.filter((x: unknown) => typeof x === "string") : [],
    },
    ultima: m.ultima === "compra" ? "compra" : "venta",
    analisis,
    herramienta,
    lista,
    ficha,
    // El formulario sigue en su mensaje; el panel no se reabre solo (abierta no vuelve a "productos").
    productos,
  };
}

// ------------------------------------------------------------ la lista

const DIA = 24 * 60 * 60 * 1000;
const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Como ChatGPT: Hoy, Ayer, Últimos 7 días, Anteriores (en la hora del navegador). */
export function agrupar<T extends { actualizada: string }>(lista: T[], ahora = new Date()): { titulo: string; items: T[] }[] {
  const hoy = inicioDelDia(ahora);
  const grupos = [
    { titulo: "Hoy", desde: hoy },
    { titulo: "Ayer", desde: hoy - DIA },
    { titulo: "Últimos 7 días", desde: hoy - 7 * DIA },
    { titulo: "Anteriores", desde: -Infinity },
  ].map((g) => ({ ...g, items: [] as T[] }));
  for (const c of lista) {
    const t = new Date(c.actualizada).getTime();
    grupos.find((g) => t >= g.desde)!.items.push(c);
  }
  return grupos.filter((g) => g.items.length > 0).map(({ titulo, items }) => ({ titulo, items }));
}

/** "10:32" si fue hoy, "ayer", "lun 28/9" si fue antes. */
export function cuandoFue(iso: string, ahora = new Date()): string {
  const d = new Date(iso);
  const hoy = inicioDelDia(ahora);
  if (d.getTime() >= hoy) return d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.getTime() >= hoy - DIA) return "ayer";
  const dias = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  return `${dias[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** "Venta en curso · 2 · Compra en curso · 3": lo que quedó a medio armar. */
export function enCursoTexto(e: { venta: number; compra: number }): string {
  return [e.venta ? `Venta en curso · ${e.venta}` : "", e.compra ? `Compra en curso · ${e.compra}` : ""].filter(Boolean).join(" · ");
}
