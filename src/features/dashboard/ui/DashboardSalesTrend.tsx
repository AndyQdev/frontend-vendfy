import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatMoney } from "@/shared/lib/money";
import type { SalesOverTimeItem } from "@/features/reports/model/types";
import type { DashboardPeriod } from "../model/use-dashboard-data";

const TITLES: Record<DashboardPeriod, string> = {
  today: "Ventas por hora",
  "7days": "Ventas por día",
  "30days": "Ventas por día",
  all: "Ventas por mes",
};

export function DashboardSalesTrend({
  data,
  period,
}: {
  data: SalesOverTimeItem[];
  period: DashboardPeriod;
}) {
  const hasData = data.some((point) => point.sales > 0 || point.previousPeriod > 0);
  const showComparison = period !== "all";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{TITLES[period]}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Todavía no hay ventas registradas en este período.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value: number) => formatMoney(value)}
                />
                <Tooltip
                  formatter={(value: number, name) => [
                    formatMoney(value),
                    name === "sales" ? "Hoy" : "Ayer",
                  ]}
                  labelFormatter={(label) => (period === "today" ? `Hora ${label}` : label)}
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                {showComparison && (
                  <Area
                    type="monotone"
                    dataKey="previousPeriod"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fill="none"
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#dashboardSales)"
                />
              </AreaChart>
            </ResponsiveContainer>

            <table className="sr-only">
              <caption>Ventas por hora comparadas con el día anterior</caption>
              <thead>
                <tr>
                  <th scope="col">Hora</th>
                  <th scope="col">Hoy</th>
                  <th scope="col">Ayer</th>
                </tr>
              </thead>
              <tbody>
                {data.map((point) => (
                  <tr key={point.date}>
                    <th scope="row">{point.date}</th>
                    <td>{formatMoney(point.sales)}</td>
                    <td>{formatMoney(point.previousPeriod)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
