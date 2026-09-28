import { useMemo } from "react";
import { useWhatsAppStatus } from "@/entities/whatsapp/api";
import {
  useReportKpis,
  useReportLowStock,
  useReportOrderChannels,
  useReportOrdersByStatus,
  useReportSalesByDepartment,
  useReportSalesOverTime,
  useReportTopProducts,
} from "@/features/reports/api";
import type {
  KPIData,
  LowStockItem,
  OrderChannelItem,
  OrderStatusItem,
  SalesByDepartment,
  SalesOverTimeItem,
  TopProductItem,
} from "@/features/reports/model/types";

export type DashboardPeriod = "today" | "7days" | "30days" | "all";

export const DASHBOARD_PERIODS: Array<{
  value: DashboardPeriod;
  label: string;
  /** Con qué se compara. `null` cuando no hay período anterior equivalente. */
  comparisonLabel: string | null;
}> = [
  { value: "today", label: "Hoy", comparisonLabel: "ayer a esta hora" },
  { value: "7days", label: "7 días", comparisonLabel: "los 7 anteriores" },
  { value: "30days", label: "30 días", comparisonLabel: "los 30 anteriores" },
  { value: "all", label: "Todo", comparisonLabel: null },
];

export type DashboardChannelKey = "cash" | "online" | "whatsapp" | "other";

export interface DashboardChannel {
  key: DashboardChannelKey;
  label: string;
  sales: number;
  count: number;
  color: string;
}

export type DashboardStatusKey =
  | "to-confirm"
  | "pending"
  | "processing"
  | "shipping"
  | "completed"
  | "cancelled";

export interface DashboardOrderStatus {
  key: DashboardStatusKey;
  label: string;
  count: number;
  color: string;
}

export interface DashboardData {
  kpis: KPIData | null;
  channels: DashboardChannel[];
  statuses: DashboardOrderStatus[];
  salesOverTime: SalesOverTimeItem[];
  geography: SalesByDepartment;
  topProducts: TopProductItem[];
  lowStock: LowStockItem[];
  currentTotal: number;
  previousTotal: number;
  changePercent: number | null;
  comparisonLabel: string | null;
  totalOrders: number;
  isLoading: boolean;
  isFetching: boolean;
  hasPartialError: boolean;
  hasCriticalError: boolean;
  hasNoSales: boolean;
  isWhatsAppConnected: boolean | null;
  refetch: () => Promise<void>;
}

const CHANNELS: Array<
  Omit<DashboardChannel, "sales" | "count"> & { matches: string[] }
> = [
  {
    key: "cash",
    label: "Caja",
    color: "hsl(var(--chart-1))",
    matches: ["system", "sistema", "caja", "pos"],
  },
  // WhatsApp va antes que la tienda online a propósito: deja el cian y el verde
  // separados en la pila, que es el único par que cuesta distinguir de un vistazo.
  {
    key: "whatsapp",
    label: "WhatsApp",
    color: "#10B981",
    matches: ["whatsapp"],
  },
  {
    key: "online",
    label: "Tienda online",
    color: "hsl(var(--chart-2))",
    matches: ["web", "storefront", "app", "tienda online", "tienda web", "aplicacion"],
  },
  {
    key: "other",
    label: "Otros",
    color: "hsl(var(--chart-4))",
    matches: ["campaign", "campana", "live", "en vivo", "otros"],
  },
];

const STATUSES: Array<
  Omit<DashboardOrderStatus, "count"> & { matches: string[] }
> = [
  {
    key: "to-confirm",
    label: "Por confirmar",
    color: "#f97316",
    matches: ["por-confirmar", "por confirmar"],
  },
  {
    key: "pending",
    label: "Pendientes",
    color: "#f1c40f",
    matches: ["pendiente", "pendientes"],
  },
  {
    key: "processing",
    label: "En proceso",
    color: "#3498db",
    matches: ["en-proceso", "en proceso"],
  },
  {
    key: "shipping",
    label: "En camino",
    color: "#9b59b6",
    matches: ["en-camino", "en camino"],
  },
  {
    key: "completed",
    label: "Completados",
    color: "#2ecc71",
    matches: ["completado", "completados"],
  },
  {
    key: "cancelled",
    label: "Cancelados",
    color: "#e74c3c",
    matches: ["cancelado", "cancelados"],
  },
];

const ACCENTS: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ñ: "n",
};

/** Compara etiquetas del backend sin depender de tildes ni mayúsculas. */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[aeiounñ]|[áéíóú]/g, (char) => ACCENTS[char] ?? char);
}

function groupChannels(data: OrderChannelItem[]): DashboardChannel[] {
  const grouped = new Map<DashboardChannelKey, DashboardChannel>(
    CHANNELS.map(({ matches: _matches, ...channel }) => [
      channel.key,
      { ...channel, sales: 0, count: 0 },
    ]),
  );

  for (const item of data) {
    const normalized = normalize(item.channel);
    const definition =
      CHANNELS.find((channel) => channel.matches.includes(normalized)) ??
      CHANNELS[CHANNELS.length - 1];
    const current = grouped.get(definition.key)!;
    current.sales += Number(item.sales) || 0;
    current.count += Number(item.count) || 0;
  }

  return CHANNELS.map((channel) => grouped.get(channel.key)!);
}

function groupStatuses(data: OrderStatusItem[]): DashboardOrderStatus[] {
  const grouped = new Map<DashboardStatusKey, DashboardOrderStatus>(
    STATUSES.map(({ matches: _matches, ...status }) => [
      status.key,
      { ...status, count: 0 },
    ]),
  );

  for (const item of data) {
    const normalized = normalize(item.status);
    const definition = STATUSES.find((status) => status.matches.includes(normalized));
    if (!definition) continue;
    grouped.get(definition.key)!.count += Number(item.count) || 0;
  }

  return STATUSES.map((status) => grouped.get(status.key)!);
}

export function useDashboardData(
  period: DashboardPeriod,
  storeId?: string,
): DashboardData {
  const params = useMemo(() => ({ period, storeId }), [period, storeId]);
  const kpisQuery = useReportKpis(params);
  const salesQuery = useReportSalesOverTime(params);
  const statusesQuery = useReportOrdersByStatus(params);
  const channelsQuery = useReportOrderChannels(params);
  const geographyQuery = useReportSalesByDepartment(params);
  const topProductsQuery = useReportTopProducts(params);
  const lowStockQuery = useReportLowStock(storeId);
  const whatsappQuery = useWhatsAppStatus(storeId);

  const channels = useMemo(
    () => groupChannels(channelsQuery.data ?? []),
    [channelsQuery.data],
  );
  const statuses = useMemo(
    () => groupStatuses(statusesQuery.data ?? []),
    [statusesQuery.data],
  );
  const salesOverTime = salesQuery.data ?? [];
  const currentTotal = Number(kpisQuery.data?.totalSales) || 0;
  const previousTotal = salesOverTime.reduce(
    (total, point) => total + (Number(point.previousPeriod) || 0),
    0,
  );
  const comparisonLabel =
    DASHBOARD_PERIODS.find((item) => item.value === period)?.comparisonLabel ?? null;
  const changePercent =
    comparisonLabel && previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : null;
  const totalOrders = statuses.reduce((total, status) => total + status.count, 0);

  const reportQueries = [
    kpisQuery,
    salesQuery,
    statusesQuery,
    channelsQuery,
    geographyQuery,
    topProductsQuery,
    lowStockQuery,
  ];
  const isLoading = reportQueries.some((query) => query.isLoading);
  const isFetching = reportQueries.some((query) => query.isFetching);
  const errorCount = reportQueries.filter((query) => query.isError).length;

  return {
    kpis: kpisQuery.data ?? null,
    channels,
    statuses,
    salesOverTime,
    geography: geographyQuery.data ?? {
      departments: [],
      unassigned: { sales: 0, count: 0 },
    },
    topProducts: topProductsQuery.data ?? [],
    lowStock: lowStockQuery.data ?? [],
    currentTotal,
    previousTotal,
    changePercent,
    comparisonLabel,
    totalOrders,
    isLoading,
    isFetching,
    hasPartialError: errorCount > 0,
    hasCriticalError: kpisQuery.isError,
    hasNoSales: !isLoading && currentTotal === 0,
    isWhatsAppConnected: storeId
      ? whatsappQuery.data?.status === "connected"
      : null,
    refetch: async () => {
      await Promise.all(reportQueries.map((query) => query.refetch()));
      if (storeId) await whatsappQuery.refetch();
    },
  };
}
