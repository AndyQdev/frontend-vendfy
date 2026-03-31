import { KPICards } from "./kpi-cards";
import { SalesChart } from "./sales-chart";
import { OrderChannelsChart } from "./order-channels-chart";
import { OrdersStatusChart } from "./orders-status-chart";
import { TopProductsChart } from "./top-products-chart";
import { SalesByCategoryChart } from "./sales-by-category-chart";
import { FinancialChart } from "./financial-chart";
import { FrequentCustomers } from "./frequent-customers";
import { SalesByDay } from "./sales-by-day";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Skeleton } from "@/shared/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { useMemo, useState } from "react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useStore } from "@/app/providers/auth";
import {
  useReportKpis,
  useReportSalesOverTime,
  useReportSalesByCategory,
  useReportOrdersByStatus,
  useReportOrderChannels,
  useReportTopProducts,
  useReportFrequentCustomers,
  useReportSalesByDay,
  useReportFinancialComparison,
} from "../api";
import type { ReportQueryParams } from "../model/types";

export function Reports() {
  const [period, setPeriod] = useState("7days");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const { selectedStore } = useStore();

  const storeId = selectedStore && selectedStore !== "all" ? selectedStore.id : undefined;

  const queryParams: ReportQueryParams = useMemo(() => {
    const params: ReportQueryParams = { period, storeId };
    if (period === "custom" && dateRange?.from && dateRange?.to) {
      params.startDate = format(dateRange.from, "yyyy-MM-dd");
      params.endDate = format(dateRange.to, "yyyy-MM-dd");
    }
    return params;
  }, [period, dateRange, storeId]);

  const kpis = useReportKpis(queryParams);
  const salesOverTime = useReportSalesOverTime(queryParams);
  const salesByCategory = useReportSalesByCategory(queryParams);
  const ordersByStatus = useReportOrdersByStatus(queryParams);
  const orderChannels = useReportOrderChannels(queryParams);
  const topProducts = useReportTopProducts(queryParams);
  const financialComparison = useReportFinancialComparison(queryParams);
  const frequentCustomers = useReportFrequentCustomers(queryParams);
  const salesByDay = useReportSalesByDay(queryParams);

  const periods = [
    { value: "today", label: "Hoy" },
    { value: "7days", label: "7 días" },
    { value: "30days", label: "30 días" },
    { value: "thisMonth", label: "Este mes" },
    { value: "custom", label: "Personalizado" },
  ];

  const handlePeriodClick = (value: string) => {
    setPeriod(value);
    if (value !== "custom") {
      setCustomDateOpen(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header con Filtros */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Dashboard de Reportes</h1>
        <div className="flex gap-2 flex-wrap items-center">
          {periods.map((p) => (
            p.value === "custom" ? (
              <Popover key={p.value} open={customDateOpen} onOpenChange={setCustomDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={period === p.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodClick(p.value)}
                  >
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "dd MMM", { locale: es })} - ${format(dateRange.to, "dd MMM", { locale: es })}`
                      : p.label}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    disabled={(date) =>
                      date > new Date() || date < new Date("2020-01-01")
                    }
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <Button
                key={p.value}
                variant={period === p.value ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodClick(p.value)}
              >
                {p.label}
              </Button>
            )
          ))}
        </div>
      </div>

      {/* Bloque 1: KPIs Principales */}
      {kpis.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-20" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-28 mb-1" /><Skeleton className="h-3 w-32" /></CardContent>
            </Card>
          ))}
        </div>
      ) : kpis.data ? (
        <KPICards data={kpis.data} />
      ) : null}

      {/* Bloque 2: Gráfica de Ventas */}
      {salesOverTime.isLoading ? (
        <ChartSkeleton />
      ) : (
        <SalesChart data={salesOverTime.data || []} />
      )}

      {/* Bloque 3: Análisis de Pedidos */}
      <div className="grid gap-6 md:grid-cols-2">
        {ordersByStatus.isLoading ? (
          <ChartSkeleton />
        ) : (
          <OrdersStatusChart data={ordersByStatus.data || []} />
        )}
        {orderChannels.isLoading ? (
          <ChartSkeleton />
        ) : (
          <OrderChannelsChart data={orderChannels.data || []} />
        )}
      </div>

      {/* Bloque 4: Comparación Financiera */}
      {financialComparison.isLoading ? (
        <ChartSkeleton />
      ) : (
        <FinancialChart data={financialComparison.data || []} />
      )}

      {/* Bloque 4b: Productos Top */}
      <div className="grid gap-6 md:grid-cols-2">
        {topProducts.isLoading ? (
          <ChartSkeleton />
        ) : (
          <TopProductsChart data={topProducts.data || []} />
        )}
        {salesByCategory.isLoading ? (
          <ChartSkeleton />
        ) : (
          <SalesByCategoryChart data={salesByCategory.data || []} />
        )}
      </div>

      {/* Bloque 5: Información Estratégica */}
      <div className="grid gap-6 md:grid-cols-2">
        {frequentCustomers.isLoading ? (
          <ChartSkeleton />
        ) : (
          <FrequentCustomers data={frequentCustomers.data || []} />
        )}
        {salesByDay.isLoading ? (
          <ChartSkeleton />
        ) : (
          <SalesByDay
            data={salesByDay.data?.salesByDay || []}
            hourlyData={salesByDay.data?.salesByHour || []}
          />
        )}
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40 mb-1" />
        <Skeleton className="h-3 w-56" />
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-[300px] pt-8">
          {[40, 65, 45, 80, 55, 70, 50, 60, 75, 45, 85, 55].map((h, i) => (
            <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
