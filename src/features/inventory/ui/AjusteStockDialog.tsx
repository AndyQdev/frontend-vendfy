import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ClipboardCheck, History, Loader2, Minus, Package, Pencil, Plus, ScanBarcode } from "lucide-react";
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
/** Lo que se hace: agregar, quitar, o contar lo que hay y corregir la diferencia. */
type Modo = DireccionAjuste | "contar";

export interface AperturaAjuste {
  inventory: Inventory;
  alcance: AlcanceAjuste;
  direccion: DireccionAjuste;
  /**
   * La abrió la pistola: arriba va el producto con su stock y se elige qué
   * hacer (agregar, quitar o contar). Cada lectura del MISMO producto suma
   * uno: recibir seis botellas es escanear seis veces.
   */
  escaneo?: {
    /** Cuántas veces se leyó desde que se abrió. */
    lecturas: number;
    /** Las tiendas donde está, cuando arriba dice "Todas" y hay más de una. */
    tiendas: Inventory[];
  };
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

const MODOS: { id: Modo; label: string; icono: typeof Plus }[] = [
  { id: "in", label: "Agregar", icono: Plus },
  { id: "out", label: "Quitar", icono: Minus },
  { id: "contar", label: "Contar", icono: ClipboardCheck },
];

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
 *
 * Abierto por el escáner suma "Contar": se dice cuántos hay de verdad y se
 * registra la diferencia como corrección de conteo, sin hacer la resta a mano.
 */
export function AjusteStockDialog({
  apertura,
  onClose,
  onHistorial,
  onEditar,
  onCambiarTienda,
}: {
  apertura: AperturaAjuste | null;
  onClose: () => void;
  /** Escaneado: ver los movimientos del producto. */
  onHistorial?: (inventory: Inventory) => void;
  /** Escaneado: abrir el producto (precio, foto, datos). */
  onEditar?: (inventory: Inventory) => void;
  /** Escaneado con "Todas las tiendas": pasar a la fila de otra tienda. */
  onCambiarTienda?: (inventory: Inventory) => void;
}) {
  const createMovement = useCreateMovement();
  const [modo, setModo] = useState<Modo>("out");
  const [conceptoId, setConceptoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [contado, setContado] = useState("");
  const [costo, setCosto] = useState("");
  const [nota, setNota] = useState("");
  const modoRef = useRef(modo);
  modoRef.current = modo;

  const inventory = apertura?.inventory ?? null;
  const alcance = apertura?.alcance ?? "envase";
  const escaneo = apertura?.escaneo;
  // Desde la tabla manda el botón que se tocó (+ o −); escaneado, lo que se elija.
  const contando = !!escaneo && modo === "contar";
  const direccion: DireccionAjuste = !escaneo ? (apertura?.direccion ?? "out") : modo === "contar" ? "in" : modo;

  const conceptos = useMemo(() => conceptosPara(direccion), [direccion]);

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
    if (nuevo !== "contar") setConceptoId(conceptosPara(nuevo)[0]?.id ?? "");
  };

  // Cada apertura empieza limpia y con el motivo más probable ya elegido, que
  // es el primero de la lista de su dirección. Otra lectura del mismo
  // producto no empieza de nuevo: suma uno a lo que se está anotando.
  const previa = useRef<AperturaAjuste | null>(null);
  useEffect(() => {
    const antes = previa.current;
    previa.current = apertura;
    if (!apertura) return;
    if (antes?.escaneo && apertura.escaneo && antes.inventory.id === apertura.inventory.id) {
      if (apertura.escaneo.lecturas > antes.escaneo.lecturas) {
        const uno = (v: string) => String((Number(v) || 0) + 1);
        if (modoRef.current === "contar") setContado(uno);
        else setCantidad(uno);
      }
      return;
    }
    setModo(apertura.direccion);
    setConceptoId(conceptosPara(apertura.direccion)[0]?.id ?? "");
    // Escaneado: ese producto ya es uno.
    setCantidad(apertura.escaneo ? "1" : "");
    setContado("");
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
  const { porMedida, contenido, abierto } = desgloseActual;
  const concepto = conceptos.find((c) => c.id === conceptoId) ?? conceptos[0];
  const { titulo, verbo } = tituloDe(alcance, direccion, porMedida);

  // En la columna de stock se piensa en envases; en la de consumo, en la
  // unidad fina. El libro solo entiende unidad base, así que se convierte acá.
  const factor = alcance === "envase" && porMedida ? contenido : 1;
  const cantidadNum = Number(cantidad);
  const cantidadValida = Number.isFinite(cantidadNum) && cantidadNum > 0;

  // Contar: lo que hay de verdad. En un producto por medida se cuentan los
  // envases cerrados y el abierto queda como está.
  const contadoNum = Number(contado);
  const contadoValido = contado.trim() !== "" && Number.isFinite(contadoNum) && contadoNum >= 0;
  const objetivo = contadoValido ? Math.round(contadoNum * factor) + (porMedida ? abierto : 0) : inventory.stockQuantity;
  const diferencia = objetivo - inventory.stockQuantity;

  const deltaBase = contando ? Math.abs(diferencia) : cantidadValida ? Math.round(cantidadNum * factor) : 0;
  const signo = contando ? (diferencia >= 0 ? 1 : -1) : direccion === "in" ? 1 : -1;
  const totalDespues = contando ? objetivo : inventory.stockQuantity + signo * deltaBase;
  const dejariaNegativo = totalDespues < 0;
  const hayCambio = contando ? contadoValido : cantidadValida;

  const desglosePreview = desglosarEnvases({
    ...inventory,
    stockQuantity: Math.max(0, totalDespues),
  });

  const sufijo =
    alcance === "envase"
      ? porMedida
        ? (contando ? contadoNum : cantidadNum) === 1
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

  const puedeGuardar = contando
    ? contadoValido && !createMovement.isPending
    : cantidadValida && !dejariaNegativo && !!concepto && !createMovement.isPending;

  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    if (contando && diferencia === 0) {
      toast.success("El stock ya coincide con lo que contaste");
      onClose();
      return;
    }
    try {
      if (contando) {
        // La diferencia queda como corrección de conteo, igual que si se
        // hubiera elegido ese motivo y hecho la resta a mano.
        await createMovement.mutateAsync({
          inventoryId: inventory.id,
          type: diferencia > 0 ? "adjustment_in" : "adjustment_out",
          quantity: deltaBase,
          notes:
            nota.trim() ||
            `Conteo: el sistema decía ${formatearCantidad(inventory.stockQuantity, unidad)} y había ${formatearCantidad(objetivo, unidad)}`,
        });
        toast.success(
          `Conteo guardado · ${diferencia > 0 ? "+" : "−"}${formatearCantidad(deltaBase, unidad)}`,
        );
      } else {
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
      }
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo registrar el ajuste");
    }
  };

  // Enter en un campo de número registra, sin ir a buscar el botón.
  const alEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleGuardar();
    }
  };

  const foto = inventory.product.imageUrls?.[0];
  const stockTexto = porMedida
    ? `${desgloseActual.sellados} sellados${
        abierto > 0 ? ` + ${formatearCantidad(abierto, unidad)} abiertos` : ""
      } · ${formatearCantidad(inventory.stockQuantity, unidad)} en total`
    : `${formatearCantidad(inventory.stockQuantity, unidad)} en stock`;

  return (
    <ResponsiveDialog open={!!apertura} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-[460px]">
        <ResponsiveDialogHeader>
          {escaneo ? (
            // Escaneado: primero QUÉ producto es y cuánto hay.
            <div className="flex items-center gap-3 text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {foto ? (
                  <img src={foto} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <ResponsiveDialogTitle className="leading-tight">
                  {inventory.product.name}
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription className="mt-1">
                  <span className="font-semibold text-foreground">{stockTexto}</span>
                  {" · "}
                  {inventory.store.name}
                </ResponsiveDialogDescription>
              </div>
            </div>
          ) : (
            <>
              <ResponsiveDialogTitle>{titulo}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                <span className="font-medium text-foreground">
                  {inventory.product.name}
                </span>
                {" — "}
                {stockTexto}
              </ResponsiveDialogDescription>
            </>
          )}
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4 pb-2">
          {escaneo && escaneo.tiendas.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Tienda:</span>
              {escaneo.tiendas.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onCambiarTienda?.(t)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    t.id === inventory.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {t.store.name}
                </button>
              ))}
            </div>
          )}

          {/* Qué hacer: solo cuando lo abrió la pistola (en la tabla ya se tocó + o −). */}
          {escaneo && (
            <div role="radiogroup" aria-label="Qué querés hacer" className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-1">
              {MODOS.map(({ id, label, icono: Icono }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={modo === id}
                  onClick={() => cambiarModo(id)}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    modo === id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icono
                    className={cn(
                      "h-4 w-4",
                      modo === id && id === "in" && "text-emerald-600 dark:text-emerald-400",
                      modo === id && id === "out" && "text-orange-600 dark:text-orange-400",
                      modo === id && id === "contar" && "text-primary",
                    )}
                  />
                  {label}
                </button>
              ))}
            </div>
          )}

          {contando ? (
            /* Contar: cuántos hay de verdad */
            <div className="space-y-2">
              <Label htmlFor="ajuste-contado">
                {porMedida ? "¿Cuántos envases cerrados hay?" : "¿Cuántos hay?"}
              </Label>
              <div className="relative">
                <Input
                  id="ajuste-contado"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  autoFocus
                  value={contado}
                  onChange={(e) => setContado(e.target.value)}
                  onKeyDown={alEnter}
                  placeholder={String(porMedida ? desgloseActual.sellados : inventory.stockQuantity)}
                  className="pr-20 text-base font-semibold tabular-nums"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {sufijo}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {porMedida && abierto > 0
                  ? `El abierto (${formatearCantidad(abierto, unidad)}) queda como está. `
                  : ""}
                Se guarda la diferencia como corrección de conteo.
              </p>
            </div>
          ) : (
            <>
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
                    onKeyDown={alEnter}
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
                    Costo por{" "}
                    {alcance === "envase" ? (porMedida ? "envase" : "unidad") : (unidad?.symbol ?? "unidad")}{" "}
                    (opcional)
                  </Label>
                  <Input
                    id="ajuste-costo"
                    type="number"
                    min={0}
                    step="0.01"
                    value={costo}
                    onChange={(e) => setCosto(e.target.value)}
                    onKeyDown={alEnter}
                    placeholder="Ej: 180.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se usa para el costo promedio y el margen. Si no lo sabés,
                    dejalo vacío.
                  </p>
                </div>
              )}
            </>
          )}

          {escaneo && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ScanBarcode className="h-3.5 w-3.5 shrink-0" />
              Escaneá el mismo producto otra vez para sumar uno.
            </p>
          )}

          {/* Nota */}
          <div className="space-y-2">
            <Label htmlFor="ajuste-nota">Nota (opcional)</Label>
            <Textarea
              id="ajuste-nota"
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder={contando ? "Ej: conteo de fin de mes" : "Ej: se derramó al trasvasar"}
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
                      hayCambio && totalDespues !== inventory.stockQuantity
                        ? signo > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-orange-600 dark:text-orange-400"
                        : ""
                    }
                  >
                    {formatearCantidad(totalDespues, unidad)}
                  </span>
                </div>
                {contando && contadoValido && (
                  <p className="mt-1 text-center text-xs text-muted-foreground">
                    {diferencia === 0
                      ? "Coincide con el sistema: no hay nada que corregir"
                      : `Se corrige ${diferencia > 0 ? "+" : "−"}${formatearCantidad(deltaBase, unidad)}`}
                  </p>
                )}
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

          {escaneo && (onHistorial || onEditar) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {onHistorial && (
                <button
                  type="button"
                  onClick={() => onHistorial(inventory)}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <History className="h-4 w-4" />
                  Ver historial
                </button>
              )}
              {onEditar && (
                <button
                  type="button"
                  onClick={() => onEditar(inventory)}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                  Editar producto
                </button>
              )}
            </div>
          )}
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={!puedeGuardar}>
            {createMovement.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {createMovement.isPending
              ? "Registrando..."
              : contando
                ? "Guardar conteo"
                : escaneo
                  ? direccion === "in"
                    ? "Agregar"
                    : "Quitar"
                  : "Registrar"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
