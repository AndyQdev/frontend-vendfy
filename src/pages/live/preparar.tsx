import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, PackageSearch, Play } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/shared/ui/page-header";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { useLive, useStartLive } from "@/entities/live/api";
import { AltaRapidaProducto } from "@/features/live/ui/AltaRapidaProducto";
import { SelectorProductosDisponibles } from "@/features/live/ui/SelectorProductosDisponibles";
import { GrillaItemsLive } from "@/features/live/ui/GrillaItemsLive";
import { CompartirLive } from "@/features/live/ui/CompartirLive";
import { ConfigurarSubastaModal } from "@/features/live/ui/ConfigurarSubastaModal";
import { ColaPostores } from "@/features/live/ui/ColaPostores";
import { EditarPrendaModal } from "@/features/live/ui/EditarPrendaModal";
import type { LiveItem } from "@/entities/live/model/types";

/**
 * La pantalla donde se arma el Live.
 *
 * Las dos formas de sumar prendas tienen el mismo peso visual porque son dos
 * casos igual de comunes: lo que se fotografía en el momento y lo que sobró
 * del Live anterior.
 *
 * Sirve también de detalle del historial: un Live terminado se abre acá y se
 * ve qué pasó, incluida la cola de postores de cada subasta.
 */
export default function PrepararLivePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: live, isLoading } = useLive(id);
  const iniciar = useStartLive(id);

  const [altaAbierta, setAltaAbierta] = useState(false);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [subastando, setSubastando] = useState<LiveItem | null>(null);
  const [viendoCola, setViendoCola] = useState<LiveItem | null>(null);
  const [editando, setEditando] = useState<LiveItem | null>(null);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (!live) return <p className="text-sm text-muted-foreground">Live no encontrado.</p>;

  const activos = live.items.filter((i) => i.status === "active");
  const disponibles = activos.filter((i) => i.disponible > 0).length;
  const terminado = live.status === "finished" || live.status === "cancelled";

  const empezar = async () => {
    try {
      await iniciar.mutateAsync();
      toast.success("El Live está en el aire");
      navigate(`/live/${id}/control`);
    } catch (error) {
      toast.error((error as Error).message || "No se pudo iniciar");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to="/live">
            <ArrowLeft className="h-4 w-4" />
            <span className="ml-1">Modo Live</span>
          </Link>
        </Button>

        <PageHeader
          title={live.title}
          description={live.description ?? undefined}
          stats={[
            { value: activos.length, label: "prendas" },
            { value: disponibles, label: "disponibles", tone: "success" },
            ...(live.summary
              ? [{ value: live.summary.vendidos, label: "vendidas" }]
              : []),
          ]}
          actions={
            live.status === "preparing" ? (
              <Button onClick={empezar} disabled={iniciar.isPending || activos.length === 0}>
                <Play className="h-4 w-4" />
                <span className="ml-1">Iniciar Live</span>
              </Button>
            ) : live.status === "active" ? (
              <Button asChild>
                <Link to={`/live/${id}/control`}>Ir al control</Link>
              </Button>
            ) : (
              <Badge variant="secondary">Finalizado</Badge>
            )
          }
        />
      </div>

      {!terminado && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAltaAbierta(true)}>
              <Camera className="h-4 w-4" />
              <span className="ml-1">Agregar con foto</span>
            </Button>
            <Button variant="outline" onClick={() => setSelectorAbierto(true)}>
              <PackageSearch className="h-4 w-4" />
              <span className="ml-1">Usar productos disponibles</span>
            </Button>
          </div>

          {live.status === "active" && (
            <CompartirLive token={live.publicToken} storeSlug={live.store?.slug} />
          )}
        </>
      )}

      <GrillaItemsLive
        live={live}
        onSubastar={setSubastando}
        onVerCola={setViendoCola}
        onEditar={setEditando}
      />

      <AltaRapidaProducto open={altaAbierta} onOpenChange={setAltaAbierta} liveId={id} />

      <SelectorProductosDisponibles
        open={selectorAbierto}
        onOpenChange={setSelectorAbierto}
        liveId={id}
        storeId={live.store?.id}
      />

      <ConfigurarSubastaModal
        open={!!subastando}
        onOpenChange={(abierto) => !abierto && setSubastando(null)}
        liveId={id}
        item={subastando}
      />

      <EditarPrendaModal
        open={!!editando}
        onOpenChange={(abierto) => !abierto && setEditando(null)}
        liveId={id}
        item={editando}
      />

      <ColaPostores
        open={!!viendoCola}
        onOpenChange={(abierto) => !abierto && setViendoCola(null)}
        liveId={id}
        auctionId={viendoCola?.auction?.id ?? null}
        nombrePrenda={viendoCola?.name}
      />
    </div>
  );
}
