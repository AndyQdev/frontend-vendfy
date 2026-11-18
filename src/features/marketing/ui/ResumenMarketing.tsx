import { AlertTriangle, Lightbulb, MessagesSquare } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Button } from "@/shared/ui/button";
import { useResumenMarketing } from "@/entities/marketing/api";
import { bs } from "@/entities/marketing/model/types";
import { EmbudoBarras } from "./Estimacion";

/** La primera pestaña: lo que entró por los chats, lo que costó y lo que volvió. */
export function ResumenMarketing({
  storeId,
  dias,
  onIrA,
}: {
  storeId: string;
  dias: number;
  onIrA: (tab: "ideas" | "chats" | "campanas") => void;
}) {
  const { data, isLoading } = useResumenMarketing(storeId, dias);

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  const e = data.embudo;
  const kpis = [
    { etiqueta: "Invertido en anuncios", valor: bs(data.gasto) },
    { etiqueta: "Escribieron", valor: String(e.personas) },
    { etiqueta: "Compraron", valor: String(e.etapas.compro) },
    { etiqueta: "Vendido por anuncios", valor: bs(data.vendidoPorAnuncios) },
    { etiqueta: "Retorno (ROAS)", valor: data.roas != null ? `${data.roas}×` : "—" },
  ];

  return (
    <div className="space-y-4">
      {data.avisos.map((a) => (
        <div
          key={`${a.campanaId}-${a.producto}`}
          role="status"
          className="flex items-start gap-2 rounded-xl border border-warning-soft bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>{a.producto}</b> se anuncia en «{a.campana}» y le quedan {a.stock} unidades. Si se acaba, la campaña se pausa sola.
          </span>
        </div>
      ))}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.etiqueta} className="p-4">
            <dt className="etiqueta text-muted-foreground">{k.etiqueta}</dt>
            <dd className="cifra mt-1 text-xl font-bold">{k.valor}</dd>
          </Card>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Camino a la venta</h2>
              <p className="text-sm text-muted-foreground">
                Las personas que escribieron por WhatsApp en los últimos {data.dias} días y hasta dónde llegaron.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onIrA("chats")}>
              <MessagesSquare className="mr-1.5 h-4 w-4" /> Ver el tablero
            </Button>
          </div>
          {e.personas ? (
            <EmbudoBarras embudo={e} />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Todavía nadie escribió en este período.</p>
          )}
          {data.anuncios.personas > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              De ellos, {data.anuncios.personas} llegaron por un anuncio y {data.anuncios.etapas.compro} compraron.
            </p>
          )}
        </Card>

        <Card className="flex flex-col justify-between gap-4 p-5">
          <div>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <Lightbulb className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold">¿Cómo vendo más?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Vendfy mira tus ventas, tu stock y tus chats, y te propone campañas con cuánto invertir y cuánto podría volver.
            </p>
          </div>
          <Button onClick={() => onIrA("ideas")}>Ver ideas de campaña</Button>
        </Card>
      </div>
    </div>
  );
}
