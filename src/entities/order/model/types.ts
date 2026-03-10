// Enums
export enum OrderStatus {
  PENDIENTE = 'pendiente',
  EN_PROCESO = 'en-proceso',
  EN_CAMINO = 'en-camino',
  COMPLETADO = 'completado',
  CANCELADO = 'cancelado',
}

export enum OrderType {
  QUICK = 'quick',
  INSTALLMENT = 'installment',
  DELIVERY = 'delivery',
}

// Interfaces
export interface DeliveryInfo {
  address: string;
  cost: number;
  notes?: string;
}

export interface InstallmentInfo {
  numberOfInstallments: number;
  nextPaymentDate: string;
}

export interface OrderItem {
  storeProductId: string;
  quantity: number;
  price: number;
}

// Input para crear orden
export interface CreateOrderInput {
  totalAmount: number;
  status?: OrderStatus;
  type?: OrderType;
  notes?: string;
  paymentMethod: string;
  paymentDate: string;
  totalReceived: number;
  deliveryInfo?: DeliveryInfo;
  installmentInfo?: InstallmentInfo;
  storeId: string;
  customerId: string;
  items: OrderItem[];
}

// Respuesta de una orden
export interface Order {
  id: string;
  totalAmount: number;
  status: OrderStatus;
  type: OrderType;
  notes?: string;
  paymentMethod: string;
  paymentDate: string;
  totalReceived: number;
  deliveryInfo?: DeliveryInfo;
  installmentInfo?: InstallmentInfo;
  store?: {
    id: string;
    name: string;
  };
  customer?: {
    id: string;
    name: string;
    email?: string;
  };
  items?: Array<{
    id: string;
    quantity: number;
    price: number;
    storeProduct?: {
      id: string;
      product?: {
        id: string;
        name: string;
        sku?: string;
        imageUrls?: string[];
      };
    };
  }>;
  installments?: Array<{
    id: string;
    installmentNumber: number;
    amount: number;
    dueDate: string;
    paidDate?: string;
    status: string;
    notes?: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface OrdersResponse {
  statusCode: number;
  data: Order[];
  countData: number;
}

export interface OrderQueryParams {
  limit?: number;
  offset?: number;
  order?: 'ASC' | 'DESC';
  attr?: string;
  value?: string;
  storeId?: string;
  dateFilter?: 'day' | 'week' | 'month' | 'year';
  status?: string;
}
