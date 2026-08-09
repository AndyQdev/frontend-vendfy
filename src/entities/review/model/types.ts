export interface Review {
  id: string;
  origin: "STORE" | "CUSTOMER";
  customerName: string;
  rating: number | null;
  comment: string | null;
  imageUrls: string[];
  featured: boolean;
  published: boolean;
  sortOrder: number;
  product?: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
  enabled: boolean;
}

export interface ReviewInput {
  storeId: string;
  productId?: string | null;
  customerName: string;
  rating?: number | null;
  comment?: string;
  imageUrls?: string[];
  featured?: boolean;
  published?: boolean;
  sortOrder?: number;
}
