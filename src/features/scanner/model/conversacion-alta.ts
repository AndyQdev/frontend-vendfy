import type { CambiosAltaVoz, ResultadoAltaVoz } from "@/entities/product/api";
import type { FraseVoz } from "@/shared/voz";
import { mayuscula, numeroALetras } from "@/shared/voz/letras";
import { formatMoney } from "@/shared/lib/money";

/**
 * Qué contesta el alta por voz después de cada frase: confirma lo que anotó y
 * pide lo que falta, en ese orden. Así la persona sabe que la escuchó, qué
 * quedó en el formulario y qué decir después, sin mirar la pantalla.
 *
 * Todo lo que se dice son piezas cortas y fijas ("Listo.", "Veinte
 * bolivianos.", "Cinco en stock.", "Dime el precio de venta."), que el
 * servidor guarda una vez y salen al instante. Solo la respuesta a una
 * pregunta ("¿para qué sirve la categoría?") se genera en el momento.
 */

const texto = (t: string): FraseVoz => ({ tipo: "texto", texto: t });

export const FRASES_ALTA = {
  listo: "Listo.",
  perfecto: "Perfecto.",
  registro: "Perfecto, lo registro.",
  nombre: "¿Cómo se llama el producto?",
  precio: "Dime el precio de venta.",
  precioTrasCosto: "¿Y a qué precio lo vendes?",
  cantidad: "¿Con cuántas unidades entra al stock?",
  comoRegistrar: "Si está todo bien, di «regístralo» o toca Registrar.",
  algoMas: "¿Algo más?",
  repetir: "No te entendí bien. ¿Me lo repites?",
  falta: "Antes de registrarlo falta un dato.",
  anoteNombre: "Anoté el nombre.",
  anoteMarca: "Anoté la marca.",
  anoteCategoria: "Anoté la categoría.",
} as const;

const enStock = (n: number) => `${mayuscula(numeroALetras(n))} en stock.`;
const compraste = (n: number) => `Compraste ${numeroALetras(n)}.`;

/** Las frases fijas del alta, para precalentarlas con las demás. */
export const FRASES_FIJAS_ALTA: string[] = [
  ...Object.values(FRASES_ALTA),
  ...[...Array.from({ length: 12 }, (_, i) => i + 1), 24].flatMap((n) => [enStock(n), compraste(n)]),
];

/** Lo que ya preguntó, para no repetirlo en cada vuelta. */
export interface MemoriaAlta {
  preguntoCantidad: boolean;
  dijoComoRegistrar: boolean;
}

export interface EstadoAlta {
  nombre: string | null;
  precio: number | null;
  cantidad: number;
}

export interface Contestacion {
  /** Lo que se dice. */
  frases: FraseVoz[];
  /** Lo mismo, para leer. */
  texto: string;
  /** La pregunta que queda abierta (para mostrarla mientras escucha). */
  pregunta: string | null;
  /** Pidió registrar y está todo: el formulario registra. */
  registrar: boolean;
  /** Hubo algo útil en la frase (no cuenta para cortar por falta de progreso). */
  progreso: boolean;
}

const unir = (partes: string[]) =>
  partes.length <= 1 ? partes.join("") : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;

export function contestar(
  r: Pick<ResultadoAltaVoz, "cambios" | "soloCosto" | "afirma" | "registrar" | "respuesta">,
  ahora: EstadoAlta,
  cantidadEs: "stock" | "compra",
  memoria: MemoriaAlta,
): Contestacion {
  const c: CambiosAltaVoz = r.cambios;
  const huboCambios = Object.keys(c).length > 0;
  const completo = Boolean(ahora.nombre?.trim()) && Boolean(ahora.precio && ahora.precio > 0);

  if (r.registrar && completo) {
    return { frases: [texto(FRASES_ALTA.registro)], texto: FRASES_ALTA.registro, pregunta: null, registrar: true, progreso: true };
  }

  const frases: FraseVoz[] = [];
  const leer: string[] = [];

  if (huboCambios) {
    const anotado: string[] = [];
    frases.push(texto(FRASES_ALTA.listo));
    if (c.nombre !== undefined) {
      frases.push(texto(FRASES_ALTA.anoteNombre));
      anotado.push(`el nombre «${c.nombre}»`);
    }
    if (c.marca !== undefined) {
      frases.push(texto(FRASES_ALTA.anoteMarca));
      anotado.push(`la marca ${c.marca}`);
    }
    if (c.categoria !== undefined) {
      frases.push(texto(FRASES_ALTA.anoteCategoria));
      anotado.push(`la categoría ${c.categoria}`);
    }
    if (c.precio !== undefined) {
      frases.push({ tipo: "precio", monto: c.precio, moneda: "BOB" });
      anotado.push(`precio ${formatMoney(c.precio)}`);
    }
    if (c.cantidad !== undefined) {
      frases.push(texto(cantidadEs === "compra" ? compraste(c.cantidad) : enStock(c.cantidad)));
      anotado.push(cantidadEs === "compra" ? `${c.cantidad} compradas` : `${c.cantidad} en stock`);
    }
    leer.push(`Listo: ${unir(anotado)}.`);
  }

  if (r.respuesta) {
    frases.push(texto(r.respuesta));
    leer.push(r.respuesta);
  }

  if (!huboCambios && !r.respuesta) {
    if (r.registrar) {
      frases.push(texto(FRASES_ALTA.falta));
      leer.push(FRASES_ALTA.falta);
    } else if (r.afirma) {
      frases.push(texto(FRASES_ALTA.perfecto));
      leer.push(FRASES_ALTA.perfecto);
    } else if (!r.soloCosto) {
      return { frases: [texto(FRASES_ALTA.repetir)], texto: FRASES_ALTA.repetir, pregunta: FRASES_ALTA.repetir, registrar: false, progreso: false };
    }
  }

  // Lo que falta, de a uno: primero lo que impide registrar.
  let pregunta: string;
  if (!ahora.nombre?.trim()) pregunta = FRASES_ALTA.nombre;
  else if (!(ahora.precio && ahora.precio > 0)) pregunta = r.soloCosto ? FRASES_ALTA.precioTrasCosto : FRASES_ALTA.precio;
  else if (cantidadEs === "stock" && !ahora.cantidad && !memoria.preguntoCantidad) {
    memoria.preguntoCantidad = true;
    pregunta = FRASES_ALTA.cantidad;
  } else if (!memoria.dijoComoRegistrar) {
    memoria.dijoComoRegistrar = true;
    pregunta = FRASES_ALTA.comoRegistrar;
  } else pregunta = FRASES_ALTA.algoMas;

  frases.push(texto(pregunta));
  leer.push(pregunta);
  return { frases, texto: leer.join(" "), pregunta, registrar: false, progreso: true };
}
