import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, Package, Clock } from "lucide-react";

interface KPICardsProps {
  data: {
    totalSales: number;
    totalOrders: number;
    averageTicket: number;
    lowStockProducts: number;
    pendingOrders: number;
  };
}

export function KPICards({ data }: KPICardsProps) {
  const kpis = [
    {
      title: "Ventas Totales",
      value: `Bs. ${data.totalSales.toLocaleString()}`,
      icon: DollarSign,
      description: "+12% vs mes anterior",
      trend: "up",
    },
    {
      title: "Número de Pedidos",
      value: data.totalOrders.toString(),
      icon: ShoppingCart,
      description: "+8% vs mes anterior",
      trend: "up",
    },
    {
      title: "Ticket Promedio",
      value: `Bs. ${data.averageTicket.toLocaleString()}`,
      icon: TrendingUp,
      description: "+5% vs mes anterior",
      trend: "up",
    },
    {
      title: "Stock Bajo",
      value: data.lowStockProducts.toString(),
      icon: Package,
      description: "Productos con stock crítico",
      trend: "warning",
    },
    {
      title: "Pedidos Pendientes",
      value: data.pendingOrders.toString(),
      icon: Clock,
      description: "Requieren atención",
      trend: "neutral",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {kpi.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className={`text-xs ${
                kpi.trend === 'up' ? 'text-green-600' : 
                kpi.trend === 'warning' ? 'text-orange-600' : 
                'text-muted-foreground'
              }`}>
                {kpi.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
