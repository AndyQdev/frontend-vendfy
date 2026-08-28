/** Cómo se recorta el producto para venderlo. */
export type PresentationKind =
  /** El envase entero: un frasco de 100 ml. */
  | "FULL_UNIT"
  /** Una medida fija: el decant de 5 ml. */
  | "FIXED_MEASURE"
  /** La que elija el cliente dentro de un rango: azúcar de 250 g a 50 kg. */
  | "VARIABLE_MEASURE";

/** Cómo se calcula lo que paga el cliente. */
export type PresentationPriceMode =
  /** Un precio cerrado: 5 ml = Bs 40. */
  | "FIXED"
  /** Precio por unidad base: Bs 0,007 por gramo, o sea Bs 7 el kilo. */
  | "PER_BASE_UNIT";

export interface Presentation {
  id: string;
  name: string;
  sku: string | null;
  kind: PresentationKind;
  /** Cuánto consume del inventario, en unidad base. Fija o envase entero. */
  baseQuantity: number | null;
  minBaseQuantity: number | null;
  maxBaseQuantity: number | null;
  /** De cuánto en cuánto puede elegir el cliente. */
  stepBaseQuantity: number | null;
  priceMode: PresentationPriceMode;
  price: number | null;
  /** Con seis decimales: "Bs 7 el kilo" son 0,007 por gramo. */
  pricePerBaseUnit: number | null;
  imageUrl: string | null;
  sortOrder: number;
  displayUnit: { code: string; symbol: string; factorToBase: number } | null;
  baseUnit: { code: string; symbol: string } | null;
}

export interface PresentationInput {
  storeProductId: string;
  name: string;
  sku?: string;
  kind: PresentationKind;
  baseQuantity?: number;
  minBaseQuantity?: number;
  maxBaseQuantity?: number;
  stepBaseQuantity?: number;
  displayUnitCode?: string;
  priceMode: PresentationPriceMode;
  price?: number;
  pricePerBaseUnit?: number;
  imageUrl?: string;
  sortOrder?: number;
}
