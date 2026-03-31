import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type {
  ReportQueryParams,
  KPIData,
  SalesOverTimeItem,
  SalesByCategoryItem,
  OrderStatusItem,
  OrderChannelItem,
  TopProductItem,
  LowStockItem,
  FrequentCustomerItem,
  SalesByDayAndHour,
  FinancialComparisonItem,
} from "../model/types";

function buildQueryString(params: ReportQueryParams): string {
  const qs = new URLSearchParams();
  qs.append("period", params.period);
  if (params.startDate) qs.append("startDate", params.startDate);
  if (params.endDate) qs.append("endDate", params.endDate);
  if (params.storeId) qs.append("storeId", params.storeId);
  return qs.toString();
}

export function useReportKpis(params: ReportQueryParams) {
  return useQuery<KPIData>({
    queryKey: ["reports", "kpis", params],
    queryFn: async () => {
      const response = await apiFetch<KPIData>(`/api/reports/kpis?${buildQueryString(params)}`);
      return response.data!;
    },
  });
}

export function useReportSalesOverTime(params: ReportQueryParams) {
  return useQuery<SalesOverTimeItem[]>({
    queryKey: ["reports", "sales-over-time", params],
    queryFn: async () => {
      const response = await apiFetch<SalesOverTimeItem[]>(`/api/reports/sales-over-time?${buildQueryString(params)}`);
      return response.data || [];
    },
  });
}

export function useReportSalesByCategory(params: ReportQueryParams) {
  return useQuery<SalesByCategoryItem[]>({
    queryKey: ["reports", "sales-by-category", params],
    queryFn: async () => {
      const response = await apiFetch<SalesByCategoryItem[]>(`/api/reports/sales-by-category?${buildQueryString(params)}`);
      return response.data || [];
    },
  });
}

export function useReportOrdersByStatus(params: ReportQueryParams) {
  return useQuery<OrderStatusItem[]>({
    queryKey: ["reports", "orders-by-status", params],
    queryFn: async () => {
      const response = await apiFetch<OrderStatusItem[]>(`/api/reports/orders-by-status?${buildQueryString(params)}`);
      return response.data || [];
    },
  });
}

export function useReportOrderChannels(params: ReportQueryParams) {
  return useQuery<OrderChannelItem[]>({
    queryKey: ["reports", "order-channels", params],
    queryFn: async () => {
      const response = await apiFetch<OrderChannelItem[]>(`/api/reports/order-channels?${buildQueryString(params)}`);
      return response.data || [];
    },
  });
}

export function useReportTopProducts(params: ReportQueryParams) {
  return useQuery<TopProductItem[]>({
    queryKey: ["reports", "top-products", params],
    queryFn: async () => {
      const response = await apiFetch<TopProductItem[]>(`/api/reports/top-products?${buildQueryString(params)}`);
      return response.data || [];
    },
  });
}

export function useReportLowStock(storeId?: string) {
  return useQuery<LowStockItem[]>({
    queryKey: ["reports", "low-stock", storeId],
    queryFn: async () => {
      const qs = storeId ? `?storeId=${storeId}` : "";
      const response = await apiFetch<LowStockItem[]>(`/api/reports/low-stock${qs}`);
      return response.data || [];
    },
  });
}

export function useReportFrequentCustomers(params: ReportQueryParams) {
  return useQuery<FrequentCustomerItem[]>({
    queryKey: ["reports", "frequent-customers", params],
    queryFn: async () => {
      const response = await apiFetch<FrequentCustomerItem[]>(`/api/reports/frequent-customers?${buildQueryString(params)}`);
      return response.data || [];
    },
  });
}

export function useReportSalesByDay(params: ReportQueryParams) {
  return useQuery<SalesByDayAndHour>({
    queryKey: ["reports", "sales-by-day", params],
    queryFn: async () => {
      const response = await apiFetch<SalesByDayAndHour>(`/api/reports/sales-by-day?${buildQueryString(params)}`);
      return response.data!;
    },
  });
}

export function useReportFinancialComparison(params: ReportQueryParams) {
  return useQuery<FinancialComparisonItem[]>({
    queryKey: ["reports", "financial-comparison", params],
    queryFn: async () => {
      const response = await apiFetch<FinancialComparisonItem[]>(`/api/reports/financial-comparison?${buildQueryString(params)}`);
      return response.data || [];
    },
  });
}
