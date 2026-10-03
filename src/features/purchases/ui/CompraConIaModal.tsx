import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, PackageCheck, Search, Sparkles, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { useLeerFactura, useRegistrarCompra } from "@/entities/omnibox/api";
import type { ProductoOpcion, Propuesta } from "@/entities/omnibox/model/types";
import { ElegirProducto } from "@/features/omnibox/ui/ElegirProducto";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { ButtonMagic } from "@/shared/ui/button-magic";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogBody as DialogBody,
} from "@/shared/ui/responsive-dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

/**
 * "Crear con IA" de Compras: la nota de compra o factura del proveedor (PDF,
 * Word, Excel o foto) se lee y queda armada como compra.
 *
 * Usa el mismo lector que la compra desde foto del asistente
 * (`POST /api/omnibox/factura`): cada renglón se cruza con el catálogo. Lo
 * reconocido llega elegido; lo dudoso se elige entre los parecidos o se busca;
 * lo que no va se omite. Registrar crea la orden y la confirma: sube el stock.
 */

interface Linea {
  texto: string;
  cantidad: number;
  costo: number;
  producto: ProductoOpcion | null;
  opciones: ProductoOpcion[];
  omitida: boolean;
  buscando: boolean;
}

const ACEPTA = ".pdf,.docx,.xlsx,.xls,.txt,.csv,image/*";

function dinero(n: number) {
  return n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineasDe(p: Propuesta): Linea[] {
  return (p.items ?? []).map((it) => {
    const previo = it.producto ? p.costos?.[it.producto.productId] : undefined;
    return {
      texto: it.texto,
      cantidad: it.cantidad,
      costo: it.precio ?? previo?.ultimoCosto ?? previo?.costoPromedio ?? 0,
      producto: it.producto,
      opciones: it.opciones,
      omitida: false,
      buscando: false,
    };
  });
}

export function CompraConIaModal({
  open,
  onOpenChange,
  storeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const leer = useLeerFactura();
  const registrar = useRegistrarCompra();
  const input = useRef<HTMLInputElement>(null);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [lineas, setLineas] = useState<Linea[] | null>(null);
  const [proveedor, setProveedor] = useState("");
  const [referencia, setReferencia] = useState("");
  const [adjunto, setAdjunto] = useState<string | null>(null);

  function reiniciar() {
    setArchivo(null);
    setLineas(null);
    setProveedor("");
    setReferencia("");
    setAdjunto(null);
  }

  async function leerArchivo() {
    if (!archivo) return;
    try {
      const p = await leer.mutateAsync({ archivo, storeId });
      if (!p.items?.length) {
        toast.error("No encontré productos en ese documento. Probá con otro archivo o una foto más nítida.");
        return;
      }
      const e = p.entidades as Record<string, any>;
      setLineas(lineasDe(p));
      setProveedor(e.proveedor ?? "");
      setReferencia(e.referencia ?? "");
      setAdjunto(e.adjunto ?? null);
    } catch (error: any) {
      toast.error(error?.message ?? "No se pudo leer el documento");
    }
  }

  function cambiar(i: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev!.map((l, j) => (j === i ? { ...l, ...cambios } : l)));
  }

  const activas = (lineas ?? []).filter((l) => !l.omitida);
  const pendientes = activas.filter((l) => !l.producto).length;
  const total = activas.reduce((s, l) => s + l.cantidad * l.costo, 0);
  const puedeRegistrar = activas.length > 0 && pendientes === 0 && !registrar.isPending;

  async function registrarCompra() {
    // Si el mismo producto quedó en dos renglones, se suma en una línea.
    const porProducto = new Map<string, { productId: string; cantidad: number; costo: number }>();
    for (const l of activas) {
      const id = l.producto!.productId;
      const previo = porProducto.get(id);
      porProducto.set(id, {
        productId: id,
        cantidad: (previo?.cantidad ?? 0) + l.cantidad,
        costo: l.costo,
      });
    }
    try {
      const compra = await registrar.mutateAsync({
        storeId,
        lineas: [...porProducto.values()],
        proveedor: proveedor.trim() || undefined,
        referencia: referencia.trim() || undefined,
        adjunto: adjunto ?? undefined,
      });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Compra registrada: el stock ya subió");
      onOpenChange(false);
      reiniciar();
      navigate(`/purchases/${compra.purchaseOrderId}`);
    } catch (error: any) {
      toast.error(error?.message ?? "No se pudo registrar la compra");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reiniciar();
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Crear compra con IA
          </DialogTitle>
          <DialogDescription>
            Subí la nota de compra o la factura del proveedor (PDF, Word, Excel o foto). La IA reconoce los
            productos, cantidades y costos, y arma la compra para que la revises.
          </DialogDescription>
        </DialogHeader>

      <DialogBody>
        {!lineas ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) setArchivo(f);
              }}
              className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:bg-muted/50"
            >
              <FileUp className="h-8 w-8 text-muted-foreground" />
              {archivo ? (
                <span className="text-sm font-medium">{archivo.name}</span>
              ) : (
                <>
                  <span className="text-sm font-medium">Tocá o arrastrá el archivo acá</span>
                  <span className="text-xs text-muted-foreground">PDF, Word, Excel, TXT o imagen · hasta 10 MB</span>
                </>
              )}
            </button>
            <input
              ref={input}
              type="file"
              accept={ACEPTA}
              className="hidden"
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <div className="flex justify-end">
              <ButtonMagic onClick={leerArchivo} disabled={!archivo || leer.isPending} alwaysActive>
                {leer.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {leer.isPending ? "Leyendo el documento…" : "Leer con IA"}
              </ButtonMagic>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ia-proveedor">Proveedor</Label>
                <Input id="ia-proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ia-referencia">N° de factura o nota</Label>
                <Input id="ia-referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Producto</th>
                    <th className="w-24 px-3 py-2 font-medium">Cantidad</th>
                    <th className="w-32 px-3 py-2 font-medium">Costo c/u (Bs)</th>
                    <th className="w-28 px-3 py-2 text-right font-medium">Subtotal</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => (
                    <tr key={i} className={cn("border-t align-top", l.omitida && "opacity-50")}>
                      <td className="px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l.texto}</p>
                        {l.omitida ? (
                          <p className="mt-1 text-xs italic text-muted-foreground">No se carga este renglón</p>
                        ) : l.producto ? (
                          <div className="mt-1 flex items-center gap-2">
                            <span className="font-medium">{l.producto.nombre}</span>
                            <button
                              type="button"
                              className="text-xs text-primary hover:underline"
                              onClick={() => cambiar(i, { producto: null, buscando: true })}
                            >
                              cambiar
                            </button>
                          </div>
                        ) : (
                          <div className="mt-1.5 space-y-2">
                            {l.opciones.length > 0 && !l.buscando && (
                              <div className="flex flex-wrap gap-1.5">
                                {l.opciones.slice(0, 4).map((o) => (
                                  <button
                                    key={o.productId}
                                    type="button"
                                    onClick={() => cambiar(i, { producto: o })}
                                    className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                                  >
                                    {o.nombre}
                                  </button>
                                ))}
                              </div>
                            )}
                            {l.buscando || l.opciones.length === 0 ? (
                              <ElegirProducto
                                storeId={storeId}
                                textoInicial=""
                                autoFoco={false}
                                onElegir={(o) => cambiar(i, { producto: o, buscando: false })}
                              />
                            ) : (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                onClick={() => cambiar(i, { buscando: true })}
                              >
                                <Search className="h-3 w-3" />
                                Buscar otro producto
                              </button>
                            )}
                            <p className="text-xs text-amber-700">
                              Elegí a qué producto corresponde, o omití el renglón. Si es nuevo, crealo antes en Productos.
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={l.cantidad}
                          disabled={l.omitida}
                          onChange={(e) => cambiar(i, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                          className="h-8"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.costo}
                          disabled={l.omitida}
                          onChange={(e) => cambiar(i, { costo: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-8"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {l.omitida ? "—" : `Bs ${dinero(l.cantidad * l.costo)}`}
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={l.omitida ? "Volver a incluir" : "Omitir renglón"}
                          onClick={() => cambiar(i, { omitida: !l.omitida })}
                        >
                          {l.omitida ? <Undo2 className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <div>
                <p className="text-xs text-muted-foreground">Total de la compra</p>
                <p className="text-2xl font-bold tabular-nums">Bs {dinero(total)}</p>
                {pendientes > 0 && (
                  <p className="text-xs font-medium text-amber-700">
                    Falta{pendientes === 1 ? "" : "n"} {pendientes} renglón{pendientes === 1 ? "" : "es"} por resolver
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reiniciar} disabled={registrar.isPending}>
                  Leer otro archivo
                </Button>
                <Button onClick={registrarCompra} disabled={!puedeRegistrar}>
                  {registrar.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PackageCheck className="mr-2 h-4 w-4" />
                  )}
                  Registrar compra
                </Button>
              </div>
            </div>
          </div>
        )}

      </DialogBody>

      </DialogContent>
    </Dialog>
  );
}
