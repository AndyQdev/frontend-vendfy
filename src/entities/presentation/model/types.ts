/** Cómo se recorta el producto para venderlo. Espejo de `PresentationKind` del backend. */
export type PresentationKind = "FULL_UNIT" | "FIXED_MEASURE" | "VARIABLE_MEASURE";

/** Cómo se calcula lo que paga el cliente. */
export type PresentationPriceMode = "FIXED" | "PER_BASE_UNIT";

export interface PresentationUnit {
  code: string;
  symbol: string;
  name?: string;
  factorToBase?: number;
}

/** Una forma de vender un producto: el frasco entero, el decant de 5 ml, por metro. */
export interface Presentation {
  id: string;
  name: string;
  sku: string | null;
  kind: PresentationKind;
  baseQuantity: number | null;
  minBaseQuantity: number | null;
  maxBaseQuantity: number | null;
  stepBaseQuantity: number | null;
  priceMode: PresentationPriceMode;
  price: number | null;
  pricePerBaseUnit: number | null;
  imageUrl: string | null;
  sortOrder: number;
  displayUnit: PresentationUnit | null;
  baseUnit: PresentationUnit | null;
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
  sortOrder?: number;
}
