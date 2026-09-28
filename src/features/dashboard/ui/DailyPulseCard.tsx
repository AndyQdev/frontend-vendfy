import { useNavigate } from "react-router-dom";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { formatMoney } from "@/shared/lib/money";
import { BoliviaSalesMap } from "./daily-tower";
import type { DashboardData } from "../model/use-dashboard-data";

function ComparisonBadge({
  changePercent,
  comparisonLabel,
}: {
  changePercent: number | null;
  comparisonLabel: string | null;
}) {
  if (changePercent === null) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <Minus className="h-4 w-4" aria-hidden="true" />
        {comparisonLabel ? "Sin referencia anterior" : "Acumulado histórico"}
      </span>
    );
  }

  const isUp = changePercent >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-medium ${
        isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {isUp ? "+" : ""}
      {changePercent.toFixed(1)}% vs. {comparisonLabel}
    </span>
  );
}

export function DailyPulseCard({ data }: { data: DashboardData }) {
  const navigate = useNavigate();

  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pulso Vendfy · Ventas por departamento
            </p>
            <p className="mt-1 text-3xl font-bold sm:text-4xl">
              {formatMoney(data.currentTotal)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <ComparisonBadge
                changePercent={data.changePercent}
                comparisonLabel={data.comparisonLabel}
              />
              <span className="text-sm text-muted-foreground">
                {data.totalOrders} {data.totalOrders === 1 ? "pedido" : "pedidos"}
              </span>
            </div>
          </div>

          {data.hasNoSales && !data.isLoading && (
            <Button size="sm" onClick={() => navigate("/caja")}>
              Registrar una venta
            </Button>
          )}
        </div>

        <BoliviaSalesMap
          departments={data.geography.departments}
          unassigned={data.geography.unassigned}
        />
      </CardContent>
    </Card>
  );
}
