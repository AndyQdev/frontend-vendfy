import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, Crosshair, Loader2, Monitor, Plus, Smartphone, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { DiapositivaGuardada } from "@/entities/store/model/types";
import type { AjustePortada, AparienciaEfectiva, CatalogoTemas } from "../../model/catalogo-temas";

type Portada = AparienciaEfectiva["portada"];

/** A dónde puede llevar el botón de una imagen, además de "todos los productos". */
export interface OpcionesDeDestino {
  categorias: Array<{ id: string; name: string }>;
  productos: Array<{ id: string; nombre: string }>;
  promociones: Array<{ slug: string; nombre: string; etiqueta: string | null }>;
}

const TIPOS_DE_DESTINO = [
  { id: "catalogo", nombre: "Todos los productos" },
  { id: "categoria", nombre: "Una categoría" },
  { id: "producto", nombre: "Un producto" },
  { id: "promo", nombre: "Una promoción" },
  { id: "ninguno", nombre: "Ninguno (solo publicidad)" },
] as const;

/** `categoria:abc` → "categoria"; `catalogo` y `ninguno` se quedan como están. */
const tipoDeDestino = (destino: string | undefined) => (destino ?? "catalogo").split(":")[0];

/**
 * La pantalla que se edita. La tablet va con la computadora: la tienda usa la
 * foto del celular solo hasta 640 px.
 */
export type Pantalla = "escritorio" | "movil";

type Punto = { x: number; y: number };
const CENTRO: Punto = { x: 50, y: 50 };
const mismoPunto = (a: Punto, b: Punto) => a.x === b.x && a.y === b.y;

/**
 * Lo que una pantalla hereda si no se le cambia nada. La misma regla que la
 * tienda (`encuadres`, en client-frontend/lib/tienda/apariencia.ts): el
 * celular sin versión propia muestra la foto principal con su encuadre; con
 * versión propia, otra foto, empieza de cero.
 */
function heredado(d: DiapositivaGuardada, pantalla: Pantalla) {
  if (pantalla === "movil" && !d.imagenMovil) return { enfoque: d.enfoque ?? CENTRO, completa: Boolean(d.completa) };
  return { enfoque: CENTRO, completa: false };
}

/** La foto y el encuadre que se ven en una pantalla. */
function vistaDe(d: DiapositivaGuardada, pantalla: Pantalla) {
  if (pantalla === "escritorio") return { imagen: d.imagen, enfoque: d.enfoque ?? CENTRO, completa: Boolean(d.completa), propia: true };
  const base = heredado(d, "movil");
  return {
    imagen: d.imagenMovil ?? d.imagen,
    enfoque: d.enfoqueMovil ?? base.enfoque,
    completa: d.completaMovil ?? base.completa,
    propia: Boolean(d.imagenMovil),
  };
}

/** El cambio a guardar: lo que coincide con lo heredado no se guarda, así sigue al de computadora. */
function cambioDeEncuadre(d: DiapositivaGuardada, pantalla: Pantalla, cambio: { enfoque?: Punto; completa?: boolean }) {
  const base = heredado(d, pantalla);
  const r: Partial<DiapositivaGuardada> = {};
  if (cambio.enfoque) r[pantalla === "escritorio" ? "enfoque" : "enfoqueMovil"] = mismoPunto(cambio.enfoque, base.enfoque) ? undefined : cambio.enfoque;
  if (cambio.completa !== undefined) r[pantalla === "escritorio" ? "completa" : "completaMovil"] = cambio.completa === base.completa ? undefined : cambio.completa;
  return r;
}

/**
 * Ancho / alto aproximado del lugar de la foto en cada variante, para dibujar
 * qué parte se ve. El mosaico y el acordeón no están: cada recuadro mide
 * distinto (y las franjas cambian de ancho), un marco solo engañaría.
 */
const PROPORCIONES: Record<string, Record<Pantalla, number>> = {
  carrusel: { escritorio: 1.9, movil: 0.6 },
  completa: { escritorio: 1.6, movil: 0.55 },
  dividida: { escritorio: 1, movil: 1 },
  cinta: { escritorio: 0.7, movil: 0.7 },
};

/**
 * Las imágenes de la portada: una grilla de miniaturas que se arrastran para
 * cambiar el orden y, debajo, la edición de la que está elegida.
 *
 * Una sola imagen sirve para la computadora y el celular; el selector
 * "Computadora | Celular" muestra cada pantalla con su foto y su encuadre (el
 * mismo que la vista previa, que va sincronizada). En "Celular" se ve lo que
 * ve el teléfono y ahí se sube, si se quiere, una versión vertical: no es una
 * imagen más sino otra foto de la misma, con el mismo texto y botón.
 */
export function EditorPortada({
  portada,
  onChange,
  catalogo,
  destinos,
  subirImagen,
  ajustes,
  variante,
  pantalla,
  onPantalla,
  onCrearConIa,
}: {
  /** Los ajustes del carrusel que usa la variante elegida: solo esos se muestran. */
  ajustes: AjustePortada[];
  portada: Portada;
  onChange: (portada: Portada) => void;
  catalogo: CatalogoTemas;
  destinos: OpcionesDeDestino;
  subirImagen: (archivo: File) => Promise<string>;
  /** La variante de portada elegida: decide el marco del recorte. */
  variante?: string;
  pantalla: Pantalla;
  onPantalla: (pantalla: Pantalla) => void;
  /** Abre el asistente que crea una imagen con IA; sin él, no se ofrece. */
  onCrearConIa?: () => void;
}) {
  const { maxDiapositivas, largos, intervalos, transiciones } = catalogo.opciones;
  const diapositivas = portada.diapositivas;
  const nueva = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [elegida, setElegida] = useState(0);
  // Una imagen que llega de afuera (la que hizo la IA) queda elegida: lo que
  // sigue es ajustarle el texto y el botón.
  const largoAnterior = useRef(diapositivas.length);
  useEffect(() => {
    if (diapositivas.length > largoAnterior.current) setElegida(diapositivas.length - 1);
    largoAnterior.current = diapositivas.length;
  }, [diapositivas.length]);
  // Si se borró la última, la elegida pasa a la vecina.
  const actual = Math.min(elegida, diapositivas.length - 1);
  const d = diapositivas[actual];
  const enCelular = pantalla === "movil";

  const cambiar = (lista: DiapositivaGuardada[]) => onChange({ ...portada, diapositivas: lista });
  const editar = (i: number, cambio: Partial<DiapositivaGuardada>) =>
    cambiar(diapositivas.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  const mover = (de: number, a: number) => {
    if (a < 0 || a >= diapositivas.length || a === de) return;
    cambiar(arrayMove(diapositivas, de, a));
    setElegida(a);
  };

  // La misma regla que el tablero de pedidos (OrdersTable): con el mouse
  // alcanza mover 8 px; con el dedo, mantener presionado, así un toque elige
  // la imagen y la página se sigue desplazando.
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const alSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    mover(Number(active.id), Number(over.id));
  };

  const subir = async (archivo: File | undefined, clave: string, alTerminar: (url: string) => void) => {
    if (!archivo) return;
    setSubiendo(clave);
    try {
      alTerminar(await subirImagen(archivo));
    } catch {
      toast.error("No se pudo subir la imagen. Probá con un JPG, PNG o WebP de hasta 5 MB.");
    } finally {
      setSubiendo(null);
    }
  };

  const puedeAgregar = diapositivas.length < maxDiapositivas;
  // Las verticales del celular entran más por fila: así las 5 y los botones se ven sin desplazar.
  const forma = enCelular ? "aspect-[9/16]" : "aspect-[16/10]";
  const vista = d && vistaDe(d, pantalla);
  const proporcion = variante ? PROPORCIONES[variante]?.[pantalla] : undefined;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-xs text-muted-foreground">
            Imágenes de la portada ({diapositivas.length}/{maxDiapositivas})
          </Label>
          <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Ver como">
            {(
              [
                { id: "escritorio", nombre: "Computadora", icono: Monitor },
                { id: "movil", nombre: "Celular", icono: Smartphone },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={pantalla === p.id}
                onClick={() => onPantalla(p.id)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${
                  pantalla === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <p.icono className="h-3.5 w-3.5" /> {p.nombre}
              </button>
            ))}
          </div>
        </div>

        {diapositivas.length === 0 && <p className="text-xs text-muted-foreground">Sin imágenes, se muestra el nombre de tu tienda.</p>}

        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
          <SortableContext items={diapositivas.map((_, i) => String(i))} strategy={rectSortingStrategy}>
            <div
              className={`grid gap-2 p-1 ${
                enCelular ? "grid-cols-[repeat(auto-fill,minmax(56px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(76px,1fr))]"
              }`}
            >
              {diapositivas.map((x, i) => {
                const v = vistaDe(x, pantalla);
                return (
                  <Miniatura
                    key={i}
                    id={String(i)}
                    numero={i + 1}
                    imagen={v.imagen}
                    enfoque={v.enfoque}
                    completa={v.completa}
                    forma={forma}
                    usaLaPrincipal={enCelular && !v.propia}
                    elegida={i === actual}
                    alElegir={() => setElegida(i)}
                  />
                );
              })}

              {/* Agregar es de la portada, no de una imagen: suma una nueva al final. */}
              {puedeAgregar && (
                <button
                  type="button"
                  disabled={subiendo === "nueva"}
                  onClick={() => nueva.current?.click()}
                  aria-label="Agregar imagen"
                  className={`${forma} flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60`}
                >
                  {subiendo === "nueva" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Agregar
                </button>
              )}
              {puedeAgregar && onCrearConIa && (
                <button
                  type="button"
                  onClick={onCrearConIa}
                  aria-label="Crear imagen con IA"
                  className={`${forma} flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-purple-300 bg-purple-50/50 text-[11px] text-purple-700 transition-colors hover:border-purple-500 dark:border-purple-800 dark:bg-purple-900/10 dark:text-purple-300`}
                >
                  <Sparkles className="h-4 w-4" />
                  Con IA
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>

        <input
          ref={nueva}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            e.target.value = "";
            subir(archivo, "nueva", (url) => {
              // La nueva queda elegida: lo que sigue es escribirle el texto.
              cambiar([...diapositivas, { imagen: url, destino: "catalogo" }]);
              setElegida(diapositivas.length);
            });
          }}
        />
      </div>

      {d && vista && (
        <div className="space-y-3 rounded-lg border-2 border-primary/30 p-3">
          {/* La foto de esta pantalla. En el celular, la versión vertical reemplaza a la principal solo ahí. */}
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm font-medium">Imagen {actual + 1}</p>
            {!enCelular ? (
              <BotonArchivo
                etiqueta="Reemplazar foto"
                cargando={subiendo === `imagen-${actual}`}
                // Otra foto: el enfoque de la anterior no le sirve (ni al celular, si la hereda).
                alElegir={(f) =>
                  subir(f, `imagen-${actual}`, (url) =>
                    editar(actual, { imagen: url, enfoque: undefined, ...(d.imagenMovil ? {} : { enfoqueMovil: undefined }) }),
                  )
                }
              />
            ) : vista.propia ? (
              <>
                <BotonArchivo
                  etiqueta="Reemplazar versión vertical"
                  cargando={subiendo === `movil-${actual}`}
                  alElegir={(f) => subir(f, `movil-${actual}`, (url) => editar(actual, { imagenMovil: url, enfoqueMovil: undefined, completaMovil: undefined }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  onClick={() => editar(actual, { imagenMovil: undefined, enfoqueMovil: undefined, completaMovil: undefined })}
                >
                  Quitar versión vertical
                </Button>
              </>
            ) : (
              <BotonArchivo
                etiqueta="Subir versión vertical"
                icono={<Smartphone className="mr-1 h-3.5 w-3.5" />}
                cargando={subiendo === `movil-${actual}`}
                alElegir={(f) => subir(f, `movil-${actual}`, (url) => editar(actual, { imagenMovil: url, enfoqueMovil: undefined, completaMovil: undefined }))}
              />
            )}
          </div>

          <Encuadre
            key={`${pantalla}-${vista.imagen}`}
            imagen={vista.imagen}
            enfoque={vista.enfoque}
            completa={vista.completa}
            proporcion={proporcion}
            siempreRecorta={variante === "cinta"}
            onChange={(cambio) => editar(actual, cambioDeEncuadre(d, pantalla, cambio))}
          />

          {/* El texto y el botón son de la imagen: los mismos en las dos pantallas. */}
          <div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Campo etiqueta="Título" valor={d.titulo} largo={largos.titulo} onChange={(titulo) => editar(actual, { titulo })} placeholder={actual === 0 ? "El nombre de tu tienda" : "Opcional"} />
              <Campo etiqueta="Texto" valor={d.texto} largo={largos.texto} onChange={(texto) => editar(actual, { texto })} placeholder="Opcional" />
              <Campo etiqueta="Botón" valor={d.boton} largo={largos.boton} onChange={(boton) => editar(actual, { boton })} placeholder={actual === 0 ? "Ver productos" : "Opcional"} />
              <DestinoDelBoton destino={d.destino} destinos={destinos} onChange={(destino) => editar(actual, { destino })} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            {/* Lo mismo que arrastrar, para quien no puede o no quiere arrastrar. */}
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" disabled={actual === 0} onClick={() => mover(actual, actual - 1)}>
                <ArrowLeft className="h-3.5 w-3.5" /> Antes
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" disabled={actual === diapositivas.length - 1} onClick={() => mover(actual, actual + 1)}>
                Después <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => cambiar(diapositivas.filter((_, j) => j !== actual))}
            >
              <Trash2 className="h-3.5 w-3.5" /> Quitar de la portada
            </Button>
          </div>
        </div>
      )}

      {ajustes.length > 0 && diapositivas.length > 1 && (
        <details className="group rounded-lg bg-muted/40">
          <summary className="cursor-pointer list-none p-3 text-sm font-medium marker:hidden">
            Cómo pasan las imágenes
            <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
              {resumenAjustes(ajustes, portada, transiciones)}
            </span>
          </summary>
          <div className="grid gap-3 p-3 pt-0 sm:grid-cols-2">
            {ajustes.includes("intervalo") && (
              <div className="space-y-1">
                <Label className="text-xs">Cambiar de imagen</Label>
                <Select value={String(portada.intervalo)} onValueChange={(v) => onChange({ ...portada, intervalo: Number(v) })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {intervalos.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s === 0 ? "Solo a mano" : `Cada ${s} segundos`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {ajustes.includes("transicion") && (
              <div className="space-y-1">
                <Label className="text-xs">Transición</Label>
                <Select value={portada.transicion} onValueChange={(transicion) => onChange({ ...portada, transicion })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {transiciones.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {ajustes.includes("flechas") && (
              <label className="flex items-center justify-between gap-2 text-sm">
                Flechas
                <Switch checked={portada.flechas} onCheckedChange={(flechas) => onChange({ ...portada, flechas })} />
              </label>
            )}
            {ajustes.includes("puntos") && (
              <label className="flex items-center justify-between gap-2 text-sm">
                Puntos
                <Switch checked={portada.puntos} onCheckedChange={(puntos) => onChange({ ...portada, puntos })} />
              </label>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

/** Lo elegido, con la fila cerrada: "Cada 6 s · Fundido". */
function resumenAjustes(ajustes: AjustePortada[], portada: Portada, transiciones: Array<{ id: string; nombre: string }>) {
  const partes: string[] = [];
  if (ajustes.includes("intervalo")) partes.push(portada.intervalo === 0 ? "Solo a mano" : `Cada ${portada.intervalo} s`);
  if (ajustes.includes("transicion")) partes.push(transiciones.find((t) => t.id === portada.transicion)?.nombre ?? portada.transicion);
  return partes.join(" · ");
}

function Miniatura({
  id,
  numero,
  imagen,
  enfoque,
  completa,
  forma,
  usaLaPrincipal,
  elegida,
  alElegir,
}: {
  id: string;
  numero: number;
  imagen: string;
  enfoque: Punto;
  completa: boolean;
  /** La proporción de la pantalla que se está viendo. */
  forma: string;
  /** En la vista Celular, sin versión vertical: se ve la de computadora recortada. */
  usaLaPrincipal: boolean;
  elegida: boolean;
  alElegir: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const estilo: CSSProperties = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 10 : undefined };
  return (
    <button
      ref={setNodeRef}
      style={estilo}
      type="button"
      // Primero lo de dnd-kit: trae su propio `aria-pressed` y pisaría el nuestro.
      {...attributes}
      {...listeners}
      onClick={alElegir}
      aria-label={`Imagen ${numero}${usaLaPrincipal ? ", usa la foto de computadora" : ""}`}
      aria-pressed={elegida}
      className={`${forma} relative cursor-grab touch-manipulation overflow-hidden rounded-md bg-muted active:cursor-grabbing ${
        elegida ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-90 hover:ring-2 hover:ring-primary/40"
      }`}
    >
      <img
        src={imagen}
        alt=""
        draggable={false}
        className={`h-full w-full ${completa ? "bg-black/80 object-contain" : "object-cover"}`}
        style={completa ? undefined : { objectPosition: `${enfoque.x}% ${enfoque.y}%` }}
      />
      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">{numero}</span>
    </button>
  );
}

/**
 * Cómo entra la foto en la pantalla elegida. Cada estilo de portada la recorta
 * a su medida, así que en vez de un recorte fijo se marca el punto que no se
 * puede perder y la tienda recorta alrededor de él. Si el estilo tiene una
 * medida conocida, se dibuja el marco de lo que se ve. Para lo que no se puede
 * cortar (un flyer con texto en los bordes), entera.
 */
function Encuadre({
  imagen,
  enfoque,
  completa,
  proporcion,
  siempreRecorta,
  onChange,
}: {
  imagen: string;
  enfoque: Punto;
  completa: boolean;
  /** Ancho / alto del lugar de la foto en esta pantalla; sin él, solo el punto. */
  proporcion?: number;
  /** La cinta: tarjetas angostas que siempre recortan. */
  siempreRecorta: boolean;
  onChange: (cambio: { enfoque?: Punto; completa?: boolean }) => void;
}) {
  const foto = useRef<HTMLImageElement>(null);
  const [formaFoto, setFormaFoto] = useState<number | null>(null);

  const marcar = (e: PointerEvent<HTMLDivElement>) => {
    const caja = foto.current?.getBoundingClientRect();
    if (!caja?.width || !caja.height) return;
    const limitar = (n: number) => Math.round(Math.min(100, Math.max(0, n)));
    onChange({ enfoque: { x: limitar(((e.clientX - caja.left) / caja.width) * 100), y: limitar(((e.clientY - caja.top) / caja.height) * 100) } });
  };

  // La parte visible, como la recorta `object-fit: cover` con
  // `object-position` en el enfoque: el p % de la foto cae en el p % del lugar.
  let marco: CSSProperties | null = null;
  if (proporcion && formaFoto) {
    const ancho = formaFoto > proporcion ? proporcion / formaFoto : 1;
    const alto = formaFoto > proporcion ? 1 : formaFoto / proporcion;
    marco = {
      left: `${(1 - ancho) * enfoque.x}%`,
      top: `${(1 - alto) * enfoque.y}%`,
      width: `${ancho * 100}%`,
      height: `${alto * 100}%`,
    };
  }
  // Casi no se corta nada (una foto ancha en la computadora): marcar un punto
  // solo confunde, la foto se ve entera.
  const casiEntera = Boolean(marco) && proporcion! / formaFoto! > 0.95 && proporcion! / formaFoto! < 1.05;
  const recorta = (siempreRecorta || !completa) && !casiEntera;

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      {/* En la cinta no se ofrece: las tarjetas son angostas y la foto siempre se recorta. */}
      {!siempreRecorta && (
        <label className="flex items-center justify-between gap-3 text-sm">
          Mostrar completa
          <Switch checked={completa} onCheckedChange={(v) => onChange({ completa: v })} />
        </label>
      )}

      <div className={`space-y-1.5 ${siempreRecorta ? "" : "border-t border-border pt-2"}`}>
        {recorta && (
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Crosshair className="h-3.5 w-3.5 flex-none" /> Tocá lo importante
            </p>
            {!mismoPunto(enfoque, CENTRO) && (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange({ enfoque: CENTRO })}>
                Centrar
              </Button>
            )}
          </div>
        )}
        {/* La foto entera, con su proporción: el punto se marca sobre la imagen real, no sobre un recorte. */}
        <div
          className={`relative mx-auto w-fit select-none overflow-hidden rounded ${recorta ? "cursor-crosshair touch-none" : ""}`}
          onPointerDown={
            recorta
              ? (e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  marcar(e);
                }
              : undefined
          }
          onPointerMove={recorta ? (e) => e.buttons === 1 && marcar(e) : undefined}
        >
          <img
            ref={foto}
            src={imagen}
            alt=""
            draggable={false}
            onLoad={(e) => setFormaFoto(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
            className="block max-h-56 max-w-full"
          />
          {recorta && marco && (
            <span
              aria-hidden
              className="pointer-events-none absolute rounded-sm border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] transition-[left,top] duration-150"
              style={marco}
            />
          )}
          {recorta && (
            <span
              aria-hidden
              className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/60 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
              style={{ left: `${enfoque.x}%`, top: `${enfoque.y}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A dónde lleva el botón: los productos, una categoría, un producto, una
 * promoción, o a ningún lado (la imagen es solo publicidad y no lleva botón).
 * Dos pasos —el tipo y después cuál— porque con muchos productos una sola
 * lista no se puede recorrer.
 */
function DestinoDelBoton({
  destino,
  destinos,
  onChange,
}: {
  destino: string | undefined;
  destinos: OpcionesDeDestino;
  onChange: (destino: string) => void;
}) {
  const tipo = tipoDeDestino(destino);
  const valor = (destino ?? "").slice(tipo.length + 1);
  const hay: Record<string, boolean> = {
    catalogo: true,
    ninguno: true,
    categoria: destinos.categorias.length > 0,
    producto: destinos.productos.length > 0,
    promo: destinos.promociones.length > 0,
  };
  const primero = (t: string) =>
    t === "categoria"
      ? `categoria:${destinos.categorias[0]?.id}`
      : t === "producto"
        ? `producto:${destinos.productos[0]?.id}`
        : t === "promo"
          ? `promo:${destinos.promociones[0]?.slug}`
          : t;

  return (
    <div className="space-y-1 sm:col-span-2">
      <Label className="text-xs">El botón lleva a</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={tipo} onValueChange={(t) => onChange(primero(t))}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_DE_DESTINO.map((t) => (
              <SelectItem key={t.id} value={t.id} disabled={!hay[t.id]}>
                {t.nombre}
                {!hay[t.id] ? " (no hay)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tipo === "categoria" && (
          <Select value={valor} onValueChange={(v) => onChange(`categoria:${v}`)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Elegí la categoría" />
            </SelectTrigger>
            <SelectContent>
              {destinos.categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {tipo === "producto" && (
          <Select value={valor} onValueChange={(v) => onChange(`producto:${v}`)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Elegí el producto" />
            </SelectTrigger>
            <SelectContent>
              {/* Uno elegido que ya no está en la lista (hay más de los que se traen) no se pierde. */}
              {valor && !destinos.productos.some((p) => p.id === valor) && <SelectItem value={valor}>El producto elegido</SelectItem>}
              {destinos.productos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {tipo === "promo" && (
          <Select value={valor} onValueChange={(v) => onChange(`promo:${v}`)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Elegí la promoción" />
            </SelectTrigger>
            <SelectContent>
              {valor && !destinos.promociones.some((p) => p.slug === valor) && <SelectItem value={valor}>Una promoción que ya no existe</SelectItem>}
              {destinos.promociones.map((p) => (
                <SelectItem key={p.slug} value={p.slug}>
                  {p.nombre}
                  {p.etiqueta ? ` · ${p.etiqueta}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {tipo === "ninguno" && <p className="text-xs text-muted-foreground">Sin botón: la imagen se muestra como publicidad.</p>}
      {tipo === "promo" && <p className="text-xs text-muted-foreground">Lleva a la página de la promoción, con todos sus productos a la vez.</p>}
    </div>
  );
}

function Campo({
  etiqueta,
  valor,
  largo,
  onChange,
  placeholder,
}: {
  etiqueta: string;
  valor?: string;
  largo: number;
  onChange: (v: string | undefined) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{etiqueta}</Label>
      <Input
        value={valor ?? ""}
        maxLength={largo}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-9"
      />
    </div>
  );
}

function BotonArchivo({
  etiqueta,
  icono,
  cargando,
  alElegir,
}: {
  etiqueta: string;
  icono?: React.ReactNode;
  cargando: boolean;
  alElegir: (archivo: File | undefined) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={cargando} onClick={() => ref.current?.click()}>
        {cargando ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : icono}
        {etiqueta}
      </Button>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = "";
          alElegir(archivo);
        }}
      />
    </>
  );
}
