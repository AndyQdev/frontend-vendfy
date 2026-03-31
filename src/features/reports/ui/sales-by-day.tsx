import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar } from "lucide-react";

interface SalesByDayProps {
  data: Array<{ day: string; sales: number }>;
  hourlyData?: Array<{ hour: string; sales: number; orders: number }>;
}

export function SalesByDay({ data, hourlyData }: SalesByDayProps) {
  const hasData = data.length > 0;
  const hasHourly = hourlyData && hourlyData.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Días con Más Ventas</CardTitle>
        <CardDescription>Patrón de ventas por día y hora</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground/60">
            <Calendar className="h-8 w-8" />
            <p className="text-sm mt-2">No hay ventas por día en este período</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sales" fill="#34d399" name="Ventas (Bs.)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {hasHourly && (
              <>
                <p className="text-sm font-medium text-muted-foreground">Ventas por hora del día</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" fontSize={11} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sales" fill="#60a5fa" name="Ventas (Bs.)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
