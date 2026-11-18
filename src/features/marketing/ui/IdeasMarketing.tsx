import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Lightbulb, Lock, MapPin, MessageCircle, Megaphone, Package } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/empty-state";
import { useCrearCampana, useIdeas } from "@/entities/marketing/api";
import type { Idea } from "@/entities/marketing/model/types";
import { RangoEstimado } from "./Estimacion";

const CANAL: Record<Idea["canal"], { texto: string; icono: typeof Megaphone }> = {
  ctwa: { texto: "Anuncio que lleva a WhatsApp", icono: Megaphone },
  plantilla_wa: { texto: "Mensaje de WhatsApp", icono: MessageCircle },
};

/** Las ideas de campaña que salen de los datos de la tienda, con su estimación. */
export function IdeasMarketing({ storeId, puedeGestionar }: { storeId: string; puedeGestionar: boolean }) {
  const [presupuesto, setPresupuesto] = useState<number | undefined>();
  const [dias, setDias] = useState<number | undefined>();
  const { data, isLoading, isFetching } = useIdeas(storeId, { presupuesto, dias });
  const crear = useCrearCampana(storeId);
  const navigate = useNavigate();

  const armar = async (i: Idea) => {
    try {
      const c = await crear.mutateAsync({
        desdeIdea: { tipo: i.tipo, productos: i.productos.map((p) => p.id) },
        presupuestoDiario: i.presupuestoDiario || undefined,
        dias: i.dias,
      });
      toast.success("Borrador listo: revísalo antes de activarlo");
      navigate(`/marketing/campanas/${c.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo armar el borrador");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h2 className="text-base font-semibold">Ideas para vender más</h2>
          <p className="text-sm text-muted-foreground">
            Salen de tus ventas, tu stock y tus chats. Cambia el presupuesto para ver qué podría pasar.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ideas-presupuesto">Bs por día</Label>
          <Input
            id="ideas-presupuesto"
            type="number"
            inputMode="decimal"
            min={5}
            max={data?.tope ?? 40}
            className="w-28"
            placeholder="35"
            onBlur={(e) => setPresupuesto(Number(e.target.value) || undefined)}
            onKeyDown={(e) => e.key === "Enter" && setPresupuesto(Number((e.target as HTMLInputElement).value) || undefined)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ideas-dias">Días</Label>
          <Input
            id="ideas-dias"
            type="number"
            min={1}
            max={30}
            className="w-20"
            placeholder="7"
            onBlur={(e) => setDias(Number(e.target.value) || undefined)}
            onKeyDown={(e) => e.key === "Enter" && setDias(Number((e.target as HTMLInputElement).value) || undefined)}
          />
        </div>
        {data && <p className="w-full text-xs text-muted-foreground">Durante el piloto, cada campaña gasta como máximo Bs {data.tope} por día.</p>}
      </Card>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : !data?.ideas.length ? (
        <EmptyState
          icon={Lightbulb}
          title="Todavía no hay ideas"
          description="Carga productos con foto y stock, o registra algunas ventas: con eso Vendfy arma la primera campaña."
        />
      ) : (
        <div className={`grid gap-4 lg:grid-cols-2 ${isFetching ? "opacity-70" : ""}`}>
          {data.ideas.map((i) => (
            <TarjetaIdea
              key={`${i.tipo}-${i.productos.map((p) => p.id).join("-")}`}
              idea={i}
              puedeGestionar={puedeGestionar}
              armando={crear.isPending}
              onArmar={() => armar(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaIdea({
  idea,
  puedeGestionar,
  armando,
  onArmar,
}: {
  idea: Idea;
  puedeGestionar: boolean;
  armando: boolean;
  onArmar: () => void;
}) {
  const canal = CANAL[idea.canal];
  const Icono = canal.icono;
  const [sinFoto, setSinFoto] = useState(false);
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        {idea.productos[0]?.imagen && !sinFoto ? (
          <img
            src={idea.productos[0].imagen}
            alt=""
            onError={() => setSinFoto(true)}
            className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
            <Icono className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Badge variant={idea.canal === "ctwa" ? "info" : "secondary"} className="mb-1">
            <Icono className="mr-1 h-3 w-3" /> {canal.texto}
          </Badge>
          <h3 className="font-semibold leading-snug">{idea.titulo}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{idea.porque}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" /> {idea.publico.descripcion}
        </span>
        {idea.productos.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Package className="h-3.5 w-3.5" /> {idea.productos.map((p) => p.nombre).join(" + ")}
          </span>
        )}
        {idea.canal === "ctwa" && (
          <span>
            Bs {idea.presupuestoDiario} por día · {idea.dias} días
          </span>
        )}
      </div>

      <RangoEstimado e={idea.estimacion} compacto />

      {idea.avisos.length > 0 && (
        <ul className="space-y-1 text-xs text-warning-soft-foreground">
          {idea.avisos.slice(0, 2).map((a) => (
            <li key={a} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto">
        {idea.bloqueo ? (
          <p className="flex gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {idea.bloqueo}
          </p>
        ) : (
          puedeGestionar && (
            <Button className="w-full" onClick={onArmar} loading={armando}>
              Armar campaña
            </Button>
          )
        )}
      </div>
    </Card>
  );
}
