import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogBody as DialogBody,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/shared/ui/responsive-dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useCrearPromocion, useEditarPromocion } from "@/entities/promotion/api";
import {
  MAX_PRODUCTOS_POR_PROMOCION,
  type Promocion,
  type TipoDescuento,
} from "@/entities/promotion/model/types";
import { subirImagenDeTienda } from "@/features/store/model/subir-imagen-tienda";
import { DialogImagenIa } from "./DialogImagenIa";
import { SelectorProductos, type ProductoElegible } from "./SelectorProductos";

/**
 * Crear o editar una promoción: nombre, descuento, vigencia, productos e
 * imagen. El precio con descuento se calcula en el servidor (al cobrar, otra
 * vez); lo que se muestra acá es una vista previa para que el comerciante vea
 * cuánto queda cada producto antes de publicar.
 */

const DESCUENTOS: Array<{ id: TipoDescuento; nombre: string; ayuda: string }> = [
  { id: "percent", nombre: "Porcentaje", ayuda: "Un % menos en cada producto (de 1 a 95)." },
  { id: "amount", nombre: "Monto por unidad", ayuda: "Bs menos en cada unidad de cada producto." },
  { id: "none", nombre: "Sin descuento", ayuda: "Solo una selección de productos con su propia página." },
];

/** Lo mismo que hace el servidor, para la vista previa: nunca da menos de cero ni más que el precio. */
function conDescuento(lista: number, tipo: TipoDescuento, valor: number): number {
  if (tipo === "none" || !(valor > 0)) return lista;
  const final = tipo === "percent" ? lista * (1 - Math.min(valor, 95) / 100) : lista - valor;
  return Math.min(lista, Math.max(0, Math.round(final * 100) / 100));
}

/** De un ISO del servidor al valor de un `datetime-local` (hora local, sin segundos). */
function aLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export function PromocionForm({
  open,
  onOpenChange,
  storeId,
  promocion,
  precargado,
  onGuardada,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  /** Con una promoción, se edita; sin ella, se crea. */
  promocion?: Promocion;
  /** Al crear, con productos e imagen ya elegidos (por ejemplo, desde una imagen hecha con IA). */
  precargado?: { productos: ProductoElegible[]; imagen: string | null };
  /** Ya guardada (creada o editada): quien la pidió sigue con ella. */
  onGuardada?: (promocion: Promocion) => void;
}) {
  const crear = useCrearPromocion();
  const editar = useEditarPromocion(storeId);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<TipoDescuento>("percent");
  const [valor, setValor] = useState("");
  const [empieza, setEmpieza] = useState("");
  const [termina, setTermina] = useState("");
  const [activa, setActiva] = useState(true);
  const [productos, setProductos] = useState<ProductoElegible[]>([]);
  const [imagen, setImagen] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [iaAbierta, setIaAbierta] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  // Al abrir: lo de la promoción que se edita, o en blanco. Solo al abrir (o al
  // pasar a editar otra): la lista se vuelve a pedir al volver a la pestaña, y
  // pisar el formulario por eso borraría lo que se estaba escribiendo.
  const promocionRef = useRef(promocion);
  promocionRef.current = promocion;
  const precargadoRef = useRef(precargado);
  precargadoRef.current = precargado;
  useEffect(() => {
    if (!open) return;
    const promocion = promocionRef.current;
    setNombre(promocion?.nombre ?? "");
    setDescripcion(promocion?.descripcion ?? "");
    setTipo(promocion?.tipo ?? "percent");
    setValor(promocion && promocion.tipo !== "none" ? String(promocion.valor) : "");
    setEmpieza(aLocal(promocion?.empieza ?? null));
    setTermina(aLocal(promocion?.termina ?? null));
    setActiva(promocion?.activa ?? true);
    setImagen(promocion?.imagen ?? precargadoRef.current?.imagen ?? null);
    setProductos(
      promocion
        ? promocion.productos.map((p) => ({
            productId: p.productoId,
            storeProductId: p.storeProductId,
            nombre: p.nombre,
            imagen: p.imagen,
            precio: p.precioLista,
          }))
        : (precargadoRef.current?.productos ?? []),
    );
  }, [open, promocion?.id]);

  const numero = Number(valor.replace(",", "."));
  const errorDeDescuento =
    tipo === "none"
      ? null
      : !(numero > 0)
        ? "Pon cuánto se descuenta."
        : tipo === "percent" && numero > 95
          ? "El porcentaje no puede pasar de 95."
          : null;
  const errorDeFechas =
    empieza && termina && new Date(termina) <= new Date(empieza) ? "Tiene que terminar después de empezar." : null;

  const falta =
    nombre.trim().length < 2
      ? "Ponle un nombre."
      : productos.length === 0
        ? "Elige al menos un producto."
        : errorDeDescuento || errorDeFechas;

  const guardando = crear.isPending || editar.isPending;

  const guardar = async () => {
    if (falta) return;
    const comunes = {
      name: nombre.trim(),
      description: descripcion.trim(),
      kind: tipo,
      value: tipo === "none" ? 0 : numero,
      startsAt: empieza ? new Date(empieza).toISOString() : null,
      endsAt: termina ? new Date(termina).toISOString() : null,
      active: activa,
      storeProductIds: productos.map((p) => p.storeProductId),
    };
    try {
      if (promocion) {
        const guardada = await editar.mutateAsync({ id: promocion.id, cambios: { ...comunes, imageUrl: imagen } });
        toast.success("Promoción actualizada");
        onGuardada?.(guardada);
      } else {
        const guardada = await crear.mutateAsync({
          storeId,
          ...comunes,
          // Sin fecha el servidor no necesita el campo; con `null` tampoco.
          startsAt: comunes.startsAt,
          endsAt: comunes.endsAt,
          ...(imagen ? { imageUrl: imagen } : {}),
        });
        toast.success("Promoción creada");
        onGuardada?.(guardada);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la promoción");
    }
  };

  const subir = async (f: File | undefined) => {
    if (!f) return;
    setSubiendo(true);
    try {
      setImagen(await subirImagenDeTienda(f));
    } catch {
      toast.error("No se pudo subir la imagen. Prueba con un JPG, PNG o WebP de hasta 5 MB.");
    } finally {
      setSubiendo(false);
    }
  };

  // La IA parte de lo que ya se eligió: una promoción guardada, uno o varios productos, o nada.
  const inicialIa = promocion
    ? { modo: "promotion" as const, promotionId: promocion.id }
    : productos.length > 1
      ? { modo: "products" as const, productos: productos.slice(0, 4) }
      : productos.length === 1
        ? { modo: "product" as const, productos }
        : { modo: "scratch" as const };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{promocion ? "Editar promoción" : "Nueva promoción"}</DialogTitle>
            <DialogDescription>
              Una campaña con su propia página en la tienda: la compartes en redes y tus clientes ven todos sus productos a la vez.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Liquidación de verano" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descripción (opcional)</Label>
              <Textarea value={descripcion} maxLength={500} rows={2} onChange={(e) => setDescripcion(e.target.value)} placeholder="Una o dos líneas sobre la campaña" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Descuento</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {DESCUENTOS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setTipo(d.id)}
                    aria-pressed={tipo === d.id}
                    className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                      tipo === d.id ? "border-primary bg-primary/10 font-semibold" : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {d.nombre}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{DESCUENTOS.find((d) => d.id === tipo)?.ayuda}</p>
              {tipo !== "none" && (
                <div className="flex max-w-[220px] items-center gap-2">
                  <Input
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder={tipo === "percent" ? "30" : "10"}
                    aria-label="Cuánto se descuenta"
                  />
                  <span className="text-sm text-muted-foreground">{tipo === "percent" ? "%" : "Bs"}</span>
                </div>
              )}
              {errorDeDescuento && valor && <p className="text-xs text-destructive">{errorDeDescuento}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Empieza (opcional)</Label>
                <Input type="datetime-local" value={empieza} onChange={(e) => setEmpieza(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Termina (opcional)</Label>
                <Input type="datetime-local" value={termina} onChange={(e) => setTermina(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Sin fecha de inicio rige ya; sin fecha de fin no vence. A la hora de fin, los productos vuelven a su precio normal.
              </p>
              {errorDeFechas && <p className="text-xs text-destructive sm:col-span-2">{errorDeFechas}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Productos</Label>
              <SelectorProductos storeId={storeId} value={productos} onChange={setProductos} max={MAX_PRODUCTOS_POR_PROMOCION} />
              {productos.length > 0 && tipo !== "none" && !errorDeDescuento && (
                <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                  {productos.map((p) => (
                    <li key={p.storeProductId} className="flex items-center justify-between gap-3 px-3 py-1.5">
                      <span className="truncate">{p.nombre}</span>
                      <span className="flex-none">
                        <s className="mr-2 text-muted-foreground">Bs {p.precio.toFixed(2)}</s>
                        <span className="font-semibold">Bs {conDescuento(p.precio, tipo, numero).toFixed(2)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Imagen de la campaña (opcional)</Label>
              <div className="flex items-start gap-3">
                <div className="relative flex h-24 w-40 flex-none items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted">
                  {imagen ? (
                    <>
                      <img src={imagen} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImagen(null)}
                        aria-label="Quitar la imagen"
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button type="button" variant="outline" size="sm" disabled={subiendo} onClick={() => archivo.current?.click()}>
                    {subiendo ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-2 h-3.5 w-3.5" />}
                    Subir una
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setIaAbierta(true)}>
                    <Sparkles className="mr-2 h-3.5 w-3.5 text-purple-600" /> Crear con IA o elegir del historial
                  </Button>
                  <input
                    ref={archivo}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      subir(f);
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Es el banner de la página de la promoción. Mejor horizontal, de al menos 1600 px.</p>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <span>
                <span className="block text-sm font-medium">Activa</span>
                <span className="block text-xs text-muted-foreground">Apagada, no se ve ni rebaja nada, aunque esté dentro de sus fechas.</span>
              </span>
              <Switch checked={activa} onCheckedChange={setActiva} />
            </label>
          </DialogBody>

          <DialogFooter className="items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">{falta ?? ""}</p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={guardar} disabled={Boolean(falta) || guardando}>
                {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {promocion ? "Guardar cambios" : "Crear promoción"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogImagenIa
        open={iaAbierta}
        onOpenChange={setIaAbierta}
        storeId={storeId}
        inicial={inicialIa}
        onUsar={(img) => setImagen(img.url)}
      />
    </>
  );
}
