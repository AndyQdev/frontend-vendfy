import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, MessageCircleQuestion, X } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/empty-state";
import { useDescartarPregunta, usePreguntas, useResponderPregunta } from "@/entities/agente/api";
import type { PreguntaSinRespuesta } from "@/entities/agente/model/types";

/**
 * Lo que tus clientes preguntaron y el agente no supo responder. Lo respondes
 * una vez y queda en la ficha de la tienda: la próxima vez ya lo sabe.
 */
export function Preguntas({ storeId }: { storeId: string }) {
  const { data = [], isLoading } = usePreguntas(storeId);
  const pendientes = data.filter((p) => p.estado === "pendiente");

  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if (!pendientes.length) {
    return (
      <EmptyState
        icon={MessageCircleQuestion}
        title="Ninguna pregunta pendiente"
        description="Cuando un cliente pregunte algo que tu vendedor no sabe (un envío a otra ciudad, una política), en vez de inventar te lo deja aquí."
      />
    );
  }
  return (
    <div className="space-y-3">
      {pendientes.map((p) => (
        <TarjetaPregunta key={p.id} storeId={storeId} p={p} />
      ))}
    </div>
  );
}

function TarjetaPregunta({ storeId, p }: { storeId: string; p: PreguntaSinRespuesta }) {
  const responder = useResponderPregunta(storeId);
  const descartar = useDescartarPregunta(storeId);
  const [respuesta, setRespuesta] = useState("");
  return (
    <Card className="space-y-2.5 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">«{p.pregunta}»</p>
        <span className="shrink-0 text-xs text-muted-foreground">{p.veces > 1 ? `${p.veces} veces` : "1 vez"}</span>
      </div>
      <Textarea rows={2} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Tu respuesta, como se la dirías al cliente" aria-label={`Respuesta a: ${p.pregunta}`} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={descartar.isPending} onClick={() => descartar.mutate(p.id)}>
          <X className="mr-1 h-3.5 w-3.5" /> No aplica
        </Button>
        <Button
          size="sm"
          disabled={!respuesta.trim() || responder.isPending}
          onClick={() =>
            responder.mutate(
              { id: p.id, respuesta },
              { onSuccess: () => toast.success("Respondida: tu vendedor ya lo sabe"), onError: (e: any) => toast.error(e?.message ?? "No se pudo guardar") },
            )
          }
        >
          {responder.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />} Guardar respuesta
        </Button>
      </div>
    </Card>
  );
}
