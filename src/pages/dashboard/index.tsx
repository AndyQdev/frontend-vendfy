import { AlertCircle } from "lucide-react";
import { useAuth, useStore } from "@/app/providers/auth";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import {
  useDashboardData,
  type DashboardPeriod,
} from "@/features/dashboard/model/use-dashboard-data";
import { DashboardGreeting } from "@/features/dashboard/ui/DashboardGreeting";
import { DailyPulseCard } from "@/features/dashboard/ui/DailyPulseCard";
import { DashboardKpis } from "@/features/dashboard/ui/DashboardKpis";
import { AttentionPanel } from "@/features/dashboard/ui/AttentionPanel";
import { ChannelsCompact } from "@/features/dashboard/ui/ChannelsCompact";
import { OrderPipeline } from "@/features/dashboard/ui/OrderPipeline";
import { DashboardSalesTrend } from "@/features/dashboard/ui/DashboardSalesTrend";
import { TopProductsCompact } from "@/features/dashboard/ui/TopProductsCompact";

/** El inicio muestra el acumulado del negocio; los cortes por fecha viven en /reports. */
const PERIOD: DashboardPeriod = "all";

export default function DashboardPage() {
  const { user } = useAuth();
  const { selectedStore } = useStore();

  const storeId =
    selectedStore && selectedStore !== "all" ? selectedStore.id : undefined;
  const storeName =
    selectedStore && selectedStore !== "all" ? selectedStore.name : "Todas las tiendas";

  const data = useDashboardData(PERIOD, storeId);

  return (
    <div className="space-y-5">
      <DashboardGreeting userName={user?.name} storeName={storeName} />

      {data.hasPartialError && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              {data.hasCriticalError
                ? "No pudimos cargar los datos."
                : "Algunos bloques no se pudieron cargar."}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void data.refetch()}
              disabled={data.isFetching}
            >
              {data.isFetching ? "Actualizando..." : "Reintentar"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* El mapa manda: ocupa dos tercios y los indicadores se apilan al costado,
          que además evita el aire que quedaba debajo de cuatro tarjetas. */}
      <section className="grid items-stretch gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DailyPulseCard data={data} />
        </div>
        <div className="flex flex-col gap-4">
          <DashboardKpis kpis={data.kpis} isLoading={data.isLoading} />
          <AttentionPanel data={data} className="flex-1" />
        </div>
      </section>

      <section className="grid items-stretch gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OrderPipeline statuses={data.statuses} />
        </div>
        <ChannelsCompact channels={data.channels} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DashboardSalesTrend data={data.salesOverTime} period={PERIOD} />
        <TopProductsCompact products={data.topProducts} />
      </section>
    </div>
  );
}
