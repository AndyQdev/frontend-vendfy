export type PurchaseOrderStatus = 'pending' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
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
  totalAmount: number;
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
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
  }>;
}

export interface PurchaseOrderQueryParams {
  limit?: number;
  offset?: number;
  order?: 'ASC' | 'DESC';
  storeId?: string;
  status?: PurchaseOrderStatus;
}
