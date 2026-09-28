import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ClipboardList, Package, Plus, Truck } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { DashboardIllustration } from "./DashboardIllustration";

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

interface DashboardGreetingProps {
  userName?: string;
  storeName: string;
}

export function DashboardGreeting({ userName, storeName }: DashboardGreetingProps) {
  const navigate = useNavigate();
  const now = new Date();
  const firstName = userName?.trim().split(" ")[0];

  return (
    <Card className="overflow-hidden">
      {/* Saludo e ilustración forman una sola pieza: la imagen acompaña al
          mensaje en vez de flotar suelta en una esquina. */}
      <CardContent className="grid items-center gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_200px] lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold sm:text-3xl">
              {greetingFor(now)}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground first-letter:uppercase">
              {format(now, "EEEE d 'de' MMMM", { locale: es })} · {storeName}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/caja")} className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva venta
            </Button>
            <Button variant="outline" onClick={() => navigate("/products/create")} className="gap-2">
              <Package className="h-4 w-4" />
              Nuevo producto
            </Button>
            <Button variant="outline" onClick={() => navigate("/purchases/new")} className="gap-2">
              <Truck className="h-4 w-4" />
              Registrar compra
            </Button>
            <Button variant="ghost" onClick={() => navigate("/orders")} className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Ver pedidos
            </Button>
          </div>
        </div>

        <DashboardIllustration className="hidden sm:block" />
      </CardContent>
    </Card>
  );
}
