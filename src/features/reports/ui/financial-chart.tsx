import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { FinancialComparisonItem } from "../model/types";

interface FinancialChartProps {
  data: FinancialComparisonItem[];
}

export function FinancialChart({ data }: FinancialChartProps) {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("es-BO", { day: "2-digit", month: "short" });
  };

  const formatted = data.map(item => ({
    ...item,
    date: formatDate(item.date),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas vs Compras vs Ganancia</CardTitle>
        <CardDescription>Comparación financiera en el período</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
            No hay datos en este período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `Bs. ${value.toFixed(2)}`,
                  name,
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="ventas"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Ventas"
              />
              <Line
                type="monotone"
                dataKey="compras"
                stroke="#f87171"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Compras"
              />
              <Line
                type="monotone"
                dataKey="ganancia"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Ganancia Neta"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
