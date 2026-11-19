import { useState } from "react";
import { BadgePercent, Copy, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/shared/ui/page-header";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { Switch } from "@/shared/ui/switch";
import { EmptyState } from "@/shared/ui/empty-state";
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
import { useStore } from "@/app/providers/auth";
import { useEditarPromocion, useEliminarPromocion, usePromociones } from "@/entities/promotion/api";
import type { EstadoPromocion, Promocion } from "@/entities/promotion/model/types";
import { BotonExportar } from "@/shared/ui/boton-exportar";
import { descargarExcel, fechaCelda, nombreArchivoListado, numeroCelda } from "@/shared/lib/exportar-excel";
import { URL_TIENDA } from "@/features/store/model/catalogo-temas";
import { PromocionForm } from "@/features/promotions/ui/PromocionForm";
import { useAcceso } from "@/app/providers/acceso";
import { PERMISO } from "@/shared/acceso/permisos";

const ESTADO: Record<EstadoPromocion, { texto: string; variant: "success" | "info" | "secondary" | "outline" }> = {
  activa: { texto: "Activa", variant: "success" },
  programada: { texto: "Programada", variant: "info" },
  terminada: { texto: "Terminada", variant: "secondary" },
  inactiva: { texto: "Pausada", variant: "outline" },
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-BO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function vigencia(p: Promocion): string {
  if (p.empieza && p.termina) return `Del ${fecha(p.empieza)} al ${fecha(p.termina)}`;
  if (p.termina) return `Hasta el ${fecha(p.termina)}`;
  if (p.empieza) return `Desde el ${fecha(p.empieza)}, sin fecha de fin`;
  return "Sin fechas: rige mientras esté activa";
}

/**
 * Las promociones de la tienda: campañas con descuento, cada una con su propia
 * página que se comparte en redes. El precio con descuento lo calcula el
 * servidor al cobrar; acá se arman y se controlan.
 */
export default function PromotionsPage() {
  // Verlas alcanza para la lista y su enlace; crear, editar, pausar y borrar piden gestionar.
  const puedeGestionar = useAcceso().puede(PERMISO.GESTIONAR_MARKETING);
  const { selectedStore } = useStore();
  const tienda = selectedStore && selectedStore !== "all" ? selectedStore : null;

  const { data: promociones = [], isLoading } = usePromociones(tienda?.id);
  const editar = useEditarPromocion(tienda?.id);
  const eliminar = useEliminarPromocion(tienda?.id);

  const [formulario, setFormulario] = useState<{ abierto: boolean; promocion?: Promocion }>({ abierto: false });
  const [aBorrar, setABorrar] = useState<Promocion | null>(null);

  if (!tienda) {
    return (
      <div className="space-y-6">
        <PageHeader title="Promociones" description="Campañas con descuento, cada una con su página." />
        <EmptyState
          icon={BadgePercent}
          title="Elige una tienda"
          description="Las promociones son de cada tienda. Elige una arriba, en el selector de tienda."
        />
      </div>
    );
  }

  const enlace = (p: Promocion) => `${URL_TIENDA}/${tienda.slug}/promo/${p.slug}`;
  const copiar = async (p: Promocion) => {
    try {
      await navigator.clipboard.writeText(enlace(p));
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar. Cópialo a mano desde la barra de la página.");
    }
  };
  const alternar = async (p: Promocion, activa: boolean) => {
    try {
      await editar.mutateAsync({ id: p.id, cambios: { active: activa } });
      toast.success(activa ? "Promoción activada" : "Promoción pausada");
    } catch {
      toast.error("No se pudo cambiar la promoción");
    }
  };
  const borrar = async () => {
    if (!aBorrar) return;
    try {
      await eliminar.mutateAsync(aBorrar.id);
      toast.success("Promoción eliminada");
    } catch {
      toast.error("No se pudo eliminar la promoción");
    } finally {
      setABorrar(null);
    }
  };

  const activas = promociones.filter((p) => p.estado === "activa").length;

  // Excel de las promociones de la tienda, con su vigencia y su enlace.
  const exportar = () => {
    descargarExcel(
      [
        {
          nombre: "Promociones",
          columnas: [
            { titulo: "Nombre", tipo: "texto", ancho: 30 },
            { titulo: "Estado", tipo: "texto", ancho: 14 },
            { titulo: "Descuento", tipo: "texto", ancho: 14 },
            { titulo: "Productos", tipo: "numero", ancho: 10 },
            { titulo: "Ahorro total (Bs)", tipo: "dinero", ancho: 16 },
            { titulo: "Empieza", tipo: "texto", ancho: 12 },
            { titulo: "Termina", tipo: "texto", ancho: 12 },
            { titulo: "Enlace", tipo: "texto", ancho: 44 },
          ],
          filas: promociones.map((p) => [
            p.nombre,
            ESTADO[p.estado].texto,
            p.etiqueta ?? "",
            p.productos.length,
            numeroCelda(p.ahorroTotal),
            fechaCelda(p.empieza),
            fechaCelda(p.termina),
            enlace(p),
          ]),
        },
      ],
      nombreArchivoListado("promociones", tienda.name),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promociones"
        description="Campañas con descuento: cada una tiene su página para compartir en redes."
        stats={[
          { value: promociones.length, label: "promociones" },
          { value: activas, label: "activas", tone: activas ? "success" : "default" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportar onExportar={exportar} size="sm" disabled={isLoading} />
            {puedeGestionar ? (
              <Button onClick={() => setFormulario({ abierto: true })}>
                <Plus className="h-4 w-4" />
                <span className="ml-1">Nueva promoción</span>
              </Button>
            ) : null}
          </div>
        }
      />

      {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}

      {!isLoading && promociones.length === 0 && (
        <EmptyState
          icon={BadgePercent}
          title="Todavía no tienes promociones"
          description="Elige uno o varios productos, ponle un descuento y una fecha, y comparte su página. El precio rebajado se ve en la tienda y se cobra en el carrito."
          primaryAction={puedeGestionar ? { label: "Crear mi primera promoción", onClick: () => setFormulario({ abierto: true }) } : undefined}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {promociones.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <div className="flex gap-4 p-4">
              <div className="h-24 w-36 flex-none overflow-hidden rounded-lg bg-muted">
                {p.imagen ? (
                  <img src={p.imagen} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <BadgePercent className="h-7 w-7" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="truncate text-sm font-semibold">{p.nombre}</h3>
                  <Badge variant={ESTADO[p.estado].variant}>{ESTADO[p.estado].texto}</Badge>
                  {p.etiqueta && <Badge variant="default">{p.etiqueta}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{vigencia(p)}</p>
                <div className="flex items-center gap-1">
                  {p.productos.slice(0, 5).map((x) => (
                    <span key={x.storeProductId} title={x.nombre} className="h-7 w-7 overflow-hidden rounded-md border border-border bg-muted">
                      {x.imagen && <img src={x.imagen} alt="" className="h-full w-full object-cover" />}
                    </span>
                  ))}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {p.productos.length} {p.productos.length === 1 ? "producto" : "productos"}
                    {p.ahorroTotal > 0 ? ` · ahorro de Bs ${p.ahorroTotal.toFixed(2)} llevando uno de cada uno` : ""}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={p.activa} disabled={!puedeGestionar} onCheckedChange={(v) => alternar(p, v)} aria-label={p.activa ? "Pausar" : "Activar"} />
                {p.activa ? "Activa" : "Pausada"}
              </label>
              <div className="flex flex-wrap gap-1">
                <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => copiar(p)}>
                  <Copy className="h-3.5 w-3.5" /> Copiar enlace
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" asChild>
                  <a href={enlace(p)} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Ver en la tienda
                  </a>
                </Button>
                {puedeGestionar ? (
                  <>
                    <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => setFormulario({ abierto: true, promocion: p })}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setABorrar(p)}>
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <PromocionForm
        open={formulario.abierto}
        onOpenChange={(abierto) => setFormulario((f) => ({ ...f, abierto }))}
        storeId={tienda.id}
        promocion={formulario.promocion}
      />

      <AlertDialog open={Boolean(aBorrar)} onOpenChange={(abierto) => !abierto && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{aBorrar?.nombre}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Su página deja de existir y los productos vuelven a su precio normal. Los pedidos que ya se hicieron con esta
              promoción no cambian.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={borrar} disabled={eliminar.isPending}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
