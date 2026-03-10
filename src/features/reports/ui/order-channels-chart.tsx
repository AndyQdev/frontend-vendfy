import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface OrderChannelsChartProps {
  data: Array<{
    channel: string;
    count: number;
    color: string;
  }>;
}

export function OrderChannelsChart({ data }: OrderChannelsChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Canal de Pedidos</CardTitle>
        <CardDescription>Distribución de pedidos por canal de origen</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="count"
              nameKey="channel"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => [
                `${value} pedidos (${((value / total) * 100).toFixed(1)}%)`,
                ''
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
