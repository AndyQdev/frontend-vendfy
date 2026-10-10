/**
 * Lo que devuelve `GET /api/product/scan?codigo=…`: qué sabe Vendfy de un
 * código de barras recién escaneado.
 *
 * Tres casos, en este orden:
 *   - `producto`   el comercio ya lo tiene cargado (precio y stock por tienda)
 *   - `sugerencia` no lo tiene, pero el catálogo compartido sí: se registra
 *                  casi sin escribir
 *   - ninguno      producto nuevo para todos: se carga a mano
 */

export interface TiendaDelProducto {
  storeId: string;
  storeName: string;
  storeProductId: string;
  /** Fila de stock en esa tienda: es el id que usa el carrito de Caja. */
  inventoryId: string | null;
  price: number;
  stock: number;
  reserved: number;
  sellWithoutStock: boolean;
}

export interface ProductoEscaneado {
  id: string;
  name: string;
  description?: string | null;
  imageUrls: string[];
  sku?: string | null;
  barcode?: string | null;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  inventoryType: "unit" | "fractional" | "composite";
  contentPerUnit: number | null;
  baseUnit: { code: string; symbol: string; name: string } | null;
  tiendas: TiendaDelProducto[];
}

/** Ficha en español que arma la IA con los datos del catálogo y la foto. */
export interface FichaIa {
  nombre: string | null;
  marca: string | null;
  contenido: string | null;
  categoria: string | null;
  descripcion: string | null;
  etiquetas: string[];
  especificaciones: Record<string, string>;
}

/**
 * Foto profesional y ficha generadas con IA. Se generan UNA vez por código
 * (el primer escaneo) y las reciben todos los comercios después.
 */
export interface EnriquecimientoIa {
  estado: "generando" | "listo" | "error" | "no_disponible";
  imagenUrl: string | null;
  ficha: FichaIa | null;
}

export interface SugerenciaCatalogo {
  gtin: string;
  nombre: string;
  marca: string | null;
  cantidad: string | null;
  categoria: string | null;
  imagenUrl: string | null;
  imagenChicaUrl: string | null;
  paises: string[];
  pais: string | null;
  popularidad: number;
  /** off, obf, opf, opff… */
  fuentes: string[];
  ia?: EnriquecimientoIa;
}

export interface ResultadoEscaneo {
  /** Normalizado: GTIN-14 o la etiqueta en mayúsculas. Es lo que se guarda. */
  codigo: string;
  /** Como viene impreso en el envase (EAN-13, EAN-8, UPC). */
  codigoLegible: string;
  esGtin: boolean;
  /** Identifica el producto en todo el mundo (no es de balanza ni interno). */
  global: boolean;
  pais: string | null;
  producto: ProductoEscaneado | null;
  sugerencia: SugerenciaCatalogo | null;
}

export const NOMBRE_FUENTE_CATALOGO: Record<string, string> = {
  off: "Open Food Facts",
  obf: "Open Beauty Facts",
  opf: "Open Products Facts",
  opff: "Open Pet Food Facts",
};
