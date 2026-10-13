export type PurchaseOrderStatus = 'pending' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  quantity: number;
  /** En Bs siempre (en compras en dólares, convertido con su dólar). */
  unitCost: number;
  subtotal: number;
  /** Compras en dólares: lo que cobró el proveedor, en dólares. */
  unitCostUsd?: number | string | null;
  subtotalUsd?: number | string | null;
  product: {
    id: string;
    name: string;
    sku?: string;
    imageUrls?: string[];
  };
}

export interface PurchaseOrder {
  id: string;
  referenceNumber: string | null;
  supplierName: string | null;
  supplierContact: string | null;
  /** En Bs siempre. */
  totalAmount: number;
  /** En qué cotizó el proveedor. Sin el campo (compras viejas): Bs. */
  currency?: "BOB" | "USD";
  /** Bs por dólar de esta compra (solo en dólares). */
  exchangeRate?: number | string | null;
  totalUsd?: number | string | null;
  notes: string | null;
  status: PurchaseOrderStatus;
  store: {
    id: string;
    name: string;
  };
  items: PurchaseOrderItem[];
  created_at: string;
  updated_at: string;
}

export interface CreatePurchaseOrderInput {
  storeId: string;
  referenceNumber?: string;
  supplierName?: string;
  supplierContact?: string;
  notes?: string;
  /** En USD los costos de `items` van en dólares. */
  currency?: "BOB" | "USD";
  exchangeRate?: number;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
  }>;
}

/** Una línea de lo que llegó, al confirmar una compra contándola. */
export interface ItemRecibido {
  productId: string;
  /** 0 = no llegó. */
  quantity: number;
  /** Solo para lo que no estaba en la compra; en la moneda de la compra. */
  unitCost?: number;
}

export interface PurchaseOrderQueryParams {
  limit?: number;
  offset?: number;
  order?: 'ASC' | 'DESC';
  storeId?: string;
  status?: PurchaseOrderStatus;
  /** Solo las compras que tienen este producto (lo escaneado). */
  productId?: string;
}

/** Con `productId`: cuánto se compró de ese producto y lo último que se pagó. */
export interface ResumenComprasProducto {
  unidades: number;
  monto: number;
  compras: number;
  ultima: string | null;
  ultimoCosto: number | null;
  /** Lo último que se pagó en dólares, si alguna vez se compró en dólares. */
  ultimoCostoUsd?: number | null;
  ultimoProveedor: string | null;
}
