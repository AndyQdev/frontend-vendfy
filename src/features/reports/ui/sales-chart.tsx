import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface SalesChartProps {
  data: Array<{
    date: string;
    sales: number;
    previousPeriod?: number;
  }>;
}

export function SalesChart({ data }: SalesChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas en el Tiempo</CardTitle>
        <CardDescription>
          Evolución de ventas con comparación al período anterior
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.6}/>
                <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.5}/>
                <stop offset="95%" stopColor="#9ca3af" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="sales" 
              stroke="#34d399" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorSales)"
              name="Período Actual"
            />
            {data[0]?.previousPeriod !== undefined && (
              <Area 
                type="monotone" 
                dataKey="previousPeriod" 
                stroke="#9ca3af" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorPrevious)"
                name="Período Anterior"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
