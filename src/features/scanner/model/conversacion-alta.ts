import type { CambiosAltaVoz, PreguntaAltaVoz, ResultadoAltaVoz } from "@/entities/product/api";
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
 *
 * La pregunta que queda abierta viaja con la próxima frase: así un "veinte"
 * a secas es el precio, y un "sí" a "¿Lo registro?" registra.
 */

const texto = (t: string): FraseVoz => ({ tipo: "texto", texto: t });

export const FRASES_ALTA = {
  listo: "Listo.",
  perfecto: "Perfecto.",
  deAcuerdo: "De acuerdo.",
  registro: "Perfecto, lo registro.",
  noRegistro: "De acuerdo, no lo registro.",
  queCambio: "De acuerdo. ¿Qué quieres cambiar?",
  repetir: "No te entendí bien. ¿Me lo repites?",
  falta: "Antes de registrarlo falta un dato.",
  anoteNombre: "Anoté el nombre.",
  anoteMarca: "Anoté la marca.",
  anoteCategoria: "Anoté la categoría.",
  yaEsta: "Eso ya está anotado.",
} as const;

/** Lo que pregunta, según lo que falta. */
export const PREGUNTAS: Record<PreguntaAltaVoz, string> = {
  alta: "¿Lo damos de alta?",
  nombre: "¿Cómo se llama el producto?",
  precio: "Dime el precio de venta.",
  precioYCantidad: "Dime el precio de venta y, si quieres, con cuántas unidades entra al stock.",
  cantidad: "¿Con cuántas unidades entra al stock?",
  registrar: "¿Lo registro?",
};
const PRECIO_TRAS_COSTO = "¿Y a qué precio lo vendes?";

/** Cuando un dato se dijo pero no se entendió: se pide ese, no otro. */
const NO_ENTENDI: Record<string, { frase: string; pregunta: PreguntaAltaVoz | null }> = {
  precio: { frase: "No entendí bien el precio. ¿Me lo repites?", pregunta: "precio" },
  cantidad: { frase: "No entendí bien la cantidad. ¿Me la repites?", pregunta: "cantidad" },
  nombre: { frase: "No entendí bien el nombre. ¿Me lo repites?", pregunta: "nombre" },
  marca: { frase: "No entendí bien la marca. ¿Me la repites?", pregunta: null },
  categoria: { frase: "No entendí bien la categoría. ¿Me la repites?", pregunta: null },
};

const enStock = (n: number) => `${mayuscula(numeroALetras(n))} en stock.`;
const compraste = (n: number) => `Compraste ${numeroALetras(n)}.`;
/** Las cantidades más comunes, para que la confirmación salga al instante. */
const CANTIDADES_COMUNES = [...Array.from({ length: 30 }, (_, i) => i + 1), 36, 40, 48, 50, 60, 100];

/** Las frases fijas del alta, para precalentarlas con las demás. */
export const FRASES_FIJAS_ALTA: string[] = [
  ...Object.values(FRASES_ALTA),
  ...Object.values(PREGUNTAS),
  PRECIO_TRAS_COSTO,
  ...Object.values(NO_ENTENDI).map((n) => n.frase),
  ...CANTIDADES_COMUNES.flatMap((n) => [enStock(n), compraste(n)]),
];

/** Lo que ya preguntó, para no repetirlo en cada vuelta. */
export interface MemoriaAlta {
  preguntoCantidad: boolean;
}

export interface EstadoAlta {
  nombre: string | null;
  precio: number | null;
  cantidad: number;
}

export interface Contestacion {
  /** Lo que se dice. */
  frases: FraseVoz[];
  /** Lo mismo, para leer (puede traer una ayuda que no se dice). */
  texto: string;
  /** La pregunta que queda abierta: viaja con la próxima frase. */
  pregunta: PreguntaAltaVoz | null;
  /** Pidió registrar y está todo: el formulario registra. */
  registrar: boolean;
  /** No quiere seguir ("no" a "¿Lo damos de alta?"): se deja de escuchar. */
  terminar: boolean;
  /** Hubo algo útil en la frase (no cuenta para cortar por falta de progreso). */
  progreso: boolean;
}

const unir = (partes: string[]) =>
  partes.length <= 1 ? partes.join("") : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;

const sola = (t: string, extra: Partial<Contestacion> = {}): Contestacion => ({
  frases: [texto(t)],
  texto: t,
  pregunta: null,
  registrar: false,
  terminar: false,
  progreso: true,
  ...extra,
});

export function contestar(
  r: Pick<ResultadoAltaVoz, "cambios" | "soloCosto" | "afirma" | "niega" | "registrar" | "respuesta" | "dudas" | "yaEstaba">,
  ahora: EstadoAlta,
  cantidadEs: "stock" | "compra",
  memoria: MemoriaAlta,
  /** Lo que se le acababa de preguntar. */
  anterior: PreguntaAltaVoz | null,
): Contestacion {
  const c: CambiosAltaVoz = r.cambios;
  const huboCambios = Object.keys(c).length > 0;
  const completo = Boolean(ahora.nombre?.trim()) && Boolean(ahora.precio && ahora.precio > 0);

  // Registrar: lo pidió con todas las letras, o dijo "sí" a "¿Lo registro?".
  if (completo && (r.registrar || (r.afirma && anterior === "registrar"))) {
    return sola(FRASES_ALTA.registro, { registrar: true });
  }
  if (r.niega && !huboCambios) {
    return anterior === "alta"
      ? sola(FRASES_ALTA.noRegistro, { terminar: true })
      : sola(FRASES_ALTA.queCambio);
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

  // Quiso decir algo que no se entendió: se pide eso mismo, antes que nada.
  const duda = (r.dudas ?? []).map((d) => NO_ENTENDI[d]).find(Boolean);
  if (duda) {
    frases.push(texto(duda.frase));
    leer.push(duda.frase);
    return { frases, texto: leer.join(" "), pregunta: duda.pregunta, registrar: false, terminar: false, progreso: huboCambios };
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
    } else if (r.yaEstaba) {
      frases.push(texto(FRASES_ALTA.yaEsta));
      leer.push(FRASES_ALTA.yaEsta);
    } else if (!r.soloCosto) {
      return sola(FRASES_ALTA.repetir, { pregunta: anterior, progreso: false });
    }
  }

  // Lo que falta, de a uno: primero lo que impide registrar.
  let pregunta: PreguntaAltaVoz;
  let dicha: string;
  const sinCantidad = cantidadEs === "stock" && !ahora.cantidad && c.cantidad === undefined;
  if (!ahora.nombre?.trim()) {
    pregunta = "nombre";
    dicha = PREGUNTAS.nombre;
  } else if (!(ahora.precio && ahora.precio > 0)) {
    if (r.soloCosto) {
      pregunta = "precio";
      dicha = PRECIO_TRAS_COSTO;
    } else if (sinCantidad && !memoria.preguntoCantidad) {
      // Las dos de una vez: "a 20 y con 5" se contesta en una sola frase.
      memoria.preguntoCantidad = true;
      pregunta = "precioYCantidad";
      dicha = PREGUNTAS.precioYCantidad;
    } else {
      pregunta = "precio";
      dicha = PREGUNTAS.precio;
    }
  } else if (sinCantidad && !memoria.preguntoCantidad) {
    memoria.preguntoCantidad = true;
    pregunta = "cantidad";
    dicha = PREGUNTAS.cantidad;
  } else {
    pregunta = "registrar";
    dicha = PREGUNTAS.registrar;
  }

  frases.push(texto(dicha));
  leer.push(pregunta === "registrar" ? `${dicha} Di «sí» o toca Registrar.` : dicha);
  return { frases, texto: leer.join(" "), pregunta, registrar: false, terminar: false, progreso: true };
}
