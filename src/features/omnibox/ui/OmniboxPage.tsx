import { Fragment, useEffect, useReducer, useRef, useState } from "react";
import { BarChart3, History, SquarePen, Store, Volume2, VolumeX } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  useAnularVenta,
  useBajaProducto,
  useCambiarProducto,
  useCrearProductos,
  useEstadoPedido,
  useCambiarPrecios,
  useCobrar,
  useGenerarHerramienta,
  useFiltrarVista,
  useRegistrarCompra,
  useConfirmar,
  useDictar,
  useEstadoVoz,
  useIntenciones,
  useInterpretar,
  useLeerFactura,
  useVistasFijadas,
  guardarConversacion,
  traerConversacion,
} from "@/entities/omnibox/api";
import {
  esDeVenta,
  estadoDe,
  type BorradorProducto,
  type FichaRecurso,
  type ListaRecurso,
  type PedidoResumen,
  type CostoProducto,
  type HerramientaGenerada,
  type LineaContexto,
  type ProductoOpcion,
  type Propuesta,
  type VistaFijada,
  type VistaSpec,
} from "@/entities/omnibox/model/types";
import { useStore } from "@/app/providers/auth";
import { VendfyMark } from "@/shared/ui/VendfyLogo";
import { Drawer, DrawerContent, DrawerTitle } from "@/shared/ui/drawer";
import { cn } from "@/shared/lib/cn";

import { completar, mensajeDeEvento, mensajeDePrecios, mensajeDeVistaFijada, mensajeRespuestaGuia, nuevoMensaje, propuestaLocal, hora as horaDe, type Mensaje } from "../model/mensaje";
import type { CambioPrecio } from "../model/herramienta";
import { validarPropuesta } from "../model/herramienta";
import { memoriaDe } from "../model/memoria-chat";
import {
  camposDeFrase,
  completo,
  esConfirmacion,
  faltanProducto,
  formularioActivo,
  nuevoFormulario,
  nuevoFormularioProductos,
  precioDeFrase,
  resumenCompletado,
  titular,
  type Formulario,
} from "../model/formularios";
import { CrearEnChatContext } from "./formularios/crear-en-chat";
import { TarjetaProductosNuevos } from "./formularios/FormularioProductos";
import { useCreateCustomer } from "@/entities/customer";
import { respuestaAGuia, resumenRespuesta } from "../model/respuesta-guia";
import { fraseDeGuia, paraHablar } from "../model/voz";
import { useVozGuia } from "./guia/useVozGuia";
import { accionesReponer, diferenciasVista, resumenPiezas, type Reposicion } from "../model/vistas";
import type { AccionesVista } from "./vista/acciones";
import {
  ESPERA_GUARDADO,
  restaurarMensajes,
  restaurarMesa,
  serializarMensajes,
  serializarMesa,
} from "../model/conversacion";
import { PanelConversaciones } from "./conversaciones/PanelConversaciones";
import {
  MESA_INICIAL,
  costoSugerido,
  efectoDeVenta,
  facturaDe,
  type AccionMesa,
  type Mesa,
  marcarAplicados,
  mesaReducer,
  totalCompra,
  type MetodoPago,
  type TipoMesa,
} from "../model/mesa";
import { useDictado } from "../model/use-dictado";
import { crearCoreografia, efectosDeCambio } from "../model/coreografia";
import {
  errorDeCobro,
  errores,
  MENSAJES,
  nuevasAdvertencias,
  revisarCompra,
  revisarVenta,
  sigueVigente,
  type AccionGuia,
  type MensajeGuia,
} from "../model/guia";
import { brillar } from "./guia/brillar";
import { FranjaGuia } from "./guia/FranjaGuia";
import { Coreografo } from "./coreografia/Coreografo";
import { useSugerencias } from "./guia/useSugerencias";
import { apiFetch } from "@/shared/api/client";
import { Burbuja, FilaAsistente } from "./Burbuja";
import { Compositor } from "./Compositor";
import { Respuesta } from "./Respuesta";
import { ChipsEnCurso } from "./mesa/ChipsEnCurso";
import { PanelMesa } from "./mesa/PanelMesa";
import { TarjetaVenta } from "./mesa/TarjetaVenta";
import { TarjetaCompra } from "./mesa/TarjetaCompra";
import { PanelHerramienta } from "./herramienta/PanelHerramienta";
import { TarjetaPrecios } from "./herramienta/TarjetaPrecios";

/**
 * El asistente: un chat donde las respuestas son tarjetas, no párrafos.
 *
 * Se escribe (o se dicta) como se le hablaría a un empleado, y el sistema
 * contesta con la acción ya armada —foto, lo que va a quedar, el total, los
 * botones— que se confirma de un toque. La IA no ejecuta: la IA llena el
 * formulario, y lo que toca stock o dinero siempre pasa por la tarjeta.
 *
 * Es un chat porque así se entiende el ida y vuelta: qué pedí, qué me
 * contestó, qué quedó hecho. La versión anterior era un buscador con un
 * historial abajo y no se entendía qué respondía a qué.
 */
export function OmniboxPage() {
  const { selectedStore } = useStore();
  const tienda = selectedStore && selectedStore !== "all" ? selectedStore : null;
  const storeId = tienda?.id ?? null;

  const [texto, setTexto] = useState("");
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const mensajesRef = useRef(mensajes);
  mensajesRef.current = mensajes;
  const [ejecutandoId, setEjecutandoId] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  // La mesa de trabajo de la derecha. Vive acá y no en el panel porque el
  // chat también la modifica (Fase 3: "sumá 2 Absolut").
  const [mesa, despachar] = useReducer(mesaReducer, MESA_INICIAL);
  const ancho = useEsAncho();
  // La mesa de ESTE momento. Las respuestas del servidor llegan segundos
  // después de mandar la frase; leer `mesa` desde ese cierre sería leer el
  // carrito viejo ("sumá 2" y enseguida "cobrá" cobraría sin las 2).
  const mesaRef = useRef(mesa);
  mesaRef.current = mesa;

  /** Lo que viaja con cada frase: la venta abierta, sin fotos ni precios. */
  const contextoMesa = () => {
    const m = mesaRef.current;
    const lineas = (ls: { productId: string; nombre: string; cantidad: number }[]) =>
      ls.map((l) => ({ productId: l.productId, nombre: l.nombre, cantidad: l.cantidad }));
    const analizando = m.abierta === "analisis" && m.analisis;
    return {
      // La que está a la vista; en el teléfono (panel cerrado), la última
      // con la que se trabajó: "que sean 3" es sobre esa.
      abierta: m.abierta === "venta" || m.abierta === "compra" ? m.abierta : m.ultima,
      venta: { lineas: lineas(m.venta.lineas) },
      compra: { lineas: lineas(m.compra.lineas) },
      // Con un análisis a la vista, "ahora por categoría" es sobre él (G4).
      ...(analizando ? { enPantalla: "analisis", vista: m.analisis!.vista } : {}),
      // La memoria corta (G6b): los últimos turnos y de quién se venía hablando.
      ...memoriaDe(mensajesRef.current),
      // El formulario de productos nuevos abierto (G7a): "el alcohol a 15" es para él.
      ...formularioProductosAbierto(),
      // La lista a la derecha (G9a): "solo las de QR" la refina. En el teléfono,
      // con el panel cerrado, la última que se abrió sigue siendo "esa".
      ...(m.lista && (m.abierta === "lista" || m.abierta === null)
        ? { enPantalla: "lista", lista: { recurso: m.lista.consulta.recurso, filtros: m.lista.consulta.filtros } }
        : {}),
    };
  };

  function formularioProductosAbierto() {
    const f = formularioActivo(mensajesRef.current)?.formulario;
    return f?.tipo === "productos" && f.estado === "abierto" ? { formulario: { tipo: "productos", productos: f.productos ?? [] } } : {};
  }
  // Con el panel al costado, chat y panel son dos columnas de alto fijo con
  // su propio scroll, como Claude o ChatGPT. Sin panel, la conversación usa el
  // scroll de la página (en el teléfono, un scroll dentro de otro se siente mal).
  const dividido = mesa.abierta !== null && ancho;
  const hilo = useRef<HTMLDivElement>(null);

  const cobrar = useCobrar();
  const anular = useAnularVenta();
  const generarHerramienta = useGenerarHerramienta();
  const filtrarVista = useFiltrarVista();
  const cambiarPrecios = useCambiarPrecios();
  const registrar = useRegistrarCompra();
  const [errorCompra, setErrorCompra] = useState<string | null>(null);
  const [errorCobro, setErrorCobro] = useState<string | null>(null);
  const [anulandoId, setAnulandoId] = useState<string | null>(null);

  // ------------------------------------------------------------ la Guía (G0)
  // Un solo mensaje a la vez. `luego`: lo que estaba por hacerse cuando la
  // Guía lo frenó ("cobrá" sin método): al resolverlo, se hace solo.
  const [guia, setGuia] = useState<{ mensaje: MensajeGuia; luego?: { cobrar: { mensajeId?: string } } } | null>(null);
  const guiaRef = useRef(guia);
  guiaRef.current = guia;

  // G2b: la última frase fue dictada (la Guía contesta hablando) y la voz.
  const porVoz = useRef(false);
  const [conversaPorVoz, setConversaPorVoz] = useState(false);
  const vozGuia = useVozGuia();

  // La coreografía: qué se tiene que VER cuando cambia la mesa. En G0 los
  // efectos ya se calculan y se emiten; la Fase G1 los dibuja.
  const coreografia = useRef(crearCoreografia()).current;
  const mesaPrevia = useRef(mesa);
  // De dónde vino el último cambio de la mesa: los tips del modo aprendiz
  // enseñan a decir lo que se hizo tocando ("también podés decir…").
  // "restaurar": se abrió una conversación guardada (G5); la mesa vuelve como
  // estaba, sin animaciones ni consejos (no es algo que se acabe de hacer).
  const origenCambio = useRef<"panel" | "chat" | "guia" | "restaurar">("panel");
  useEffect(() => {
    const antes = mesaPrevia.current;
    mesaPrevia.current = mesa;
    const origen = origenCambio.current;
    origenCambio.current = "panel";
    if (origen === "restaurar") return;
    const efectos = efectosDeCambio(antes, mesa);
    coreografia.emitir(efectos);
    if (origen === "panel") {
      if (efectos.some((e) => e.tipo === "cantidad" && e.mesa === "venta")) {
        ayuda.agregarLocal(MENSAJES.tipDecirCantidad());
      }
      const lineasCompra = mesa.compra.lineas.length;
      if (efectos.some((e) => e.tipo === "lineaEntra" && e.mesa === "compra") && lineasCompra >= 3 && !mesa.compra.adjunto) {
        ayuda.agregarLocal(MENSAJES.tipFotoFactura());
      }
    }
    // "Cobrá" quedó esperando el método de pago: apenas se elige —desde la
    // Guía o tocando el panel, que en el teléfono la tapa— se cobra. La
    // persona ya había pedido cobrar; elegir el método es contestar.
    const pendiente = guiaRef.current;
    if (pendiente?.luego?.cobrar && mesa.venta.pago && !antes.venta.pago) {
      setGuia(null);
      cobrarVenta({ mensajeId: pendiente.luego.cobrar.mensajeId, pago: mesa.venta.pago });
      return;
    }
    // La Guía calla sola cuando lo que decía ya se arregló. Lo que respondió
    // el servidor vale hasta que se toca el borrador de esa mesa.
    setGuia((g) => {
      if (!g) return g;
      const m = g.mensaje;
      if (m.codigo === "SERVIDOR") {
        const tocado = m.mesa === "venta" ? antes.venta !== mesa.venta : antes.compra !== mesa.compra;
        return tocado ? null : g;
      }
      return sigueVigente(m, mesa.venta, mesa.compra) ? g : null;
    });
  }, [mesa, coreografia]);

  /** Llevar la vista al campo del problema y hacerlo brillar. */
  function senalar(m: MensajeGuia, campo = m.campo) {
    if (!campo) return;
    if (campo.startsWith("renglon:")) {
      // Los renglones de la factura están en el chat: en el teléfono, la hoja
      // del panel los taparía.
      if (!ancho) despachar({ tipo: "cerrar" });
    } else {
      despachar({ tipo: "abrir", mesa: m.mesa, pestana: "borrador" });
    }
    void brillar(campo, m.nivel);
  }

  /**
   * Que la Guía diga algo. Los errores señalan su campo solos; las
   * advertencias no se roban el foco (tienen su botón "Ver").
   * Una advertencia no pisa un error que todavía espera respuesta.
   */
  function avisar(mensaje: MensajeGuia, opciones: { luego?: { cobrar: { mensajeId?: string } }; senalar?: boolean } = {}) {
    const actual = guiaRef.current;
    if (mensaje.nivel === "advertencia" && actual?.mensaje.nivel === "error") return;
    setGuia({ mensaje, luego: opciones.luego });
    if (opciones.senalar ?? mensaje.nivel === "error") senalar(mensaje);
  }

  /** El último costo pagado por un producto (para "Cargar compra" desde la venta). */
  async function ultimoCosto(productId: string): Promise<{ costo: number; anterior: number | null }> {
    try {
      const r = await apiFetch<{ costo: CostoProducto | null }>(`/api/omnibox/producto/${productId}?storeId=${storeId}`);
      const c = r.data?.costo ?? null;
      return { costo: costoSugerido(null, c), anterior: c?.ultimoCosto ?? null };
    } catch {
      return { costo: 0, anterior: null };
    }
  }

  /**
   * Lo que resuelve el mensaje que está a la vista: un error o advertencia
   * (catálogo fijo) o una sugerencia. Las acciones despachan lo mismo que
   * los botones del panel; ninguna cobra ni registra sola.
   */
  async function alAccionGuia(a: AccionGuia, objetivo?: MensajeGuia | null) {
    const fija = guiaRef.current?.mensaje ?? null;
    // `objetivo`: el mensaje al que se contestó hablando o escribiendo (G2b);
    // en ese momento la franja puede estar escondida (se estaba escribiendo).
    const m = objetivo ?? fija ?? ayuda.actual;
    if (!m) return;
    const sugerencia = m === fija ? null : m;
    if (a.tipo === "ver") {
      senalar(m, a.campo);
      return;
    }
    if (a.tipo === "descartar") {
      if (sugerencia) ayuda.resolver(sugerencia, "descartada");
      else setGuia(null);
      return;
    }
    origenCambio.current = "guia";
    switch (a.tipo) {
      case "pago":
        // Elegir el pago desde la Guía es lo mismo que tocarlo en el panel:
        // si se venía cobrando, el efecto de la mesa completa el cobro.
        despachar({ tipo: "pago", pago: a.pago });
        break;
      case "cantidad":
        despachar(
          a.mesa === "venta"
            ? { tipo: "cantidadVenta", productId: a.productId, cantidad: a.cantidad }
            : { tipo: "cantidadCompra", productId: a.productId, cantidad: a.cantidad },
        );
        break;
      case "precio":
        despachar({ tipo: "precioVenta", productId: a.productId, precio: a.precio });
        break;
      case "agregar":
        despachar({ tipo: "agregarVenta", producto: a.producto, cantidad: a.cantidad });
        if (ancho) despachar({ tipo: "abrir", mesa: "venta", pestana: "borrador" });
        break;
      case "comprar": {
        // D3: "No tenés stock, ¿querés agregar?" → la compra con el producto.
        const costo = a.costo != null ? { costo: a.costo, anterior: a.costoAnterior } : await ultimoCosto(a.producto.productId);
        origenCambio.current = "guia";
        despachar({ tipo: "agregarCompra", producto: a.producto, cantidad: a.cantidad, costo: costo.costo, costoAnterior: costo.anterior });
        despachar({ tipo: "abrir", mesa: "compra", pestana: "borrador" });
        break;
      }
      case "proveedor":
        despachar({ tipo: "proveedor", proveedor: a.proveedor });
        break;
      case "verProducto":
        despachar({ tipo: "verProducto", producto: a.producto });
        break;
    }
    if (sugerencia) ayuda.resolver(sugerencia, "aceptada");
    else if (a.tipo !== "pago") setGuia(null);
  }

  /** Las advertencias que trae un cambio que vino del chat (no se estaba mirando el panel). */
  function anunciarAdvertencias(antes: Mesa, acciones: AccionMesa[]) {
    const despues = acciones.reduce(mesaReducer, antes);
    const revisar = (m: Mesa) => [...revisarVenta(m.venta), ...revisarCompra(m.compra)];
    const nueva = nuevasAdvertencias(revisar(antes), revisar(despues))[0];
    if (nueva) avisar(nueva, { senalar: false });
  }

  const { data: intenciones } = useIntenciones();
  const { data: estadoVoz, isLoading: consultandoVoz } = useEstadoVoz();
  const interpretar = useInterpretar();
  const confirmar = useConfirmar();
  const dictar = useDictar();
  const leer = useLeerFactura();
  // El archivo de cada factura, para "Reintentar" sin tener que elegirlo de nuevo.
  const facturas = useRef(new Map<string, File>());

  // Los ejemplos salen del catálogo del backend, no de una lista escrita acá:
  // una intención nueva aparece sola en las sugerencias.
  const sugerencias = (intenciones ?? [])
    .filter((i) => i.disponible && i.id !== "cambiar_vista")
    .map((i) => i.ejemplos[0])
    .filter(Boolean)
    .slice(0, 5);

  const actualizar = (id: string, f: (m: Mensaje) => Mensaje) =>
    setMensajes((prev) => prev.map((m) => (m.id === id ? f(m) : m)));

  // Bajar hasta lo último cuando llega algo nuevo o cuando una respuesta
  // termina de pensar. NO cuando se confirma una tarjeta de más arriba: ahí
  // la persona está mirando esa, y saltar al fondo la haría perderla.
  //
  // Se desplaza la PÁGINA y no un contenedor: la conversación vive en el
  // scroll del documento, con el header y el campo pegados arriba y abajo.
  // Un scroll adentro de otro scroll es lo que en el teléfono se siente mal.
  const ultimo = mensajes[mensajes.length - 1];

  // El campo cambia de lugar (del centro a abajo) con el primer mensaje, y al
  // montarse de nuevo pierde el foco. Se lo devuelve para poder seguir
  // escribiendo sin tocar la pantalla.
  const conversando = mensajes.length > 0;
  useEffect(() => {
    if (conversando) campo.current?.focus();
  }, [conversando]);

  useEffect(() => {
    if (mensajes.length === 0) return;
    if (dividido && hilo.current) {
      hilo.current.scrollTo({ top: hilo.current.scrollHeight, behavior: "smooth" });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    }
  }, [mensajes.length, ultimo?.fase, dividido]);

  // ------------------------------------------------------------ preguntar

  async function interpretarEn(id: string, consulta: string) {
    if (!storeId) return;
    try {
      const propuesta = await interpretar.mutateAsync({ texto: consulta, storeId, contexto: contextoMesa() });
      actualizar(id, (m) => ({ ...m, fase: "listo", propuesta: propuesta! }));
      if (propuesta?.agente) return desplegarAgente(id, propuesta);
      if (propuesta && esDeVenta(propuesta)) aplicarVenta(id, propuesta);
      if (propuesta?.vista) mostrarAnalisis(id, consulta, propuesta);
      if (propuesta?.intencion === "simular") armarHerramienta(id, consulta);
      if (propuesta) abrirFormularioSiFalta(id, propuesta);
    } catch (error: any) {
      actualizar(id, (m) => ({
        ...m,
        fase: "error",
        error: error?.message ?? "No pude procesarlo. Revisá tu conexión.",
      }));
    }
  }

  function enviar() {
    const consulta = texto.trim();
    if (!consulta || !storeId) return;
    setTexto("");
    porVoz.current = false;
    setConversaPorVoz(false);
    vozGuia.callar();
    if (responderFormulario(consulta, false)) return;
    if (responderGuia(consulta, false)) return;
    const m = nuevoMensaje(consulta, false);
    setMensajes((prev) => [...prev, m]);
    interpretarEn(m.id, consulta);
  }

  function reintentar(m: Mensaje) {
    const archivo = facturas.current.get(m.id);
    if (archivo) {
      actualizar(m.id, (x) => ({ ...x, fase: "pensando", error: undefined }));
      leerEn(m.id, archivo);
      return;
    }
    if (!m.texto) return;
    actualizar(m.id, (x) => ({ ...x, fase: "pensando", error: undefined }));
    interpretarEn(m.id, m.texto);
  }

  /**
   * El dictado entrega el audio; el servidor transcribe E interpreta en una
   * sola llamada, porque es el único que conoce el catálogo y puede sesgar el
   * reconocimiento hacia los nombres de ESTA tienda.
   *
   * La burbuja aparece en el acto, con "Transcribiendo…": sin eso, soltar el
   * botón y no ver nada durante tres segundos parece que no anduvo.
   */
  const voz = useDictado(async (audio) => {
    if (!storeId) return;
    porVoz.current = true;
    setConversaPorVoz(true);
    const m = nuevoMensaje(null, true);
    setMensajes((prev) => [...prev, m]);
    try {
      const r = await dictar.mutateAsync({ audio, storeId, contexto: contextoMesa() });
      const dicho = r?.transcripcion.texto?.trim();
      if (!dicho) {
        setMensajes((prev) => prev.filter((x) => x.id !== m.id));
        toast.info("No se entendió nada. Probá de nuevo, más cerca del micrófono.");
        return;
      }
      // "Su teléfono 7189…" completa el formulario que está esperando (G6b).
      if (formularioActivo(mensajesRef.current) && camposOConfirmacion(dicho)) {
        setMensajes((prev) => prev.filter((x) => x.id !== m.id));
        responderFormulario(dicho, true);
        return;
      }
      // "Seis", "con QR", "sí": contestarle a la Guía gana sobre lo que
      // entendió el servidor (que no sabe qué preguntó la Guía).
      const pendiente = guiaRef.current?.mensaje ?? candidataRef.current;
      const respuesta = respuestaAGuia(dicho, pendiente);
      if (respuesta && pendiente) {
        const resumen = resumenRespuesta(respuesta);
        actualizar(m.id, (x) => ({ ...mensajeRespuestaGuia(dicho, true, resumen), id: x.id, hora: x.hora }));
        void alAccionGuia(respuesta, pendiente);
        vozGuia.hablar(paraHablar(resumen));
        return;
      }
      actualizar(m.id, (x) =>
        r!.propuesta
          ? { ...x, texto: dicho, fase: "listo", propuesta: r!.propuesta }
          : { ...x, texto: dicho, fase: "error", error: "Te escuché, pero no entendí qué querés hacer." },
      );
      const p = r!.propuesta;
      if (p?.agente) {
        desplegarAgente(m.id, p);
        vozGuia.hablar(paraHablar(p.agente.texto));
        return;
      }
      if (p && esDeVenta(p)) aplicarVenta(m.id, p);
      if (p?.vista) mostrarAnalisis(m.id, dicho, p);
      if (p?.intencion === "simular") armarHerramienta(m.id, dicho);
      if (p) abrirFormularioSiFalta(m.id, p);
      vozGuia.hablar(fraseDeRespuesta(p));
    } catch (error: any) {
      const motivo = error?.message ?? "No se pudo procesar el dictado.";
      actualizar(m.id, (x) => ({
        ...x,
        fase: "error",
        error: motivo,
      }));
      vozGuia.hablar(paraHablar(motivo));
    } finally {
      voz.cancelar();
    }
  });

  // ------------------------------------------------------------ análisis (G3)

  /**
   * Una pregunta de análisis se responde con una vista: se abre en el panel
   * (también en el teléfono: la vista ES la respuesta). Volver a abrir la de
   * un mensaje que ya está en la pestaña la deja como estaba, con su período.
   */
  function mostrarAnalisis(id: string, pregunta: string, p: Propuesta) {
    if (!p.vista) return;
    const actual = mesaRef.current.analisis;
    if (actual?.mensajeId === id) {
      despachar({ tipo: "abrir", mesa: "analisis" });
      return;
    }
    // "Ahora por categoría" (G4): la tarjeta dice qué cambió, calculado y no
    // contado por el modelo; la conclusión sabe de qué se venía hablando.
    const e = p.entidades as { cambios?: string[]; pregunta?: string };
    const cambio = p.intencion === "cambiar_vista" && actual && e.cambios === undefined;
    const contexto = cambio ? `${actual.pregunta} → ${pregunta}` : (e.pregunta ?? pregunta);
    if (cambio) {
      const cambios = diferenciasVista(actual.vista, p.vista);
      actualizar(id, (m) =>
        m.propuesta ? { ...m, propuesta: { ...m.propuesta, entidades: { ...m.propuesta.entidades, cambios, pregunta: contexto } } } : m,
      );
    }
    despachar({ tipo: "analizar", analisis: { mensajeId: id, pregunta: contexto, vista: p.vista } });
  }

  /** Una vista del tablero: queda en el hilo y se abre con los datos al día, sin IA. */
  function abrirFijada(f: VistaFijada) {
    const m = mensajeDeVistaFijada(f);
    setMensajes((prev) => [...prev, m]);
    despachar({ tipo: "analizar", analisis: { mensajeId: m.id, pregunta: f.pregunta || f.nombre, vista: f.vista } });
  }

  // ------------------------------------------------------------ formularios conversacionales (G6b)

  const crearCliente = useCreateCustomer();

  /** Uno solo activo: abrir uno descarta los que quedaron abiertos. */
  function abrirFormulario(id: string, f: Formulario) {
    setMensajes((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, formulario: f }
          : x.formulario?.estado === "abierto"
            ? { ...x, formulario: { ...x.formulario, estado: "descartado" } }
            : x,
      ),
    );
  }

  /** "Es para Edwin" y no hay ningún Edwin: el "Nuevo cliente" queda esperando su teléfono. */
  function abrirFormularioSiFalta(id: string, p: Propuesta) {
    if (estadoDe(p) === "elegir-cliente" && (p.clientes?.length ?? 0) === 0) {
      abrirFormulario(id, nuevoFormulario("cliente", { nombre: titular(String(p.entidades.nombre ?? "")) }));
    }
    // Un código de barras que la tienda no tiene (G7c): el formulario, lleno con lo que dijo el catálogo.
    if (estadoDe(p) === "productos-nuevos") {
      abrirFormulario(id, nuevoFormularioProductos(((p.entidades as any).productos ?? []) as BorradorProducto[]));
      abrirProductosEnPanel(id);
    }
  }

  function campoFormulario(id: string, campos: Record<string, string>) {
    actualizar(id, (x) => (x.formulario ? { ...x, formulario: { ...x.formulario, campos: { ...x.formulario.campos, ...campos }, error: undefined } } : x));
  }

  /** Crea el cliente y sigue con lo que se estaba haciendo (la venta queda para él). */
  async function crearDesdeFormulario(id: string) {
    const m = mensajesRef.current.find((x) => x.id === id);
    const f = m?.formulario;
    if (!m || !f || !completo(f) || f.estado === "creando") return;
    actualizar(id, (x) => ({ ...x, formulario: { ...x.formulario!, estado: "creando", error: undefined } }));
    try {
      const c = await crearCliente.mutateAsync({
        name: f.campos.nombre.trim(),
        phone: f.campos.telefono.replace(/\D/g, ""),
        ...(f.campos.email ? { email: f.campos.email } : {}),
      } as any);
      actualizar(id, (x) => ({ ...x, formulario: { ...x.formulario!, estado: "creado", creado: { id: c!.id, nombre: c!.name } } }));
      // "Creá el cliente Marta" (G7b) es solo crearlo; "es para Edwin" además lo pone en la venta.
      if (m.propuesta?.intencion !== "crear_cliente") {
        elegirCliente(mensajesRef.current.find((x) => x.id === id) ?? m, { id: c!.id, nombre: c!.name });
      }
    } catch (error: any) {
      actualizar(id, (x) => ({ ...x, formulario: { ...x.formulario!, estado: "abierto", error: error?.message ?? "No se pudo crear el cliente" } }));
    }
  }

  /** ¿La frase es para el formulario activo? (algún dato, o "crealo" con todo completo). */
  function camposOConfirmacion(frase: string): boolean {
    const f = formularioActivo(mensajesRef.current)?.formulario;
    if (!f || f.estado !== "abierto") return false;
    if (f.tipo === "productos") return (completo(f) && esConfirmacion(frase)) || precioLocal(f, frase) != null;
    return Object.keys(camposDeFrase(f.tipo, frase)).length > 0 || (completo(f) && esConfirmacion(frase));
  }

  /** "A 15" con UN solo producto sin precio: se anota sin ir al servidor (lo demás lo entiende el agente). */
  function precioLocal(f: Formulario, frase: string): { indice: number; precio: number } | null {
    const lista = f.productos ?? [];
    const sinPrecio = lista.map((b, i) => ({ b, i })).filter(({ b }) => faltanProducto(b).includes("precio"));
    const precio = precioDeFrase(frase);
    // De lo comprado sin costo, el número suelto es lo que costó (G9b): lo
    // resuelve el servidor, que con el costo sugiere el precio.
    if (sinPrecio.length === 1 && sinPrecio[0].b.compra && !sinPrecio[0].b.compra.costo) return null;
    return precio != null && sinPrecio.length === 1 ? { indice: sinPrecio[0].i, precio } : null;
  }

  /**
   * La frase completa el formulario activo, sin ir al servidor: "su teléfono
   * 71890031" llena el teléfono de Edwin y nada más. true si la usó.
   */
  function responderFormulario(frase: string, dictada: boolean): boolean {
    const activo = formularioActivo(mensajesRef.current);
    const f = activo?.formulario;
    if (!activo || !f || f.estado !== "abierto") return false;
    if (f.tipo === "productos") {
      const lista = f.productos ?? [];
      if (completo(f) && esConfirmacion(frase)) {
        const aviso = lista.length === 1 ? `Creando ${lista[0].nombre}…` : `Creando ${lista.length} productos…`;
        setMensajes((prev) => [...prev, mensajeRespuestaGuia(frase, dictada, aviso)]);
        void crearProductos(activo.id);
        return true;
      }
      const local = precioLocal(f, frase);
      // Varios productos, nombres, categorías: lo entiende el agente, con el formulario a la vista.
      if (!local) return false;
      const productos = lista.map((b, i) => (i === local.indice ? { ...b, precio: local.precio } : b));
      cambiarProductos(activo.id, productos);
      const resumen = resumenCompletado({ ...f, productos }, {});
      setMensajes((prev) => [...prev, mensajeRespuestaGuia(frase, dictada, resumen)]);
      if (dictada) vozGuia.hablar(paraHablar(resumen));
      return true;
    }
    if (completo(f) && esConfirmacion(frase)) {
      setMensajes((prev) => [...prev, mensajeRespuestaGuia(frase, dictada, `Creando el cliente ${f.campos.nombre}…`)]);
      void crearDesdeFormulario(activo.id);
      return true;
    }
    const nuevos = camposDeFrase(f.tipo, frase);
    if (!Object.keys(nuevos).length) return false;
    campoFormulario(activo.id, nuevos);
    const resumen = resumenCompletado(f, nuevos);
    setMensajes((prev) => [...prev, mensajeRespuestaGuia(frase, dictada, resumen)]);
    if (dictada) vozGuia.hablar(paraHablar(resumen));
    return true;
  }

  // ------------------------------------------------------------ el agente y los productos (G7)

  /**
   * La respuesta del agente (G7b): su texto queda en el mensaje de la frase y
   * cada tarjeta que preparó entra como un mensaje más del hilo (sin burbuja),
   * con todo lo que ya sabe hacer cualquier tarjeta: la compra se carga, el
   * análisis se abre, el formulario espera. Completar el formulario abierto no
   * es una tarjeta: cambia el que está.
   */
  function desplegarAgente(id: string, p: Propuesta) {
    const nuevos: Mensaje[] = [];
    for (const a of p.agente?.acciones ?? []) {
      const e = a.entidades as Record<string, any>;
      if (a.intencion === "completar_formulario") {
        const activo = formularioActivo(mensajesRef.current);
        if (activo?.formulario?.tipo === "productos") {
          cambiarProductos(activo.id, (e.productos ?? []) as BorradorProducto[], e.margen ?? undefined);
          continue;
        }
        // Sin formulario abierto (se descartó), es uno nuevo.
        nuevos.push({ ...mensajeDeAccion({ ...a, intencion: "crear_producto" }), formulario: nuevoFormularioProductos(e.productos ?? [], e.margen ?? null) });
        continue;
      }
      if (a.intencion === "cambiar_precios") {
        const precios = { tipo: "precios" as const, cambios: (e.cambios ?? []) as CambioPrecio[], motivo: String(e.motivo ?? "") };
        nuevos.push(mensajeDePrecios(precios, { mensajeId: id, titulo: "el asistente" }));
        continue;
      }
      const m = mensajeDeAccion(a);
      if (a.intencion === "crear_producto") m.formulario = nuevoFormularioProductos((e.productos ?? []) as BorradorProducto[], e.margen ?? null);
      if (a.intencion === "crear_cliente") {
        m.formulario = nuevoFormulario("cliente", { nombre: titular(String(e.nombre ?? "")), telefono: String(e.telefono ?? "") });
      }
      nuevos.push(m);
    }
    if (!nuevos.length) return;
    const traeFormulario = nuevos.some((n) => n.formulario);
    setMensajes((prev) => {
      // Uno solo activo: el que llega deja descartado al que estaba abierto.
      const previos = traeFormulario
        ? prev.map((x) => (x.formulario?.estado === "abierto" ? { ...x, formulario: { ...x.formulario, estado: "descartado" as const } } : x))
        : prev;
      const i = previos.findIndex((x) => x.id === id);
      return i < 0 ? [...previos, ...nuevos] : [...previos.slice(0, i + 1), ...nuevos, ...previos.slice(i + 1)];
    });
    for (const n of nuevos) {
      const a = n.propuesta;
      if (!a) continue;
      if (esDeVenta(a)) aplicarVenta(n.id, a);
      if (a.vista) mostrarAnalisis(n.id, String((a.entidades as any).pregunta ?? ""), a);
      // G9a: lo que se pidió ver, a la derecha (en el teléfono sube la hoja).
      if (a.intencion === "lista" || a.intencion === "ficha") abrirRecurso(n);
      // G9b: los productos nuevos se arman a la derecha.
      if (n.formulario?.tipo === "productos") abrirProductosEnPanel(n.id);
    }
  }

  /** Una lista o una ficha del chat (G9a), a la derecha. */
  function abrirRecurso(m: Mensaje) {
    const e = (m.propuesta?.entidades ?? {}) as { lista?: ListaRecurso; ficha?: FichaRecurso };
    if (e.lista) {
      despachar({ tipo: "abrirLista", lista: { mensajeId: m.id, titulo: e.lista.titulo, consulta: e.lista.consulta } });
    } else if (e.ficha) {
      despachar({ tipo: "abrirFicha", ficha: { recurso: e.ficha.recurso, id: e.ficha.id, titulo: e.ficha.titulo, desdeLista: false } });
    }
  }

  /** Si la lista o la ficha de este mensaje es la que está a la vista. */
  function recursoAbierto(m: Mensaje): boolean {
    const e = (m.propuesta?.entidades ?? {}) as { lista?: ListaRecurso; ficha?: FichaRecurso };
    if (e.lista) return mesa.abierta === "lista" && mesa.lista?.mensajeId === m.id;
    if (e.ficha) return mesa.abierta === "ficha" && mesa.ficha?.id === e.ficha.id;
    return false;
  }

  function mensajeDeAccion(a: Propuesta): Mensaje {
    return { id: crypto.randomUUID(), texto: null, porVoz: false, hora: new Date(), fase: "listo", propuesta: a };
  }

  function cambiarProductos(id: string, productos: BorradorProducto[], margen?: number) {
    actualizar(id, (x) => (x.formulario ? { ...x, formulario: { ...x.formulario, productos, error: undefined, ...(margen ? { margen } : {}) } } : x));
  }

  /**
   * El formulario de productos nuevos a la derecha (G9b), en pantalla ancha:
   * se ve cómo se arman mientras se conversa. En el teléfono queda en el
   * chat (una hoja encima taparía la conversación que lo está llenando).
   */
  function abrirProductosEnPanel(mensajeId: string) {
    if (ancho) despachar({ tipo: "abrirProductos", mensajeId });
  }

  const crearProductosApi = useCrearProductos();

  /**
   * Crea los productos del formulario. Si se dijo que se compraron, quedan
   * cargados en la compra (con la cantidad y el costo, o 1 para revisar):
   * el stock y el costo entran por la compra, como siempre, no a mano.
   */
  async function crearProductos(id: string) {
    const f = mensajesRef.current.find((x) => x.id === id)?.formulario;
    if (!storeId || !f || f.tipo !== "productos" || !completo(f) || f.estado === "creando") return;
    actualizar(id, (x) => ({ ...x, formulario: { ...x.formulario!, estado: "creando", error: undefined } }));
    try {
      const r = await crearProductosApi.mutateAsync({ storeId, productos: f.productos ?? [] });
      actualizar(id, (x) => ({ ...x, formulario: { ...x.formulario!, estado: "creado", creados: r.creados } }));
      // Creados: el formulario ya no se arma a la derecha (G9b). Si van a la
      // compra o a la venta, el panel pasa ahí; si no, se cierra y queda el
      // resumen en el chat.
      if (mesaRef.current.abierta === "productos" && mesaRef.current.productos?.mensajeId === id) despachar({ tipo: "cerrar" });
      // "Vendé un mouse" y no existía: ya creado, va a la venta.
      const vendidos = r.creados.filter((c) => c.venta?.cantidad);
      if (vendidos.length) {
        origenCambio.current = "chat";
        for (const c of vendidos) despachar({ tipo: "agregarVenta", producto: c, cantidad: c.venta!.cantidad });
        if (ancho) despachar({ tipo: "abrir", mesa: "venta", pestana: "borrador" });
        const resumen = `Agregado a la venta: ${vendidos.map((c) => `${c.venta!.cantidad} × ${c.nombre}`).join(", ")}.`;
        setMensajes((prev) => [...prev, { ...mensajeDeAccion(propuestaLocal("agregar_a_venta", { titulo: "Venta" })), desenlace: { tipo: "mesa", resumen } }]);
      }
      const comprados = r.creados.filter((c) => c.compra);
      if (comprados.length) {
        origenCambio.current = "chat";
        for (const c of comprados) {
          despachar({ tipo: "agregarCompra", producto: c, cantidad: c.compra!.cantidad ?? 1, costo: c.compra!.costo ?? 0, costoAnterior: null });
        }
        if (ancho) despachar({ tipo: "abrir", mesa: "compra", pestana: "borrador" });
        const sinDatos = comprados.filter((c) => !c.compra!.cantidad || !c.compra!.costo).map((c) => c.nombre);
        const resumen = `Cargué en la compra: ${comprados.map((c) => c.nombre).join(", ")}.${
          sinDatos.length ? ` Revisá cuántos compraste y a cuánto de ${sinDatos.join(", ")}.` : " Revisala y registrala."
        }`;
        setMensajes((prev) => [...prev, { ...mensajeDeAccion(propuestaLocal("agregar_a_compra", { titulo: "Compra" })), desenlace: { tipo: "mesa", resumen } }]);
      }
    } catch (error: any) {
      actualizar(id, (x) => ({ ...x, formulario: { ...x.formulario!, estado: "abierto", error: error?.message ?? "No se pudieron crear los productos" } }));
    }
  }

  /**
   * "Crear «mouse»" desde cualquier tarjeta (G7a): el formulario aparece en el
   * chat con el nombre puesto. Con la compra a la vista, ya va como comprado.
   */
  function crearProductoEnChat(nombre: string) {
    const borrador: BorradorProducto = {
      nombre: titular(nombre),
      precio: null,
      stock: null,
      categoria: null,
      codigo: null,
      marca: null,
      compra: mesaRef.current.abierta === "compra" ? { cantidad: null, costo: null } : null,
      existente: null,
    };
    const m: Mensaje = {
      ...mensajeDeAccion(propuestaLocal("crear_producto", { titulo: "Producto nuevo", entidades: { productos: [borrador] } })),
      formulario: nuevoFormularioProductos([borrador]),
    };
    setMensajes((prev) => [
      ...prev.map((x) => (x.formulario?.estado === "abierto" ? { ...x, formulario: { ...x.formulario, estado: "descartado" as const } } : x)),
      m,
    ]);
    abrirProductosEnPanel(m.id);
  }

  const cambiarProductoApi = useCambiarProducto();
  const bajaProductoApi = useBajaProducto();
  const estadoPedidoApi = useEstadoPedido();

  /** Confirmar la tarjeta que preparó el agente: cambiar o dar de baja un producto, mover un pedido. */
  async function confirmarAccion(m: Mensaje) {
    const p = m.propuesta;
    if (!storeId || !p) return;
    const e = p.entidades as Record<string, any>;
    setEjecutandoId(m.id);
    try {
      const r =
        p.intencion === "editar_producto"
          ? await cambiarProductoApi.mutateAsync({ storeId, productId: e.productId, cambios: e.cambios ?? {} })
          : p.intencion === "baja_producto"
            ? await bajaProductoApi.mutateAsync({ storeId, productId: e.productId })
            : await estadoPedidoApi.mutateAsync({ storeId, orderId: e.orderId, estado: e.estado });
      actualizar(m.id, (x) => ({ ...x, desenlace: { tipo: "hecho", resumen: r.resumen, despues: null, entidades: e } }));
    } catch (error: any) {
      toast.error(error?.message ?? "No se pudo hacer");
    } finally {
      setEjecutandoId(null);
    }
  }

  /** "Mover" un pedido de la lista: arma la tarjeta para confirmarlo (no lo mueve solo). */
  function moverPedido(pedido: PedidoResumen, estado: string) {
    const p = propuestaLocal("estado_pedido", {
      titulo: `Pedido #${pedido.numero}`,
      entidades: {
        orderId: pedido.orderId,
        numero: pedido.numero,
        estado,
        antes: pedido.estado,
        cliente: pedido.cliente,
        total: pedido.total,
        productos: pedido.productos,
      },
      requiereConfirmacion: true,
    });
    setMensajes((prev) => [...prev, mensajeDeAccion(p)]);
  }

  // ------------------------------------------------------------ herramientas a medida (G6)

  /**
   * "¿Qué pasa si…?": la herramienta se arma aparte (tarda) y su tarjeta
   * muestra el progreso. Lista, se abre en el panel; salvo que se esté
   * armando una venta o una compra: ahí no se le cambia la mesa a nadie y
   * queda el botón en la tarjeta.
   */
  async function armarHerramienta(id: string, pregunta: string) {
    if (!storeId) return;
    actualizar(id, (m) => ({ ...m, herramienta: { fase: "armando", desde: Date.now() } }));
    try {
      const g = await generarHerramienta.mutateAsync({ storeId, pregunta });
      actualizar(id, (m) => ({ ...m, herramienta: { fase: "lista", generada: g } }));
      const abierta = mesaRef.current.abierta;
      if (abierta === null || abierta === "analisis" || abierta === "herramienta") {
        despachar({ tipo: "usarHerramienta", herramienta: { mensajeId: id, titulo: g.titulo } });
      } else {
        toast.success(`Lista: ${g.titulo}`, { description: "La abrís desde su tarjeta en el chat." });
      }
      if (porVoz.current) vozGuia.hablar(paraHablar(`Listo: ${g.titulo}.`));
    } catch (error: any) {
      actualizar(id, (m) => ({ ...m, herramienta: { fase: "error", error: error?.message ?? "No se pudo armar." } }));
    }
  }

  /** La pregunta con que se pidió (la del servidor, si la entendió distinto de cómo se escribió). */
  const preguntaDe = (m: Mensaje) => String((m.propuesta?.entidades as { pregunta?: unknown } | undefined)?.pregunta ?? m.texto ?? "");

  function abrirHerramienta(m: Mensaje) {
    if (m.herramienta?.fase !== "lista") return;
    despachar({ tipo: "usarHerramienta", herramienta: { mensajeId: m.id, titulo: m.herramienta.generada.titulo } });
  }

  /** Se rompió aun corregida: sus mismos datos, como tablas de un análisis (sin IA). */
  function verDatosDeHerramienta(m: Mensaje, vista: VistaSpec) {
    despachar({ tipo: "analizar", analisis: { mensajeId: m.id, pregunta: preguntaDe(m), vista } });
  }

  /**
   * Lo que propuso una herramienta: se contrasta con sus datos y queda como
   * tarjeta N1 en el chat. Una sola pendiente por herramienta: apretar
   * "Aplicar" de nuevo (con otro %) reemplaza la anterior.
   */
  function proponerDesdeHerramienta(mensajeId: string, accion: unknown, g: HerramientaGenerada) {
    const r = validarPropuesta(accion, g.datos);
    if (r.error !== undefined) {
      toast.error(r.error);
      return;
    }
    setMensajes((prev) => [
      ...prev.filter((x) => !(x.precios?.estado === "pendiente" && x.precios.origen.mensajeId === mensajeId)),
      mensajeDePrecios(r.propuesta, { mensajeId, titulo: g.titulo }),
    ]);
    // En el teléfono el panel tapa el chat: se cierra para ver la tarjeta.
    if (!ancho) despachar({ tipo: "cerrar" });
  }

  async function confirmarPrecios(m: Mensaje) {
    if (!storeId || !m.precios) return;
    const cambios = m.precios.propuesta.cambios.map((c) => ({ productId: c.productId, precio: c.precio }));
    actualizar(m.id, (x) => ({ ...x, precios: { ...x.precios!, estado: "aplicando", error: undefined } }));
    try {
      const r = await cambiarPrecios.mutateAsync({ storeId, cambios });
      actualizar(m.id, (x) => ({ ...x, precios: { ...x.precios!, estado: "aplicado", resumen: r.resumen } }));
    } catch (error: any) {
      actualizar(m.id, (x) => ({
        ...x,
        precios: { ...x.precios!, estado: "error", error: error?.message ?? "No se pudieron cambiar los precios." },
      }));
    }
  }

  /**
   * Lo que un análisis hace afuera (G4). "Reponer" carga la compra con las
   * mismas acciones que los botones; viene de la vista, no de cargar a mano,
   * así que la Guía no sugiere "sacale una foto a la factura".
   */
  const accionesVista: AccionesVista = {
    verProducto: (producto) => despachar({ tipo: "verProducto", producto }),
    reponer: (items: Reposicion[]) => {
      const acciones = accionesReponer(items);
      anunciarAdvertencias(mesaRef.current, acciones);
      origenCambio.current = "guia";
      acciones.forEach(despachar);
    },
    enCompra: (ids) => ids.length > 0 && ids.every((id) => mesa.compra.lineas.some((l) => l.productId === id)),
    verCompra: () => despachar({ tipo: "abrir", mesa: "compra", pestana: "borrador" }),
    abrirFijada,
  };
  const { data: fijadas } = useVistasFijadas(storeId);

  // ------------------------------------------------------------ conversaciones guardadas (G5)
  // La conversación abierta vive en la URL (?c=<id>): recargar vuelve a la
  // misma. Se guarda sola, entera (mensajes + mesa), un rato después de cada
  // cambio; lo que quede pendiente se manda al cerrar la página.
  const [params, setParams] = useSearchParams();
  const conversacionId = params.get("c");
  const [tituloConversacion, setTituloConversacion] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<"guardando" | "guardado" | "error" | null>(null);
  const [verConversaciones, setVerConversaciones] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const qc = useQueryClient();
  /** La conversación cuyo estado está en pantalla (la de la URL, una vez abierta). */
  const cargada = useRef<string | null>(null);
  /** Lo último que se guardó, para no guardar dos veces lo mismo. */
  const ultimoGuardado = useRef("");
  const pendiente = useRef<{ id: string; cuerpo: { mensajes: unknown[]; mesa: unknown }; json: string } | null>(null);
  const temporizador = useRef<number | null>(null);

  async function guardarPendiente(keepalive = false) {
    if (temporizador.current) {
      window.clearTimeout(temporizador.current);
      temporizador.current = null;
    }
    const p = pendiente.current;
    if (!p || !storeId) return;
    pendiente.current = null;
    if (cargada.current === p.id) setGuardado("guardando");
    try {
      const r = await guardarConversacion(storeId, p.id, p.cuerpo, keepalive);
      ultimoGuardado.current = p.json;
      if (cargada.current === p.id) {
        setTituloConversacion(r.titulo);
        setGuardado("guardado");
      }
      void qc.invalidateQueries({ queryKey: ["omnibox", "conversaciones"] });
    } catch {
      // Se reintenta: con el próximo cambio, o solo en unos segundos.
      if (cargada.current === p.id) setGuardado("error");
      if (!pendiente.current) {
        pendiente.current = p;
        temporizador.current = window.setTimeout(() => void guardarPendiente(), 5_000);
      }
    }
  }

  useEffect(() => {
    if (!storeId || mensajes.length === 0) return;
    let id = conversacionId;
    if (!id) {
      // La primera frase de una conversación nueva le da su id (y su URL).
      const nuevo = crypto.randomUUID();
      id = nuevo;
      cargada.current = nuevo;
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          n.set("c", nuevo);
          return n;
        },
        { replace: true },
      );
    }
    if (cargada.current !== id) return; // todavía se está abriendo otra
    const cuerpo = { mensajes: serializarMensajes(mensajes), mesa: serializarMesa(mesa) };
    const json = JSON.stringify(cuerpo);
    if (json === ultimoGuardado.current) return;
    pendiente.current = { id, cuerpo, json };
    if (temporizador.current) window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => void guardarPendiente(), ESPERA_GUARDADO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensajes, mesa, conversacionId, storeId]);

  // Al cerrar o esconder la página, lo pendiente se manda igual.
  useEffect(() => {
    const alSalir = () => {
      if (pendiente.current) void guardarPendiente(true);
    };
    const alOcultar = () => document.visibilityState === "hidden" && alSalir();
    window.addEventListener("pagehide", alSalir);
    document.addEventListener("visibilitychange", alOcultar);
    return () => {
      window.removeEventListener("pagehide", alSalir);
      document.removeEventListener("visibilitychange", alOcultar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // Abrir la de la URL (al recargar, o al elegirla en la lista).
  useEffect(() => {
    if (!storeId || !conversacionId || cargada.current === conversacionId) return;
    let vigente = true;
    setAbriendo(true);
    void (async () => {
      await guardarPendiente(); // lo de la anterior, antes de cambiar
      try {
        const c = await traerConversacion(storeId, conversacionId);
        if (!vigente) return;
        const mensajesGuardados = restaurarMensajes(c.contenido);
        const mesaGuardada = restaurarMesa(c.mesa);
        cargada.current = c.id;
        ultimoGuardado.current = JSON.stringify({
          mensajes: serializarMensajes(mensajesGuardados),
          mesa: serializarMesa(mesaGuardada),
        });
        origenCambio.current = "restaurar";
        setGuia(null);
        vozGuia.callar();
        setMensajes(mensajesGuardados);
        despachar({ tipo: "restaurar", mesa: mesaGuardada });
        setTituloConversacion(c.titulo);
        setGuardado("guardado");
      } catch {
        if (!vigente) return;
        toast.error("Esa conversación no existe o ya se borró.");
        empezarNueva();
      } finally {
        if (vigente) setAbriendo(false);
      }
    })();
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversacionId, storeId]);

  /** Una conversación en blanco. La anterior queda guardada con su mesa. */
  function empezarNueva() {
    void guardarPendiente();
    cargada.current = null;
    ultimoGuardado.current = "";
    origenCambio.current = "restaurar";
    setGuia(null);
    vozGuia.callar();
    setMensajes([]);
    despachar({ tipo: "restaurar", mesa: MESA_INICIAL });
    setTituloConversacion(null);
    setGuardado(null);
    setVerConversaciones(false);
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.delete("c");
        return n;
      },
      { replace: false },
    );
  }

  function abrirConversacion(id: string) {
    setVerConversaciones(false);
    if (id === conversacionId) return;
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set("c", id);
        return n;
      },
      { replace: false },
    );
  }

  function alBorrarConversacion(id: string) {
    if (pendiente.current?.id === id) pendiente.current = null;
    if (id === conversacionId) {
      if (temporizador.current) window.clearTimeout(temporizador.current);
      empezarNueva();
    }
  }

  const panelDeConversaciones = storeId ? (
    <PanelConversaciones
      abierto={verConversaciones}
      onCerrar={() => setVerConversaciones(false)}
      storeId={storeId}
      actualId={conversacionId}
      onAbrir={abrirConversacion}
      onNueva={empezarNueva}
      onBorrada={alBorrarConversacion}
      onRenombrada={(id, titulo) => id === cargada.current && setTituloConversacion(titulo)}
    />
  ) : null;

  // ------------------------------------------------------------ factura (Fase 5)

  /**
   * Una foto o un PDF de la factura del proveedor. En el hilo aparece la foto
   * como lo que "dijo" la persona, y la respuesta es la compra armada: lo
   * reconocido ya cargado a la derecha, lo dudoso y lo nuevo para resolver.
   */
  function leerFactura(archivo: File) {
    if (!storeId) return;
    const esPdf = archivo.type === "application/pdf";
    if (!esPdf && !archivo.type.startsWith("image/")) {
      toast.error("Mandá una foto o un PDF de la factura.");
      return;
    }
    if (archivo.size > 10 * 1024 * 1024) {
      toast.error("El archivo pesa más de 10 MB. Probá con una foto más chica.");
      return;
    }
    const m: Mensaje = {
      ...nuevoMensaje(esPdf ? archivo.name : "Factura del proveedor", false),
      adjunto: { url: URL.createObjectURL(archivo), nombre: archivo.name, esPdf },
    };
    facturas.current.set(m.id, archivo);
    setMensajes((prev) => [...prev, m]);
    leerEn(m.id, archivo);
  }

  async function leerEn(id: string, archivo: File) {
    if (!storeId) return;
    try {
      const p = await leer.mutateAsync({ archivo, storeId });
      if (!p.items?.length) {
        actualizar(id, (x) => ({
          ...x,
          fase: "error",
          error: "No encontré productos en esa foto. Probá con otra más nítida: entera, derecha y con buena luz.",
        }));
        return;
      }
      actualizar(id, (x) => ({ ...x, fase: "listo", propuesta: p }));
      const f = facturaDe(id, p);
      if (f) despachar(f);
      if (ancho) despachar({ tipo: "abrir", mesa: "compra", pestana: "borrador" });
      aplicarVenta(id, p);
    } catch (error: any) {
      actualizar(id, (x) => ({
        ...x,
        fase: "error",
        error: error?.message ?? "No pude leer la factura. Revisá tu conexión.",
      }));
    }
  }

  /** Un renglón de la factura que no se carga (un flete, algo que no se vende). */
  function omitirItem(m: Mensaje, indice: number) {
    despachar({ tipo: "lineaResuelta", clave: `${m.id}:${indice}` });
    actualizar(m.id, (x) => ({
      ...x,
      propuesta: {
        ...x.propuesta!,
        items: x.propuesta!.items!.map((y, i) => (i === indice ? { ...y, omitido: true } : y)),
      },
    }));
  }

  // ------------------------------------------------------------ sugerencias (G2a)
  // No interrumpen: mientras se escribe o se dicta no se muestra ninguna.
  const ayuda = useSugerencias({
    storeId,
    mesa,
    pausado: texto.trim().length > 0 || voz.estado === "grabando" || voz.estado === "procesando",
  });
  // La sugerencia pendiente aunque esté escondida: el dictado la lee al volver.
  const candidataRef = useRef(ayuda.candidata);
  candidataRef.current = ayuda.candidata;

  // ------------------------------------------------------------ la Guía habla (G2b)
  // Mientras se le habla al asistente, la Guía contesta hablando: lo que se
  // hizo y lo que pregunta. Escribir o tocar la vuelve a dejar callada.
  const visible = guia?.mensaje ?? ayuda.actual;
  const dichas = useRef(new Set<string>());
  useEffect(() => {
    if (!visible || !porVoz.current || dichas.current.has(visible.clave)) return;
    dichas.current.add(visible.clave);
    vozGuia.hablar(fraseDeGuia(visible));
  }, [visible, vozGuia]);
  // Al volver a dictar, la voz se calla: no le tapa el micrófono a nadie.
  useEffect(() => {
    if (voz.estado === "grabando") vozGuia.callar();
  }, [voz.estado, vozGuia]);

  /**
   * "6", "con QR", "sí", "no, dejalo": si la Guía preguntó algo y la frase es
   * la respuesta, se resuelve con el mismo botón que se habría tocado, sin ir
   * al servidor. Devuelve si la frase era una respuesta.
   */
  function responderGuia(frase: string, dictada: boolean): boolean {
    const pendiente = guiaRef.current?.mensaje ?? ayuda.candidata;
    const respuesta = respuestaAGuia(frase, pendiente);
    if (!respuesta || !pendiente) return false;
    const resumen = resumenRespuesta(respuesta);
    setMensajes((prev) => [...prev, mensajeRespuestaGuia(frase, dictada, resumen)]);
    void alAccionGuia(respuesta, pendiente);
    return true;
  }

  /** Lo que se dice en voz alta de una respuesta del servidor: corto, nunca la tarjeta entera. */
  function fraseDeRespuesta(p: Propuesta | null | undefined): string | null {
    if (!p) return "Te escuché, pero no entendí qué querés hacer.";
    const efecto = esDeVenta(p) ? efectoDeVenta(p) : null;
    if (efecto?.cobrar) return null; // lo dice el cobro, cuando termine
    if (efecto) return paraHablar(efecto.resumen);
    if (p.vista) return p.intencion === "cambiar_vista" ? "Listo, cambié la vista." : `Te armé: ${p.vista.titulo}.`;
    if (p.intencion === "simular") return "Te armo una herramienta a medida. Tarda menos de un minuto.";
    if (p.resultado) return paraHablar(p.resultado.resumen);
    if (p.aviso) return paraHablar(p.aviso);
    if (p.faltan.length > 0) return paraHablar(p.faltan[0].pregunta);
    if (p.opciones.length > 0) return "Encontré varios parecidos: elegí uno en la pantalla.";
    return null;
  }

  // ------------------------------------------------------------ actuar

  async function ejecutar(m: Mensaje, entidades: Record<string, unknown>, despues: number | null) {
    if (!storeId || !m.propuesta?.intencion) return;
    setEjecutandoId(m.id);
    // "Se rompieron 2" viaja como diferencia (-2); si la persona corrigió el
    // número que queda, manda su número y la diferencia ya no vale.
    const original = m.propuesta.entidades;
    if (typeof original.delta === "number" && entidades.cantidad !== original.cantidad) {
      const { delta: _delta, ...resto } = entidades;
      entidades = resto;
    }
    try {
      const r = await confirmar.mutateAsync({
        intencion: m.propuesta.intencion,
        entidades,
        storeId,
      });
      // Sin toast de éxito: la tarjeta misma pasa a "Listo · stock 32". Un
      // cartel arriba diciendo lo mismo es ruido.
      actualizar(m.id, (x) => ({
        ...x,
        desenlace: { tipo: "hecho", resumen: r!.resumen, despues, entidades },
      }));
    } catch (error: any) {
      toast.error(error?.message ?? "No se pudo hacer");
    } finally {
      setEjecutandoId(null);
    }
  }

  /**
   * Completar lo que faltaba (el producto, un número) NO ejecuta lo que
   * escribe: vuelve a la tarjeta con su diff. Lo que solo LEE sí se resuelve
   * en el acto: pedir confirmación para ver un stock es el paso que vinimos a
   * sacar.
   */
  async function seguir(m: Mensaje, p: Propuesta) {
    if (!storeId) return;
    if (esDeVenta(p)) {
      actualizar(m.id, (x) => ({ ...x, propuesta: p }));
      aplicarVenta(m.id, p);
      return;
    }
    if (p.requiereConfirmacion || !p.ejecutable || !p.intencion) {
      actualizar(m.id, (x) => ({ ...x, propuesta: p }));
      return;
    }

    actualizar(m.id, (x) => ({ ...x, fase: "pensando", propuesta: p }));
    try {
      const r = await confirmar.mutateAsync({ intencion: p.intencion, entidades: p.entidades, storeId });
      const datos = r!.datos as any;
      const prod = p.producto;
      const resultado = {
        resumen: r!.resumen,
        // Misma forma que devuelve el servidor para una consulta de stock:
        // la fila con foto.
        datos:
          prod && datos?.stock !== undefined
            ? { ...datos, productos: [{ ...prod, stock: datos.stock, precio: datos.precio }] }
            : datos,
      };
      actualizar(m.id, (x) => ({ ...x, fase: "listo", propuesta: { ...p, resultado } }));
    } catch (error: any) {
      actualizar(m.id, (x) => ({ ...x, fase: "error", error: error?.message ?? "No se pudo consultar" }));
    }
  }

  function elegirProducto(m: Mensaje, op: ProductoOpcion) {
    if (vistaPendiente(m)) return void filtrarPendiente(m, "producto", op.productId);
    seguir(m, completar(m.propuesta!, { producto: op.nombre, productId: op.productId }, op));
  }

  /** Un análisis que espera a que se elija cuál José (G6b). */
  const vistaPendiente = (m: Mensaje) =>
    (m.propuesta?.entidades as { vistaPendiente?: VistaSpec } | undefined)?.vistaPendiente ?? null;

  /**
   * Se eligió cuál: el servidor le pone ese filtro a TODAS las piezas de la
   * vista que quedó esperando, y recién ahí se muestra. Nunca antes: serían
   * los datos de toda la tienda.
   */
  async function filtrarPendiente(m: Mensaje, tipo: "cliente" | "producto" | "categoria", id: string) {
    const pendiente = vistaPendiente(m);
    if (!pendiente || !storeId) return;
    actualizar(m.id, (x) => ({ ...x, fase: "pensando" }));
    try {
      const vista = await filtrarVista.mutateAsync({ storeId, vista: pendiente, tipo, id });
      const p: Propuesta = {
        ...m.propuesta!,
        vista,
        titulo: vista.titulo,
        clientes: undefined,
        opciones: [],
        aviso: null,
        ejecutable: true,
        entidades: { pregunta: (m.propuesta!.entidades as { pregunta?: string }).pregunta ?? m.texto ?? "" },
      };
      actualizar(m.id, (x) => ({ ...x, fase: "listo", propuesta: p }));
      mostrarAnalisis(m.id, m.texto ?? "", p);
    } catch (error: any) {
      actualizar(m.id, (x) => ({ ...x, fase: "error", error: error?.message ?? "No pude armar el análisis." }));
    }
  }

  function completarDato(m: Mensaje, slot: string, valor: string) {
    if (m.propuesta && esDeVenta(m.propuesta) && slot === "nombre") {
      actualizar(m.id, (x) => ({ ...x, fase: "pensando" }));
      interpretarEn(m.id, `es para ${valor}`);
      return;
    }
    const numerico = ["precio", "cantidad", "costo"].includes(slot);
    seguir(m, completar(m.propuesta!, { [slot]: numerico ? Number(valor) : valor }));
  }

  /**
   * Cobrar lo armado en el panel. La venta queda en el hilo como una tarjeta
   * (con "Anular venta") y el carrito se vacía para la próxima.
   *
   * Si el servidor la rechaza —sin stock, sin permiso— el motivo se muestra
   * al lado del botón y el carrito queda intacto: nada de lo armado se pierde.
   */
  /**
   * Una frase de la venta, ya entendida: se aplica con el MISMO reductor que
   * los botones. En escritorio se abre el panel para que se vea el cambio; en
   * el teléfono no (taparía el chat en cada "sumá"): queda el chip.
   */
  function aplicarVenta(id: string, p: Propuesta) {
    const efecto = efectoDeVenta(p);
    if (!efecto) return; // falta algo: la tarjeta del chat lo pide
    anunciarAdvertencias(mesaRef.current, efecto.acciones);
    origenCambio.current = "chat";
    efecto.acciones.forEach(despachar);
    const destino = mesaDe(p);
    preguntarCantidad(p, destino);

    // Un pedido de varias cosas: la tarjeta sigue viva (lo dudoso queda para
    // elegir), así que no se cierra con un resumen; se marca lo aplicado.
    if (p.items) {
      // Si se estaba vendiendo y dijo "compré…", la venta se cierra y se abre
      // la compra, como Claude cambia de artefacto. La venta queda en el chip.
      if (ancho) despachar({ tipo: "abrir", mesa: destino, pestana: "borrador" });
      actualizar(id, (x) => ({ ...x, propuesta: marcarAplicados(p) }));
      return;
    }

    if (efecto.cobrar) {
      actualizar(id, (x) => ({ ...x, desenlace: { tipo: "mesa", resumen: efecto.resumen } }));
      cobrarVenta({ mensajeId: id, pago: (p.entidades as any).pago as MetodoPago | undefined });
      return;
    }
    if (ancho) despachar({ tipo: "abrir", mesa: destino, pestana: "borrador" });
    actualizar(id, (x) => ({
      ...x,
      desenlace: { tipo: "mesa", resumen: efecto.resumen, imagen: efecto.imagen },
    }));
  }

  /**
   * "Vendé coca" sin decir cuántas: se puso 1 y la Guía pregunta, con los
   * números a un toque. Solo si la frase agregó UN producto: en "coca, arroz y
   * aceite" lo normal es uno de cada uno, y preguntar tres veces molesta.
   */
  function preguntarCantidad(p: Propuesta, destino: TipoMesa) {
    const e = p.entidades as Record<string, any>;
    const nuevos = (p.items ?? []).filter((it) => it.producto);
    const unico =
      p.items && nuevos.length === 1 && p.items.length === 1
        ? { producto: nuevos[0].producto!, dicha: nuevos[0].cantidadDicha }
        : !p.items && p.producto && p.intencion === "agregar_a_venta"
          ? { producto: p.producto, dicha: e.cantidadDicha as boolean | undefined }
          : null;
    if (!unico || unico.dicha !== false) return;
    const yaEstaba = (destino === "venta" ? mesaRef.current.venta.lineas : mesaRef.current.compra.lineas).some(
      (l) => l.productId === unico.producto.productId,
    );
    if (yaEstaba) return; // "sumá coca" con una ya en el carrito: no es "¿cuántas?"
    ayuda.agregarLocal(MENSAJES.cantidadNoDicha(unico.producto, destino));
  }

  /** La mesa sobre la que actúa una frase: la compra, la venta, o la que dijo el servidor. */
  function mesaDe(p: Propuesta): TipoMesa {
    const e = p.entidades as Record<string, any>;
    if (e.mesa === "compra" || e.mesa === "venta") return e.mesa;
    return ["agregar_a_compra", "cambiar_costo_compra", "elegir_proveedor", "registrar_compra"].includes(p.intencion ?? "")
      ? "compra"
      : "venta";
  }

  /**
   * Registrar la compra armada. La llama el botón del panel o la tarjeta de
   * confirmación del chat ("registrá la compra"); nunca se registra sola.
   */
  async function registrarCompra(mensajeId?: string) {
    const compra0 = mesaRef.current.compra;
    if (!storeId) return;
    setErrorCompra(null);
    // La Guía revisa antes de registrar: compra vacía, o renglones de la
    // factura sin resolver (la compra quedaría con productos de menos y el
    // total no cerraría con el papel).
    const bloquea = errores(revisarCompra(compra0))[0];
    if (bloquea) {
      if (mensajeId) {
        actualizar(mensajeId, (x) => ({ ...x, desenlace: { tipo: "guia", texto: bloquea.texto, nivel: "error" } }));
      }
      avisar(bloquea);
      return;
    }
    const lineas = compra0.lineas;
    try {
      const compra = await registrar.mutateAsync({
        storeId,
        proveedor: compra0.proveedor || undefined,
        referencia: compra0.referencia || undefined,
        adjunto: compra0.adjunto ?? undefined,
        lineas: lineas.map((l) => ({ productId: l.productId, cantidad: l.cantidad, costo: l.costo })),
      });
      const evento = {
        tipo: "compra" as const,
        compra,
        lineas: lineas.map((l) => ({ nombre: l.nombre, imagen: l.imagen, cantidad: l.cantidad, costo: l.costo, stock: l.stock })),
      };
      if (mensajeId) {
        actualizar(mensajeId, (x) => ({ ...x, evento }));
      } else {
        setMensajes((prev) => [...prev, mensajeDeEvento(evento)]);
      }
      despachar({ tipo: "limpiarCompra" });
    } catch (error: any) {
      const motivo = error?.message ?? "No se pudo registrar la compra. Revisá tu conexión.";
      setErrorCompra(motivo);
      avisar(MENSAJES.servidor(motivo, "compra"));
    }
  }

  // Cambiar la compra borra el error de un intento anterior.
  useEffect(() => setErrorCompra(null), [mesa.compra]);

  function elegirCliente(m: Mensaje, c: { id: string; nombre: string }) {
    if (vistaPendiente(m)) return void filtrarPendiente(m, "cliente", c.id);
    const p = m.propuesta!;
    seguir(m, {
      ...p,
      entidades: { ...p.entidades, clienteId: c.id, cliente: c.nombre },
      ejecutable: true,
    });
  }

  /**
   * Un renglón dudoso de un pedido ("empire"): se puede elegir UNO O VARIOS.
   * Cada toque agrega ese producto con la cantidad que se dijo.
   */
  function elegirItem(m: Mensaje, indice: number, producto: ProductoOpcion) {
    const p = m.propuesta!;
    const it = p.items![indice];
    if (it.agregados?.includes(producto.productId)) return;
    const destino = mesaDe(p);
    if (destino === "compra") {
      const previo = p.costos?.[producto.productId];
      despachar({
        tipo: "agregarCompra",
        producto,
        cantidad: it.cantidad,
        costo: costoSugerido(it.precio, previo),
        costoAnterior: previo?.ultimoCosto ?? null,
      });
    } else {
      despachar({
        tipo: "agregarVenta",
        producto,
        cantidad: it.cantidad,
        ...(it.precio != null ? { precio: it.precio } : {}),
      });
    }
    if ((p.entidades as any).factura) despachar({ tipo: "lineaResuelta", clave: `${m.id}:${indice}` });
    if (ancho) despachar({ tipo: "abrir", mesa: destino, pestana: "borrador" });
    actualizar(m.id, (x) => ({
      ...x,
      propuesta: {
        ...x.propuesta!,
        items: x.propuesta!.items!.map((y, i) =>
          i === indice ? { ...y, agregados: [...(y.agregados ?? []), producto.productId] } : y,
        ),
      },
    }));
  }

  function elegirLinea(m: Mensaje, l: LineaContexto) {
    const p = m.propuesta!;
    seguir(m, {
      ...p,
      entidades: { ...p.entidades, productId: l.productId, producto: l.nombre },
      lineas: [],
      ejecutable: true,
    });
  }

  /**
   * Cobrar lo armado en la mesa. Lo llama el botón o una frase ("cobrale con
   * QR", D2). Desde el chat la venta queda en la tarjeta de ESA frase.
   */
  async function cobrarVenta(opciones: { mensajeId?: string; pago?: MetodoPago } = {}) {
    const venta0 = mesaRef.current.venta;
    if (!storeId) return;
    const pago = opciones.pago ?? venta0.pago;
    // La Guía revisa antes de cobrar: venta vacía (pudo vaciarse entre la
    // frase y la respuesta), o sin método de pago. Al resolverlo desde la
    // Guía, se cobra solo.
    const bloquea = errores(revisarVenta(venta0, pago))[0];
    if (bloquea || !pago) {
      const m = bloquea ?? MENSAJES.faltaPago();
      if (opciones.mensajeId) {
        actualizar(opciones.mensajeId, (x) => ({
          ...x,
          fase: "listo",
          desenlace: { tipo: "guia", texto: m.texto, nivel: "error" },
        }));
      }
      avisar(m, m.codigo === "FALTA_PAGO" ? { luego: { cobrar: { mensajeId: opciones.mensajeId } } } : {});
      return;
    }
    setErrorCobro(null);
    const lineas = venta0.lineas;
    coreografia.emitir([{ tipo: "cobrando", origen: opciones.mensajeId ? "chat" : "boton" }]);
    try {
      const venta = await cobrar.mutateAsync({
        storeId,
        clienteId: venta0.clienteId,
        pago,
        lineas: lineas.map((l) => ({ storeProductId: l.storeProductId, cantidad: l.cantidad, precio: l.precio })),
      });
      const evento = {
        tipo: "venta" as const,
        venta,
        lineas: lineas.map((l) => ({ nombre: l.nombre, imagen: l.imagen, cantidad: l.cantidad })),
      };
      if (opciones.mensajeId) {
        actualizar(opciones.mensajeId, (x) => ({ ...x, evento }));
      } else {
        setMensajes((prev) => [...prev, mensajeDeEvento(evento)]);
      }
      despachar({ tipo: "limpiarVenta" });
      coreografia.emitir([{ tipo: "cobrada" }]);
      ayuda.contarVenta();
      if (!opciones.mensajeId) ayuda.agregarLocal(MENSAJES.tipCobrarHablando());
      if (porVoz.current) {
        vozGuia.hablar(`Cobrado: ${venta.total.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} bolivianos.`);
      }
    } catch (error: any) {
      const motivo = error?.message ?? "No se pudo cobrar. Revisá tu conexión.";
      // La Guía lo dice y, si nombra un producto del carrito, señala su cantidad.
      avisar(errorDeCobro(motivo, venta0));
      if (opciones.mensajeId) {
        // Desde el chat: el motivo va en la tarjeta de la frase, y el carrito
        // queda intacto para corregir y volver a decir "cobrá".
        actualizar(opciones.mensajeId, (x) => ({ ...x, desenlace: undefined, fase: "error", error: motivo }));
      } else {
        setErrorCobro(motivo);
      }
    }
  }

  async function anularVenta(m: Mensaje) {
    if (!storeId || !m.evento || m.evento.tipo !== "venta") return;
    setAnulandoId(m.id);
    try {
      await anular.mutateAsync({ orderId: m.evento.venta.orderId, storeId });
      actualizar(m.id, (x) => ({
        ...x,
        evento: x.evento?.tipo === "venta" ? { ...x.evento, anulada: true } : x.evento,
      }));
    } catch (error: any) {
      toast.error(error?.message ?? "No se pudo anular la venta");
    } finally {
      setAnulandoId(null);
    }
  }

  // Cambiar el carrito borra el error de un cobro anterior: ya no aplica.
  useEffect(() => setErrorCobro(null), [mesa.venta]);

  function usarSugerencia(s: string) {
    setTexto(s);
    campo.current?.focus();
  }

  // ------------------------------------------------------------ pantalla


  if (!storeId) {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <div className="mx-auto w-full max-w-[880px] rounded-xl border border-border bg-card px-6 py-14 text-center shadow-card">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Store className="size-5" />
          </span>
          <p className="font-semibold">Elegí una tienda</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
            El asistente trabaja sobre una tienda a la vez. Elegila tocando el bloque de Vendfy, arriba a
            la izquierda: con “todas” no sabe a cuál sumarle el stock.
          </p>
        </div>
      </div>
    );
  }

  const compositor = (
    <Compositor
      ref={campo}
      texto={texto}
      onTexto={setTexto}
      onEnviar={enviar}
      voz={voz}
      vozDisponible={Boolean(estadoVoz?.disponible)}
      consultandoVoz={consultandoVoz}
      onArchivo={leerFactura}
      leyendo={leer.isPending}
    />
  );

  // Sin conversación: el campo al centro, como ChatGPT. Es lo único que hay
  // para hacer en esa pantalla, y abajo de todo parecía un detalle.
  // Al recargar con una conversación en la URL: no mostrar la bienvenida
  // vacía el segundo que tarda en llegar.
  if (!conversando && abriendo) {
    return (
      <div className="flex flex-1 flex-col">
        <BarraConversacion onConversaciones={() => setVerConversaciones(true)} />
        <p data-testid="omnibox-abriendo" className="mx-auto mt-24 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-acento" />
          Abriendo la conversación…
        </p>
        {panelDeConversaciones}
      </div>
    );
  }

  if (!conversando) {
    return (
      <div className="flex flex-1 flex-col">
        <BarraConversacion onConversaciones={() => setVerConversaciones(true)} />
        <Bienvenida sugerencias={sugerencias} onSugerencia={usarSugerencia} fijadas={fijadas ?? []} onFijada={abrirFijada}>
          {compositor}
        </Bienvenida>
        {panelDeConversaciones}
      </div>
    );
  }

  const panelAbierto = mesa.abierta !== null;
  // La herramienta abierta (G6) vive en su mensaje: el panel la recibe ya armada.
  const conHerramienta = mesa.herramienta ? mensajes.find((x) => x.id === mesa.herramienta!.mensajeId) : undefined;
  const panelHerramienta = conHerramienta?.herramienta ? (
    <PanelHerramienta
      key={conHerramienta.id}
      estado={conHerramienta.herramienta}
      pregunta={preguntaDe(conHerramienta)}
      storeId={storeId!}
      onCambio={(e) => actualizar(conHerramienta.id, (x) => ({ ...x, herramienta: e }))}
      onProponer={(accion, g) => proponerDesdeHerramienta(conHerramienta.id, accion, g)}
      onVerDatos={(vista) => verDatosDeHerramienta(conHerramienta, vista)}
    />
  ) : null;
  // Los productos nuevos (G9b): el formulario de su mensaje, en el panel.
  const conProductos = mesa.productos ? mensajes.find((x) => x.id === mesa.productos!.mensajeId) : undefined;
  const panelProductos =
    conProductos?.formulario?.tipo === "productos" ? (
      <TarjetaProductosNuevos
        enPanel
        formulario={conProductos.formulario}
        storeId={storeId!}
        hora={horaDe(conProductos.hora)}
        aviso={conProductos.propuesta?.aviso}
        onCambiar={(productos) => cambiarProductos(conProductos.id, productos)}
        onCrear={() => void crearProductos(conProductos.id)}
        onDescartar={() =>
          actualizar(conProductos.id, (x) => (x.formulario ? { ...x, formulario: { ...x.formulario, estado: "descartado" } } : x))
        }
      />
    ) : null;
  // La lista y la ficha (G9a) como las trajo el agente: el panel no espera para mostrarlas.
  const listaInicial = mesa.lista
    ? ((mensajes.find((x) => x.id === mesa.lista!.mensajeId)?.propuesta?.entidades as { lista?: ListaRecurso } | undefined)?.lista)
    : undefined;
  const fichaInicial = mesa.ficha
    ? mensajes
        .map((x) => (x.propuesta?.entidades as { ficha?: FichaRecurso } | undefined)?.ficha)
        .find((f) => f && f.id === mesa.ficha!.id && f.recurso === mesa.ficha!.recurso)
    : undefined;
  // Ampliado: el panel ocupa todo y el chat se esconde (solo en pantalla ancha;
  // en el teléfono el panel ya es de pantalla completa).
  const ampliada = dividido && mesa.ampliada;
  // Con el panel al costado el chat es una columna angosta: sin tope de ancho.
  const anchoChat = dividido ? "" : "max-w-[880px]";

  return (
    // "Crear «mouse»" desde cualquier tarjeta abre el formulario acá (G7a).
    <CrearEnChatContext.Provider value={crearProductoEnChat}>
    <div className="flex flex-1 flex-col">

      <div
        className={cn(
          "mt-1 flex flex-1 gap-5",
          // Alto fijo: lo que queda de la pantalla debajo de la cabecera y el
          // título, con un margen abajo para que se vea el borde del panel.
          dividido && "grid h-[calc(100dvh-7.25rem)] min-h-[28rem] flex-none",
          dividido && (ampliada ? "grid-cols-1" : "grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"),
        )}
      >
        {/* ---- el chat: los mensajes en el scroll de la página, el campo pegado abajo */}
        <section className={cn("flex min-w-0 flex-1 flex-col", dividido && "min-h-0", ampliada && "hidden")}>
          <div className={cn("mx-auto w-full", anchoChat)}>
            <BarraConversacion
              titulo={tituloConversacion ?? "Nueva conversación"}
              guardado={guardado}
              onConversaciones={() => setVerConversaciones(true)}
              onNueva={empezarNueva}
            />
          </div>
          <div
            ref={hilo}
            data-zona="chat"
            className={cn(
              "mx-auto flex w-full flex-1 flex-col gap-3 pb-4 sm:gap-3.5",
              anchoChat,
              dividido && "min-h-0 overflow-y-auto pr-1 [scrollbar-width:thin]",
            )}
          >
            {mensajes.map((m) =>
              m.precios ? (
                <FilaAsistente key={m.id}>
                  <TarjetaPrecios
                    precios={m.precios}
                    hora={horaDe(m.hora)}
                    onConfirmar={() => confirmarPrecios(m)}
                    onCancelar={() => actualizar(m.id, (x) => ({ ...x, precios: { ...x.precios!, estado: "cancelado" } }))}
                  />
                </FilaAsistente>
              ) : m.evento ? (
                <Fragment key={m.id}>
                  {/* "Cobrale con QR" deja su burbuja; el botón Cobrar, no. */}
                  {m.texto && <Burbuja mensaje={m} />}
                  <FilaAsistente>
                    {m.evento.tipo === "compra" ? (
                      <TarjetaCompra evento={m.evento} cuando={m.hora} />
                    ) : (
                      <TarjetaVenta
                        evento={m.evento}
                        cuando={m.hora}
                        anulando={anulandoId === m.id}
                        onAnular={() => anularVenta(m)}
                      />
                    )}
                  </FilaAsistente>
                </Fragment>
              ) : (
              <Fragment key={m.id}>
                {/* Las tarjetas que preparó el agente (G7b) no nacen de una frase: sin burbuja. */}
                {(m.texto || m.porVoz || m.adjunto) && <Burbuja mensaje={m} />}
                <FilaAsistente>
                  <Respuesta
                    mensaje={m}
                    storeId={storeId}
                    tienda={tienda!.name}
                    ejecutando={ejecutandoId === m.id}
                    sugerencias={sugerencias}
                    productoAbierto={panelAbierto && mesa.pestana === "producto" ? mesa.producto?.productId : undefined}
                    onVerProducto={(producto) => despachar({ tipo: "verProducto", producto })}
                    onConfirmar={(entidades, despues) => ejecutar(m, entidades, despues)}
                    onCancelar={() => actualizar(m.id, (x) => ({ ...x, desenlace: { tipo: "cancelado" } }))}
                    onElegirProducto={(op) => elegirProducto(m, op)}
                    onCompletarDato={(slot, valor) => completarDato(m, slot, valor)}
                    onReintentar={() => reintentar(m)}
                    onSugerencia={usarSugerencia}
                    onElegirCliente={(c) => elegirCliente(m, c)}
                    onElegirLinea={(l) => elegirLinea(m, l)}
                    onElegirItem={(i, producto) => elegirItem(m, i, producto)}
                    onOmitirItem={(i) => omitirItem(m, i)}
                    onConfirmarCompra={() => registrarCompra(m.id)}
                    registrandoCompra={registrar.isPending}
                    resumenCompra={{
                      lineas: mesa.compra.lineas.length,
                      total: totalCompra(mesa.compra),
                      proveedor: mesa.compra.proveedor,
                    }}
                    onAbrirVista={() => m.propuesta && mostrarAnalisis(m.id, m.texto ?? "", m.propuesta)}
                    vistaAbierta={mesa.abierta === "analisis" && mesa.analisis?.mensajeId === m.id}
                    onAbrirHerramienta={() => abrirHerramienta(m)}
                    onAbrirFormulario={() => abrirFormulario(m.id, nuevoFormulario("cliente", { nombre: titular(String(m.propuesta?.entidades.nombre ?? "")) }))}
                    onCampoFormulario={(clave, valor) => campoFormulario(m.id, { [clave]: valor })}
                    onCrearFormulario={() => void crearDesdeFormulario(m.id)}
                    onDescartarFormulario={() =>
                      actualizar(m.id, (x) => (x.formulario ? { ...x, formulario: { ...x.formulario, estado: "descartado" } } : x))
                    }
                    herramientaAbierta={mesa.abierta === "herramienta" && mesa.herramienta?.mensajeId === m.id}
                    onReintentarHerramienta={() => armarHerramienta(m.id, preguntaDe(m))}
                    onVerDatosHerramienta={(vista) => verDatosDeHerramienta(m, vista)}
                    onCambiarProductos={(productos) => cambiarProductos(m.id, productos)}
                    onCrearProductos={() => void crearProductos(m.id)}
                    onDescartarProductos={() =>
                      actualizar(m.id, (x) => (x.formulario ? { ...x, formulario: { ...x.formulario, estado: "descartado" } } : x))
                    }
                    onConfirmarAccion={() => void confirmarAccion(m)}
                    onMoverPedido={moverPedido}
                    onCrearProductoEnChat={crearProductoEnChat}
                    onAbrirRecurso={() => abrirRecurso(m)}
                    recursoAbierto={recursoAbierto(m)}
                    productosEnPanel={Boolean(ancho && mesa.productos?.mensajeId === m.id)}
                    productosAbiertos={mesa.abierta === "productos" && mesa.productos?.mensajeId === m.id}
                    onAbrirProductos={() => despachar({ tipo: "abrirProductos", mensajeId: m.id })}
                  />
                </FilaAsistente>
              </Fragment>
              ),
            )}
          </div>

          {/* Pegado abajo dentro del scroll de la página. Fondo sólido del color
              de la página: lo que pasa por detrás no se ve a través. El margen
              negativo se come el relleno inferior del marco, para que el campo
              quede contra el borde de la pantalla y no flotando. */}
          <div
            className={cn(
              "z-30 bg-background pt-2",
              dividido ? "" : "sticky bottom-0 -mb-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
            )}
          >
            <div className={cn("mx-auto w-full", anchoChat)}>
              {(guia?.mensaje ?? ayuda.actual) && (
                <FranjaGuia
                  mensaje={(guia?.mensaje ?? ayuda.actual)!}
                  onAccion={alAccionGuia}
                  onCerrar={() => {
                    if (guia) setGuia(null);
                    else if (ayuda.actual) ayuda.resolver(ayuda.actual, "descartada");
                  }}
                />
              )}
              {conversaPorVoz && vozGuia.disponible ? (
                <div data-testid="omnibox-voz-respuestas" className="mb-1.5 flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
                  {vozGuia.activa ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                  <span>{vozGuia.activa ? "Te contesto hablando" : "Respuestas habladas apagadas"}</span>
                  <span aria-hidden>·</span>
                  <button type="button" onClick={vozGuia.alternar} className="font-medium text-foreground underline-offset-2 hover:underline">
                    {vozGuia.activa ? "Silenciar" : "Activar"}
                  </button>
                </div>
              ) : null}
              <ChipsEnCurso mesa={mesa} despachar={despachar} />
              {compositor}
            </div>
          </div>
        </section>

        {/* ---- la mesa, en pantalla ancha: columna derecha pegada bajo la cabecera */}
        {dividido && (
          <div className="min-h-0 min-w-0">
            <PanelMesa
              mesa={mesa}
              despachar={despachar}
              storeId={storeId}
              onCobrar={() => cobrarVenta()}
              cobrando={cobrar.isPending}
              errorCobro={errorCobro}
              onRegistrarCompra={() => registrarCompra()}
              registrando={registrar.isPending}
              errorCompra={errorCompra}
              tienda={tienda!.name}
              acciones={accionesVista}
              herramienta={panelHerramienta}
              listaInicial={listaInicial}
              fichaInicial={fichaInicial}
              productos={panelProductos}
            />
          </div>
        )}
      </div>

      <Coreografo coreografia={coreografia} />
      {panelDeConversaciones}

      {/* ---- la mesa, en el teléfono: sube desde abajo a pantalla casi completa */}
      {!ancho && (
        <Drawer open={panelAbierto} onOpenChange={(abierto) => !abierto && despachar({ tipo: "cerrar" })}>
          <DrawerContent className="h-[92dvh]">
            <DrawerTitle className="sr-only">
              {mesa.abierta === "lista"
                ? (mesa.lista?.titulo ?? "Lista")
                : mesa.abierta === "ficha"
                  ? (mesa.ficha?.titulo ?? "Ficha")
                  : mesa.abierta === "analisis"
                ? "Análisis"
                : mesa.abierta === "herramienta"
                  ? "Herramienta"
                  : mesa.abierta === "compra"
                    ? "Compra"
                    : "Venta"}
            </DrawerTitle>
            <PanelMesa
              mesa={mesa}
              despachar={despachar}
              storeId={storeId}
              enHoja
              onCobrar={() => cobrarVenta()}
              cobrando={cobrar.isPending}
              errorCobro={errorCobro}
              onRegistrarCompra={() => registrarCompra()}
              registrando={registrar.isPending}
              errorCompra={errorCompra}
              tienda={tienda!.name}
              acciones={accionesVista}
              herramienta={panelHerramienta}
              listaInicial={listaInicial}
              fichaInicial={fichaInicial}
              productos={panelProductos}
            />
          </DrawerContent>
        </Drawer>
      )}
    </div>
    </CrearEnChatContext.Provider>
  );
}

/**
 * Arriba del chat (G5): las conversaciones guardadas, el título de la actual,
 * si ya se guardó, y empezar una nueva. En la bienvenida, solo el botón de
 * las conversaciones.
 */
function BarraConversacion({
  titulo,
  guardado = null,
  onConversaciones,
  onNueva,
}: {
  titulo?: string;
  guardado?: "guardando" | "guardado" | "error" | null;
  onConversaciones: () => void;
  onNueva?: () => void;
}) {
  const boton =
    "grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted hover:text-foreground";
  return (
    <div data-testid="barra-conversacion" className="mb-2 flex items-center gap-2">
      <button type="button" data-testid="omnibox-conversaciones" aria-label="Conversaciones" title="Conversaciones" onClick={onConversaciones} className={boton}>
        <History className="size-4" />
      </button>
      {titulo ? (
        <div className="min-w-0 flex-1">
          <p data-testid="conversacion-titulo" className="truncate text-sm font-semibold text-foreground">
            {titulo}
          </p>
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {guardado ? (
        <span
          data-testid="conversacion-guardado"
          data-estado={guardado}
          className={cn("shrink-0 text-[11px]", guardado === "error" ? "text-destructive" : "text-muted-foreground")}
        >
          {guardado === "guardando" ? "Guardando…" : guardado === "guardado" ? "Guardado" : "Sin guardar: reintentando"}
        </span>
      ) : null}
      {onNueva ? (
        <button type="button" data-testid="omnibox-nueva" aria-label="Nueva conversación" title="Nueva conversación" onClick={onNueva} className={boton}>
          <SquarePen className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Pantalla ancha (1024 px o más): el panel va al costado del chat. Debajo, al
 * costado no entra y sube como hoja desde abajo.
 */
function useEsAncho(): boolean {
  const consulta = "(min-width: 1024px)";
  const [ancho, setAncho] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const alCambiar = () => setAncho(mq.matches);
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);
  return ancho;
}

/**
 * La pantalla vacía: saludo, el campo en el medio y las sugerencias debajo.
 *
 * Los ejemplos no son adorno: un campo vacío no le dice a nadie qué puede
 * pedir, y ese es el problema que hunde a los chats. Van DEBAJO del campo,
 * como en ChatGPT: primero se ve dónde escribir, después qué escribir.
 */
function Bienvenida({
  sugerencias,
  onSugerencia,
  fijadas,
  onFijada,
  children,
}: {
  sugerencias: string[];
  onSugerencia: (s: string) => void;
  /** El tablero propio (G4): las vistas fijadas, a un toque y con los datos al día. */
  fijadas: VistaFijada[];
  onFijada: (f: VistaFijada) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid="omnibox-vacio"
      className="mx-auto flex min-h-[60dvh] w-full max-w-[760px] flex-1 flex-col items-center justify-center gap-6 py-10 text-center"
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
        <VendfyMark variant="mono" size={30} />
      </span>
      <div>
        <h2 className="text-xl font-bold">¿Qué necesitás?</h2>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
          Escribí o dictá como se lo dirías a tu empleado. Lo que toque stock o plata te lo
          muestro antes de hacerlo.
        </p>
      </div>
      <div className="w-full text-left">{children}</div>
      {fijadas.length > 0 ? (
        <section aria-label="Tu tablero" className="w-full text-left" data-testid="omnibox-tablero">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Tu tablero</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {fijadas.slice(0, 6).map((f) => (
              <button
                key={f.id}
                type="button"
                data-testid="vista-fijada"
                onClick={() => onFijada(f)}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-card transition-colors hover:border-border-strong hover:bg-muted"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                  <BarChart3 className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-foreground">{f.nombre}</span>
                  <span className="block truncate text-xs text-muted-foreground">{resumenPiezas(f.vista).join(" · ")}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <div className="flex max-w-xl flex-wrap justify-center gap-2">
        {sugerencias.map((s) => (
          <button
            key={s}
            type="button"
            data-testid="omnibox-sugerencia"
            onClick={() => onSugerencia(s)}
            className="rounded-full border border-input bg-card px-3.5 py-2 text-[13px] font-medium transition-colors hover:border-border-strong hover:bg-muted active:scale-[0.98]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
