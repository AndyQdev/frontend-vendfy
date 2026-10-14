import type { ReactNode } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Check, Loader2, Sparkles } from "lucide-react";

import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { AparienciaGuardada, SeccionGuardada } from "@/entities/store/model/types";
import { aparienciaEfectiva, useCatalogoTemas, type Muestra, type Opcion } from "../../model/catalogo-temas";
import { EditorPortada } from "./EditorPortada";
import { VistaPreviaTienda } from "./VistaPreviaTienda";

/**
 * La pestaña Diseño → Tema de Vendfy.
 *
 * La plantilla se elige en dos pasos, rubro y después plantilla del rubro:
 * con muchos diseños, una grilla con todos no se puede recorrer.
 *
 * El comerciante elige entre opciones cerradas (las que sirve la tienda en
 * `/api/temas`), nunca colores ni tamaños sueltos: así ninguna combinación se
 * ve rota. Todo se ve en la vista previa antes de guardar.
 */
export function DisenoTienda({
  slug,
  rubro,
  themeId,
  apariencia,
  categorias,
  onCambiarRubro,
  onCambiarTema,
  onCambiarApariencia,
  subirImagen,
}: {
  slug: string;
  /** `config.category`: filtra las plantillas que se ofrecen. */
  rubro: string | undefined;
  onCambiarRubro: (rubro: string) => void;
  themeId: string | undefined;
  apariencia: AparienciaGuardada | undefined;
  categorias: Array<{ id: string; name: string }>;
  onCambiarTema: (themeId: string) => void;
  onCambiarApariencia: (apariencia: AparienciaGuardada) => void;
  subirImagen: (archivo: File) => Promise<string>;
}) {
  const { data: catalogo, isLoading, isError } = useCatalogoTemas();

  if (isLoading) {
    return (
      <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando los temas…
      </Card>
    );
  }
  if (isError || !catalogo) {
    return (
      <Card className="flex items-center gap-2 p-6 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" /> No se pudieron cargar los temas. Revisá la conexión y recargá la página.
      </Card>
    );
  }

  const tema = catalogo.temas.find((t) => t.id === themeId) ?? catalogo.temas[0];
  const rubroActual = catalogo.rubros.find((r) => r.id === rubro);
  const plantillasDelRubro = (rubroActual?.temas ?? [])
    .map((id) => catalogo.temas.find((t) => t.id === id))
    .filter((t): t is (typeof catalogo.temas)[number] => Boolean(t));
  // Al cambiar de rubro, si la plantilla actual no es de ese rubro, se pasa a
  // la primera que ofrece (como hacía el panel antes).
  const cambiarRubro = (id: string) => {
    onCambiarRubro(id);
    const delRubro = catalogo.rubros.find((r) => r.id === id)?.temas ?? [];
    if (!delRubro.includes(tema.id) && delRubro[0]) onCambiarTema(delRubro[0]);
  };
  const efectiva = aparienciaEfectiva(apariencia, tema, catalogo);
  const o = catalogo.opciones;

  // Se guarda la apariencia completa, no solo lo tocado: así lo que se ve en
  // la vista previa es exactamente lo que queda guardado.
  const actualizar = (cambio: Partial<AparienciaGuardada>) => onCambiarApariencia({ ...efectiva, ...cambio });
  const secciones = efectiva.secciones;
  const cambiarSeccion = (tipo: string, cambio: Partial<SeccionGuardada>) =>
    actualizar({ secciones: secciones.map((s) => (s.tipo === tipo ? { ...s, ...cambio } : s)) });
  const moverSeccion = (i: number, lado: -1 | 1) => {
    const lista = [...secciones];
    [lista[i], lista[i + lado]] = [lista[i + lado], lista[i]];
    actualizar({ secciones: lista });
  };
  const portada = secciones.find((s) => s.tipo === "portada");
  const defPortada = o.secciones.find((s) => s.tipo === "portada");
  const imagenesPortada = efectiva.portada.diapositivas.length;
  const varianteActual = defPortada?.variantes.find((v) => v.id === portada?.variante);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Bloque titulo="Plantilla" descripcion="Elegí el rubro de tu tienda y después una de sus plantillas.">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Rubro</Label>
              <Select value={rubro ?? ""} onValueChange={cambiarRubro}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí el rubro" />
                </SelectTrigger>
                <SelectContent>
                  {catalogo.rubros.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Plantilla</Label>
              <Select value={plantillasDelRubro.some((t) => t.id === tema.id) ? tema.id : ""} onValueChange={onCambiarTema} disabled={!rubroActual}>
                <SelectTrigger>
                  <SelectValue placeholder={rubroActual ? "Elegí una plantilla" : "Primero elegí el rubro"} />
                </SelectTrigger>
                <SelectContent>
                  {plantillasDelRubro.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                      {t.personalizable ? " ✦ personalizable" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border p-2">
            <div className="w-24 flex-none overflow-hidden rounded-md border border-border">
              <Miniatura muestra={tema.muestra} />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                {tema.nombre}
                {tema.personalizable && <Sparkles className="h-3.5 w-3.5 text-primary" aria-label="Personalizable" />}
              </p>
              <p className="text-xs text-muted-foreground">{tema.descripcion}</p>
            </div>
          </div>
        </Bloque>

        {!tema.personalizable ? (
          <Card className="flex gap-3 p-4 text-sm">
            <Sparkles className="mt-0.5 h-4 w-4 flex-none text-primary" />
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{tema.nombre}</span> todavía no se personaliza: se ve tal
              como está. Los temas con <Sparkles className="inline h-3.5 w-3.5 text-primary" /> te dejan elegir colores,
              animaciones, imágenes de portada y secciones.
            </p>
          </Card>
        ) : (
          <>
            <Bloque titulo="Colores" descripcion="Paletas armadas para que todo se lea bien.">
              <div className="grid grid-cols-3 gap-2">
                {tema.paletas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => actualizar({ paleta: p.id })}
                    className={`rounded-lg border p-2 text-left transition-all ${
                      efectiva.paleta === p.id ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="flex h-9 overflow-hidden rounded-md border border-black/5">
                      <span className="flex-[3]" style={{ background: p.muestra.fondo }} />
                      <span className="flex-[2]" style={{ background: p.muestra.superficie }} />
                      <span className="flex-[2]" style={{ background: p.muestra.primario }} />
                      <span className="flex-1" style={{ background: p.muestra.acento }} />
                    </span>
                    <span className="mt-1.5 flex items-center justify-between text-xs font-medium">
                      {p.nombre}
                      {efectiva.paleta === p.id && <Check className="h-3.5 w-3.5 text-primary" />}
                    </span>
                  </button>
                ))}
              </div>
            </Bloque>

            <Bloque titulo="Estilo">
              <Fila etiqueta="Tipografía">
                <Opciones opciones={o.tipografias} valor={efectiva.tipografia} onChange={(tipografia) => actualizar({ tipografia })} />
              </Fila>
              <Fila etiqueta="Esquinas">
                <Opciones opciones={o.esquinas} valor={efectiva.esquinas} onChange={(esquinas) => actualizar({ esquinas })} columnas={3} />
              </Fila>
              <Fila etiqueta="Cabecera" ayuda={efectiva.cabecera === "transparente" ? "Va transparente solo sobre una portada con foto (Carrusel o Pantalla completa)." : undefined}>
                <Opciones opciones={o.cabeceras} valor={efectiva.cabecera} onChange={(cabecera) => actualizar({ cabecera })} columnas={3} />
              </Fila>
            </Bloque>

            <Bloque titulo="Animaciones" descripcion="Si el celular del cliente pide menos movimiento, no se muestran.">
              <Fila etiqueta="Al aparecer">
                <Opciones opciones={o.entradas} valor={efectiva.entrada} onChange={(entrada) => actualizar({ entrada })} />
              </Fila>
              <Fila etiqueta="Al pasar el mouse por un producto">
                <Opciones opciones={o.hovers} valor={efectiva.hover} onChange={(hover) => actualizar({ hover })} />
              </Fila>
              {o.entrePaginas && (
                <Fila etiqueta="Al abrir un producto" ayuda="En Chrome, Edge y Safari. En los demás navegadores abre normal.">
                  <Opciones opciones={o.entrePaginas} valor={efectiva.entrePaginas} onChange={(entrePaginas) => actualizar({ entrePaginas })} />
                </Fila>
              )}
            </Bloque>

            <Bloque
              titulo="Barra de anuncio"
              descripcion="Una línea arriba de todo. Escribí solo lo que cumplís."
              accion={
                <Switch
                  checked={efectiva.anuncio.activo}
                  onCheckedChange={(activo) => actualizar({ anuncio: { ...efectiva.anuncio, activo } })}
                />
              }
            >
              {efectiva.anuncio.activo && (
                <>
                  <Input
                    value={efectiva.anuncio.texto}
                    maxLength={o.largos.anuncio}
                    placeholder="Ej.: Envíos a todo el país"
                    onChange={(e) => actualizar({ anuncio: { ...efectiva.anuncio, texto: e.target.value } })}
                  />
                  <Opciones
                    opciones={o.variantesAnuncio}
                    valor={efectiva.anuncio.variante}
                    onChange={(variante) => actualizar({ anuncio: { ...efectiva.anuncio, variante } })}
                  />
                </>
              )}
            </Bloque>

            {portada && defPortada && (
              <Bloque titulo="Portada" descripcion="La imagen grande de arriba.">
                <Fila etiqueta="Estilo">
                  <Opciones
                    opciones={defPortada.variantes}
                    valor={portada.variante}
                    onChange={(variante) => cambiarSeccion("portada", { variante })}
                    bloqueadas={Object.fromEntries(
                      defPortada.variantes
                        .filter((v) => (v.minimoImagenes ?? 0) > imagenesPortada)
                        .map((v) => [v.id, `Necesita ${v.minimoImagenes} imágenes (tenés ${imagenesPortada})`]),
                    )}
                  />
                </Fila>
                {/* Elegida antes y después se borraron imágenes: la tienda muestra otra. */}
                {(varianteActual?.minimoImagenes ?? 0) > imagenesPortada && imagenesPortada > 0 && (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                    {varianteActual!.nombre} necesita {varianteActual!.minimoImagenes} imágenes. Con{" "}
                    {imagenesPortada} tu tienda muestra otra portada: subí{" "}
                    {varianteActual!.minimoImagenes! - imagenesPortada} más o elegí otro estilo.
                  </p>
                )}
                <EditorPortada
                  portada={efectiva.portada}
                  onChange={(p) => actualizar({ portada: p })}
                  catalogo={catalogo}
                  categorias={categorias}
                  subirImagen={subirImagen}
                  // El mosaico muestra todas a la vez y la cinta avanza sola:
                  // intervalo, transición, flechas y puntos no les aplican.
                  conAjustesDeCarrusel={!["mosaico", "cinta"].includes(portada.variante)}
                />
              </Bloque>
            )}

            <Bloque titulo="Secciones" descripcion="Cuáles se ven, en qué orden y con qué fondo.">
              <ul className="divide-y divide-border rounded-lg border border-border">
                {secciones.map((s, i) => {
                  const def = o.secciones.find((d) => d.tipo === s.tipo)!;
                  return (
                    <li key={s.tipo} className={`space-y-2 p-3 ${s.activa ? "" : "opacity-60"}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={i === 0} onClick={() => moverSeccion(i, -1)} aria-label={`Subir ${def.nombre}`}>
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={i === secciones.length - 1} onClick={() => moverSeccion(i, 1)} aria-label={`Bajar ${def.nombre}`}>
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{def.nombre}</p>
                          <p className="truncate text-xs text-muted-foreground">{def.descripcion}</p>
                        </div>
                        <Switch
                          checked={s.activa}
                          disabled={def.fija}
                          onCheckedChange={(activa) => cambiarSeccion(s.tipo, { activa })}
                          aria-label={`Mostrar ${def.nombre}`}
                        />
                      </div>
                      {s.activa && (
                        <div className="grid grid-cols-2 gap-2 pl-8">
                          {def.variantes.length > 1 && s.tipo !== "portada" ? (
                            <Elegir valor={s.variante} opciones={def.variantes} onChange={(variante) => cambiarSeccion(s.tipo, { variante })} />
                          ) : (
                            <span />
                          )}
                          {s.tipo !== "portada" && (
                            <Elegir valor={s.fondo} opciones={o.fondos} prefijo="Fondo: " onChange={(fondo) => cambiarSeccion(s.tipo, { fondo })} />
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">
                Una sección sin datos no aparece aunque esté prendida: por ejemplo, Destacados si no marcaste ningún
                producto como destacado.
              </p>
            </Bloque>
          </>
        )}
      </div>

      <div className="xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
        {slug ? (
          <VistaPreviaTienda slug={slug} themeId={tema.id} apariencia={tema.personalizable ? efectiva : undefined} />
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">La vista previa aparece cuando la tienda tiene dirección (slug).</Card>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ piezas

function Bloque({ titulo, descripcion, accion, children }: { titulo: string; descripcion?: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{titulo}</h3>
          {descripcion && <p className="mt-0.5 text-xs text-muted-foreground">{descripcion}</p>}
        </div>
        {accion}
      </div>
      {children}
    </Card>
  );
}

function Fila({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{etiqueta}</Label>
      {children}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

/** Opciones como botones: se ven todas de un vistazo, mejor que un desplegable. */
function Opciones({
  opciones,
  valor,
  onChange,
  columnas = 2,
  bloqueadas = {},
}: {
  opciones: Opcion[];
  valor: string;
  onChange: (v: string) => void;
  columnas?: 2 | 3;
  /** id → por qué no se puede elegir todavía. */
  bloqueadas?: Record<string, string>;
}) {
  return (
    <div className={`grid gap-1.5 ${columnas === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {opciones.map((op) => {
        const motivo = bloqueadas[op.id];
        return (
          <button
            key={op.id}
            type="button"
            onClick={() => onChange(op.id)}
            disabled={Boolean(motivo)}
            title={motivo ?? op.descripcion}
            aria-pressed={valor === op.id}
            className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              valor === op.id ? "border-primary bg-primary/10 font-semibold text-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {op.nombre}
            {(motivo || (op.descripcion && columnas === 2)) && (
              <span className="mt-0.5 block font-normal text-muted-foreground">{motivo ?? op.descripcion}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Elegir({ valor, opciones, onChange, prefijo = "" }: { valor: string; opciones: Opcion[]; onChange: (v: string) => void; prefijo?: string }) {
  return (
    <Select value={valor} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((op) => (
          <SelectItem key={op.id} value={op.id}>
            {prefijo}
            {op.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Un boceto del tema con sus colores: cabecera, portada y dos tarjetas. */
function Miniatura({ muestra }: { muestra: Muestra }) {
  return (
    <div className="aspect-[16/10] space-y-1.5 p-2" style={{ background: muestra.fondo }}>
      <div className="flex items-center justify-between">
        <span className="h-1.5 w-8 rounded-full" style={{ background: muestra.texto }} />
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: muestra.acento }} />
      </div>
      <div className="flex h-[38%] items-end rounded p-1.5" style={{ background: muestra.superficie }}>
        <span className="h-2 w-10 rounded-sm" style={{ background: muestra.primario }} />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-5 rounded-sm" style={{ background: muestra.superficie }} />
        ))}
      </div>
    </div>
  );
}
