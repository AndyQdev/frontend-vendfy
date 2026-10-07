import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, Play, Square } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/shared/ui/page-header";
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
import {
  useCuentasDelLive,
  useFinishLive,
  useLive,
  useStartLive,
} from "@/entities/live/api";
import { AgregarPrendas } from "@/features/live/ui/AgregarPrendas";
import {
  GrillaItemsLive,
  type EstadoGrilla,
} from "@/features/live/ui/GrillaItemsLive";
import { CompartirLive } from "@/features/live/ui/CompartirLive";
import { ConfigurarSubastaModal } from "@/features/live/ui/ConfigurarSubastaModal";
import { ColaPostores } from "@/features/live/ui/ColaPostores";
import { EditarPrendaModal } from "@/features/live/ui/EditarPrendaModal";
import type { LiveItem } from "@/entities/live/model/types";

/** Cada cuánto se vuelve a preguntar mientras el Live está en el aire. */
const REFRESCO = 4000;

/**
 * El Live, en una sola pantalla.
 *
 * Antes eran dos —preparar y control— y compartían la grilla y cinco modales.
 * La diferencia real nunca fue lo que se podía hacer, sino **el orden en que
 * importa**: preparando manda el catálogo que estás armando; en el aire mandan
 * los contadores y las cuentas por cobrar, y la grilla pasa abajo. Lo que
 * cambia según el estado es el orden, no lo que está disponible.
 *
 * Agregar prendas está en los dos momentos, porque sumar lo que acaba de
 * entrar es el módulo entero.
 *
 * Sirve además de detalle del historial: un Live cerrado se abre acá y se ve
 * qué pasó, con la cola de postores de cada subasta y las cuentas que queden
 * por cobrar, que es lo que se resuelve al día siguiente.
 */
export default function SesionLivePage() {
  const { id = "" } = useParams();

  // El refresco lo decide el hook según el estado que trae: un Live cerrado no
  // tiene nada que volver a preguntar.
  const { data: live, isLoading } = useLive(id, { refrescarCada: REFRESCO });
  const enVivo = live?.status === "active";

  const { data: cuentas = [] } = useCuentasDelLive(id, {
    refrescarCada: enVivo ? REFRESCO : undefined,
  });

  const iniciar = useStartLive(id);
  const finalizar = useFinishLive(id);

  const [subastando, setSubastando] = useState<LiveItem | null>(null);
  const [viendoCola, setViendoCola] = useState<LiveItem | null>(null);
  const [editando, setEditando] = useState<LiveItem | null>(null);
  const [confirmandoFin, setConfirmandoFin] = useState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (!live) return <p className="text-sm text-muted-foreground">Live no encontrado.</p>;

  const cerrado = live.status === "finished" || live.status === "cancelled";
  const preparando = live.status === "preparing";
  const estadoGrilla: EstadoGrilla = enVivo
    ? "vivo"
    : cerrado
      ? "cerrado"
      : "preparando";

  const activos = live.items.filter((i) => i.status === "active");
  const disponibles = activos.filter((i) => i.disponible > 0);
  const vendidas = activos.length - disponibles.length;
  const subastasAbiertas = activos.filter((i) => i.auction?.status === "open");
  const totalCuentas = cuentas.reduce((s, c) => s + Number(c.totalAmount ?? 0), 0);

  const empezar = async () => {
    try {
      await iniciar.mutateAsync();
      toast.success("El Live está en el aire");
    } catch (error) {
      toast.error((error as Error).message || "No se pudo iniciar");
    }
  };

  const terminar = async () => {
    try {
      await finalizar.mutateAsync();
      toast.success("Live finalizado");
    } catch (error) {
      toast.error((error as Error).message || "No se pudo finalizar");
    } finally {
      setConfirmandoFin(false);
    }
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/live">
          <ArrowLeft className="h-4 w-4" />
          <span className="ml-1">Modo Live</span>
        </Link>
      </Button>

      {/* En el aire el encabezado se achica a lo imprescindible: el punto que
          avisa que está transmitiendo, el título y las acciones. El resumen lo
          dan los contadores, que vienen justo abajo. */}
      {enVivo ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
            </span>
            <h1 className="truncate text-lg font-semibold">{live.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <AgregarPrendas liveId={id} storeId={live.store?.id} compacto />
            <Button variant="destructive" onClick={() => setConfirmandoFin(true)}>
              <Square className="h-4 w-4" />
              <span className="ml-1">Finalizar</span>
            </Button>
          </div>
        </div>
      ) : (
        <PageHeader
          title={live.title}
          description={live.description ?? undefined}
          stats={[
            { value: activos.length, label: "prendas" },
            { value: disponibles.length, label: "disponibles", tone: "success" },
            ...(live.summary
              ? [{ value: live.summary.vendidos, label: "vendidas" }]
              : []),
          ]}
          actions={
            preparando ? (
              <Button
                onClick={empezar}
                disabled={iniciar.isPending || activos.length === 0}
              >
                <Play className="h-4 w-4" />
                <span className="ml-1">Iniciar Live</span>
              </Button>
            ) : (
              <Badge variant="secondary">Finalizado</Badge>
            )
          }
        />
      )}

      {/* El enlace va grande mientras se transmite: al arrancar es lo primero
          que hace falta, y copiarlo de un botón chico en la fila de acciones es
          más difícil de encontrar. */}
      {enVivo && (
        <CompartirLive token={live.publicToken} storeSlug={live.store?.slug} />
      )}

      {enVivo && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tarjeta valor={disponibles.length} etiqueta="disponibles" />
          <Tarjeta valor={vendidas} etiqueta="vendidas" />
          <Tarjeta valor={cuentas.length} etiqueta="cuentas abiertas" />
          <Tarjeta valor={totalCuentas.toFixed(2)} etiqueta="vendido" />
        </div>
      )}

      {enVivo && subastasAbiertas.length > 0 && (
        <Seccion titulo="Subastas abiertas">
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
                <span className="font-semibold tabular-nums">
                  {(item.auction!.currentAmount ?? item.auction!.startingPrice).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {/* Las cuentas siguen abiertas después de finalizar: cobrarlas es lo que
          queda por hacer, así que la sección no desaparece al cerrar el Live. */}
      {cuentas.length > 0 && (
        <Seccion titulo="Cuentas por cobrar">
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
                  <span className="font-semibold tabular-nums">
                    {Number(c.totalAmount).toFixed(2)}
                  </span>
                  <Badge variant="outline">#{c.number ?? "—"}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {/* Preparando, agregar es lo único que se hace acá: va grande y arriba de
          la grilla. En el aire ya está en el encabezado. */}
      {preparando && <AgregarPrendas liveId={id} storeId={live.store?.id} />}

      <Seccion titulo="Prendas">
        <GrillaItemsLive
          live={live}
          estado={estadoGrilla}
          onSubastar={setSubastando}
          onVerCola={setViendoCola}
          onEditar={setEditando}
        />
      </Seccion>

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

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h2>
      {children}
    </section>
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
