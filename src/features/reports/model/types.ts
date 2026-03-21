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
  color: string;
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
