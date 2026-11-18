import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/shared/ui/button";
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
import { Skeleton } from "@/shared/ui/skeleton";
import { formatMoney } from "@/shared/lib/money";
import { usePresentations } from "@/entities/presentation/api";
import type { Presentation } from "@/entities/presentation/model/types";

export interface ProductoParaVender {
  id: string;
  storeProductId: string;
  name: string;
  price: number;
  stock: number;
  imageUrl?: string;
  inventoryType?: string;
  contentPerUnit?: number;
  pricePerBaseUnit?: number;
  baseUnitSymbol?: string;
}

export interface LineaElegida {
  presentationId?: string;
  presentationName?: string;
  baseQuantity: number;
  unitPrice: number;
  quantity: number;
}

interface Props {
  producto: ProductoParaVender | null;
  onCerrar: () => void;
  onAgregar: (linea: LineaElegida) => void;
}

const numero = (valor: string) => {
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

interface Opcion {
  clave: string;
  nombre: string;
  detalle: string;
  presentacion: Presentation | null;
  baseQuantity: number;
  precio: number;
}

/**
 * Elegir cómo se lleva el producto en Caja: el envase completo, un decant del
 * catálogo o una medida libre. El servidor vuelve a calcular precio y consumo,
 * esto es solo para que el cajero vea lo que va a cobrar.
 */
export function SelectorFormaDeVentaCaja({ producto, onCerrar, onAgregar }: Props) {
  const { data: presentaciones = [], isLoading } = usePresentations(
    producto?.storeProductId ?? null
  );
  const [clave, setClave] = useState("completo");
  const [medida, setMedida] = useState("");
  const [cantidad, setCantidad] = useState(1);

  const fraccionado = producto?.inventoryType === "fractional";
  const simbolo = producto?.baseUnitSymbol ?? "u";

  const opciones = useMemo<Opcion[]>(() => {
    if (!producto) return [];
    const envase = presentaciones.find((p) => p.kind === "FULL_UNIT") ?? null;
    const contenido = envase?.baseQuantity ?? (fraccionado ? producto.contentPerUnit || 1 : 1);
    const precioEnvase = !envase
      ? producto.price
      : envase.priceMode === "FIXED"
        ? Number(envase.price ?? 0)
        : Math.round(Number(envase.pricePerBaseUnit ?? 0) * contenido * 100) / 100;

    const completo: Opcion = {
      clave: "completo",
      nombre: envase?.name || "Envase completo",
      detalle: fraccionado ? `Lleva ${contenido} ${simbolo}` : "Una unidad",
      presentacion: envase,
      baseQuantity: contenido,
      precio: precioEnvase,
    };

    return [
      completo,
      ...presentaciones
        .filter((p) => p.kind !== "FULL_UNIT")
        .map((p) => ({
          clave: p.id,
          nombre: p.name,
          detalle: detalleDe(p, simbolo),
          presentacion: p,
          baseQuantity: p.kind === "VARIABLE_MEASURE" ? 0 : p.baseQuantity ?? 0,
          precio: p.priceMode === "FIXED" ? Number(p.price ?? 0) : 0,
        })),
    ];
  }, [producto, fraccionado, presentaciones, simbolo]);

  const elegida = opciones.find((o) => o.clave === clave) ?? opciones[0];
  const variable = elegida?.presentacion?.kind === "VARIABLE_MEASURE";

  useEffect(() => {
    setCantidad(1);
    setClave("completo");
  }, [producto?.storeProductId]);

  useEffect(() => {
    if (!variable || !elegida?.presentacion) return;
    const p = elegida.presentacion;
    setMedida(String(p.minBaseQuantity ?? p.stepBaseQuantity ?? 1));
  }, [clave, variable, elegida?.presentacion]);

  const medidaElegida = variable ? numero(medida) : elegida?.baseQuantity ?? 1;

  const precioUnitario = useMemo(() => {
    if (!elegida) return 0;
    const p = elegida.presentacion;
    if (!p) return elegida.precio;
    if (p.priceMode === "FIXED") return Number(p.price ?? 0);
    return Math.round(Number(p.pricePerBaseUnit ?? 0) * medidaElegida * 100) / 100;
  }, [elegida, medidaElegida]);

  const consumo = variable ? medidaElegida : elegida?.baseQuantity ?? 1;
  const maximo = consumo > 0 ? Math.floor((producto?.stock ?? 0) / consumo) : 0;
  const medidaValida =
    !variable ||
    !elegida?.presentacion ||
    (Number.isInteger(medidaElegida) &&
      medidaElegida >= (elegida.presentacion.minBaseQuantity ?? 1) &&
      medidaElegida <= (elegida.presentacion.maxBaseQuantity ?? Infinity) &&
      (medidaElegida - (elegida.presentacion.minBaseQuantity ?? 1)) %
        (elegida.presentacion.stepBaseQuantity ?? 1) ===
        0);

  const agregar = () => {
    if (!elegida || !producto || cantidad < 1 || cantidad > maximo || !medidaValida) return;
    onAgregar({
      presentationId: elegida.presentacion?.id,
      presentationName: elegida.presentacion?.name,
      baseQuantity: consumo,
      unitPrice: precioUnitario,
      quantity: cantidad,
    });
  };

  return (
    <Dialog open={Boolean(producto)} onOpenChange={(open) => !open && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{producto?.name ?? "Agregar a la venta"}</DialogTitle>
          <DialogDescription>
            {fraccionado
              ? `Hay ${producto?.stock ?? 0} ${simbolo} en stock. Elegí cómo se lo lleva.`
              : "Elegí cuántas unidades van a la venta."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {fraccionado && (
            <div className="space-y-2">
              <Label>Forma de venta</Label>
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="grid gap-2" role="radiogroup" aria-label="Forma de venta">
                  {opciones.map((o) => (
                    <button
                      key={o.clave}
                      type="button"
                      role="radio"
                      aria-checked={clave === o.clave}
                      onClick={() => setClave(o.clave)}
                      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                        clave === o.clave
                          ? "border-primary bg-primary/5"
                          : "hover:border-muted-foreground/40"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{o.nombre}</span>
                        <span className="block text-xs text-muted-foreground">{o.detalle}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {o.presentacion?.priceMode === "PER_BASE_UNIT"
                          ? `${formatMoney(Number(o.presentacion.pricePerBaseUnit ?? 0))} / ${o.presentacion.baseUnit?.symbol ?? simbolo}`
                          : formatMoney(o.precio)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {variable && elegida?.presentacion && (
            <div className="space-y-2">
              <Label htmlFor="medida-caja">¿Cuánto lleva? ({simbolo})</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Menos"
                  onClick={() => {
                    const paso = elegida.presentacion?.stepBaseQuantity ?? 1;
                    const min = elegida.presentacion?.minBaseQuantity ?? paso;
                    setMedida(String(Math.max(min, numero(medida) - paso)));
                  }}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="medida-caja"
                  type="number"
                  className="text-center"
                  min={elegida.presentacion.minBaseQuantity ?? 1}
                  max={elegida.presentacion.maxBaseQuantity ?? undefined}
                  step={elegida.presentacion.stepBaseQuantity ?? 1}
                  value={medida}
                  onChange={(e) => setMedida(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Más"
                  onClick={() => {
                    const paso = elegida.presentacion?.stepBaseQuantity ?? 1;
                    const max = elegida.presentacion?.maxBaseQuantity ?? Infinity;
                    setMedida(String(Math.min(max, numero(medida) + paso)));
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                De {elegida.presentacion.minBaseQuantity ?? 1} a{" "}
                {elegida.presentacion.maxBaseQuantity ?? "—"} {simbolo}, de a{" "}
                {elegida.presentacion.stepBaseQuantity ?? 1}.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Cantidad</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Restar"
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                disabled={cantidad <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center font-semibold tabular-nums">{cantidad}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Sumar"
                onClick={() => setCantidad((c) => Math.min(maximo, c + 1))}
                disabled={cantidad >= maximo}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <span className="ml-auto text-sm text-muted-foreground">
                Total <span className="font-semibold text-foreground">{formatMoney(precioUnitario * cantidad)}</span>
              </span>
            </div>
            {maximo === 0 ? (
              <p className="text-xs text-destructive">
                No alcanza el stock para esta forma de venta.
              </p>
            ) : !medidaValida ? (
              <p className="text-xs text-destructive">
                Elegí una medida válida, de a {elegida?.presentacion?.stepBaseQuantity ?? 1} {simbolo}.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Alcanza para {maximo} {maximo === 1 ? "unidad" : "unidades"}.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="button" onClick={agregar} disabled={maximo === 0 || cantidad > maximo || !medidaValida}>
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function detalleDe(p: Presentation, simbolo: string) {
  const factor = p.displayUnit?.factorToBase || 1;
  const unidad = p.displayUnit?.symbol ?? simbolo;
  const enMuestra = (n: number | null) => (n === null ? "—" : Number((n / factor).toFixed(3)));
  if (p.kind === "VARIABLE_MEASURE") {
    return `${enMuestra(p.minBaseQuantity)}–${enMuestra(p.maxBaseQuantity)} ${unidad}`;
  }
  return `Lleva ${enMuestra(p.baseQuantity)} ${unidad}`;
}
