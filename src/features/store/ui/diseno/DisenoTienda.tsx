import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Image as ImageIcon,
  Info,
  Layers,
  LayoutGrid,
  LayoutList,
  LayoutTemplate,
  Loader2,
  PanelTop,
  Palette,
  Play,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";

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

/** Separación de las tres columnas con los bordes de la pantalla, en px. */
const MARGEN_PANTALLA = 16;

/** Lo que se puede editar, uno a la vez en la columna del medio. */
type IdPanel = "plantillas" | "estilos" | "colores" | "cabecera" | "portada" | "secciones" | "tarjetas" | "movimiento";

interface ItemMenu {
  id: IdPanel;
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
  /** Lo elegido, para verlo al pasar el mouse sin abrirlo. */
  resumen?: string;
  /** Las plantillas que no se personalizan solo dejan elegir plantilla. */
  soloPersonalizable?: boolean;
}

/**
 * La pestaña Diseño → Tema de Vendfy, en tres columnas: el menú de lo que se
 * puede cambiar, el panel de lo elegido y la vista previa. Las columnas ocupan
 * todo el ancho de la pantalla (salen del ancho máximo del panel): con la
 * vista previa al lado, los 1600px del resto del panel quedan chicos.
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
  categorias: Array<{ id: string; name: string; fullName?: string }>;
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
  const [panel, setPanel] = useState<IdPanel>("colores");
  const [pestanaPortada, setPestanaPortada] = useState<"diseno" | "contenido">("diseno");
  const enfocar = (destino: string, extra: Omit<FocoVistaPrevia, "destino" | "clave"> = {}) =>
    setFoco({ destino, ...extra, clave: Date.now() });
  // Lo dice la vista previa: es el navegador de esta computadora.
  const [menosMovimiento, setMenosMovimiento] = useState(false);

  // Las tres columnas salen del ancho máximo del panel y usan toda la
  // pantalla; el título y las pestañas de arriba quedan como siempre. Se mide
  // el ancho sin la barra de scroll (100vw la incluye y daría scroll de costado).
  const [anchoVentana, setAnchoVentana] = useState(() => document.documentElement.clientWidth);
  useEffect(() => {
    const medir = () => setAnchoVentana(document.documentElement.clientWidth);
    window.addEventListener("resize", medir);
    const obs = new ResizeObserver(medir);
    obs.observe(document.documentElement);
    return () => {
      window.removeEventListener("resize", medir);
      obs.disconnect();
    };
  }, []);

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
    setPanel("portada");
    setPestanaPortada("contenido");
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

  // Vuelve a lo que propone la plantilla. Las imágenes de portada se
  // conservan: subirlas de nuevo cuesta. Se aplica al guardar.
  const restablecer = () => {
    onCambiarApariencia({ portada: { diapositivas: efectiva.portada.diapositivas } });
    toast.success("Volviste al diseño de la plantilla (tus imágenes de portada quedan). Guardá para publicarlo.");
  };

  // ---------------------------------------------------------------- el menú

  const grupos: Array<{ titulo: string; items: ItemMenu[] }> = [
    {
      titulo: "Empezar",
      items: [
        {
          id: "plantillas",
          icono: LayoutTemplate,
          titulo: "Plantillas",
          descripcion: "Elegí el rubro de tu tienda y después una de sus plantillas.",
          resumen: tema.nombre,
        },
        ...(tema.estilos && tema.estilos.length > 0
          ? [
              {
                id: "estilos" as const,
                icono: Layers,
                titulo: "Estilos listos",
                descripcion: "Combinaciones ya armadas de colores, letras y portada. Un toque y se aplican.",
                soloPersonalizable: true,
              },
            ]
          : []),
      ],
    },
    {
      titulo: "Apariencia",
      items: [
        {
          id: "colores",
          icono: Palette,
          titulo: "Colores y letras",
          descripcion: "La paleta, la textura del fondo y la tipografía de toda la tienda.",
          resumen: `${tema.paletas.find((p) => p.id === efectiva.paleta)?.nombre ?? "—"} · ${nombreDe(o.tipografias, efectiva.tipografia)}`,
          soloPersonalizable: true,
        },
        {
          id: "cabecera",
          icono: PanelTop,
          titulo: "Encabezado",
          descripcion: "La barra de arriba de tu tienda y la línea de anuncio.",
          resumen: `${nombreDe(o.cabeceras, efectiva.cabecera)} · anuncio ${efectiva.anuncio.activo ? "prendido" : "apagado"}`,
          soloPersonalizable: true,
        },
        ...(portada && defPortada
          ? [
              {
                id: "portada" as const,
                icono: ImageIcon,
                titulo: "Portada principal",
                descripcion: "La primera impresión de tu tienda. Mirá cómo queda mientras la editás.",
                resumen: `${varianteActual?.nombre ?? "—"} · ${imagenesPortada === 0 ? "sin imágenes" : `${imagenesPortada} ${imagenesPortada === 1 ? "imagen" : "imágenes"}`}`,
                soloPersonalizable: true,
              },
            ]
          : []),
      ],
    },
    {
      titulo: "Contenido",
      items: [
        {
          id: "secciones",
          icono: LayoutList,
          titulo: "Secciones",
          descripcion: "Cuáles se ven en el inicio de tu tienda, en qué orden y con qué fondo.",
          resumen: `${secciones.filter((s) => s.activa).length} de ${secciones.length} visibles`,
          soloPersonalizable: true,
        },
        {
          id: "tarjetas",
          icono: LayoutGrid,
          titulo: "Tarjetas y botones",
          descripcion: "La forma de las tarjetas de producto y los botones, y cómo responden al mouse.",
          resumen: `Esquinas ${nombreDe(o.esquinas, efectiva.esquinas).toLowerCase()} · ${nombreDe(o.hovers, efectiva.hover)}`,
          soloPersonalizable: true,
        },
      ],
    },
    {
      titulo: "Experiencia",
      items: [
        {
          id: "movimiento",
          icono: Wand2,
          titulo: "Animaciones",
          descripcion: "Cómo aparecen las secciones al bajar y cómo se abre un producto.",
          resumen: nombreDe(o.entradas, efectiva.entrada),
          soloPersonalizable: true,
        },
      ],
    },
  ];
  const habilitado = (it: ItemMenu) => tema.personalizable || !it.soloPersonalizable;
  const todos = grupos.flatMap((g) => g.items.map((it) => ({ ...it, grupo: g.titulo })));
  // Si lo elegido ya no está (otra plantilla, sin estilos…), se vuelve a Plantillas.
  const actual = todos.find((it) => it.id === panel && habilitado(it)) ?? todos[0];

  // ---------------------------------------------------------- cada panel

  const paneles: Record<IdPanel, () => ReactNode> = {
    plantillas: () => (
      <>
        <Fila etiqueta="Rubro">
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
        </Fila>
        <Fila etiqueta="Plantilla">
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
        </Fila>
        <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-2.5">
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
        {!tema.personalizable ? (
          <p className="flex gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 flex-none text-primary" />
            <span>
              <span className="font-medium text-foreground">{tema.nombre}</span> todavía no se personaliza: se ve tal
              como está. Las plantillas con <Sparkles className="inline h-3.5 w-3.5 text-primary" /> te dejan elegir
              colores, animaciones, imágenes de portada y secciones.
            </span>
          </p>
        ) : (
          <AsistenteIa />
        )}
      </>
    ),

    estilos: () => (
      <div className="grid grid-cols-2 gap-2">
        {(tema.estilos ?? []).map((e) => {
          const m = tema.paletas.find((p) => p.id === e.apariencia.paleta)?.muestra;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                // Conserva lo que cuesta cargar: las imágenes y el anuncio.
                onCambiarApariencia({
                  ...e.apariencia,
                  secciones: undefined,
                  anuncio: efectiva.anuncio,
                  portada: { ...e.apariencia.portada, diapositivas: efectiva.portada.diapositivas },
                  ...(e.apariencia.secciones ? { secciones: e.apariencia.secciones as SeccionGuardada[] } : {}),
                });
                toast.success(`Estilo ${e.nombre} aplicado. Guardá para publicarlo.`);
              }}
              className="rounded-xl border border-border p-2.5 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
            >
              {m && (
                <span className="mb-2 flex h-10 overflow-hidden rounded-md border border-black/5">
                  <span className="flex-[3]" style={{ background: m.fondo }} />
                  <span className="flex-[2]" style={{ background: m.primario }} />
                  <span className="flex-1" style={{ background: m.acento }} />
                </span>
              )}
              <span className="block text-xs font-semibold">{e.nombre}</span>
              <span className="block text-[11px] text-muted-foreground">{e.descripcion}</span>
            </button>
          );
        })}
      </div>
    ),

    colores: () => (
      <>
        <Fila etiqueta="Paleta" ayuda="Armadas para que todo se lea bien.">
          <div className="grid grid-cols-2 gap-2">
            {tema.paletas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => actualizar({ paleta: p.id })}
                className={`rounded-xl border p-2 text-left transition-all ${
                  efectiva.paleta === p.id ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:border-primary/50"
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
        {o.texturas && (
          <Fila etiqueta="Textura del fondo">
            <Opciones opciones={o.texturas} valor={efectiva.textura} onChange={(textura) => actualizar({ textura })} columnas={3} />
          </Fila>
        )}
        <Fila etiqueta="Tipografía">
          <Opciones opciones={o.tipografias} valor={efectiva.tipografia} onChange={(tipografia) => actualizar({ tipografia })} />
        </Fila>
      </>
    ),

    cabecera: () => (
      <>
        <Fila etiqueta="Estilo del encabezado" ayuda={ayudaCabecera?.texto} aviso={ayudaCabecera?.aviso}>
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
        <div className="space-y-3 rounded-xl border border-border p-3">
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
      </>
    ),

    portada: () =>
      portada && defPortada ? (
        <>
          <div role="tablist" aria-label="Qué editar de la portada" className="grid grid-cols-2 rounded-xl bg-muted/60 p-1">
            {(
              [
                ["diseno", "Diseño"],
                ["contenido", "Contenido"],
              ] as const
            ).map(([id, nombre]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={pestanaPortada === id}
                onClick={() => setPestanaPortada(id)}
                className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                  pestanaPortada === id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {nombre}
              </button>
            ))}
          </div>

          {pestanaPortada === "diseno" ? (
            <>
              <Fila etiqueta="Diseño de portada" ayuda="Elegí el formato que mejor presenta tus productos.">
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
              <button
                type="button"
                onClick={() => setPestanaPortada("contenido")}
                className="flex w-full items-center justify-between rounded-xl border border-dashed border-border p-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <span>
                  <span className="block text-sm font-medium text-foreground">Imágenes, títulos y botones</span>
                  {imagenesPortada === 0 ? "Todavía sin imágenes" : `${imagenesPortada} ${imagenesPortada === 1 ? "imagen" : "imágenes"}`} · en
                  Contenido
                </span>
                <ChevronRight className="h-4 w-4 flex-none" />
              </button>
            </>
          ) : (
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
          )}
        </>
      ) : null,

    secciones: () => (
      <>
        <ul className="divide-y divide-border rounded-xl border border-border">
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
          Una sección sin datos no aparece aunque esté prendida: por ejemplo, Destacados si no marcaste ningún producto
          como destacado.
        </p>
      </>
    ),

    tarjetas: () => (
      <>
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
      </>
    ),

    movimiento: () => (
      <>
        <p className="text-xs text-muted-foreground">Si el celular del cliente pide menos movimiento, no se muestran.</p>
        {menosMovimiento && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
            Tu computadora tiene las animaciones apagadas, por eso en la vista previa no se mueve nada. Tus clientes que
            las tienen prendidas sí las ven. Para verlas acá, en Windows: Configuración → Accesibilidad → Efectos
            visuales → Efectos de animación.
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
        {o.entrePaginas && (
          <Fila etiqueta="Al abrir un producto" ayuda="En Chrome, Edge y Safari. En los demás navegadores abre normal.">
            <Opciones opciones={o.entrePaginas} valor={efectiva.entrePaginas} onChange={(entrePaginas) => actualizar({ entrePaginas })} />
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => enfocar("abrir-producto", verTarjetas)}>
              <Play className="h-3.5 w-3.5" /> Probar: abrir un producto
            </Button>
          </Fila>
        )}
      </>
    ),
  };

  return (
    <>
      {/* Tres columnas en pantallas grandes, con el alto de la ventana: cada
          una baja por su cuenta. Más angosto, el menú pasa arriba en una fila. */}
      <div
        style={{ width: anchoVentana - 2 * MARGEN_PANTALLA, marginLeft: `calc(50% - ${anchoVentana / 2 - MARGEN_PANTALLA}px)` }}
        className="grid gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] xl:h-[calc(100dvh-var(--alto-header)-1.5rem)] xl:min-h-[640px] xl:grid-cols-[240px_minmax(0,420px)_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]">
        {/* ---- 1. Qué personalizar */}
        <Card className="flex min-h-0 flex-col p-2 lg:col-span-2 xl:col-span-1 xl:overflow-y-auto xl:p-4">
          <div className="mb-3 hidden border-b border-border px-1 pb-4 xl:block">
            <h2 className="text-lg font-semibold tracking-tight">Personalizá tu web</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Elegí qué querés modificar</p>
          </div>
          <nav aria-label="Qué personalizar" className="flex gap-1 overflow-x-auto xl:flex-col xl:gap-3 xl:overflow-visible">
            {grupos.map((g) => (
              <div key={g.titulo} className="flex gap-1 xl:flex-col xl:gap-0.5">
                <p className="hidden px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground xl:block">{g.titulo}</p>
                {g.items.map((it) => {
                  const activo = actual.id === it.id;
                  const libre = habilitado(it);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setPanel(it.id)}
                      disabled={!libre}
                      aria-current={activo ? "page" : undefined}
                      title={libre ? it.resumen : `${tema.nombre} no se personaliza`}
                      className={`relative flex flex-none items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 xl:py-2.5 ${
                        activo ? "bg-primary/10 font-semibold text-primary" : "text-foreground/80 hover:bg-muted"
                      }`}
                    >
                      {activo && <span aria-hidden className="absolute -left-4 bottom-1.5 top-1.5 hidden w-[3px] rounded-r-full bg-primary xl:block" />}
                      <it.icono className="h-4 w-4 flex-none" />
                      <span className="flex-1 text-left">{it.titulo}</span>
                      <ChevronRight className={`hidden h-4 w-4 flex-none xl:block ${activo ? "text-primary" : "text-muted-foreground/60"}`} />
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="mt-auto hidden gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 xl:mt-6 xl:flex">
            <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
            <div>
              <p className="text-xs font-semibold">Editá con confianza</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Los cambios se ven acá antes de guardar. Nada se publica hasta que tocás Guardar cambios.
              </p>
            </div>
          </div>
        </Card>

        {/* ---- 2. Lo elegido */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-border px-5 pb-4 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              {actual.grupo} / {actual.titulo}
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">{actual.titulo}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{actual.descripcion}</p>
          </div>
          <div key={actual.id} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            {paneles[actual.id]()}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 flex-none rounded-full bg-emerald-500" /> Cambios reflejados en la vista previa
            </span>
            {tema.personalizable && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 text-xs"
                onClick={restablecer}
                title="Vuelve a los colores, la portada y las secciones de la plantilla. Tus imágenes de portada quedan."
              >
                Restablecer
              </Button>
            )}
          </div>
        </Card>

        {/* ---- 3. La vista previa */}
        <Card className="flex min-h-0 flex-col p-4 lg:sticky lg:top-[calc(var(--alto-header)+0.75rem)] lg:self-start xl:static xl:self-stretch">
          {slug ? (
            <VistaPreviaTienda
              slug={slug}
              themeId={tema.id}
              apariencia={tema.personalizable ? efectiva : undefined}
              foco={foco}
              onMenosMovimiento={setMenosMovimiento}
              dispositivo={dispositivo}
              onDispositivo={setDispositivo}
              plantilla={tema.nombre}
            />
          ) : (
            <p className="p-2 text-sm text-muted-foreground">La vista previa aparece cuando la tienda tiene dirección (slug).</p>
          )}
        </Card>
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
    </>
  );
}

// ------------------------------------------------------------------ piezas

const nombreDe = (lista: Opcion[], id: string) => lista.find((x) => x.id === id)?.nombre ?? id;

/** Arma la configuración a partir de lo que cuenta el comerciante. Las imágenes con IA se crean en la portada. */
function AsistenteIa() {
  return (
    <div className="space-y-2 rounded-xl border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-800 dark:bg-purple-900/10">
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
    </div>
  );
}

function Fila({ etiqueta, ayuda, aviso, children }: { etiqueta: string; ayuda?: string; aviso?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{etiqueta}</Label>
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
    <div className={`grid gap-2 ${columnas === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {opciones.map((op) => {
        const motivo = bloqueadas[op.id];
        const elegida = valor === op.id;
        return (
          <button
            key={op.id}
            type="button"
            onClick={() => onChange(op.id)}
            disabled={Boolean(motivo)}
            title={motivo ?? op.descripcion}
            aria-pressed={elegida}
            className={`relative rounded-xl border px-3 py-2.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              elegida ? "border-primary bg-primary/5 font-semibold text-foreground ring-1 ring-primary/30" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {elegida && (
              <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-2.5 w-2.5" />
              </span>
            )}
            <span className={elegida ? "pr-5" : ""}>{op.nombre}</span>
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
