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
}

// Tipos de movimiento de inventario
export type MovementType = 'purchase' | 'sale' | 'adjustment_in' | 'adjustment_out';

export interface InventoryMovement {
  id: string;
  type: MovementType;
  quantity: number;
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
