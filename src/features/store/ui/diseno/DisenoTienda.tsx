import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertCircle, ArrowDown, ArrowUp, Check, ChevronDown, Image as ImageIcon, LayoutList, Loader2, PanelTop, Palette, Play, Sparkles, Wand2, type LucideIcon } from "lucide-react";

import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { AparienciaGuardada, SeccionGuardada } from "@/entities/store/model/types";
import { aparienciaEfectiva, ajustesDePortada, useCatalogoTemas, type Muestra, type Opcion } from "../../model/catalogo-temas";
import { EditorPortada } from "./EditorPortada";
import { VistaPreviaTienda, type Dispositivo, type FocoVistaPrevia } from "./VistaPreviaTienda";
import { useProducts } from "@/entities/product/api";
import { usePromociones } from "@/entities/promotion/api";
import type { ImagenIa, Promocion } from "@/entities/promotion/model/types";
import { DialogImagenIa, type ContextoDeUso } from "@/features/promotions/ui/DialogImagenIa";
import { PromocionForm } from "@/features/promotions/ui/PromocionForm";
import type { ProductoElegible } from "@/features/promotions/ui/SelectorProductos";

/**
 * La pestaña Diseño → Tema de Vendfy.
 *
 * La plantilla se elige en dos pasos, rubro y después plantilla del rubro:
 * con muchos diseños, una grilla con todos no se puede recorrer.
 *
 * El comerciante elige entre opciones cerradas (las que sirve la tienda en
 * `/api/temas`), nunca colores ni tamaños sueltos: así ninguna combinación se
 * ve rota. Todo se ve en la vista previa antes de guardar, y cada cambio la
 * lleva hasta donde se nota (`enfocar`).
 */
export function DisenoTienda({
  slug,
  storeId,
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
  /** La tienda, para sus promociones, productos e imágenes con IA. */
  storeId?: string;
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
  // A dónde puede llevar el botón de una imagen, y lo que el asistente de IA usa.
  const promociones = usePromociones(storeId).data ?? [];
  const productos = useProducts({ storeId, limit: 100 }).data?.data ?? [];
  const [iaAbierta, setIaAbierta] = useState(false);
  // Una promoción que se arma a partir de una imagen hecha con IA.
  const [promoNueva, setPromoNueva] = useState<{ productos: ProductoElegible[]; imagen: string } | null>(null);
  const [foco, setFoco] = useState<FocoVistaPrevia | null>(null);
  // Uno solo para la vista previa y las imágenes de la portada: lo que se
  // edita es lo que se está viendo. La tablet ve las de computadora.
  const [dispositivo, setDispositivo] = useState<Dispositivo>("escritorio");
  // Una sola sección abierta a la vez: más de una es la pared de opciones de antes.
  const [abierta, setAbierta] = useState<string | null>("colores");
  const enfocar = (destino: string, extra: Omit<FocoVistaPrevia, "destino" | "clave"> = {}) =>
    setFoco({ destino, ...extra, clave: Date.now() });
  // Lo dice la vista previa: es el navegador de esta computadora.
  const [menosMovimiento, setMenosMovimiento] = useState(false);

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
  const nombreDeSeccion = (tipo: string) => o.secciones.find((d) => d.tipo === tipo)?.nombre ?? tipo;
  const cambiarSeccion = (tipo: string, cambio: Partial<SeccionGuardada>) => {
    actualizar({ secciones: secciones.map((s) => (s.tipo === tipo ? { ...s, ...cambio } : s)) });
    // Apagada no hay nada que mostrar.
    if (cambio.activa !== false) enfocar(tipo, { nombre: nombreDeSeccion(tipo) });
  };
  const moverSeccion = (i: number, lado: -1 | 1) => {
    const lista = [...secciones];
    [lista[i], lista[i + lado]] = [lista[i + lado], lista[i]];
    actualizar({ secciones: lista });
    if (lista[i + lado].activa) enfocar(lista[i + lado].tipo, { nombre: nombreDeSeccion(lista[i + lado].tipo) });
  };
  const verTarjetas = { nombre: "Las tarjetas de producto" };
  const portada = secciones.find((s) => s.tipo === "portada");
  const defPortada = o.secciones.find((s) => s.tipo === "portada");
  const imagenesPortada = efectiva.portada.diapositivas.length;
  const varianteActual = defPortada?.variantes.find((v) => v.id === portada?.variante);
  // La que la tienda muestra de verdad: con menos imágenes de las que pide la
  // elegida, pasa a la del tema o a la primera sin mínimo (`resolverApariencia`
  // en client-frontend/lib/tienda/apariencia.ts). El marco del recorte va con esta.
  const minimoDe = (id: string | undefined) => defPortada?.variantes.find((v) => v.id === id)?.minimoImagenes ?? 0;
  const delTemaPortada = tema.aparienciaInicial?.secciones?.find((s) => s.tipo === "portada")?.variante;
  const varianteMostrada =
    imagenesPortada > 0 && imagenesPortada < minimoDe(portada?.variante)
      ? delTemaPortada && imagenesPortada >= minimoDe(delTemaPortada)
        ? delTemaPortada
        : defPortada?.variantes.find((v) => !minimoDe(v.id))?.id
      : portada?.variante;

  // La cabecera "Sobre la portada" va transparente solo si la primera sección
  // es una portada con foto de fondo; si no, la tienda la dibuja sólida y la
  // opción parece no hacer nada. Una tienda sin desplegar no declara cuáles.
  const declaradas = defPortada?.variantes.filter((v) => v.cabeceraEncima) ?? [];
  const portadasConCabeceraEncima = declaradas.length
    ? declaradas
    : (defPortada?.variantes ?? []).filter((v) => ["carrusel", "completa", "acordeon"].includes(v.id));
  const cabeceraEncimaPosible =
    secciones.find((s) => s.activa)?.tipo === "portada" &&
    portadasConCabeceraEncima.some((v) => v.id === portada?.variante) &&
    imagenesPortada > 0;
  const ayudaCabecera =
    efectiva.cabecera !== "transparente"
      ? undefined
      : cabeceraEncimaPosible
        ? { texto: "Transparente sobre la portada, sólida al bajar." }
        : {
            aviso: true,
            texto: `Con tu portada actual se ve sólida. Va transparente sobre ${enumerar(
              portadasConCabeceraEncima.map((v) => v.nombre),
            )}, con al menos una imagen y como primera sección.`,
          };

  /**
   * Suma una imagen a la portada, con el destino que le corresponde: una hecha
   * desde una promoción lleva a su página, una de un producto a su detalle, y
   * una hecha de cero no lleva a ningún lado (es solo publicidad). El título y
   * el botón quedan para que el comerciante los ajuste.
   */
  const agregarImagenAPortada = (d: { imagen: string; destino: string; titulo?: string; boton?: string }) => {
    const actuales = efectiva.portada.diapositivas;
    if (actuales.length >= o.maxDiapositivas) {
      toast.error(`La portada ya tiene ${o.maxDiapositivas} imágenes. Quitá una para sumar esta.`);
      return false;
    }
    actualizar({ portada: { ...efectiva.portada, diapositivas: [...actuales, d] } });
    setAbierta("portada");
    enfocar("portada", { nombre: "La portada" });
    return true;
  };

  const usarImagenIa = (img: ImagenIa, contexto: ContextoDeUso) => {
    // El conjunto de productos se agrupa en una promoción: la imagen se suma cuando esa promoción se guarda.
    if (contexto.agrupar && contexto.productos.length > 0) {
      setPromoNueva({ productos: contexto.productos, imagen: img.url });
      return;
    }
    const promo = img.promotionId ? promociones.find((p) => p.id === img.promotionId) : undefined;
    const producto = img.kind === "product" ? productos.find((p) => p.storeProducts?.[0]?.id === img.productIds[0]) : undefined;
    const sumada = agregarImagenAPortada(
      promo
        ? { imagen: img.url, destino: `promo:${promo.slug}`, titulo: promo.nombre, boton: "Ver la promoción" }
        : producto
          ? { imagen: img.url, destino: `producto:${producto.id}`, titulo: producto.name, boton: "Ver el producto" }
          : { imagen: img.url, destino: img.kind === "products" ? "catalogo" : "ninguno", ...(img.kind === "products" ? { boton: "Ver los productos" } : {}) },
    );
    if (sumada) toast.success("Imagen agregada a la portada. Ajustale el texto y el botón.");
  };

  const promoGuardada = (p: Promocion) => {
    if (!promoNueva) return;
    if (agregarImagenAPortada({ imagen: p.imagen ?? promoNueva.imagen, destino: `promo:${p.slug}`, titulo: p.nombre, boton: "Ver la promoción" })) {
      toast.success("Promoción creada y agregada a la portada.");
    }
    setPromoNueva(null);
  };

  return (
    <div className="space-y-6">
      <Bloque titulo="Plantilla" descripcion="Elegí el rubro de tu tienda y después una de sus plantillas.">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
        {/* Vuelve a lo que propone la plantilla. Las imágenes de portada se
            conservan: subirlas de nuevo cuesta. Se aplica al guardar. */}
        {tema.personalizable && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => onCambiarApariencia({ portada: { diapositivas: efectiva.portada.diapositivas } })}
          >
            Volver al diseño de la plantilla
          </Button>
        )}
      </Bloque>

    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <div className="space-y-4">
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
            <AsistenteIa />

            <div className="space-y-2">
              <Seccion
                id="colores"
                icono={Palette}
                titulo="Colores y letras"
                resumen={`${tema.paletas.find((p) => p.id === efectiva.paleta)?.nombre ?? "—"} · ${nombreDe(o.tipografias, efectiva.tipografia)} · ${nombreDe(o.esquinas, efectiva.esquinas)}`}
                abierta={abierta}
                alternar={setAbierta}
              >
                <Fila etiqueta="Paleta" ayuda="Armadas para que todo se lea bien.">
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
                </Fila>
                <Fila etiqueta="Tipografía">
                  <Opciones opciones={o.tipografias} valor={efectiva.tipografia} onChange={(tipografia) => actualizar({ tipografia })} />
                </Fila>
                <Fila etiqueta="Esquinas">
                  <Opciones
                    opciones={o.esquinas}
                    valor={efectiva.esquinas}
                    onChange={(esquinas) => {
                      actualizar({ esquinas });
                      enfocar("tarjetas", verTarjetas);
                    }}
                    columnas={3}
                  />
                </Fila>
              </Seccion>

              {portada && defPortada && (
                <Seccion
                  id="portada"
                  icono={ImageIcon}
                  titulo="Portada"
                  resumen={`${varianteActual?.nombre ?? "—"} · ${imagenesPortada === 0 ? "sin imágenes" : `${imagenesPortada} ${imagenesPortada === 1 ? "imagen" : "imágenes"}`}`}
                  abierta={abierta}
                  alternar={setAbierta}
                >
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
                      {varianteActual!.nombre} necesita {varianteActual!.minimoImagenes} imágenes. Con {imagenesPortada} tu
                      tienda muestra otra portada: subí {varianteActual!.minimoImagenes! - imagenesPortada} más o elegí
                      otro estilo.
                    </p>
                  )}
                  <EditorPortada
                    portada={efectiva.portada}
                    onChange={(p) => {
                      actualizar({ portada: p });
                      enfocar("portada", { nombre: "La portada" });
                    }}
                    catalogo={catalogo}
                    destinos={{
                      categorias,
                      productos: productos.map((p) => ({ id: p.id, nombre: p.name })),
                      promociones: promociones
                        .filter((p) => p.estado !== "inactiva")
                        .map((p) => ({ slug: p.slug, nombre: p.nombre, etiqueta: p.etiqueta })),
                    }}
                    subirImagen={subirImagen}
                    // Cada variante declara qué ajustes usa: el mosaico muestra
                    // todas a la vez, la dividida pasa siempre en fundido…
                    ajustes={ajustesDePortada(varianteActual)}
                    onCrearConIa={storeId ? () => setIaAbierta(true) : undefined}
                    variante={varianteMostrada}
                    pantalla={dispositivo === "movil" ? "movil" : "escritorio"}
                    onPantalla={(p) => setDispositivo(p === "movil" ? "movil" : dispositivo === "tableta" ? "tableta" : "escritorio")}
                  />
                </Seccion>
              )}

              <Seccion
                id="secciones"
                icono={LayoutList}
                titulo="Secciones"
                resumen={`${secciones.filter((s) => s.activa).length} de ${secciones.length} visibles`}
                abierta={abierta}
                alternar={setAbierta}
              >
                <p className="text-xs text-muted-foreground">Cuáles se ven, en qué orden y con qué fondo.</p>
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
              </Seccion>

              <Seccion
                id="movimiento"
                icono={Wand2}
                titulo="Animaciones"
                resumen={`${nombreDe(o.entradas, efectiva.entrada)} · ${nombreDe(o.hovers, efectiva.hover)}`}
                abierta={abierta}
                alternar={setAbierta}
              >
                <p className="text-xs text-muted-foreground">Si el celular del cliente pide menos movimiento, no se muestran.</p>
                {menosMovimiento && (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                    Tu computadora tiene las animaciones apagadas, por eso en la vista previa no se mueve nada. Tus
                    clientes que las tienen prendidas sí las ven. Para verlas acá, en Windows: Configuración →
                    Accesibilidad → Efectos visuales → Efectos de animación.
                  </p>
                )}
                <Fila etiqueta="Al aparecer">
                  <Opciones
                    opciones={o.entradas}
                    valor={efectiva.entrada}
                    onChange={(entrada) => {
                      actualizar({ entrada });
                      // Se repite con lo que está a la vista; lo demás, al bajar.
                      if (entrada !== "ninguna") enfocar("", { aviso: "Bajá en la vista previa: así aparecen las secciones" });
                    }}
                  />
                </Fila>
                <Fila
                  etiqueta="Al pasar el mouse por un producto"
                  ayuda={
                    efectiva.hover === "ninguno"
                      ? undefined
                      : `En computadora, sobre las tarjetas de Destacados y Productos (en el celular no hay mouse).${
                          efectiva.hover === "segunda-foto" ? " Solo cambian los productos con dos fotos o más." : ""
                        }`
                  }
                >
                  <Opciones
                    opciones={o.hovers}
                    valor={efectiva.hover}
                    onChange={(hover) => {
                      actualizar({ hover });
                      if (hover !== "ninguno") enfocar("tarjetas", { ...verTarjetas, aviso: "Pasá el mouse por una tarjeta" });
                    }}
                  />
                </Fila>
                {o.entrePaginas && (
                  <Fila etiqueta="Al abrir un producto" ayuda="En Chrome, Edge y Safari. En los demás navegadores abre normal.">
                    <Opciones opciones={o.entrePaginas} valor={efectiva.entrePaginas} onChange={(entrePaginas) => actualizar({ entrePaginas })} />
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => enfocar("abrir-producto", verTarjetas)}>
                      <Play className="h-3.5 w-3.5" /> Probar: abrir un producto
                    </Button>
                  </Fila>
                )}
              </Seccion>

              <Seccion
                id="cabecera"
                icono={PanelTop}
                titulo="Cabecera y anuncio"
                resumen={`${nombreDe(o.cabeceras, efectiva.cabecera)} · anuncio ${efectiva.anuncio.activo ? "prendido" : "apagado"}`}
                abierta={abierta}
                alternar={setAbierta}
              >
                <Fila etiqueta="Cabecera" ayuda={ayudaCabecera?.texto} aviso={ayudaCabecera?.aviso}>
                  <Opciones
                    opciones={o.cabeceras}
                    valor={efectiva.cabecera}
                    onChange={(cabecera) => {
                      actualizar({ cabecera });
                      enfocar("cabecera", { nombre: "La cabecera" });
                    }}
                    columnas={3}
                  />
                </Fila>
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Barra de anuncio</p>
                      <p className="text-xs text-muted-foreground">Una línea arriba de todo. Escribí solo lo que cumplís.</p>
                    </div>
                    <Switch
                      checked={efectiva.anuncio.activo}
                      aria-label="Mostrar la barra de anuncio"
                      onCheckedChange={(activo) => {
                        actualizar({ anuncio: { ...efectiva.anuncio, activo } });
                        if (activo) enfocar("cabecera", { nombre: "La barra de anuncio" });
                      }}
                    />
                  </div>
                  {efectiva.anuncio.activo && (
                    <>
                      <Input
                        value={efectiva.anuncio.texto}
                        maxLength={o.largos.anuncio}
                        placeholder="Ej.: Envíos a todo el país"
                        onChange={(e) => {
                          actualizar({ anuncio: { ...efectiva.anuncio, texto: e.target.value } });
                          enfocar("cabecera", { nombre: "La barra de anuncio" });
                        }}
                      />
                      <Opciones
                        opciones={o.variantesAnuncio}
                        valor={efectiva.anuncio.variante}
                        onChange={(variante) => {
                          actualizar({ anuncio: { ...efectiva.anuncio, variante } });
                          enfocar("cabecera", { nombre: "La barra de anuncio" });
                        }}
                      />
                    </>
                  )}
                </div>
              </Seccion>
            </div>
          </>
        )}
      </div>

      <div className="xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
        {slug ? (
          <VistaPreviaTienda
            slug={slug}
            themeId={tema.id}
            apariencia={tema.personalizable ? efectiva : undefined}
            foco={foco}
            onMenosMovimiento={setMenosMovimiento}
            dispositivo={dispositivo}
            onDispositivo={setDispositivo}
          />
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">La vista previa aparece cuando la tienda tiene dirección (slug).</Card>
        )}
      </div>
    </div>

      {storeId && (
        <>
          <DialogImagenIa open={iaAbierta} onOpenChange={setIaAbierta} storeId={storeId} onUsar={usarImagenIa} permitirAgrupar />
          <PromocionForm
            open={Boolean(promoNueva)}
            onOpenChange={(abierto) => !abierto && setPromoNueva(null)}
            storeId={storeId}
            precargado={promoNueva ?? undefined}
            onGuardada={promoGuardada}
          />
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ piezas

const nombreDe = (lista: Opcion[], id: string) => lista.find((x) => x.id === id)?.nombre ?? id;

/**
 * Una sección plegable del editor. Cerrada muestra lo elegido, para saber el
 * estado sin abrirla; solo una está abierta a la vez.
 */
function Seccion({
  id,
  icono: Icono,
  titulo,
  resumen,
  abierta,
  alternar,
  children,
}: {
  id: string;
  icono: LucideIcon;
  titulo: string;
  resumen: string;
  abierta: string | null;
  alternar: (id: string | null) => void;
  children: ReactNode;
}) {
  const abierto = abierta === id;
  return (
    <Card className={`overflow-hidden transition-shadow ${abierto ? "ring-1 ring-primary/30" : ""}`}>
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => alternar(abierto ? null : id)}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/40"
      >
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icono className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{titulo}</span>
          {!abierto && <span className="block truncate text-xs text-muted-foreground">{resumen}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 flex-none text-muted-foreground transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && <div className="space-y-4 border-t border-border p-4">{children}</div>}
    </Card>
  );
}

/**
 * El asistente de IA. Hoy crea imágenes de portada (de cero, con un producto,
 * con varios o con una promoción) y deja volver a usar las que ya se hicieron.
 * Sugerir el diseño entero a partir de lo que pide el comerciante viene después.
 */
/** Arma la configuración a partir de lo que cuenta el comerciante. Las imágenes con IA se crean en la portada. */
function AsistenteIa() {
  return (
    <Card className="space-y-2 border-purple-200 bg-purple-50/50 p-4 dark:border-purple-800 dark:bg-purple-900/10">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Armar con IA
        </p>
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
          Próximamente
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Contale cómo es tu tienda y la IA elige los colores, la tipografía, la portada y las secciones por vos.
      </p>
    </Card>
  );
}

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

function Fila({ etiqueta, ayuda, aviso, children }: { etiqueta: string; ayuda?: string; aviso?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{etiqueta}</Label>
      {children}
      {ayuda && (
        <p className={aviso ? "rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs" : "text-xs text-muted-foreground"}>{ayuda}</p>
      )}
    </div>
  );
}

/** "A, B o C". */
function enumerar(nombres: string[]) {
  return nombres.length < 2 ? nombres.join("") : `${nombres.slice(0, -1).join(", ")} o ${nombres[nombres.length - 1]}`;
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
