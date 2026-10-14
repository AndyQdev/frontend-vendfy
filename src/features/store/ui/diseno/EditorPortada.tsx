import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { DiapositivaGuardada } from "@/entities/store/model/types";
import type { AparienciaEfectiva, CatalogoTemas } from "../../model/catalogo-temas";

type Portada = AparienciaEfectiva["portada"];

/**
 * Las imágenes de la portada. Cada una con su texto y su botón, opcionales, y
 * una versión vertical para el celular, también opcional: sin ella, el
 * teléfono recorta la principal.
 */
export function EditorPortada({
  portada,
  onChange,
  catalogo,
  categorias,
  subirImagen,
  conAjustesDeCarrusel = true,
}: {
  conAjustesDeCarrusel?: boolean;
  portada: Portada;
  onChange: (portada: Portada) => void;
  catalogo: CatalogoTemas;
  categorias: Array<{ id: string; name: string }>;
  subirImagen: (archivo: File) => Promise<string>;
}) {
  const { maxDiapositivas, largos, intervalos, transiciones } = catalogo.opciones;
  const diapositivas = portada.diapositivas;
  const nueva = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);

  const cambiar = (lista: DiapositivaGuardada[]) => onChange({ ...portada, diapositivas: lista });
  const editar = (i: number, cambio: Partial<DiapositivaGuardada>) =>
    cambiar(diapositivas.map((d, j) => (j === i ? { ...d, ...cambio } : d)));
  const mover = (i: number, lado: -1 | 1) => {
    const lista = [...diapositivas];
    [lista[i], lista[i + lado]] = [lista[i + lado], lista[i]];
    cambiar(lista);
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

  return (
    <div className="space-y-4">
      {diapositivas.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Sin imágenes, la portada es un bloque del color de la paleta con el nombre de tu tienda. Con una o más, se
          ven las imágenes.
        </p>
      )}

      {diapositivas.map((d, i) => (
        <div key={`${d.imagen}-${i}`} className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex gap-3">
            <div className="relative h-20 w-28 flex-none overflow-hidden rounded-md bg-muted">
              <img src={d.imagen} alt="" className="h-full w-full object-cover" />
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">{i + 1}</span>
            </div>
            <div className="flex flex-1 flex-col justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                <BotonArchivo
                  etiqueta="Cambiar"
                  cargando={subiendo === `imagen-${i}`}
                  alElegir={(f) => subir(f, `imagen-${i}`, (url) => editar(i, { imagen: url }))}
                />
                <BotonArchivo
                  etiqueta={d.imagenMovil ? "Cambiar la del celular" : "Imagen para celular"}
                  icono={<Smartphone className="mr-1 h-3.5 w-3.5" />}
                  cargando={subiendo === `movil-${i}`}
                  alElegir={(f) => subir(f, `movil-${i}`, (url) => editar(i, { imagenMovil: url }))}
                />
                {d.imagenMovil && (
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => editar(i, { imagenMovil: undefined })}>
                    Quitar la del celular
                  </Button>
                )}
              </div>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={i === diapositivas.length - 1} onClick={() => mover(i, 1)} aria-label="Bajar">
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="ml-auto h-8 w-8 p-0 text-destructive" onClick={() => cambiar(diapositivas.filter((_, j) => j !== i))} aria-label="Quitar imagen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Campo etiqueta="Título" valor={d.titulo} largo={largos.titulo} onChange={(titulo) => editar(i, { titulo })} placeholder={i === 0 ? "El nombre de tu tienda" : "Opcional"} />
            <Campo etiqueta="Texto" valor={d.texto} largo={largos.texto} onChange={(texto) => editar(i, { texto })} placeholder="Opcional" />
            <Campo etiqueta="Botón" valor={d.boton} largo={largos.boton} onChange={(boton) => editar(i, { boton })} placeholder={i === 0 ? "Ver productos" : "Opcional"} />
            <div className="space-y-1">
              <Label className="text-xs">El botón lleva a</Label>
              <Select value={d.destino ?? "catalogo"} onValueChange={(destino) => editar(i, { destino })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="catalogo">Todos los productos</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={`categoria:${c.id}`}>
                      Categoría: {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}

      {diapositivas.length < maxDiapositivas && (
        <>
          <Button type="button" variant="outline" className="w-full" disabled={subiendo === "nueva"} onClick={() => nueva.current?.click()}>
            {subiendo === "nueva" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
            Agregar imagen ({diapositivas.length}/{maxDiapositivas})
          </Button>
          <input
            ref={nueva}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              e.target.value = "";
              subir(archivo, "nueva", (url) => cambiar([...diapositivas, { imagen: url, destino: "catalogo" }]));
            }}
          />
          <p className="text-xs text-muted-foreground">
            Horizontal, de al menos 1600 px de ancho. La del celular, vertical (por ejemplo 900 × 1400).
          </p>
        </>
      )}

      {conAjustesDeCarrusel && diapositivas.length > 1 && (
        <div className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
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
          <label className="flex items-center justify-between gap-2 text-sm">
            Flechas
            <Switch checked={portada.flechas} onCheckedChange={(flechas) => onChange({ ...portada, flechas })} />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            Puntos
            <Switch checked={portada.puntos} onCheckedChange={(puntos) => onChange({ ...portada, puntos })} />
          </label>
        </div>
      )}
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
