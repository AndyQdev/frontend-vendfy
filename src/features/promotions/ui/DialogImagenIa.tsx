import { useEffect, useRef, useState } from "react";
import { History, ImageIcon, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
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
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  useEliminarImagenIa,
  useEstadoIa,
  useGenerarImagenIa,
  useImagenesIa,
  usePromociones,
} from "@/entities/promotion/api";
import type { ImagenIa, ProporcionImagen, TipoImagenIa } from "@/entities/promotion/model/types";
import { SelectorProductos, type ProductoElegible } from "./SelectorProductos";

/**
 * Crear una imagen de portada o de campaña con IA, y volver a usar las que ya
 * se hicieron.
 *
 * Tres cosas que importan:
 * - La IA NO escribe texto en la imagen (lo dice abajo, para que nadie lo
 *   pida): los modelos de imágenes lo dibujan mal y un precio equivocado en una
 *   publicidad es un problema. El título, el texto y el botón los pone la tienda.
 * - Cada imagen que se genera queda en el historial, se use o no: la podés
 *   volver a elegir en otra portada o campaña sin pagar otra generación.
 * - Nada se aplica solo: la imagen se ve y se decide usarla o descartarla.
 */

const MODOS: Array<{ id: TipoImagenIa; nombre: string; ayuda: string }> = [
  { id: "scratch", nombre: "Desde cero", ayuda: "Una publicidad nueva, sin ningún producto en particular." },
  { id: "product", nombre: "Con un producto", ayuda: "Parte de la foto de un producto y arma una imagen publicitaria con él." },
  { id: "products", nombre: "Con varios productos", ayuda: "Compone una imagen con 2 a 4 productos juntos." },
  { id: "promotion", nombre: "Con una promoción", ayuda: "Usa los productos de una promoción y queda vinculada a ella." },
];

const PROPORCIONES: Array<{ id: ProporcionImagen; nombre: string }> = [
  { id: "16:9", nombre: "Horizontal" },
  { id: "9:16", nombre: "Vertical (celular)" },
  { id: "1:1", nombre: "Cuadrada" },
];

const EJEMPLOS = ["Verano, fresco, tonos cálidos", "Elegante y minimalista", "Fiesta de fin de año, dorado", "Juvenil y colorido"];

export interface InicialIa {
  modo?: TipoImagenIa;
  productos?: ProductoElegible[];
  promotionId?: string;
}

/** Lo que acompaña a la imagen elegida. */
export interface ContextoDeUso {
  /** Los productos con los que se hizo, si se acaba de generar (en el historial no se sabe). */
  productos: ProductoElegible[];
  /** El comerciante pidió, además, armar una promoción con esos productos. */
  agrupar: boolean;
}

export function DialogImagenIa({
  open,
  onOpenChange,
  storeId,
  inicial,
  onUsar,
  permitirAgrupar = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  inicial?: InicialIa;
  /** El comerciante eligió usar esta imagen (recién hecha o del historial). */
  onUsar: (imagen: ImagenIa, contexto: ContextoDeUso) => void;
  /** Ofrecer "usar y armar una promoción con estos productos" (en Diseño; en una promoción no tiene sentido). */
  permitirAgrupar?: boolean;
}) {
  const [modo, setModo] = useState<TipoImagenIa>("scratch");
  const [productos, setProductos] = useState<ProductoElegible[]>([]);
  const [promotionId, setPromotionId] = useState("");
  const [brief, setBrief] = useState("");
  const [aspect, setAspect] = useState<ProporcionImagen>("16:9");
  const [resultado, setResultado] = useState<ImagenIa | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);

  const promociones = usePromociones(storeId).data ?? [];
  const historial = useImagenesIa(open ? storeId : undefined);
  const estado = useEstadoIa(open ? storeId : undefined);
  const generar = useGenerarImagenIa();
  const eliminar = useEliminarImagenIa(storeId);

  // Al abrir se parte de lo que pide quien llama (una promoción, un producto).
  // Se lee de una referencia y solo al abrir: quien llama arma `inicial` de nuevo
  // en cada render, y reiniciar el diálogo por eso borraría lo que se está escribiendo.
  const inicialRef = useRef(inicial);
  inicialRef.current = inicial;
  useEffect(() => {
    if (!open) return;
    const i = inicialRef.current;
    setModo(i?.modo ?? "scratch");
    setProductos(i?.productos ?? []);
    setPromotionId(i?.promotionId ?? "");
    setBrief("");
    setResultado(null);
    setVerHistorial(false);
  }, [open]);

  const maxProductos = modo === "product" ? 1 : 4;
  const faltaAlgo =
    brief.trim().length < 3
      ? "Contanos qué querés ver en la imagen."
      : modo === "product" && productos.length !== 1
        ? "Elegí un producto."
        : modo === "products" && (productos.length < 2 || productos.length > 4)
          ? "Elegí entre 2 y 4 productos."
          : modo === "promotion" && !promotionId
            ? "Elegí una promoción."
            : null;

  const noDisponible = estado.data && !estado.data.disponible;
  const sinCupo = estado.data && estado.data.usadasHoy >= estado.data.tope;

  const pedir = async () => {
    try {
      const imagen = await generar.mutateAsync({
        storeId,
        kind: modo,
        brief: brief.trim(),
        aspect,
        ...(modo === "product" || modo === "products" ? { storeProductIds: productos.map((p) => p.storeProductId) } : {}),
        ...(modo === "promotion" ? { promotionId } : {}),
      });
      setResultado(imagen);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar la imagen");
    }
  };

  const usar = (imagen: ImagenIa, agrupar = false) => {
    // Los productos solo se conocen si la imagen es la que se acaba de generar.
    onUsar(imagen, { productos: resultado?.id === imagen.id ? productos : [], agrupar });
    onOpenChange(false);
  };

  const descartar = async (imagen: ImagenIa) => {
    try {
      await eliminar.mutateAsync(imagen.id);
      if (resultado?.id === imagen.id) setResultado(null);
    } catch {
      toast.error("No se pudo sacar la imagen del historial");
    }
  };

  const imagenes = historial.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" /> Crear una imagen con IA
          </DialogTitle>
          <DialogDescription>
            La IA hace el arte; el título, el texto y el botón los ponés vos en la portada, así se leen bien. Lo que
            generes queda guardado para reusarlo.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {noDisponible && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              La IA todavía no está conectada en este servidor. Podés reusar las imágenes que ya hiciste.
            </p>
          )}

          {resultado ? (
            <Resultado
              imagen={resultado}
              ocupado={eliminar.isPending}
              onUsar={() => usar(resultado)}
              onAgrupar={permitirAgrupar && productos.length > 0 && (resultado.kind === "product" || resultado.kind === "products") ? () => usar(resultado, true) : undefined}
              onDescartar={() => descartar(resultado)}
              onOtra={() => setResultado(null)}
            />
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs">¿De qué parte?</Label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {MODOS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setModo(m.id);
                        // Al pasar de varios a uno, se queda con el primero.
                        if (m.id === "product") setProductos((p) => p.slice(0, 1));
                      }}
                      aria-pressed={modo === m.id}
                      className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                        modo === m.id ? "border-primary bg-primary/10 font-semibold" : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {m.nombre}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{MODOS.find((m) => m.id === modo)?.ayuda}</p>
              </div>

              {(modo === "product" || modo === "products") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{modo === "product" ? "El producto" : "Los productos (hasta 4)"}</Label>
                  <SelectorProductos storeId={storeId} value={productos} onChange={setProductos} max={maxProductos} />
                  <p className="text-xs text-muted-foreground">Se usa la primera foto de cada uno: tiene que estar subida a Vendfy.</p>
                </div>
              )}

              {modo === "promotion" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">La promoción</Label>
                  <Select value={promotionId} onValueChange={setPromotionId}>
                    <SelectTrigger>
                      <SelectValue placeholder={promociones.length ? "Elegí una promoción" : "Todavía no hay promociones"} />
                    </SelectTrigger>
                    <SelectContent>
                      {promociones
                        .filter((p) => p.estado !== "inactiva")
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre}
                            {p.etiqueta ? ` · ${p.etiqueta}` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">¿Cómo la querés?</Label>
                <Textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="Ej.: verano, fresco, tonos cálidos"
                />
                <div className="flex flex-wrap gap-1.5">
                  {EJEMPLOS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setBrief(e)}
                      className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">No escribas precios ni porcentajes: la IA no dibuja texto. Eso va en el título de la portada.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Forma</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PROPORCIONES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAspect(p.id)}
                      aria-pressed={aspect === p.id}
                      className={`rounded-md border px-2.5 py-2 text-xs transition-colors ${
                        aspect === p.id ? "border-primary bg-primary/10 font-semibold" : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {p.nombre}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* El historial: reusar sin pagar otra generación. */}
          <div className="space-y-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setVerHistorial((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-medium"
              aria-expanded={verHistorial}
            >
              <span className="flex items-center gap-2">
                <History className="h-4 w-4" /> Tus imágenes anteriores
                {imagenes.length > 0 && <span className="text-xs font-normal text-muted-foreground">({imagenes.length})</span>}
              </span>
              <span className="text-xs text-muted-foreground">{verHistorial ? "Ocultar" : "Ver"}</span>
            </button>
            {verHistorial &&
              (imagenes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no generaste ninguna.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {imagenes.map((img) => (
                    <div key={img.id} className="group relative overflow-hidden rounded-lg border border-border bg-muted">
                      <img src={img.url} alt={img.prompt ?? "Imagen con IA"} loading="lazy" className="aspect-video w-full object-cover" />
                      <div className="absolute inset-0 flex flex-col justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        {img.prompt && <p className="line-clamp-2 text-[11px] text-white">{img.prompt}</p>}
                        <div className="flex gap-1">
                          <Button type="button" size="sm" className="h-7 flex-1 text-xs" onClick={() => usar(img)}>
                            Usar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 w-7 p-0"
                            aria-label="Sacar del historial"
                            onClick={() => descartar(img)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </DialogBody>

        {!resultado && (
          <DialogFooter className="items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {estado.data ? `Hoy usaste ${estado.data.usadasHoy} de ${estado.data.tope} imágenes.` : ""}
              {faltaAlgo && brief.length > 0 ? ` ${faltaAlgo}` : ""}
            </p>
            <Button type="button" onClick={pedir} disabled={generar.isPending || Boolean(faltaAlgo) || Boolean(noDisponible) || Boolean(sinCupo)}>
              {generar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {generar.isPending ? "Creando… puede tardar hasta 40 s" : "Crear imagen"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Resultado({
  imagen,
  ocupado,
  onUsar,
  onAgrupar,
  onDescartar,
  onOtra,
}: {
  imagen: ImagenIa;
  ocupado: boolean;
  onUsar: () => void;
  /** Usarla y armar una promoción con los mismos productos. */
  onAgrupar?: () => void;
  onDescartar: () => void;
  onOtra: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border bg-muted">
        <img src={imagen.url} alt="La imagen que hizo la IA" className="mx-auto max-h-[420px] w-auto max-w-full object-contain" />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ImageIcon className="h-3.5 w-3.5" /> Ya quedó en tu historial. Si no te gusta, descartala o hacé otra.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onUsar}>
          Usar esta imagen
        </Button>
        {onAgrupar && (
          <Button type="button" variant="secondary" onClick={onAgrupar}>
            Usarla y armar una promoción con estos productos
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onOtra}>
          <RefreshCw className="mr-2 h-4 w-4" /> Hacer otra
        </Button>
        <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={ocupado} onClick={onDescartar}>
          <Trash2 className="mr-2 h-4 w-4" /> Descartar
        </Button>
      </div>
    </div>
  );
}
