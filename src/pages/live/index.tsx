import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Radio } from "lucide-react";

import { PageHeader } from "@/shared/ui/page-header";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { EmptyState } from "@/shared/ui/empty-state";
import { useStore } from "@/app/providers/auth";
import { useLives } from "@/entities/live/api";
import { CrearLiveModal } from "@/features/live/ui/CrearLiveModal";
import { CompartirLive } from "@/features/live/ui/CompartirLive";
import type { LiveSession } from "@/entities/live/model/types";

const ETIQUETA: Record<string, { texto: string; variant: any }> = {
  preparing: { texto: "Preparando", variant: "warning" },
  active: { texto: "En vivo", variant: "destructive" },
  finished: { texto: "Finalizado", variant: "secondary" },
  cancelled: { texto: "Cancelado", variant: "outline" },
};

/**
 * La puerta del Modo Live: el de ahora y los de antes.
 *
 * Arriba el que está en curso, porque si hay uno activo es lo único que
 * importa en ese momento. Abajo el historial, que es donde se resuelven las
 * colas de postores al día siguiente.
 */
export default function LivePage() {
  const { selectedStore } = useStore();
  const storeId = selectedStore && selectedStore !== "all" ? selectedStore.id : "all";

  const { data, isLoading } = useLives({ storeId, limit: 30 });
  const [crearAbierto, setCrearAbierto] = useState(false);

  const lives = data?.data ?? [];
  const enCurso = lives.find((l) => l.status === "active" || l.status === "preparing");
  const pasados = lives.filter((l) => l !== enCurso);

  const vendidosTotales = lives.reduce((s, l) => s + (l.summary?.vendidos ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modo Live"
        description="Vender en vivo lo que entra al inventario en el momento."
        stats={[
          { value: lives.length, label: "lives" },
          { value: vendidosTotales, label: "prendas vendidas" },
        ]}
        actions={
          <Button onClick={() => setCrearAbierto(true)}>
            <Plus className="h-4 w-4" />
            <span className="ml-1">Nuevo Live</span>
          </Button>
        }
      />

      {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}

      {!isLoading && lives.length === 0 && (
        <EmptyState
          icon={Radio}
          title="Todavía no hiciste ningún Live"
          description="Creá uno, sacale foto a lo que vas a vender y compartí el enlace. Las prendas entran al inventario en el momento."
          primaryAction={{ label: "Crear mi primer Live", onClick: () => setCrearAbierto(true) }}
        />
      )}

      {enCurso && <LiveEnCurso live={enCurso} />}

      {pasados.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Historial
          </h2>
          <div className="space-y-2">
            {pasados.map((live) => (
              <FilaHistorial key={live.id} live={live} />
            ))}
          </div>
        </section>
      )}

      <CrearLiveModal
        open={crearAbierto}
        onOpenChange={setCrearAbierto}
        storeId={storeId}
      />
    </div>
  );
}

function LiveEnCurso({ live }: { live: LiveSession }) {
  const activo = live.status === "active";
  const etiqueta = ETIQUETA[live.status];

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {activo && (
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
            </span>
          )}
          <div>
            <h2 className="font-semibold">{live.title}</h2>
            <Badge variant={etiqueta.variant}>{etiqueta.texto}</Badge>
          </div>
        </div>

        {/* Un botón y no dos: el Live es una sola pantalla, y el estado ya
            dice a qué vas: a armarlo o a conducirlo. */}
        <Button asChild variant={activo ? "default" : "outline"}>
          <Link to={`/live/${live.id}`}>{activo ? "Ir al Live" : "Preparar"}</Link>
        </Button>
      </div>

      {activo && (
        <CompartirLive token={live.publicToken} storeSlug={live.store?.slug} />
      )}
    </section>
  );
}

function FilaHistorial({ live }: { live: LiveSession }) {
  const etiqueta = ETIQUETA[live.status];
  const s = live.summary;

  return (
    <Link
      to={`/live/${live.id}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 hover:border-border-strong"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{live.title}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(live.created_at).toLocaleDateString()}
          {s && ` · ${s.items} prendas · ${s.vendidos} vendidas`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {s && s.ventasTotal > 0 && (
          <span className="tabular-nums text-sm font-semibold">
            {s.ventasTotal.toFixed(2)}
          </span>
        )}
        <Badge variant={etiqueta.variant}>{etiqueta.texto}</Badge>
      </div>
    </Link>
  );
}
