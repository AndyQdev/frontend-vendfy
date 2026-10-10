import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  CornerDownLeft,
  MapPin,
  Pencil,
  Plus,
  ScanBarcode,
  ShoppingCart,
  Store,
  Tag,
} from "lucide-react";

import type { ItemVenta } from "@/entities/order";
import type { ResultadoEscaneo, TiendaDelProducto } from "@/entities/product/model/escaneo";
import { cn } from "@/shared/lib/cn";
import { formatMoney } from "@/shared/lib/money";
import { Button } from "@/shared/ui/button";
import {
  ResponsiveDialogBody,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";
import { useHablando } from "@/shared/voz";
import { aparece, BarrasVoz, escalonado, ImagenProducto, PrecioAnimado } from "./piezas";

/** Cómo se lee el stock de un vistazo. */
function nivelStock(t: TiendaDelProducto) {
  const disponible = t.stock - t.reserved;
  if (disponible <= 0) {
    return t.sellWithoutStock
      ? { etiqueta: "A pedido", punto: "bg-info", texto: "text-info-soft-foreground", fondo: "bg-info-soft" }
      : { etiqueta: "Agotado", punto: "bg-destructive", texto: "text-destructive-soft-foreground", fondo: "bg-destructive-soft" };
  }
  if (disponible <= 5) {
    return { etiqueta: "Quedan pocos", punto: "bg-warning", texto: "text-warning-soft-foreground", fondo: "bg-warning-soft" };
  }
  return { etiqueta: "En stock", punto: "bg-success", texto: "text-success-soft-foreground", fondo: "bg-success-soft" };
}

/** Un Enter suelto (no en un campo ni sobre un botón) es "agregar a la venta". */
function esEnterLibre(e: KeyboardEvent) {
  if (e.key !== "Enter" || e.repeat || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return false;
  const destino = e.target as HTMLElement | null;
  return !destino?.closest?.("input, textarea, select, button, a, [contenteditable='true'], [role='switch'], [role='radio']");
}

interface Props {
  resultado: ResultadoEscaneo;
  tiendaId: string | null;
  recienCreado: boolean;
  /** Lo que ya hay en la venta en curso. */
  venta: ItemVenta[];
  /** La fila de stock desde la que se vendería (para saber cuántos hay en la venta). */
  inventarioParaVender: string | null;
  onAgregar: () => void;
  onCobrar: () => void;
  onIrACobrar: () => void;
  onEditar: () => void;
  onRepetirPrecio: () => void;
}

export function VistaEncontrado({
  resultado,
  tiendaId,
  recienCreado,
  venta,
  inventarioParaVender,
  onAgregar,
  onCobrar,
  onIrACobrar,
  onEditar,
  onRepetirPrecio,
}: Props) {
  const producto = resultado.producto!;
  const tiendas = producto.tiendas;
  const actual = tiendas.find((t) => t.storeId === tiendaId) ?? tiendas[0];
  const precios = new Set(tiendas.map((t) => t.price));
  const maxStock = Math.max(10, ...tiendas.map((t) => t.stock));
  const unidad = producto.inventoryType === "fractional" ? producto.baseUnit?.symbol ?? "" : "u.";
  const hablando = useHablando();

  const deEste = venta.find((i) => i.id === inventarioParaVender)?.quantity ?? 0;
  const unidades = venta.reduce((s, i) => s + i.quantity, 0);
  const total = venta.reduce((s, i) => s + i.price * i.quantity, 0);
  const sePuedeVender = !!inventarioParaVender;

  // Enter agrega otra unidad: escanear, Enter, escanear, Enter…
  useEffect(() => {
    if (!sePuedeVender) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (!esEnterLibre(e)) return;
      e.preventDefault();
      onAgregar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [sePuedeVender, onAgregar]);

  return (
    <motion.div
      key={`encontrado-${producto.id}`}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.22 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <ResponsiveDialogHeader className="pb-3">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-soft-foreground"
        >
          <CheckCircle2 className="size-3.5" aria-hidden />
          {recienCreado ? "¡Registrado!" : "Lo tenés en tu catálogo"}
        </motion.div>
        <ResponsiveDialogTitle className="pr-16 text-xl">{producto.name}</ResponsiveDialogTitle>
        <ResponsiveDialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 font-mono">
            <ScanBarcode className="size-3.5" aria-hidden />
            {resultado.codigoLegible}
          </span>
          {resultado.pais && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {resultado.pais}
            </span>
          )}
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <ResponsiveDialogBody className="pb-4">
        <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-6">
          <div className="relative mx-auto w-full max-w-[260px] md:max-w-none md:self-start">
            <ImagenProducto
              src={producto.imageUrls[0]}
              alt={producto.name}
              className="aspect-square w-full rounded-3xl shadow-[0_18px_50px_-24px_hsl(var(--foreground)/0.35)]"
            />
            {/* Cuántos hay de este en la venta: rebota con cada unidad que se suma. */}
            <AnimatePresence>
              {deEste > 0 && (
                <motion.span
                  key={deEste}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-sm font-bold text-primary-foreground shadow-lg"
                >
                  <ShoppingCart className="size-3.5" aria-hidden />
                  {deEste}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <motion.div variants={escalonado} initial="oculto" animate="visible" className="min-w-0 space-y-4">
            <motion.div variants={aparece} className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {precios.size > 1 ? `Precio en ${actual?.storeName}` : "Precio"}
              </p>
              <div className="flex items-center gap-3">
                <PrecioAnimado valor={actual?.price ?? 0} className="block text-4xl font-bold text-foreground sm:text-5xl" />
                <button
                  type="button"
                  onClick={onRepetirPrecio}
                  aria-label="Decir el precio otra vez"
                  title="Decir el precio otra vez"
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    hablando ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary-soft-foreground hover:bg-primary hover:text-primary-foreground",
                  )}
                >
                  <BarrasVoz activa={hablando} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {producto.brand && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-soft-foreground">
                    <Tag className="size-3" aria-hidden />
                    {producto.brand.name}
                  </span>
                )}
                {producto.category && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {producto.category.name}
                  </span>
                )}
              </div>
              {producto.description && (
                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{producto.description}</p>
              )}
            </motion.div>

            <motion.div variants={aparece} className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stock</p>
              {tiendas.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                  Todavía no está en ninguna tienda.
                </p>
              )}
              {tiendas.map((t, i) => {
                const nivel = nivelStock(t);
                const esActual = t.storeId === actual?.storeId;
                return (
                  <motion.div
                    key={t.storeId}
                    variants={aparece}
                    className={cn(
                      "rounded-xl border p-3 transition-colors",
                      esActual && tiendas.length > 1 ? "border-primary/40 bg-primary-soft/40" : "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <Store className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{t.storeName}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold", nivel.fondo, nivel.texto)}>
                          <span className={cn("size-1.5 rounded-full", nivel.punto)} />
                          {nivel.etiqueta}
                        </span>
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {t.stock} {unidad}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className={cn("h-full rounded-full", nivel.punto)}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (Math.max(t.stock, 0) / maxStock) * 100)}%` }}
                        transition={{ delay: 0.25 + i * 0.08, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                      />
                    </div>
                    {precios.size > 1 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Precio acá: <span className="font-semibold text-foreground">{formatMoney(t.price)}</span>
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>

            {/* La venta que se está armando: se ve crecer escaneo a escaneo. */}
            <AnimatePresence initial={false}>
              {unidades > 0 && (
                <motion.button
                  type="button"
                  onClick={onIrACobrar}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="group flex w-full items-center gap-3 overflow-hidden rounded-xl border border-primary/30 bg-primary-soft/60 px-3 py-2.5 text-left transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                    <ShoppingCart className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      Venta en curso · {unidades} {unidades === 1 ? "producto" : "productos"}
                    </span>
                    <motion.span key={total} initial={{ y: 4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="block text-xs text-muted-foreground">
                      Total {formatMoney(total)}
                    </motion.span>
                  </span>
                  <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />
                </motion.button>
              )}
            </AnimatePresence>

            <motion.p variants={aparece} className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ScanBarcode className="size-3.5" aria-hidden />
              Escaneá otro código cuando quieras
            </motion.p>
          </motion.div>
        </div>
      </ResponsiveDialogBody>

      <ResponsiveDialogFooter>
        <Button variant="ghost" onClick={onEditar}>
          <Pencil aria-hidden />
          Editar
        </Button>
        {deEste > 0 ? (
          <Button variant="outline" onClick={onIrACobrar}>
            Cobrar {formatMoney(total)}
            <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button variant="outline" onClick={onCobrar} disabled={!sePuedeVender}>
            <ShoppingCart aria-hidden />
            Cobrar ahora
          </Button>
        )}
        <Button onClick={onAgregar} disabled={!sePuedeVender} className="relative">
          {deEste > 0 ? <Plus aria-hidden /> : <ShoppingCart aria-hidden />}
          {deEste > 0 ? "Agregar otro" : "Agregar a la venta"}
          <kbd className="ml-1 hidden items-center rounded border border-primary-foreground/30 px-1 text-[10px] font-medium opacity-80 md:inline-flex">
            <CornerDownLeft className="size-3" aria-hidden />
          </kbd>
        </Button>
      </ResponsiveDialogFooter>
    </motion.div>
  );
}
