import { AlertTriangle, Clock, Receipt, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatMoney } from "@/shared/lib/money";
import type { KPIData } from "@/features/reports/model/types";

interface KpiTile {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

export function DashboardKpis({
  kpis,
  isLoading,
}: {
  kpis: KPIData | null;
  isLoading: boolean;
}) {
  if (isLoading || !kpis) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="p-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-3 h-7 w-32" />
          </Card>
        ))}
      </div>
    );
  }

  const tiles: KpiTile[] = [
    {
      label: "Ganancia estimada",
      value: formatMoney(kpis.gananciaReal),
      hint: `Margen ${kpis.margen.toFixed(1)}%`,
      icon: TrendingUp,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Pedidos pendientes",
      value: String(kpis.pendingOrders),
      hint: "Esperando avance",
      icon: Clock,
      iconBg: "bg-yellow-100 dark:bg-yellow-900/20",
      iconColor: "text-yellow-700 dark:text-yellow-400",
    },
    {
      label: "Ticket promedio",
      value: formatMoney(kpis.averageTicket),
      hint: `${kpis.totalOrders} ${kpis.totalOrders === 1 ? "venta" : "ventas"}`,
      icon: Receipt,
      iconBg: "bg-blue-100 dark:bg-blue-900/20",
      iconColor: "text-blue-700 dark:text-blue-400",
    },
    {
      label: "Productos por agotarse",
      value: String(kpis.lowStockProducts),
      hint: "Stock bajo",
      icon: AlertTriangle,
      iconBg: "bg-red-100 dark:bg-red-900/20",
      iconColor: "text-red-700 dark:text-red-400",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tiles.map((tile) => (
        <Card key={tile.label} className="p-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${tile.iconBg}`}>
              <tile.icon className={`h-5 w-5 ${tile.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{tile.label}</p>
              <p className="truncate text-xl font-bold">{tile.value}</p>
              {tile.hint && (
                <p className="text-xs text-muted-foreground">{tile.hint}</p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
