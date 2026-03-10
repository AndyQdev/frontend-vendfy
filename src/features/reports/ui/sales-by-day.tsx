import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface SalesByDayProps {
  data: Array<{
    day: string;
    sales: number;
  }>;
}

export function SalesByDay({ data }: SalesByDayProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Días con Más Ventas</CardTitle>
        <CardDescription>Patrón de ventas por día de la semana</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="sales" fill="#34d399" name="Ventas (Bs.)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
