import type { Filtros } from "@/entities/omnibox/model/types";

import { respuestaDeEscaneo } from "./escaneo";
import type { Mensaje } from "./mensaje";
import { textoAlcance } from "./vistas";

/**
 * La memoria corta del asistente (G6b): lo que viaja con cada frase para que
 * "su teléfono", "esas" o "y en línea de tiempo" se entiendan.
 *
 * No es el chat entero (lento y caro): los últimos turnos, cada uno en una
 * línea (qué dijo y qué se le respondió), y lo que está EN FOCO: de quién
 * eran los números del último análisis. Sale del hilo y no del panel, porque
 * en el teléfono el panel suele estar cerrado y el foco no se puede perder.
 *
 * Puro: se prueba en e2e/logic/memoria-chat.spec.ts.
 */

export const TURNOS_MEMORIA = 4;
const LARGO = 180;

export interface Turno {
  dijo: string;
  /** Qué se le respondió, en una línea. */
  respuesta: string;
}

export interface Memoria {
  historial: Turno[];
  /** De quién se venía hablando (los filtros del último análisis). */
  foco?: Filtros;
}

const corto = (t: string) => (t.length > LARGO ? `${t.slice(0, LARGO - 1)}…` : t);

/** Lo que se le respondió a un mensaje, en una línea (sin cifras inventadas: lo que ya se mostró). */
export function respuestaDe(m: Mensaje): string | null {
  if (m.fase === "pensando") return null;
  if (m.fase === "error") return m.error ? `Error: ${m.error}` : null;
  if (m.evento?.tipo === "venta") return `Venta #${m.evento.venta.numero} cobrada`;
  if (m.evento?.tipo === "compra") return "Compra registrada";
  if (m.escaneo) return respuestaDeEscaneo(m.escaneo);
  const p = m.propuesta;
  if (!p) return null;
  // El agente (G7b): lo que dijo, y qué tarjetas dejó (la frase siguiente puede ser sobre ellas).
  if (p.agente) {
    const tarjetas = p.agente.acciones.map((a) => a.titulo ?? a.intencion).filter(Boolean);
    return `${p.agente.texto}${tarjetas.length ? ` [preparé: ${tarjetas.join(", ")}]` : ""}`;
  }
  if (m.formulario?.tipo === "productos") {
    const nombres = (m.formulario.productos ?? []).map((b) => b.nombre).join(", ");
    return m.formulario.estado === "creado" ? `Creé: ${nombres}` : `Formulario de productos nuevos: ${nombres}`;
  }
  if (m.herramienta?.fase === "lista") return `Herramienta "${m.herramienta.generada.titulo}"`;
  if (p.vista) return `Análisis "${p.vista.titulo}" (${textoAlcance(p.vista.filtros, p.vista.condiciones)})`;
  if (p.clientes?.length && !p.ejecutable) return `Preguntó cuál cliente: ${p.clientes.map((c) => c.nombre).join(" o ")}`;
  if (m.desenlace?.tipo === "hecho" || m.desenlace?.tipo === "mesa") return m.desenlace.resumen;
  if (m.desenlace?.tipo === "cancelado") return "Cancelado";
  if (p.resultado) return p.resultado.resumen;
  if (p.faltan.length) return `Preguntó: ${p.faltan[0].pregunta}`;
  if (p.aviso) return p.aviso;
  return p.titulo ?? p.intencion ?? null;
}

/** Los últimos turnos y el foco, para mandar con la próxima frase. */
export function memoriaDe(mensajes: Mensaje[]): Memoria {
  const historial: Turno[] = [];
  for (const m of mensajes) {
    if (!m.texto) continue; // eventos del panel: no son algo que se dijo
    const respuesta = respuestaDe(m);
    if (respuesta) historial.push({ dijo: corto(m.texto), respuesta: corto(respuesta) });
  }
  // El foco: el último análisis de la conversación, con o sin filtros (si el
  // último fue de toda la tienda, ya no se habla de José).
  const ultimoAnalisis = [...mensajes].reverse().find((m) => m.propuesta?.vista);
  const foco = ultimoAnalisis?.propuesta?.vista?.filtros;
  return { historial: historial.slice(-TURNOS_MEMORIA), ...(foco && Object.keys(foco).length ? { foco } : {}) };
}
