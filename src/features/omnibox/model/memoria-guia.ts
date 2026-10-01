import type { MensajeGuia } from "./guia";

/**
 * Lo que la Guía recuerda para no molestar (Fase G2a). Puro: se prueba en
 * e2e/logic/memoria-guia.spec.ts; la pantalla lo guarda en localStorage por
 * tienda.
 *
 * Reglas (ASISTENTE-GENERATIVO.md, 4.2):
 *  - una sugerencia descartada no vuelve (esa misma, por 12 horas);
 *  - un TIPO descartado 3 veces se silencia 30 días;
 *  - por debajo de la confianza mínima, no se dice;
 *  - los tips del modo aprendiz salen una sola vez, y solo las primeras
 *    `VENTAS_APRENDIZ` ventas: después la Guía habla solo cuando hace falta.
 */

export const CONFIANZA_MINIMA = 0.5;
export const VENTAS_APRENDIZ = 20;
export const DESCARTES_PARA_SILENCIAR = 3;
const HORA = 60 * 60 * 1000;
export const OLVIDO_DESCARTE = 12 * HORA;
export const SILENCIO = 30 * 24 * HORA;

export interface MemoriaGuia {
  /** clave de la sugerencia → cuándo se descartó. */
  descartadas: Record<string, number>;
  /** código → descartes seguidos y hasta cuándo está silenciado. */
  codigos: Record<string, { veces: number; hasta?: number }>;
  /** Tips ya mostrados (una sola vez cada uno). */
  tips: Record<string, true>;
  /** Ventas cobradas: mide cuánto lleva usando el asistente. */
  ventas: number;
}

export const MEMORIA_VACIA: MemoriaGuia = { descartadas: {}, codigos: {}, tips: {}, ventas: 0 };

export function esTip(m: MensajeGuia): boolean {
  return m.codigo.startsWith("TIP_");
}

export function esAprendiz(mem: MemoriaGuia): boolean {
  return mem.ventas < VENTAS_APRENDIZ;
}

/** ¿Se puede mostrar esta sugerencia o tip? Errores y advertencias siempre pueden. */
export function permitida(m: MensajeGuia, mem: MemoriaGuia, ahora: number): boolean {
  if (m.nivel !== "sugerencia") return true;
  if (esTip(m)) return esAprendiz(mem) && !mem.tips[m.codigo];
  if ((m.confianza ?? 1) < CONFIANZA_MINIMA) return false;
  const cuando = mem.descartadas[m.clave];
  if (cuando != null && ahora - cuando < OLVIDO_DESCARTE) return false;
  const hasta = mem.codigos[m.codigo]?.hasta;
  if (hasta != null && ahora < hasta) return false;
  return true;
}

/** "No, gracias" (o la ✕): no vuelve, y el tercero seguido silencia el tipo. */
export function descartar(mem: MemoriaGuia, m: MensajeGuia, ahora: number): MemoriaGuia {
  if (esTip(m)) return { ...mem, tips: { ...mem.tips, [m.codigo]: true } };
  const previo = mem.codigos[m.codigo]?.veces ?? 0;
  const veces = previo + 1;
  const silenciar = veces >= DESCARTES_PARA_SILENCIAR;
  return {
    ...mem,
    descartadas: { ...mem.descartadas, [m.clave]: ahora },
    codigos: {
      ...mem.codigos,
      [m.codigo]: silenciar ? { veces: 0, hasta: ahora + SILENCIO } : { veces },
    },
  };
}

/** Aceptar una sugerencia cuenta como "le sirvió": se reinicia la racha de descartes. */
export function aceptar(mem: MemoriaGuia, m: MensajeGuia): MemoriaGuia {
  if (esTip(m)) return { ...mem, tips: { ...mem.tips, [m.codigo]: true } };
  if (!mem.codigos[m.codigo]) return mem;
  return { ...mem, codigos: { ...mem.codigos, [m.codigo]: { veces: 0 } } };
}

/** Un tip que se mostró ya no vuelve, aunque no se haya tocado. */
export function tipVisto(mem: MemoriaGuia, codigo: string): MemoriaGuia {
  return mem.tips[codigo] ? mem : { ...mem, tips: { ...mem.tips, [codigo]: true } };
}

export function contarVenta(mem: MemoriaGuia): MemoriaGuia {
  return { ...mem, ventas: mem.ventas + 1 };
}

/** Lo que llega de localStorage puede estar roto o ser de otra versión. */
export function leerMemoria(crudo: string | null): MemoriaGuia {
  if (!crudo) return MEMORIA_VACIA;
  try {
    const m = JSON.parse(crudo);
    return {
      descartadas: typeof m.descartadas === "object" && m.descartadas ? m.descartadas : {},
      codigos: typeof m.codigos === "object" && m.codigos ? m.codigos : {},
      tips: typeof m.tips === "object" && m.tips ? m.tips : {},
      ventas: Number.isFinite(m.ventas) ? m.ventas : 0,
    };
  } catch {
    return MEMORIA_VACIA;
  }
}
