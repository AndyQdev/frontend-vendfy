import { useState } from "react";
import { Image as ImageIcon, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
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
  usePresentations,
  useRemovePresentation,
} from "@/entities/presentation/api";
import type { Presentation } from "@/entities/presentation/model/types";
import { PresentacionEditor } from "./PresentacionEditor";

/** Cómo se lee la medida de una presentación, en una línea. */
function medidaLegible(p: Presentation, simbolo: string): string {
  if (p.kind === "VARIABLE_MEASURE") {
    return `${p.minBaseQuantity}–${p.maxBaseQuantity} ${simbolo}, de a ${p.stepBaseQuantity}`;
  }
  return `${p.baseQuantity} ${simbolo}`;
}

/** Y cómo se lee el precio, en los términos en que se cargó. */
function precioLegible(p: Presentation): string {
  if (p.priceMode === "FIXED") return `Bs ${Number(p.price ?? 0).toFixed(2)}`;

  // Se guarda por unidad base pero se muestra en la unidad elegida: "Bs 7/kg"
  // se lee mucho mejor que "Bs 0,007/g".
  const factor = p.displayUnit?.factorToBase ?? 1;
  const simbolo = p.displayUnit?.symbol ?? p.baseUnit?.symbol ?? "";
  const valor = Number(p.pricePerBaseUnit ?? 0) * factor;
  return `Bs ${valor.toFixed(2)} / ${simbolo}`;
}

/**
 * Las formas en que se ofrece este producto.
 *
 * Solo aparece si el producto se vende por medida, porque para uno unitario
 * no hay nada que recortar: se vende como viene. Es la respuesta a "quiero
 * vender el frasco entero Y decants del mismo frasco" — cada fila de acá es
 * una opción distinta que sale del MISMO stock, sin duplicar inventario y sin
 * que se puedan sobrevender entre sí.
 */
export function PresentacionesCard({
  storeProductId,
  contenidoPorEnvase,
  unidadBase,
}: {
  storeProductId: string;
  contenidoPorEnvase: number;
  unidadBase: { code: string; symbol: string } | null;
}) {
  const { data: presentaciones = [], isLoading } =
    usePresentations(storeProductId);
  const quitar = useRemovePresentation();

  const [editorAbierto, setEditorAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<Presentation | null>(null);
  const [aBorrar, setABorrar] = useState<Presentation | null>(null);

  const simbolo = unidadBase?.symbol ?? "";

  const abrirAlta = () => {
    setEnEdicion(null);
    setEditorAbierto(true);
  };

  const abrirEdicion = (p: Presentation) => {
    setEnEdicion(p);
    setEditorAbierto(true);
  };

  const confirmarBorrado = async () => {
    if (!aBorrar) return;
    try {
      await quitar.mutateAsync({ id: aBorrar.id, storeProductId });
      toast.success(`"${aBorrar.name}" ya no se ofrece`);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo quitar");
    } finally {
      setABorrar(null);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/20">
            <Scissors className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Formas de venta</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Cómo se le ofrece al cliente. Todas salen del mismo stock
              {contenidoPorEnvase > 0 && (
                <> de {contenidoPorEnvase} {simbolo} por envase</>
              )}
              .
            </p>
          </div>
        </div>

        <Button type="button" onClick={abrirAlta} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Agregar
        </Button>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : presentaciones.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Scissors className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Todavía no hay formas de venta</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Agregá el envase entero y los recortes que quieras ofrecer —un
              decant de 5 ml, otro de 10— y aparecerán como opciones en tu
              tienda. El stock se descuenta en {simbolo || "unidad base"}, así
              que nunca se te va a vender más de lo que hay.
            </p>
            <Button
              type="button"
              onClick={abrirAlta}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Crear la primera
            </Button>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {presentaciones.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 p-3 first:rounded-t-lg last:rounded-b-lg"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {medidaLegible(p, simbolo)}
                  </p>
                </div>

                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {precioLegible(p)}
                </span>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Editar ${p.name}`}
                    onClick={() => abrirEdicion(p)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Quitar ${p.name}`}
                    onClick={() => setABorrar(p)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PresentacionEditor
        abierto={editorAbierto}
        onClose={() => setEditorAbierto(false)}
        storeProductId={storeProductId}
        contenidoPorEnvase={contenidoPorEnvase}
        unidadBase={unidadBase}
        presentacion={enEdicion}
      />

      <AlertDialog
        open={!!aBorrar}
        onOpenChange={(o) => !o && setABorrar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dejar de ofrecer "{aBorrar?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Desaparece de tu tienda, pero los pedidos que ya la usaron siguen
              mostrándola en su historial. El stock no se toca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarBorrado}>
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
