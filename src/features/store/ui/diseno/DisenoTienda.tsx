import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderTree,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  LayoutList,
  ListOrdered,
  Loader2,
  MessageSquare,
  PanelBottom,
  PanelTop,
  Palette,
  Play,
  Shapes,
  ShoppingBag,
  Star,
  Tag,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import type { AparienciaGuardada, SeccionGuardada } from "@/entities/store/model/types";
import { aparienciaEfectiva, ajustesDePortada, useCatalogoTemas, type EstiloListo, type Muestra, type Opcion } from "../../model/catalogo-temas";
import { catalogoParaIa } from "../../model/diseno-ia";
import { AsistenteIa, ESTADO_INICIAL_IA, type DestinosDeTextos, type EstadoAsistenteIa } from "./AsistenteIa";
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

/**
 * Simple: elegir un diseño listo, los colores y la letra, para que la primera
 * configuración sea rápida y no abrume. Avanzado: el menú completo. Se recuerda
 * en este navegador; la primera vez abre el simple.
 */
type Modo = "simple" | "avanzado";
const CLAVE_MODO = "vendfy:diseno-modo";

/**
 * Lo que se puede editar, uno a la vez en la columna del medio.
 *
 * Cada cosa se configura en un solo lugar:
 * - Estilo general: lo que afecta a toda la tienda.
 * - Estructura: lo que se repite en todas las páginas.
 * - Página de inicio: "Organizar secciones" solo ordena y prende o apaga; cada
 *   sección tiene su pantalla (`seccion:<tipo>`), todas con la misma plantilla
 *   (`panelDeSeccion`). La lista sale del catálogo de la tienda: una sección
 *   nueva aparece sola.
 */
type PanelFijo = "inicio" | "colores" | "formas" | "tarjetas" | "movimiento" | "cabecera" | "pie" | "organizar";
type IdPanel = PanelFijo | `seccion:${string}`;

const ICONO_DE_SECCION: Record<string, LucideIcon> = {
  portada: ImageIcon,
  promociones: Tag,
  categorias: FolderTree,
  destacados: Star,
  beneficios: BadgeCheck,
  catalogo: ShoppingBag,
  resenas: MessageSquare,
  nosotros: Users,
};

interface ItemMenu {
  /** Una sección del inicio: va con sangría bajo "Organizar secciones". */
  seccion?: boolean;
  /** Apagada: se ve atenuada. */
  oculta?: boolean;
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
 * Hay una sola plantilla y dos modos (`Modo`). El simple es lo primero que se
 * ve: la galería de diseños listos (agrupada por tipo de negocio, con "Armar
 * con IA"), los colores y la letra. El avanzado es el menú completo de tres
 * columnas; los dos editan la misma apariencia.
 *
 * El comerciante elige entre opciones cerradas (las que sirve la tienda en
 * `/api/temas`), nunca colores ni tamaños sueltos: así ninguna combinación se
 * ve rota. Todo se ve en la vista previa antes de guardar, y cada cambio la
 * lleva hasta donde se nota (`enfocar`).
 */
export function DisenoTienda({
  slug,
  storeId,
  nombre,
  rubro,
  themeId,
  apariencia,
  categorias,
  onCambiarTema,
  onCambiarApariencia,
  onCambiarTitulo,
  onCambiarNosotros,
  subirImagen,
}: {
  slug: string;
  /** El nombre de la tienda: contexto para "Armar con IA". */
  nombre?: string;
  /** La tienda, para sus promociones, productos e imágenes con IA. */
  storeId?: string;
  /** `config.category`: con qué grupo abre la galería de diseños listos. */
  rubro: string | undefined;
  themeId: string | undefined;
  apariencia: AparienciaGuardada | undefined;
  categorias: Array<{ id: string; name: string; fullName?: string }>;
  onCambiarTema: (themeId: string) => void;
  onCambiarApariencia: (apariencia: AparienciaGuardada) => void;
  /**
   * Los textos que no viven en la apariencia: el título de la tienda
   * (`config.branding.heroTitle`, el de la portada sin imágenes) y "Nosotros"
   * (`config.aboutUs`). Sin ellos, "Armar con IA" no ofrece esos textos.
   */
  onCambiarTitulo?: (titulo: string) => void;
  onCambiarNosotros?: (texto: string) => void;
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
  const [modo, setModoCrudo] = useState<Modo>(() => {
    try {
      return localStorage.getItem(CLAVE_MODO) === "avanzado" ? "avanzado" : "simple";
    } catch {
      return "simple";
    }
  });
  const setModo = (m: Modo) => {
    setModoCrudo(m);
    try {
      localStorage.setItem(CLAVE_MODO, m);
    } catch {
      // Sin almacenamiento (ventana privada): el modo dura solo esta visita.
    }
  };
  // El grupo elegido en la galería de diseños listos; sin elegir, el del rubro.
  const [grupoElegido, setGrupoElegido] = useState<string | null>(null);
  // Lo que se le contó a la IA y lo que propuso: sigue ahí al volver de otro panel.
  const [asistenteIa, setAsistenteIa] = useState<EstadoAsistenteIa>(ESTADO_INICIAL_IA);
  // La IA tarda: cuando contesta se aplica con lo que haya en pantalla en ese
  // momento (una imagen subida mientras tanto no se pierde), no con lo que
  // había al pedir.
  const aplicarDisenoActual = useRef<(d: EstiloListo["apariencia"]) => void>(() => {});
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
  const efectiva = aparienciaEfectiva(apariencia, tema, catalogo);
  const o = catalogo.opciones;

  // Se guarda la apariencia completa, no solo lo tocado: así lo que se ve en
  // la vista previa es exactamente lo que queda guardado.
  // Una tienda que tenía una plantilla que ya no existe pasa a la actual al
  // primer cambio (la tienda pública ya la muestra así).
  const fijarPlantilla = () => {
    if (themeId !== tema.id) onCambiarTema(tema.id);
  };
  const actualizar = (cambio: Partial<AparienciaGuardada>) => {
    fijarPlantilla();
    onCambiarApariencia({ ...efectiva, ...cambio });
  };

  // Un diseño completo (uno listo o el que armó la IA) reemplaza todo menos lo
  // que cuesta cargar: las imágenes de la portada y el anuncio. Queda de
  // borrador en la vista previa.
  const aplicarDiseno = (d: EstiloListo["apariencia"]) => {
    fijarPlantilla();
    onCambiarApariencia({
      ...d,
      secciones: undefined,
      anuncio: efectiva.anuncio,
      portada: { ...d.portada, diapositivas: efectiva.portada.diapositivas },
      ...(d.secciones ? { secciones: d.secciones as SeccionGuardada[] } : {}),
    });
    enfocar("portada");
  };
  aplicarDisenoActual.current = aplicarDiseno;

  // La galería de diseños listos: grupos en el orden del catálogo, solo los
  // que tienen algún diseño. Abre en el grupo del rubro de la tienda.
  const estilos = tema.estilos ?? [];
  const gruposDeEstilos = (catalogo.gruposDeEstilos ?? []).filter((g) => estilos.some((e) => e.grupo === g.id));
  const grupoActivo = grupoElegido ?? gruposDeEstilos.find((g) => rubro && g.rubros.includes(rubro))?.id ?? "todos";
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
  const tituloDeSeccion = (tipo: string) => (tipo === "portada" ? "Portada principal" : nombreDeSeccion(tipo));
  const abrirSeccion = (tipo: string) => {
    setPanel(`seccion:${tipo}`);
    if (secciones.find((s) => s.tipo === tipo)?.activa) enfocar(tipo, { nombre: tituloDeSeccion(tipo) });
  };
  /**
   * De dónde sale lo que muestra una sección y, si hoy no tiene nada, por qué
   * no se ve. Los enlaces abren en otra pestaña: salir de acá perdería los
   * cambios sin guardar.
   */
  const datosDeSeccion = (tipo: string): { origen?: string; falta?: string; enlace?: { href: string; texto: string } } => {
    const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
    switch (tipo) {
      case "promociones": {
        const vigentes = promociones.filter((p) => p.estado !== "inactiva").length;
        return {
          origen: `Muestra tus promociones vigentes. Tenés ${cuantos(vigentes, "promoción activa", "promociones activas")}.`,
          falta: vigentes === 0 ? "No tenés promociones activas: esta sección no se ve hasta que crees una." : undefined,
          enlace: { href: "/promotions", texto: "Ir a Promociones" },
        };
      }
      case "categorias":
        return {
          origen: `Muestra las categorías principales que tienen productos. Tenés ${cuantos(categorias.length, "categoría", "categorías")} en total, contando subcategorías.`,
          falta: categorias.length === 0 ? "Todavía no creaste categorías: esta sección no se ve." : undefined,
          enlace: { href: "/products/taxonomies", texto: "Editar categorías" },
        };
      case "destacados": {
        const destacados = productos.filter((p) => p.metadata?.isFeatured).length;
        return {
          origen: "Muestra los productos que marcaste como destacados.",
          // Con 100 o más productos la lista de acá viene cortada: no se afirma que falten.
          falta: destacados === 0 && productos.length < 100 ? "No marcaste ningún producto como destacado: esta sección no se ve." : undefined,
          enlace: { href: "/products", texto: "Ir a Productos" },
        };
      }
      case "catalogo":
        return { origen: "Muestra todos tus productos publicados, con buscador y filtros.", enlace: { href: "/products", texto: "Ir a Productos" } };
      case "resenas":
        return { origen: "Muestra las reseñas de tu tienda. Se administran en la pestaña Reseñas de esta misma pantalla." };
      case "nosotros":
        return { origen: 'Muestra el texto "Sobre nosotros", que se escribe en la pestaña General de esta misma pantalla. Sin texto, la sección no se ve.' };
      case "beneficios":
        return { origen: "Muestra los beneficios cargados en la configuración de la tienda. Sin beneficios, la sección no se ve." };
      default:
        return {};
    }
  };
  // Lo que conviene saber del diseño de una sección antes de elegirlo.
  const ayudaDeSeccion = (tipo: string) =>
    tipo === "categorias" ? "Se muestran las categorías principales que tienen productos; una vacía no aparece." : undefined;
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
    setPanel("seccion:portada");
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

  const resumenDeSeccion = (s: SeccionGuardada) => {
    const def = o.secciones.find((d) => d.tipo === s.tipo);
    if (!def) return "";
    if (s.tipo === "portada")
      return `${varianteActual?.nombre ?? "—"} · ${imagenesPortada === 0 ? "sin imágenes" : `${imagenesPortada} ${imagenesPortada === 1 ? "imagen" : "imágenes"}`}`;
    return def.variantes.length > 1 ? nombreDe(def.variantes, s.variante) : def.descripcion;
  };

  const grupos: Array<{ titulo: string; items: ItemMenu[] }> = [
    {
      titulo: "Estilo general",
      items: [
        {
          id: "colores",
          icono: Palette,
          titulo: "Colores, letras y fondo",
          descripcion: "La paleta, la tipografía y la textura del fondo de toda la tienda.",
          resumen: `${tema.paletas.find((p) => p.id === efectiva.paleta)?.nombre ?? "—"} · ${nombreDe(o.tipografias, efectiva.tipografia)}`,
          soloPersonalizable: true,
        },
        {
          id: "formas",
          icono: Shapes,
          titulo: "Formas y esquinas",
          descripcion: "Qué tan rectas o redondeadas son las tarjetas, los botones y las fotos.",
          resumen: `Esquinas ${nombreDe(o.esquinas, efectiva.esquinas).toLowerCase()}`,
          soloPersonalizable: true,
        },
        {
          id: "tarjetas",
          icono: LayoutGrid,
          titulo: "Tarjeta de producto",
          descripcion: "Cómo se ve cada producto en Destacados y en el catálogo, y cómo responde al mouse.",
          resumen: `${o.tarjetas ? `${nombreDe(o.tarjetas, efectiva.tarjeta)} · ` : ""}${nombreDe(o.hovers, efectiva.hover)}`,
          soloPersonalizable: true,
        },
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
    {
      titulo: "Estructura",
      items: [
        {
          id: "cabecera",
          icono: PanelTop,
          titulo: "Encabezado",
          descripcion: "La barra de arriba de tu tienda y la línea de anuncio. Se ven en todas las páginas.",
          resumen: `${nombreDe(o.cabeceras, efectiva.cabecera)} · anuncio ${efectiva.anuncio.activo ? "prendido" : "apagado"}`,
          soloPersonalizable: true,
        },
        ...(o.pies
          ? [
              {
                id: "pie" as const,
                icono: PanelBottom,
                titulo: "Pie de página",
                descripcion: "El cierre de todas las páginas. Muestra solo los datos de contacto que cargaste.",
                resumen: nombreDe(o.pies, efectiva.pie),
                soloPersonalizable: true,
              },
            ]
          : []),
      ],
    },
    {
      titulo: "Página de inicio",
      items: [
        {
          id: "organizar",
          icono: ListOrdered,
          titulo: "Organizar secciones",
          descripcion: "Qué bloques se ven en el inicio y en qué orden. Tocá uno para configurarlo.",
          resumen: `${secciones.filter((s) => s.activa).length} de ${secciones.length} visibles`,
          soloPersonalizable: true,
        },
        // En el orden en que la tienda las muestra.
        ...secciones.flatMap((s): ItemMenu[] => {
          const def = o.secciones.find((d) => d.tipo === s.tipo);
          if (!def) return [];
          return [
            {
              id: `seccion:${s.tipo}`,
              icono: ICONO_DE_SECCION[s.tipo] ?? LayoutList,
              titulo: tituloDeSeccion(s.tipo),
              descripcion: s.tipo === "portada" ? "La primera impresión de tu tienda. Mirá cómo queda mientras la editás." : def.descripcion,
              resumen: resumenDeSeccion(s),
              soloPersonalizable: true,
              seccion: true,
              oculta: !s.activa,
            },
          ];
        }),
      ],
    },
  ];
  const habilitado = (it: ItemMenu) => tema.personalizable || !it.soloPersonalizable;
  const todos = grupos.flatMap((g) => g.items.map((it) => ({ ...it, grupo: g.titulo })));
  // Si lo elegido ya no está, se vuelve al primero.
  const actual = todos.find((it) => it.id === panel && habilitado(it)) ?? todos[0];

  // ---------------------------------------------------------- cada panel

  const selectorDePaletas = () => (
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
  );

  const paneles: Record<PanelFijo, () => ReactNode> = {
    inicio: () => {
      const tarjeta = (e: (typeof estilos)[number]) => {
        const m = tema.paletas.find((p) => p.id === e.apariencia.paleta)?.muestra;
        const letra = o.tipografias.find((t) => t.id === e.apariencia.tipografia)?.nombre;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => {
              aplicarDiseno(e.apariencia);
              toast.success(`Diseño ${e.nombre} aplicado. Miralo en la vista previa y guardá para publicarlo.`);
            }}
            className="rounded-xl border border-border p-2.5 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
          >
            {m && (
              <span className="mb-2 block overflow-hidden rounded-md border border-black/5">
                <Miniatura muestra={m} />
              </span>
            )}
            <span className="block text-xs font-semibold">{e.nombre}</span>
            <span className="block text-[11px] text-muted-foreground">{e.descripcion}</span>
            {letra && <span className="mt-1 block text-[10px] text-muted-foreground/80">Letra {letra.toLowerCase()}</span>}
          </button>
        );
      };
      const chip = (id: string, nombre: string) => (
        <button
          key={id}
          type="button"
          onClick={() => setGrupoElegido(id)}
          aria-pressed={grupoActivo === id}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            grupoActivo === id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
          }`}
        >
          {nombre}
        </button>
      );
      // Sin grupos (una tienda sin desplegar): todos juntos, como antes.
      const visibles = gruposDeEstilos.filter((g) => grupoActivo === "todos" || g.id === grupoActivo);
      const sinGrupo = estilos.filter((e) => !gruposDeEstilos.some((g) => g.id === e.grupo));

      // Dónde va cada texto que propone la IA. El que no tiene dónde, no se ofrece.
      const diapositivas = efectiva.portada.diapositivas;
      const enPrimeraImagen = (cambio: { titulo?: string; texto?: string }) => {
        actualizar({ portada: { ...efectiva.portada, diapositivas: diapositivas.map((d, i) => (i === 0 ? { ...d, ...cambio } : d)) } });
        enfocar("portada", { nombre: "La portada" });
      };
      const destinosDeTextos: DestinosDeTextos = {
        // Con imágenes, el título es el de la primera; sin ninguna, la portada
        // muestra el título de la tienda.
        tituloPortada: diapositivas.length
          ? { etiqueta: "Título de la portada", donde: "En la primera imagen de la portada.", usar: (titulo) => enPrimeraImagen({ titulo }) }
          : onCambiarTitulo && {
              etiqueta: "Título de la portada",
              donde: "Como título de tu tienda (Marca). Se ve en la tienda cuando guardes.",
              usar: (titulo) => {
                onCambiarTitulo(titulo);
                toast.success("Título cambiado. Guardá para verlo en tu tienda.");
              },
            },
        // Sin imágenes, debajo del título va la descripción de la tienda: no se pisa desde acá.
        subtituloPortada: diapositivas.length
          ? { etiqueta: "Texto de la portada", donde: "Debajo del título, en la primera imagen.", usar: (texto) => enPrimeraImagen({ texto }) }
          : undefined,
        anuncio: {
          etiqueta: "Barra de anuncio",
          donde: efectiva.anuncio.activo ? "Reemplaza el texto de tu barra de anuncio." : "Prende la barra de anuncio con este texto.",
          usar: (texto) => {
            actualizar({ anuncio: { ...efectiva.anuncio, activo: true, texto: texto.slice(0, o.largos.anuncio) } });
            enfocar("cabecera", { nombre: "La barra de anuncio" });
          },
        },
        nosotros: onCambiarNosotros && {
          etiqueta: "Nosotros",
          donde: "En la sección Nosotros de tu tienda. Se ve cuando guardes.",
          usar: (texto) => {
            onCambiarNosotros(texto);
            toast.success("Texto de Nosotros cambiado. Guardá para verlo en tu tienda.");
          },
        },
      };
      return (
        <>
          <p className="flex gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
            <span>
              Un diseño cambia colores, letras, formas y secciones de una vez. Tus imágenes, textos y anuncio quedan.
              Nada se publica hasta que guardes.
            </span>
          </p>
          {gruposDeEstilos.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {chip("todos", "Todos")}
              {gruposDeEstilos.map((g) => chip(g.id, g.nombre))}
            </div>
          )}
          {visibles.map((g) => (
            <div key={g.id} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.nombre}</p>
              <div className="grid grid-cols-2 gap-2">{estilos.filter((e) => e.grupo === g.id).map(tarjeta)}</div>
            </div>
          ))}
          {grupoActivo === "todos" && sinGrupo.length > 0 && <div className="grid grid-cols-2 gap-2">{sinGrupo.map(tarjeta)}</div>}
          {tema.personalizable && (
            <AsistenteIa
              storeId={storeId}
              estado={asistenteIa}
              onEstado={setAsistenteIa}
              armarPedido={() => ({
                catalogo: catalogoParaIa(catalogo, tema),
                contexto: {
                  nombre,
                  rubro,
                  imagenesPortada: diapositivas.length,
                  categorias: categorias.slice(0, 12).map((c) => c.name),
                  productos: productos.slice(0, 12).map((p) => p.name),
                },
              })}
              onAplicar={(d) => aplicarDisenoActual.current(d)}
              destinos={destinosDeTextos}
            />
          )}
        </>
      );
    },

    colores: () => (
      <>
        <Fila etiqueta="Paleta" ayuda="Armadas para que todo se lea bien.">
          {selectorDePaletas()}
        </Fila>
        {o.texturas && (
          <Fila etiqueta="Textura del fondo">
            <Opciones opciones={o.texturas} valor={efectiva.textura} onChange={(textura) => actualizar({ textura })} />
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

    pie: () =>
      o.pies ? (
        <Fila etiqueta="Diseño del pie" ayuda="El mismo en todas las páginas. Muestra solo los datos de contacto que cargaste.">
          <Opciones
            opciones={o.pies}
            valor={efectiva.pie}
            onChange={(pie) => {
              actualizar({ pie });
              enfocar("pie", { nombre: "El pie de página" });
            }}
          />
        </Fila>
      ) : null,

    organizar: () => (
      <>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {secciones.map((s, i) => {
            const def = o.secciones.find((d) => d.tipo === s.tipo)!;
            const sinDatos = s.activa ? datosDeSeccion(s.tipo).falta : undefined;
            return (
              <li key={s.tipo} className="flex items-center gap-2 p-3">
                <div className="flex flex-col">
                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={i === 0} onClick={() => moverSeccion(i, -1)} aria-label={`Subir ${def.nombre}`}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={i === secciones.length - 1} onClick={() => moverSeccion(i, 1)} aria-label={`Bajar ${def.nombre}`}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => abrirSeccion(s.tipo)}
                  className={`group flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted ${s.activa ? "" : "opacity-60"}`}
                  title={`Configurar ${tituloDeSeccion(s.tipo)}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{tituloDeSeccion(s.tipo)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.activa ? resumenDeSeccion(s) : "Oculta"}
                      {sinDatos && <span className="text-amber-600 dark:text-amber-400"> · sin datos: tus clientes no la ven</span>}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 flex-none text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
                <Switch
                  checked={s.activa}
                  disabled={def.fija}
                  onCheckedChange={(activa) => cambiarSeccion(s.tipo, { activa })}
                  aria-label={`Mostrar ${def.nombre}`}
                />
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          Acá solo se ordena y se prende o apaga. Para cambiar cómo se ve una sección, tocala: se abre su pantalla. A una
          sección sin datos tus clientes no la ven aunque esté prendida; acá, en la vista previa, se muestra con contenido de
          ejemplo.
        </p>
      </>
    ),

    tarjetas: () => (
      <>
        {o.tarjetas && (
          <Fila
            etiqueta="Diseño de la tarjeta"
            ayuda={`Cómo se ven los productos en Destacados y en el catálogo.${
              secciones.find((s) => s.tipo === "catalogo")?.variante === "menu"
                ? " Tu catálogo está en Lista rápida: ahí las tarjetas son siempre horizontales."
                : ""
            }`}
          >
            <Opciones
              opciones={o.tarjetas}
              valor={efectiva.tarjeta}
              onChange={(tarjeta) => {
                actualizar({ tarjeta });
                enfocar("tarjetas", verTarjetas);
              }}
            />
          </Fila>
        )}
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

    formas: () => (
      <>
        <p className="text-xs text-muted-foreground">Valen para toda la tienda: el inicio, el detalle del producto, el carrito y el pedido.</p>
        <Fila etiqueta={o.esquinasBotones ? "Esquinas de tarjetas y cajas" : "Esquinas"}>
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
        {o.esquinasBotones && (
          <Fila etiqueta="Esquinas de botones y filtros" ayuda="Los botones de compra, los filtros del catálogo y el buscador.">
            <Opciones
              opciones={o.esquinasBotones}
              valor={efectiva.esquinasBotones}
              onChange={(esquinasBotones) => {
                actualizar({ esquinasBotones });
                enfocar("catalogo", { nombre: "Los botones y filtros" });
              }}
              columnas={3}
            />
          </Fila>
        )}
        {o.esquinasFotos && (
          <Fila etiqueta="Esquinas de las fotos" ayuda="Las fotos sueltas: la de la tarjeta Limpia o Editorial, las miniaturas y la de Nosotros.">
            <Opciones
              opciones={o.esquinasFotos}
              valor={efectiva.esquinasFotos}
              onChange={(esquinasFotos) => {
                actualizar({ esquinasFotos });
                enfocar("tarjetas", verTarjetas);
              }}
              columnas={3}
            />
          </Fila>
        )}
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
      </>
    ),
  };

  const panelDePortada = () =>
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
      ) : null;

  /**
   * La pantalla de una sección: siempre las mismas partes, en el mismo orden
   * (visible, diseño, fondo, de dónde sale lo que muestra). La portada suma su
   * editor de imágenes.
   */
  const panelDeSeccion = (tipo: string) => {
    const s = secciones.find((x) => x.tipo === tipo);
    const def = o.secciones.find((d) => d.tipo === tipo);
    if (!s || !def) return null;
    const datos = datosDeSeccion(tipo);
    return (
      <>
        <button
          type="button"
          onClick={() => setPanel("organizar")}
          className="-mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Organizar secciones
        </button>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div>
            <p className="text-sm font-medium">{def.fija ? "Siempre visible" : s.activa ? "Visible en el inicio" : "Oculta"}</p>
            <p className="text-xs text-muted-foreground">
              {def.fija ? "El catálogo no se puede apagar: es donde se compra." : "El orden se cambia en Organizar secciones."}
            </p>
          </div>
          <Switch
            checked={s.activa}
            disabled={def.fija}
            onCheckedChange={(activa) => cambiarSeccion(tipo, { activa })}
            aria-label={`Mostrar ${def.nombre}`}
          />
        </div>
        {datos.falta && s.activa && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">{datos.falta}</p>
        )}
        {tipo === "portada" ? (
          panelDePortada()
        ) : (
          <>
            {def.variantes.length > 1 && (
              <Fila etiqueta="Diseño" ayuda={ayudaDeSeccion(tipo)}>
                <Opciones opciones={def.variantes} valor={s.variante} onChange={(variante) => cambiarSeccion(tipo, { variante })} />
              </Fila>
            )}
            <Fila etiqueta="Fondo">
              <Opciones opciones={o.fondos} valor={s.fondo} onChange={(fondo) => cambiarSeccion(tipo, { fondo })} columnas={3} />
            </Fila>
            <div className="space-y-1.5 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
              <p className="text-sm font-medium text-foreground">Contenido</p>
              <p>{datos.origen}</p>
              {datos.enlace && (
                <a
                  href={datos.enlace.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {datos.enlace.texto} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </>
        )}
      </>
    );
  };

  // La vista previa: la tercera columna del avanzado y la segunda del simple.
  const vistaPrevia = (
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
  );
  const anchoCompleto = { width: anchoVentana - 2 * MARGEN_PANTALLA, marginLeft: `calc(50% - ${anchoVentana / 2 - MARGEN_PANTALLA}px)` };

  if (modo === "simple") {
    return (
      <div
        style={anchoCompleto}
        className="grid gap-4 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] xl:h-[calc(100dvh-var(--alto-header)-1.5rem)] xl:min-h-[640px] xl:grid-rows-[minmax(0,1fr)]">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-border px-5 pb-4 pt-5">
            <h2 className="text-xl font-semibold tracking-tight">Diseñá tu tienda</h2>
            <p className="mt-1 text-xs text-muted-foreground">Tres pasos y listo. Todo se ve en la vista previa antes de guardar.</p>
          </div>
          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-5">
            <Paso numero={1} titulo="Elegí un diseño" ayuda="Un punto de partida armado para tu tipo de negocio.">
              {paneles.inicio()}
            </Paso>
            <Paso numero={2} titulo="Colores" ayuda="Armados para que todo se lea bien.">
              {selectorDePaletas()}
            </Paso>
            <Paso numero={3} titulo="Letra">
              <Opciones opciones={o.tipografias} valor={efectiva.tipografia} onChange={(tipografia) => actualizar({ tipografia })} />
            </Paso>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
            <span className="text-xs text-muted-foreground">Formas, encabezado, secciones y animaciones:</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 flex-none gap-1 text-xs font-semibold"
              onClick={() => setModo("avanzado")}
            >
              Personalizar a fondo <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
        {vistaPrevia}
      </div>
    );
  }

  return (
    <>
      {/* Tres columnas en pantallas grandes, con el alto de la ventana: cada
          una baja por su cuenta. Más angosto, el menú pasa arriba en una fila. */}
      <div
        style={anchoCompleto}
        className="grid gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] xl:h-[calc(100dvh-var(--alto-header)-1.5rem)] xl:min-h-[640px] xl:grid-cols-[240px_minmax(0,420px)_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]">
        {/* ---- 1. Qué personalizar */}
        <Card className="flex min-h-0 flex-col p-2 lg:col-span-2 xl:col-span-1 xl:overflow-y-auto xl:p-4">
          <div className="mb-3 hidden border-b border-border px-1 pb-4 xl:block">
            <h2 className="text-lg font-semibold tracking-tight">Personalizá tu web</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Elegí qué querés modificar</p>
          </div>
          <button
            type="button"
            onClick={() => setModo("simple")}
            className="mb-2 flex flex-none items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Volver al modo simple
          </button>
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
                      onClick={() => (it.id.startsWith("seccion:") ? abrirSeccion(it.id.slice("seccion:".length)) : setPanel(it.id))}
                      disabled={!libre}
                      aria-current={activo ? "page" : undefined}
                      title={libre ? it.resumen : `${tema.nombre} no se personaliza`}
                      className={`relative flex flex-none items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        it.seccion ? "xl:ml-3 xl:py-1.5 xl:text-[13px]" : "xl:py-2.5"
                      } ${activo ? "bg-primary/10 font-semibold text-primary" : it.oculta ? "text-muted-foreground/60 hover:bg-muted" : "text-foreground/80 hover:bg-muted"}`}
                    >
                      {activo && <span aria-hidden className="absolute -left-4 bottom-1.5 top-1.5 hidden w-[3px] rounded-r-full bg-primary xl:block" />}
                      <it.icono className="h-4 w-4 flex-none" />
                      <span className="flex-1 text-left">
                        {it.titulo}
                        {it.oculta && <span className="ml-1 text-[11px] font-normal">(oculta)</span>}
                      </span>
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
            {actual.id.startsWith("seccion:") ? panelDeSeccion(actual.id.slice("seccion:".length)) : paneles[actual.id as PanelFijo]()}
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

        {vistaPrevia}
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

/** Un paso numerado del modo simple. */
function Paso({ numero, titulo, ayuda, children }: { numero: number; titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {numero}
        </span>
        <div>
          <h3 className="text-sm font-semibold">{titulo}</h3>
          {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
        </div>
      </div>
      {children}
    </section>
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
