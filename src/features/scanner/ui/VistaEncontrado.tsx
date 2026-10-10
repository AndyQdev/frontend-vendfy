import { motion } from "motion/react";
import { CheckCircle2, MapPin, Pencil, ScanBarcode, ShoppingCart, Store, Tag } from "lucide-react";

import type { ResultadoEscaneo, TiendaDelProducto } from "@/entities/product/model/escaneo";
import { Button } from "@/shared/ui/button";
import {
  ResponsiveDialogBody,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";
import { cn } from "@/shared/lib/cn";
import { aparece, escalonado, ImagenProducto, PrecioAnimado } from "./piezas";

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

interface Props {
  resultado: ResultadoEscaneo;
  tiendaId: string | null;
  recienCreado: boolean;
  onVender: () => void;
  onEditar: () => void;
}

export function VistaEncontrado({ resultado, tiendaId, recienCreado, onVender, onEditar }: Props) {
  const producto = resultado.producto!;
  const tiendas = producto.tiendas;
  const actual = tiendas.find((t) => t.storeId === tiendaId) ?? tiendas[0];
  const precios = new Set(tiendas.map((t) => t.price));
  const maxStock = Math.max(10, ...tiendas.map((t) => t.stock));
  const unidad = producto.inventoryType === "fractional" ? producto.baseUnit?.symbol ?? "" : "u.";

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
        <ResponsiveDialogTitle className="pr-8 text-xl">{producto.name}</ResponsiveDialogTitle>
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
          <ImagenProducto
            src={producto.imageUrls[0]}
            alt={producto.name}
            className="mx-auto aspect-square w-full max-w-[260px] rounded-3xl shadow-[0_18px_50px_-24px_hsl(var(--foreground)/0.35)] md:max-w-none md:self-start"
          />
        <motion.div variants={escalonado} initial="oculto" animate="visible" className="min-w-0 space-y-4">
          <motion.div variants={aparece} className="flex items-center gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {precios.size > 1 ? `Precio en ${actual?.storeName}` : "Precio"}
              </p>
              <PrecioAnimado valor={actual?.price ?? 0} className="block text-4xl font-bold text-foreground sm:text-5xl" />
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
            </div>
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
                      Precio acá: <span className="font-semibold text-foreground">Bs {t.price.toFixed(2)}</span>
                    </p>
                  )}
                </motion.div>
              );
            })}
          </motion.div>

          <motion.p variants={aparece} className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ScanBarcode className="size-3.5" aria-hidden />
            Escaneá otro código cuando quieras
          </motion.p>
        </motion.div>
        </div>
      </ResponsiveDialogBody>

      <ResponsiveDialogFooter>
        <Button variant="outline" onClick={onEditar}>
          <Pencil aria-hidden />
          Editar
        </Button>
        <Button onClick={onVender} disabled={!actual?.inventoryId}>
          <ShoppingCart aria-hidden />
          Vender ahora
        </Button>
      </ResponsiveDialogFooter>
    </motion.div>
  );
}
