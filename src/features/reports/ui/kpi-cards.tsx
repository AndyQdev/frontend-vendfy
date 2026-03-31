import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, TrendingDown, Package, Percent } from "lucide-react";
import type { KPIData } from "../model/types";

interface KPICardsProps {
  data: KPIData;
}

export function KPICards({ data }: KPICardsProps) {
  const kpis = [
    {
      title: "Ingresos",
      value: `Bs. ${data.totalSales.toLocaleString()}`,
      icon: DollarSign,
      description: `${data.totalOrders} pedidos completados`,
      color: "text-green-600",
      iconBg: "bg-green-100 dark:bg-green-900/20",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "Invertido",
      value: `Bs. ${data.totalCompras.toLocaleString()}`,
      icon: TrendingDown,
      description: "Total gastado en compras",
      color: "text-red-600",
      iconBg: "bg-red-100 dark:bg-red-900/20",
      iconColor: "text-red-600 dark:text-red-400",
    },
    {
      title: "Ganancia Neta",
      value: `Bs. ${data.gananciaReal.toLocaleString()}`,
      icon: TrendingUp,
      description: "Ingresos - costo de lo vendido",
      color: data.gananciaReal >= 0 ? "text-emerald-600" : "text-red-600",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Margen",
      value: `${data.margen.toFixed(1)}%`,
      icon: Percent,
      description: "Rentabilidad sobre ventas",
      color: data.margen >= 30 ? "text-emerald-600" : data.margen >= 10 ? "text-yellow-600" : "text-red-600",
      iconBg: data.margen >= 30 ? "bg-emerald-100 dark:bg-emerald-900/20" : data.margen >= 10 ? "bg-yellow-100 dark:bg-yellow-900/20" : "bg-red-100 dark:bg-red-900/20",
      iconColor: data.margen >= 30 ? "text-emerald-600" : data.margen >= 10 ? "text-yellow-600" : "text-red-600",
    },
    {
      title: "Pedidos",
      value: data.totalOrders.toString(),
      icon: ShoppingCart,
      description: "Órdenes en este período",
      color: "text-blue-600",
      iconBg: "bg-blue-100 dark:bg-blue-900/20",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <div className={`p-1.5 rounded-lg ${kpi.iconBg}`}>
                <Icon className={`h-4 w-4 ${kpi.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
