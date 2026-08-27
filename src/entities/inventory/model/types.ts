export interface Inventory {
  id: string;
  stockQuantity: number;
  reservedQuantity: number;
  status: 'disponible' | 'agotado' | 'reservado';
  product: {
    id: string;
    name: string;
    sku: string;
    imageUrls?: string[];
    price?: number;
  };
  store: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InventoryStats {
  uniqueProducts: number;
  totalUnits: number;
  totalValue: number;
  outOfStock: number;
}

export interface InventoryResponse {
  statusCode: number;
  data: Inventory[];
  countData: number;
  stats?: InventoryStats;
}

export interface InventoryQueryParams {
  limit?: number;
  offset?: number;
  order?: 'ASC' | 'DESC';
  attr?: string;
  value?: string;
  storeId?: string;
  categoryId?: string; // Filtrar por categoría
  brandId?: string; // Filtrar por marca
  minPrice?: number; // Precio mínimo (>= )
  maxPrice?: number; // Precio máximo (<=)
  inStock?: boolean; // Solo productos con stock disponible (> 0)
  search?: string; // Búsqueda multi-campo (nombre, descripción, tags)
}

// Tipos de movimiento de inventario.
// Los cuatro primeros se registran a mano; el resto los genera el motor de
// consumo del backend al vender, cancelar o fraccionar.
export type MovementType =
  | 'purchase'
  | 'sale'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'consumption'
  | 'fraction'
  | 'assembly'
  | 'waste'
  | 'sample'
  | 'container_open'
  | 'container_empty'
  | 'return';

export interface InventoryMovement {
  id: string;
  type: MovementType;
  /** Cantidad SIEMPRE positiva, en la unidad base del producto. */
  quantity: number;
  /** +1 entra, -1 sale, 0 no altera el total. Lo calcula el backend. */
  direction?: number;
  unitCost: number | null;
  totalCost: number | null;
  notes: string | null;
  inventory: Inventory;
  createdBy: {
    id: string;
    name?: string;
    email?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface MovementResponse {
  statusCode: number;
  data: InventoryMovement[];
  countData: number;
}

export interface CreateMovementParams {
  inventoryId: string;
  type: MovementType;
  quantity: number;
  unitCost?: number;
  notes?: string;
}

export interface MovementKpis {
  totalVentas: number;
  totalCompras: number;
  ganancias: number;
  costoDeVentas: number;
  gananciaReal: number;
  margen: number;
}

export interface MovementQueryParams {
  limit?: number;
  offset?: number;
  order?: 'ASC' | 'DESC';
  inventoryId?: string;
  type?: MovementType;
  storeId?: string;
}
