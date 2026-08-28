import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/cn";
import { useCreateMovement } from "@/entities/inventory/api";
import {
  desglosarEnvases,
  formatearCantidad,
  pasoDeConsumo,
} from "@/entities/inventory/model/envases";
import { conceptosPara } from "@/entities/inventory/model/movimientos";
import type { Inventory } from "@/entities/inventory/model/types";

/** Sobre qué se está operando: envases enteros o el contenido del abierto. */
export type AlcanceAjuste = "envase" | "contenido";
export type DireccionAjuste = "in" | "out";

export interface AperturaAjuste {
  inventory: Inventory;
  alcance: AlcanceAjuste;
  direccion: DireccionAjuste;
}

function tituloDe(
  alcance: AlcanceAjuste,
  direccion: DireccionAjuste,
  porMedida: boolean,
): { titulo: string; verbo: string } {
  if (alcance === "contenido") {
    return direccion === "out"
      ? { titulo: "Registrar consumo", verbo: "Descontar" }
      : { titulo: "Devolver al envase abierto", verbo: "Devolver" };
  }
  // Un producto unitario no tiene envases que abrir: son unidades a secas.
  const que = porMedida ? "envases" : "unidades";
  return direccion === "out"
    ? { titulo: `Quitar ${que}`, verbo: "Quitar" }
    : { titulo: `Agregar ${que}`, verbo: "Agregar" };
}

/**
 * El diálogo por el que pasa todo ajuste manual de stock.
 *
 * Antes los botones +/− escribían solos. El problema no era la comodidad sino
 * que `inventory_movements` es un libro append-only: cada clic quedaba como un
 * asiento permanente y sin explicación. Ahora cada ajuste dice CUÁNTO y POR
 * QUÉ, que es lo que después hace que el historial y el reporte de merma
 * signifiquen algo.
 *
 * La cantidad se pide en la unidad en que la persona piensa: envases enteros
 * si tocó la columna de stock, mililitros o gramos si tocó la de consumo. La
 * conversión a unidad base -que es lo único que entiende el libro- se hace
 * acá y se muestra en la vista previa antes de confirmar.
 */
export function AjusteStockDialog({
  apertura,
  onClose,
}: {
  apertura: AperturaAjuste | null;
  onClose: () => void;
}) {
  const createMovement = useCreateMovement();
  const [conceptoId, setConceptoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");
  const [nota, setNota] = useState("");

  const inventory = apertura?.inventory ?? null;
  const alcance = apertura?.alcance ?? "envase";
  const direccion = apertura?.direccion ?? "out";

  const conceptos = useMemo(() => conceptosPara(direccion), [direccion]);

  // Cada apertura empieza limpia y con el motivo más probable ya elegido, que
  // es el primero de la lista de su dirección.
  useEffect(() => {
    if (!apertura) return;
    setConceptoId(conceptosPara(apertura.direccion)[0]?.id ?? "");
    setCantidad("");
    setCosto("");
    setNota("");
  }, [apertura]);

  const desgloseActual = useMemo(
    () =>
      inventory
        ? desglosarEnvases(inventory)
        : null,
    [inventory],
  );

  if (!inventory || !desgloseActual) return null;

  const unidad = inventory.product?.baseUnit;
  const { porMedida, contenido } = desgloseActual;
  const concepto = conceptos.find((c) => c.id === conceptoId) ?? conceptos[0];
  const { titulo, verbo } = tituloDe(alcance, direccion, porMedida);

  // En la columna de stock se piensa en envases; en la de consumo, en la
  // unidad fina. El libro solo entiende unidad base, así que se convierte acá.
  const factor = alcance === "envase" && porMedida ? contenido : 1;
  const cantidadNum = Number(cantidad);
  const cantidadValida = Number.isFinite(cantidadNum) && cantidadNum > 0;
  const deltaBase = cantidadValida ? Math.round(cantidadNum * factor) : 0;
  const signo = direccion === "in" ? 1 : -1;
  const totalDespues = inventory.stockQuantity + signo * deltaBase;
  const dejariaNegativo = totalDespues < 0;

  const desglosePreview = desglosarEnvases({
    ...inventory,
    stockQuantity: Math.max(0, totalDespues),
  });

  const sufijo =
    alcance === "envase"
      ? porMedida
        ? cantidadNum === 1
          ? "envase"
          : "envases"
        : "unidades"
      : (unidad?.symbol ?? "unidades");

  // Atajos: en envases, cantidades redondas; en contenido, múltiplos del paso
  // y el medio envase, que es la fracción que más se usa a ojo.
  const paso = pasoDeConsumo(contenido);
  const atajos =
    alcance === "envase"
      ? [1, 2, 5, 10]
      : [paso, paso * 2, paso * 5, Math.round(contenido / 2)].filter(
          (v, i, a) => v > 0 && a.indexOf(v) === i,
        );

  const puedeGuardar =
    cantidadValida && !dejariaNegativo && !!concepto && !createMovement.isPending;

  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    try {
      await createMovement.mutateAsync({
        inventoryId: inventory.id,
        type: concepto.type,
        quantity: deltaBase,
        ...(concepto.pideCosto && Number(costo) > 0
          ? // El costo se pide por envase pero el libro lo lleva por unidad
            // base: sin dividir, un frasco de Bs 200 costaría Bs 200 el ml.
            { unitCost: Number(costo) / factor }
          : {}),
        notes: nota.trim() || concepto.label,
      });
      toast.success(
        `${concepto.label} · ${formatearCantidad(deltaBase, unidad)}`,
      );
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo registrar el ajuste");
    }
  };

  return (
    <ResponsiveDialog open={!!apertura} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-[460px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{titulo}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            <span className="font-medium text-foreground">
              {inventory.product.name}
            </span>
            {porMedida ? (
              <>
                {" — "}
                {desgloseActual.sellados} sellados
                {desgloseActual.abierto > 0 && (
                  <>
                    {" + "}
                    {formatearCantidad(desgloseActual.abierto, unidad)} abiertos
                  </>
                )}
                {" · "}
                {formatearCantidad(inventory.stockQuantity, unidad)} en total
              </>
            ) : (
              <>
                {" — "}
                {formatearCantidad(inventory.stockQuantity, unidad)} en stock
              </>
            )}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4 pb-2">
          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="ajuste-concepto">¿Qué pasó?</Label>
            <Select value={conceptoId} onValueChange={setConceptoId}>
              <SelectTrigger id="ajuste-concepto">
                <SelectValue placeholder="Elegí un motivo" />
              </SelectTrigger>
              <SelectContent>
                {conceptos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex flex-col items-start">
                      <span>{c.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.ayuda}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cantidad */}
          <div className="space-y-2">
            <Label htmlFor="ajuste-cantidad">Cantidad</Label>
            <div className="relative">
              <Input
                id="ajuste-cantidad"
                type="number"
                inputMode="decimal"
                min={0}
                step={alcance === "envase" ? 1 : "any"}
                autoFocus
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="0"
                className="pr-20 text-base font-semibold tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {sufijo}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {atajos.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCantidad(String(v))}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    "hover:bg-accent hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    Number(cantidad) === v
                      ? "border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {alcance === "envase" ? v : formatearCantidad(v, unidad)}
                </button>
              ))}
            </div>

            {alcance === "envase" && porMedida && cantidadValida && (
              <p className="text-xs text-muted-foreground">
                Equivale a {formatearCantidad(deltaBase, unidad)}.
              </p>
            )}
          </div>

          {/* Costo, solo cuando el motivo es una compra */}
          {concepto?.pideCosto && (
            <div className="space-y-2">
              <Label htmlFor="ajuste-costo">
                Costo por {alcance === "envase" && porMedida ? "envase" : sufijo}{" "}
                (opcional)
              </Label>
              <Input
                id="ajuste-costo"
                type="number"
                min={0}
                step="0.01"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                placeholder="Ej: 180.00"
              />
              <p className="text-xs text-muted-foreground">
                Se usa para el costo promedio y el margen. Si no lo sabés,
                dejalo vacío.
              </p>
            </div>
          )}

          {/* Nota */}
          <div className="space-y-2">
            <Label htmlFor="ajuste-nota">Nota (opcional)</Label>
            <Textarea
              id="ajuste-nota"
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: se derramó al trasvasar"
            />
          </div>

          {/* Vista previa: cómo queda el inventario si se confirma */}
          <div
            className={cn(
              "rounded-lg border p-3",
              dejariaNegativo
                ? "border-destructive/40 bg-destructive/5"
                : "bg-muted/40",
            )}
          >
            {dejariaNegativo ? (
              <p className="text-sm text-destructive">
                No alcanza: hay{" "}
                {formatearCantidad(inventory.stockQuantity, unidad)} y estás
                queriendo {verbo.toLowerCase()}{" "}
                {formatearCantidad(deltaBase, unidad)}.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-center gap-3 text-sm font-semibold tabular-nums">
                  <span className="text-muted-foreground">
                    {formatearCantidad(inventory.stockQuantity, unidad)}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span
                    className={
                      cantidadValida
                        ? signo > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-orange-600 dark:text-orange-400"
                        : ""
                    }
                  >
                    {formatearCantidad(totalDespues, unidad)}
                  </span>
                </div>
                {porMedida && (
                  <p className="mt-1 text-center text-xs text-muted-foreground">
                    quedarían {desglosePreview.sellados} sellados
                    {desglosePreview.abierto > 0 && (
                      <>
                        {" + "}
                        {formatearCantidad(desglosePreview.abierto, unidad)}{" "}
                        del abierto
                      </>
                    )}
                  </p>
                )}
              </>
            )}
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={!puedeGuardar}>
            {createMovement.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {createMovement.isPending ? "Registrando..." : "Registrar"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
