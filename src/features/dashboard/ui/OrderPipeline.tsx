import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import type { DashboardOrderStatus } from "../model/use-dashboard-data";

/**
 * Carril de pedidos en HTML/CSS: profundidad sutil, sin WebGL, para que siga siendo operable.
 */
export function OrderPipeline({ statuses }: { statuses: DashboardOrderStatus[] }) {
  const navigate = useNavigate();
  // Se muestran todos los estados, cancelados incluidos: esconderlos haría que
  // los números del carril no cerraran con el total de pedidos.
  const visible = statuses;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Flujo de pedidos</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex snap-x gap-2 overflow-x-auto pb-1">
          {visible.map((status, index) => (
            <li key={status.key} className="flex shrink-0 snap-start items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/orders")}
                className="press min-w-[120px] rounded-xl border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${status.label}: ${status.count} pedidos. Abrir pedidos`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {status.label}
                  </span>
                </span>
                <span className="mt-1 block text-2xl font-bold">{status.count}</span>
              </button>

              {index < visible.length - 1 && (
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
