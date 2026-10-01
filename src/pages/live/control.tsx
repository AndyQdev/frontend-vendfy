import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, MessageCircle, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { useCuentasDelLive, useFinishLive, useLive } from "@/entities/live/api";
import { AltaRapidaProducto } from "@/features/live/ui/AltaRapidaProducto";
import { GrillaItemsLive } from "@/features/live/ui/GrillaItemsLive";
import { CompartirLive } from "@/features/live/ui/CompartirLive";
import { ConfigurarSubastaModal } from "@/features/live/ui/ConfigurarSubastaModal";
import { ColaPostores } from "@/features/live/ui/ColaPostores";
import { EditarPrendaModal } from "@/features/live/ui/EditarPrendaModal";
import type { LiveItem } from "@/entities/live/model/types";

/** Cada cuánto se vuelve a preguntar mientras el Live está en el aire. */
const REFRESCO = 4000;

/**
 * El panel durante la transmisión.
 *
 * Es una vista distinta de la de preparación porque el vendedor está haciendo
 * otra cosa: no arma el Live, lo conduce. Acá manda lo que se está vendiendo y
 * las cuentas que hay que cobrar, no el catálogo.
 *
 * Se refresca solo cada cuatro segundos. El stock se mueve por fuera de esta
 * pantalla -los compradores, la caja- así que esperar a que alguien recargue
 * sería mostrar algo que ya no es cierto.
 */
export default function ControlLivePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const { data: live, isLoading } = useLive(id, { refrescarCada: REFRESCO });
  const { data: cuentas = [] } = useCuentasDelLive(id, { refrescarCada: REFRESCO });
  const finalizar = useFinishLive(id);

  const [altaAbierta, setAltaAbierta] = useState(false);
  const [subastando, setSubastando] = useState<LiveItem | null>(null);
  const [viendoCola, setViendoCola] = useState<LiveItem | null>(null);
  const [editando, setEditando] = useState<LiveItem | null>(null);
  const [confirmandoFin, setConfirmandoFin] = useState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (!live) return <p className="text-sm text-muted-foreground">Live no encontrado.</p>;

  const activos = live.items.filter((i) => i.status === "active");
  const disponibles = activos.filter((i) => i.disponible > 0);
  const vendidas = activos.length - disponibles.length;
  const subastasAbiertas = activos.filter((i) => i.auction?.status === "open");
  const total = cuentas.reduce((s, c) => s + Number(c.totalAmount ?? 0), 0);

  const terminar = async () => {
    try {
      await finalizar.mutateAsync();
      toast.success("Live finalizado");
      navigate(`/live/${id}/preparar`);
    } catch (error) {
      toast.error((error as Error).message || "No se pudo finalizar");
    } finally {
      setConfirmandoFin(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/live">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
          </span>
          <h1 className="text-lg font-semibold">{live.title}</h1>
        </div>

        <div className="flex gap-2">
          <CompartirLive token={live.publicToken} storeSlug={live.store?.slug} compacto />
          <Button variant="outline" onClick={() => setAltaAbierta(true)}>
            <Camera className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Agregar</span>
          </Button>
          <Button variant="destructive" onClick={() => setConfirmandoFin(true)}>
            <Square className="h-4 w-4" />
            <span className="ml-1">Finalizar</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tarjeta valor={disponibles.length} etiqueta="disponibles" />
        <Tarjeta valor={vendidas} etiqueta="vendidas" />
        <Tarjeta valor={cuentas.length} etiqueta="cuentas abiertas" />
        <Tarjeta valor={total.toFixed(2)} etiqueta="vendido" />
      </div>

      {subastasAbiertas.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Subastas abiertas
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {subastasAbiertas.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.auction!.bidCount} oferta
                    {item.auction!.bidCount === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="tabular-nums font-semibold">
                  {(item.auction!.currentAmount ?? item.auction!.startingPrice).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Prendas
        </h2>
        <GrillaItemsLive
          live={live}
          enVivo
          onSubastar={setSubastando}
          onVerCola={setViendoCola}
          onEditar={setEditando}
        />
      </section>

      {cuentas.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cuentas por cobrar
          </h2>
          <div className="space-y-1">
            {cuentas.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.customer?.name ?? "Cliente"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {c.items?.length ?? 0} prenda
                      {(c.items?.length ?? 0) === 1 ? "" : "s"}
                    </span>
                    {c.customer?.phone && (
                      <a
                        href={`https://wa.me/${c.customer.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-primary"
                      >
                        <MessageCircle className="h-3 w-3" />
                        {c.customer.phone}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-semibold">
                    {Number(c.totalAmount).toFixed(2)}
                  </span>
                  <Badge variant="outline">#{c.number ?? "—"}</Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <AltaRapidaProducto open={altaAbierta} onOpenChange={setAltaAbierta} liveId={id} />

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

      <AlertDialog open={confirmandoFin} onOpenChange={setConfirmandoFin}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Finalizar el Live?</AlertDialogTitle>
            <AlertDialogDescription>
              {subastasAbiertas.length > 0 ? (
                <>
                  Hay {subastasAbiertas.length} subasta
                  {subastasAbiertas.length === 1 ? "" : "s"} abierta
                  {subastasAbiertas.length === 1 ? "" : "s"}: se cierran y la prenda queda
                  cargada al mayor postor.{" "}
                </>
              ) : null}
              El enlace deja de aceptar compras. Las cuentas siguen abiertas para cobrar, y
              lo que no se vendió queda disponible para el próximo Live.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir transmitiendo</AlertDialogCancel>
            <AlertDialogAction onClick={terminar}>Finalizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Tarjeta({ valor, etiqueta }: { valor: React.ReactNode; etiqueta: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-center">
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
    </div>
  );
}
