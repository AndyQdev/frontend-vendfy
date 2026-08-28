import type { Inventory } from "./types";

/**
 * Cómo se reparte el stock entre envases sellados y el que está abierto.
 *
 * El stock se guarda como UN SOLO número en la unidad más fina (280 ml). El
 * reparto "2 frascos sellados + 1 abierto con 80 ml" no es un dato aparte:
 * sale de dividir ese número entre lo que trae cada envase.
 *
 *   sellados = 280 ÷ 100 = 2      (división entera)
 *   abierto  = 280 % 100 = 80     (el resto)
 *
 * Que sea derivado y no almacenado es lo que hace que nunca se desincronice,
 * y también lo que hace que el stock baje en el momento correcto:
 *
 *   quedan 280 ml (2 sellados + 80 abiertos)
 *   se usan 80  → 200 ml → 2 sellados, ninguno abierto   (el stock NO baja)
 *   se usan 81  → 199 ml → 1 sellado + 1 abierto con 99  (el stock baja a 1)
 *
 * O sea: al pasarse aunque sea 1 ml del envase abierto hay que abrir el
 * siguiente, y eso deja de contar como sellado. La resta lo hace sola.
 *
 * LÍMITE CONOCIDO: esto supone un solo envase abierto a la vez. Si en la
 * repisa hay dos frascos por la mitad (50 + 50), el total es correcto pero
 * acá se leen como un frasco sellado. Llevar la cuenta frasco por frasco es
 * lo que habilita `product.trackContainers`, que todavía no está implementado.
 */
export interface DesgloseEnvases {
  /** Si el producto se vende por medida y tiene sentido separar envases. */
  porMedida: boolean;
  /** Cuánto trae cada envase, en unidad base. */
  contenido: number;
  /** El stock completo en unidad base: 280 ml. */
  total: number;
  /** Envases sin abrir. */
  sellados: number;
  /** Lo que queda en el envase abierto. 0 = no hay ninguno abierto. */
  abierto: number;
  /** Lo ya consumido del envase abierto. */
  gastado: number;
  /** Cuánto queda del envase abierto, de 0 a 100. */
  porcentaje: number;
}

export function desglosarEnvases(inventory: Inventory): DesgloseEnvases {
  const total = inventory.stockQuantity;
  const contenido = inventory.product?.contentPerUnit ?? 0;

  // Un producto unitario no tiene envase que fraccionar: su stock ya son
  // unidades y el desglose sería siempre "N sellados, ninguno abierto".
  const porMedida =
    inventory.product?.inventoryType === "fractional" && contenido > 1;

  if (!porMedida) {
    return {
      porMedida: false,
      contenido: 1,
      total,
      sellados: total,
      abierto: 0,
      gastado: 0,
      porcentaje: 0,
    };
  }

  const sellados = Math.floor(total / contenido);
  const abierto = total % contenido;

  return {
    porMedida: true,
    contenido,
    total,
    sellados,
    abierto,
    gastado: abierto === 0 ? 0 : contenido - abierto,
    porcentaje: abierto === 0 ? 0 : Math.round((abierto / contenido) * 100),
  };
}

/**
 * De cuánto en cuánto avanzan los botones +/− del envase abierto.
 *
 * Un paso de 1 ml en un frasco de 100 obliga a ochenta clics; uno de 50 g en
 * una bolsa de 250 se pasa de largo. La escala busca que un envase entero se
 * recorra en unos veinte clics, que es lo que se tolera sin abrir el diálogo.
 */
export function pasoDeConsumo(contenido: number): number {
  if (contenido <= 20) return 1;
  if (contenido <= 200) return 5;
  if (contenido <= 1000) return 10;
  return 50;
}

/** Color de la barra según lo que queda del envase abierto. */
export function colorDeNivel(porcentaje: number): {
  barra: string;
  texto: string;
} {
  if (porcentaje >= 50) {
    return {
      barra: "bg-emerald-500",
      texto: "text-emerald-700 dark:text-emerald-400",
    };
  }
  if (porcentaje >= 20) {
    return {
      barra: "bg-amber-500",
      texto: "text-amber-700 dark:text-amber-400",
    };
  }
  return { barra: "bg-red-500", texto: "text-red-700 dark:text-red-400" };
}

/**
 * Muestra una cantidad con su unidad.
 *
 * El stock se guarda siempre en la unidad más fina (ml, g, cm) para que las
 * cuentas sean enteras y exactas. Acá se traduce a algo legible: 1500 ml se
 * lee mejor como "1,5 L", y 300 unidades como "300".
 */
export function formatearCantidad(
  cantidad: number,
  unidad?: { code: string; symbol: string },
): string {
  if (!unidad || unidad.code === "unit") return String(cantidad);

  const escalas: Record<string, { factor: number; symbol: string }> = {
    ml: { factor: 1000, symbol: "L" },
    g: { factor: 1000, symbol: "kg" },
    cm: { factor: 100, symbol: "m" },
  };

  const escala = escalas[unidad.code];
  if (escala && cantidad >= escala.factor) {
    const valor = cantidad / escala.factor;
    const texto = Number.isInteger(valor)
      ? String(valor)
      : valor.toFixed(2).replace(".", ",");
    return `${texto} ${escala.symbol}`;
  }

  return `${cantidad} ${unidad.symbol}`;
}
