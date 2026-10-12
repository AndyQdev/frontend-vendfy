export interface ReportQueryParams {
  period: string;
  startDate?: string;
  endDate?: string;
  storeId?: string;
}

export interface KPIData {
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  lowStockProducts: number;
  pendingOrders: number;
  totalCompras: number;
  gananciaReal: number;
  margen: number;
}

export interface FinancialComparisonItem {
  date: string;
  ventas: number;
  compras: number;
  ganancia: number;
}

export interface SalesOverTimeItem {
  date: string;
  sales: number;
  previousPeriod: number;
}

export interface SalesByCategoryItem {
  category: string;
  sales: number;
}

export interface OrderStatusItem {
  status: string;
  count: number;
  color: string;
}

export interface OrderChannelItem {
  channel: string;
  count: number;
  sales: number;
  color: string;
}

export interface DepartmentSalesItem {
  /** Código ISO 3166-2 sin prefijo de país, por ejemplo `S` para Santa Cruz. */
  code: string;
  name: string;
  sales: number;
  count: number;
}

export interface SalesByDepartment {
  departments: DepartmentSalesItem[];
  /** Ventas que no se pudieron ubicar en ningún departamento. */
  unassigned: { sales: number; count: number };
}

export interface TopProductItem {
  name: string;
  quantity: number;
  revenue: number;
}

export interface LowStockItem {
  id: string;
  name: string;
  currentStock: number;
  minStock: number;
  category: string;
}

export interface FrequentCustomerItem {
  id: string;
  name: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
}

export interface SalesByDayItem {
  day: string;
  sales: number;
}

export interface SalesByHourItem {
  hour: string;
  sales: number;
  orders: number;
}

export interface SalesByDayAndHour {
  salesByDay: SalesByDayItem[];
  salesByHour: SalesByHourItem[];
}

/** El reporte de un producto: lo que muestra Estadísticas al escanearlo. */
export interface ReporteProducto {
  producto: { id: string; nombre: string; imagen: string | null };
  periodo: {
    unidades: number;
    ingresos: number;
    ventas: number;
    clientes: number;
    /** Lo que costó lo vendido; null si no hay costo registrado. */
    costo: number | null;
    /** false si alguna venta no registró costo: la ganancia es aproximada. */
    costoCompleto: boolean;
    /** Días del período; null en "Todo". */
    dias: number | null;
  };
  anterior: { unidades: number; ingresos: number } | null;
  granularidad: "hour" | "day" | "week" | "month";
  serie: Array<{ fecha: string; unidades: number; ingresos: number }>;
  /** Su puesto entre lo vendido en el período; null si no se vendió. */
  ranking: { puesto: number; de: number } | null;
  /** null si el producto no tiene inventario en la tienda elegida. */
  stock: { disponible: number; reservado: number } | null;
  ultimaCompra: {
    fecha: string;
    costo: number | null;
    cantidad: number;
    proveedor: string | null;
  } | null;
  ultimaVenta: string | null;
  clientesTop: Array<{ nombre: string; unidades: number }>;
}
