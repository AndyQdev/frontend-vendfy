export type LiveSessionStatus = "preparing" | "active" | "finished" | "cancelled";
export type LiveItemStatus = "active" | "removed";
export type LiveAuctionStatus = "pending" | "open" | "closed" | "cancelled";
export type LiveBidStatus = "queued" | "awarded" | "declined";

/** Los números del Live, congelados al cerrarlo. */
export interface LiveSessionSummary {
  items: number;
  vendidos: number;
  disponibles: number;
  ventasTotal: number;
  cuentas: number;
  subastas: { cerradas: number; sinPujas: number; montoFinal: number };
}

export interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  publicToken: string;
  status: LiveSessionStatus;
  summary: LiveSessionSummary | null;
  startedAt: string | null;
  endedAt: string | null;
  created_at: string;
  store?: { id: string; name: string; slug: string };
  /** Solo al crear: la ruta pública lista para pegar. */
  publicPath?: string;
}

export interface LiveAuction {
  id: string;
  status: LiveAuctionStatus;
  startingPrice: number;
  minIncrement: number;
  currentAmount: number | null;
  bidCount: number;
  openedAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
}

/**
 * Una prenda del Live.
 *
 * `disponible` NO viene guardado: el backend lo calcula contra el inventario
 * en cada lectura. Por eso una prenda cobrada en la caja mientras el Live
 * corre desaparece sola en el siguiente refresco.
 */
export interface LiveItem {
  id: string;
  status: LiveItemStatus;
  sortOrder: number;
  featured: boolean;
  storeProductId: string;
  productId: string;
  name: string;
  price: number;
  imageUrls: string[];
  disponible: number;
  /** Si existe, esta prenda se subasta. Su existencia ES el modo de venta. */
  auction: LiveAuction | null;
}

export interface LiveSessionDetail extends LiveSession {
  items: LiveItem[];
}

/** Un postor, como lo ve el vendedor: con el teléfono para llamarlo. */
export interface PostorEnCola {
  bidId: string;
  amount: number;
  status: LiveBidStatus;
  customerId: string;
  name: string;
  phone: string;
  createdAt: string;
  orderId: string | null;
}

/** Lo que un cliente se está llevando de este Live. */
export interface LiveAccount {
  id: string;
  number: number | null;
  totalAmount: number;
  status: string;
  customer?: { id: string; name: string; phone: string };
  items?: Array<{
    id: string;
    quantity: number;
    price: number;
    storeProduct?: { id: string; product?: { name: string } };
  }>;
}

export interface ProductoReutilizable {
  storeProductId: string;
  productId: string;
  name: string;
  price: number;
  imageUrls: string[];
  disponible: number;
}

export interface CreateLiveInput {
  storeId: string;
  title: string;
  description?: string;
  coverUrl?: string;
}

export interface QuickItemInput {
  name: string;
  price: number;
  stock?: number;
  imageUrl?: string;
  categoryId?: string;
}

export interface CreateAuctionInput {
  startingPrice: number;
  minIncrement?: number;
  closesAt?: string;
}
