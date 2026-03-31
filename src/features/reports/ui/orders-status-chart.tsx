import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ClipboardList } from "lucide-react";

interface OrdersStatusChartProps {
  data: Array<{ status: string; count: number; color: string }>;
}

export function OrdersStatusChart({ data }: OrdersStatusChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos por Estado</CardTitle>
        <CardDescription>Distribución de estados de pedidos</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground/60">
            <ClipboardList className="h-8 w-8" />
            <p className="text-sm mt-2">No hay pedidos en este período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80} fill="#8884d8" dataKey="count" nameKey="status">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
