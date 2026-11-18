import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/native-select";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatMoney } from "@/shared/lib/money";
import type { UnitOfMeasure } from "@/entities/inventory/model/types";
import {
  useCreatePresentation,
  useDeletePresentation,
  usePresentations,
  useUpdatePresentation,
} from "@/entities/presentation/api";
import type {
  Presentation,
  PresentationInput,
  PresentationKind,
  PresentationPriceMode,
} from "@/entities/presentation/model/types";

interface Props {
  storeProductId: string;
  baseUnitCode: string;
  contentPerUnit: number;
  units: UnitOfMeasure[];
}

const KIND_LABEL: Record<PresentationKind, string> = {
  FULL_UNIT: "Envase completo",
  FIXED_MEASURE: "Medida fija",
  VARIABLE_MEASURE: "Medida libre",
};

interface FormState {
  name: string;
  sku: string;
  kind: PresentationKind;
  baseQuantity: string;
  minBaseQuantity: string;
  maxBaseQuantity: string;
  stepBaseQuantity: string;
  displayUnitCode: string;
  priceMode: PresentationPriceMode;
  price: string;
  pricePerBaseUnit: string;
  sortOrder: string;
}

const VACIO: FormState = {
  name: "",
  sku: "",
  kind: "FIXED_MEASURE",
  baseQuantity: "",
  minBaseQuantity: "",
  maxBaseQuantity: "",
  stepBaseQuantity: "",
  displayUnitCode: "",
  priceMode: "FIXED",
  price: "",
  pricePerBaseUnit: "",
  sortOrder: "0",
};

const numero = (valor: string) => {
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

/** Precio por unidad de muestra con los decimales que hagan falta. */
function precioPorUnidad(valor: number, simbolo: string) {
  return `${new Intl.NumberFormat("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(valor)} / ${simbolo}`;
}

function resumenDeMedida(p: Presentation, baseSymbol: string) {
  const simbolo = p.displayUnit?.symbol ?? baseSymbol;
  const factor = p.displayUnit?.factorToBase || 1;
  const enMuestra = (base: number | null) =>
    base === null ? "—" : Number((base / factor).toFixed(3));

  if (p.kind === "VARIABLE_MEASURE") {
    return `De ${enMuestra(p.minBaseQuantity)} a ${enMuestra(p.maxBaseQuantity)} ${simbolo}, de a ${enMuestra(p.stepBaseQuantity)}`;
  }
  return `Lleva ${enMuestra(p.baseQuantity)} ${simbolo}`;
}

function precioDe(p: Presentation, baseSymbol: string) {
  if (p.priceMode === "FIXED") {
    return p.price !== null ? formatMoney(Number(p.price)) : "Sin precio";
  }
  const factor = p.displayUnit?.factorToBase || 1;
  const simbolo = p.displayUnit?.symbol ?? p.baseUnit?.symbol ?? baseSymbol;
  return precioPorUnidad(Number(p.pricePerBaseUnit ?? 0) * factor, simbolo);
}

/**
 * Formas de venta de un producto fraccionable: el frasco entero, los decants,
 * la venta por metro. El stock es uno solo; cada forma solo dice cuánto
 * consume y cuánto cuesta.
 */
export function FormasDeVenta({ storeProductId, baseUnitCode, contentPerUnit, units }: Props) {
  const { data: presentaciones = [], isLoading } = usePresentations(storeProductId);
  const crear = useCreatePresentation(storeProductId);
  const actualizar = useUpdatePresentation(storeProductId);
  const eliminar = useDeletePresentation(storeProductId);

  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<Presentation | null>(null);
  const [form, setForm] = useState<FormState>(VACIO);
  const [error, setError] = useState("");
  const [aEliminar, setAEliminar] = useState<Presentation | null>(null);

  const baseUnit = units.find((u) => u.code === baseUnitCode);
  const baseSymbol = baseUnit?.symbol ?? (baseUnitCode || "u");
  const unidadesDeMuestra = useMemo(() => {
    if (!baseUnit) return [];
    return units.filter((u) => u.dimension === baseUnit.dimension && u.code !== baseUnit.code);
  }, [units, baseUnit]);

  const abrirNueva = () => {
    const envase = contentPerUnit > 0 ? String(contentPerUnit) : "";
    setEditando(null);
    setForm({
      ...VACIO,
      name: contentPerUnit > 0 ? `Envase completo (${contentPerUnit} ${baseSymbol})` : "Envase completo",
      kind: "FULL_UNIT",
      baseQuantity: envase,
      displayUnitCode: "",
    });
    setError("");
    setAbierto(true);
  };

  const abrirEdicion = (p: Presentation) => {
    setEditando(p);
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      kind: p.kind,
      baseQuantity: p.baseQuantity?.toString() ?? "",
      minBaseQuantity: p.minBaseQuantity?.toString() ?? "",
      maxBaseQuantity: p.maxBaseQuantity?.toString() ?? "",
      stepBaseQuantity: p.stepBaseQuantity?.toString() ?? "",
      displayUnitCode: p.displayUnit?.code ?? "",
      priceMode: p.priceMode,
      price: p.price?.toString() ?? "",
      pricePerBaseUnit: p.pricePerBaseUnit?.toString() ?? "",
      sortOrder: p.sortOrder?.toString() ?? "0",
    });
    setError("");
    setAbierto(true);
  };

  const guardar = async () => {
    const nombre = form.name.trim();
    if (!nombre) return setError("Ponele un nombre para que el cliente sepa qué elige.");

    if (form.kind !== "VARIABLE_MEASURE" && !(numero(form.baseQuantity) ?? 0)) {
      return setError("Indicá cuánto lleva esta forma de venta en unidad base.");
    }
    if (form.kind === "VARIABLE_MEASURE") {
      const min = numero(form.minBaseQuantity) ?? 0;
      const max = numero(form.maxBaseQuantity) ?? 0;
      const paso = numero(form.stepBaseQuantity) ?? 0;
      if (min <= 0 || max < min || paso <= 0) {
        return setError("Para medida libre, el mínimo, el máximo y el paso tienen que ser válidos.");
      }
    }
    if (form.priceMode === "FIXED" && numero(form.price) === undefined) {
      return setError("Indicá el precio cerrado de esta forma de venta.");
    }
    if (form.priceMode === "PER_BASE_UNIT" && !(numero(form.pricePerBaseUnit) ?? 0)) {
      return setError("Indicá el precio por unidad base.");
    }

    const variable = form.kind === "VARIABLE_MEASURE";
    const data: PresentationInput = {
      storeProductId,
      name: nombre,
      sku: form.sku.trim() || undefined,
      kind: form.kind,
      ...(variable
        ? {
            minBaseQuantity: numero(form.minBaseQuantity),
            maxBaseQuantity: numero(form.maxBaseQuantity),
            stepBaseQuantity: numero(form.stepBaseQuantity),
          }
        : { baseQuantity: numero(form.baseQuantity) }),
      displayUnitCode: form.displayUnitCode || undefined,
      priceMode: form.priceMode,
      ...(form.priceMode === "FIXED"
        ? { price: numero(form.price) }
        : { pricePerBaseUnit: numero(form.pricePerBaseUnit) }),
      sortOrder: numero(form.sortOrder) ?? 0,
    };

    try {
      if (editando) await actualizar.mutateAsync({ id: editando.id, data });
      else await crear.mutateAsync(data);
      setAbierto(false);
    } catch {
      // El toast ya explica el error del backend.
    }
  };

  const guardando = crear.isPending || actualizar.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Formas de venta</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Cómo se le entrega al cliente: el envase completo, un decant de 5 ml,
            por metro. El stock es el mismo para todas.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={abrirNueva}>
          <Plus className="h-4 w-4 mr-1" />
          Agregar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : presentaciones.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no hay formas de venta. Sin ninguna, este producto se vende
          solo entero en Caja.
        </p>
      ) : (
        <ul className="space-y-2">
          {presentaciones.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <Badge variant="secondary">{KIND_LABEL[p.kind]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {resumenDeMedida(p, baseSymbol)} · {precioDe(p, baseSymbol)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Editar ${p.name}`}
                  onClick={() => abrirEdicion(p)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Eliminar ${p.name}`}
                  onClick={() => setAEliminar(p)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar forma de venta" : "Nueva forma de venta"}</DialogTitle>
            <DialogDescription>
              Se mide en {baseUnit?.name ?? baseUnitCode}
              {baseSymbol ? ` (${baseSymbol})` : ""}, igual que el stock.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pres-name">Nombre</Label>
              <Input
                id="pres-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Decant 5 ml"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pres-kind">Tipo</Label>
                <NativeSelect
                  id="pres-kind"
                  value={form.kind}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, kind: e.target.value as PresentationKind }))
                  }
                >
                  <option value="FULL_UNIT">Envase completo</option>
                  <option value="FIXED_MEASURE">Medida fija</option>
                  <option value="VARIABLE_MEASURE">Medida libre</option>
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pres-price-mode">Precio</Label>
                <NativeSelect
                  id="pres-price-mode"
                  value={form.priceMode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      priceMode: e.target.value as PresentationPriceMode,
                    }))
                  }
                >
                  <option value="FIXED">Precio cerrado</option>
                  <option value="PER_BASE_UNIT">Por unidad base</option>
                </NativeSelect>
              </div>
            </div>

            {form.kind === "VARIABLE_MEASURE" ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="pres-min">Mínimo ({baseSymbol})</Label>
                  <Input
                    id="pres-min"
                    type="number"
                    min="1"
                    value={form.minBaseQuantity}
                    onChange={(e) => setForm((f) => ({ ...f, minBaseQuantity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pres-max">Máximo ({baseSymbol})</Label>
                  <Input
                    id="pres-max"
                    type="number"
                    min="1"
                    value={form.maxBaseQuantity}
                    onChange={(e) => setForm((f) => ({ ...f, maxBaseQuantity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pres-step">Paso ({baseSymbol})</Label>
                  <Input
                    id="pres-step"
                    type="number"
                    min="1"
                    value={form.stepBaseQuantity}
                    onChange={(e) => setForm((f) => ({ ...f, stepBaseQuantity: e.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="pres-base">Lleva ({baseSymbol})</Label>
                <Input
                  id="pres-base"
                  type="number"
                  min="1"
                  value={form.baseQuantity}
                  onChange={(e) => setForm((f) => ({ ...f, baseQuantity: e.target.value }))}
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {form.priceMode === "FIXED" ? (
                <div className="space-y-2">
                  <Label htmlFor="pres-price">Precio cerrado (Bs)</Label>
                  <Input
                    id="pres-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="pres-unit-price">Precio por {baseSymbol} (Bs)</Label>
                  <Input
                    id="pres-unit-price"
                    type="number"
                    min="0"
                    step="0.000001"
                    value={form.pricePerBaseUnit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, pricePerBaseUnit: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Bs 7 el kilo se escribe 0,007 por gramo.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="pres-display">Mostrar en</Label>
                <NativeSelect
                  id="pres-display"
                  value={form.displayUnitCode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, displayUnitCode: e.target.value }))
                  }
                >
                  <option value="">{baseUnit?.name ?? baseUnitCode}</option>
                  {unidadesDeMuestra.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pres-sku">SKU (opcional)</Label>
                <Input
                  id="pres-sku"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  placeholder="Ej: PERF-DEC-5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pres-order">Orden</Label>
                <Input
                  id="pres-order"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(aEliminar)} onOpenChange={(open) => !open && setAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{aEliminar?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de ofrecerse en la tienda y en Caja. Los pedidos viejos la
              siguen mostrando.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (aEliminar) eliminar.mutate(aEliminar.id);
                setAEliminar(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
