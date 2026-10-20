/**
 * Promociones e imágenes con IA, tal como las sirve el backend
 * (ecomerce-backend/src/promotion).
 */

export type TipoDescuento = "none" | "percent" | "amount";
export type EstadoPromocion = "activa" | "programada" | "terminada" | "inactiva";

export interface ProductoDePromocion {
  productoId: string;
  storeProductId: string;
  nombre: string;
  imagen: string | null;
  /** El precio de siempre. */
  precioLista: number;
  /** Con la promoción. */
  precio: number;
}

export interface Promocion {
  id: string;
  nombre: string;
  /** Su página en la tienda: /<tienda>/promo/<slug>. No cambia al renombrar. */
  slug: string;
  descripcion: string | null;
  imagen: string | null;
  tipo: TipoDescuento;
  valor: number;
  /** "30 %" o "Bs 10"; null si no rebaja (una selección). */
  etiqueta: string | null;
  empieza: string | null;
  termina: string | null;
  activa: boolean;
  estado: EstadoPromocion;
  productos: ProductoDePromocion[];
  ahorroTotal: number;
}

export interface PromocionInput {
  storeId: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  kind: TipoDescuento;
  value?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  active?: boolean;
  storeProductIds: string[];
}

export const MAX_PRODUCTOS_POR_PROMOCION = 12;

export type TipoImagenIa = "scratch" | "product" | "products" | "promotion";
export type ProporcionImagen = "16:9" | "9:16" | "1:1";

/** Una imagen que la IA generó para la tienda (el historial). */
export interface ImagenIa {
  id: string;
  url: string;
  kind: TipoImagenIa;
  prompt: string | null;
  aspect: ProporcionImagen;
  /** Los productos de la tienda (store_product) de los que partió. */
  productIds: string[];
  /** La promoción de la que partió, si fue una. */
  promotionId: string | null;
  created_at: string;
}

export interface GenerarImagenInput {
  storeId: string;
  kind: TipoImagenIa;
  storeProductIds?: string[];
  promotionId?: string;
  brief: string;
  aspect?: ProporcionImagen;
}

export interface EstadoIa {
  disponible: boolean;
  usadasHoy: number;
  tope: number;
}
