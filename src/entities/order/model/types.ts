// Enums
export enum OrderStatus {
  /**
   * Esperando que confirmes que podés conseguir lo que falta.
   *
   * El pedido está completo pero NO descontó stock. Nace así cuando alguna
   * línea no tiene stock y su producto está marcado "A pedido". Al moverlo a
   * Pendiente, recién ahí se descuenta.
   */
  POR_CONFIRMAR = 'por-confirmar',
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
  coordinates?: { latitude: number; longitude: number };
  /**
   * Link para que el cliente siga al repartidor (Yango, Pedidos Ya, un link
   * de ubicación en vivo...). Lo carga la tienda al pasar el pedido a
   * "en camino" y habilita el botón en la página de seguimiento.
   */
  trackingUrl?: string;
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
  /** Correlativo por tienda para decirlo en voz alta (#1042) */
  number?: number | null;
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
    /** Cuántas cosas: 3 camisas, 2 decants. NO cuántos mililitros. */
    quantity: number;
    price: number;
    /**
     * Cuánto mide CADA unidad de esta línea, en unidad base. Solo en ventas
     * por medida: 2 decants de 30 ml son quantity 2 y baseQuantity 30.
     */
    baseQuantity?: number | null;
    /** PRODUCT | MEASURE | PRESENTATION | CONFIGURATION */
    itemType?: string;
    unit?: { code: string; symbol: string } | null;
    storeProduct?: {
      id: string;
      product?: {
        id: string;
        name: string;
        sku?: string;
        imageUrls?: string[];
        baseUnit?: { code: string; symbol: string } | null;
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
