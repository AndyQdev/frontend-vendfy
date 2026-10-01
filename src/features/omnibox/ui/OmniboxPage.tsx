import { Fragment, useEffect, useReducer, useRef, useState } from "react";
import { Store } from "lucide-react";
import { toast } from "sonner";

import {
  useAnularVenta,
  useCobrar,
  useRegistrarCompra,
  useConfirmar,
  useDictar,
  useEstadoVoz,
  useIntenciones,
  useInterpretar,
  useLeerFactura,
} from "@/entities/omnibox/api";
import {
  esDeVenta,
  type LineaContexto,
  type ProductoOpcion,
  type Propuesta,
} from "@/entities/omnibox/model/types";
import { useStore } from "@/app/providers/auth";
import { VendfyMark } from "@/shared/ui/VendfyLogo";
import { Drawer, DrawerContent, DrawerTitle } from "@/shared/ui/drawer";
import { cn } from "@/shared/lib/cn";

import { completar, mensajeDeEvento, nuevoMensaje, type Mensaje } from "../model/mensaje";
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
import { Burbuja, FilaAsistente } from "./Burbuja";
import { Compositor } from "./Compositor";
import { Respuesta } from "./Respuesta";
import { ChipsEnCurso } from "./mesa/ChipsEnCurso";
import { PanelMesa } from "./mesa/PanelMesa";
import { TarjetaVenta } from "./mesa/TarjetaVenta";
import { TarjetaCompra } from "./mesa/TarjetaCompra";

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
    return {
      // La que está a la vista; en el teléfono (panel cerrado), la última
      // con la que se trabajó: "que sean 3" es sobre esa.
      abierta: m.abierta ?? m.ultima,
      venta: { lineas: lineas(m.venta.lineas) },
      compra: { lineas: lineas(m.compra.lineas) },
    };
  };
  // Con el panel al costado, chat y panel son dos columnas de alto fijo con
  // su propio scroll, como Claude o ChatGPT. Sin panel, la conversación usa el
  // scroll de la página (en el teléfono, un scroll dentro de otro se siente mal).
  const dividido = mesa.abierta !== null && ancho;
  const hilo = useRef<HTMLDivElement>(null);

  const cobrar = useCobrar();
  const anular = useAnularVenta();
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

  // La coreografía: qué se tiene que VER cuando cambia la mesa. En G0 los
  // efectos ya se calculan y se emiten; la Fase G1 los dibuja.
  const coreografia = useRef(crearCoreografia()).current;
  const mesaPrevia = useRef(mesa);
  useEffect(() => {
    const antes = mesaPrevia.current;
    mesaPrevia.current = mesa;
    coreografia.emitir(efectosDeCambio(antes, mesa));
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

  function alAccionGuia(a: AccionGuia) {
    const actual = guiaRef.current;
    if (!actual) return;
    if (a.tipo === "ver") {
      senalar(actual.mensaje, a.campo);
      return;
    }
    // Elegir el pago desde la Guía es lo mismo que tocarlo en el panel: si se
    // venía cobrando, el efecto de la mesa (arriba) completa el cobro.
    despachar({ tipo: "pago", pago: a.pago });
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
    .filter((i) => i.disponible)
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
      if (propuesta && esDeVenta(propuesta)) aplicarVenta(id, propuesta);
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
      actualizar(m.id, (x) =>
        r!.propuesta
          ? { ...x, texto: dicho, fase: "listo", propuesta: r!.propuesta }
          : { ...x, texto: dicho, fase: "error", error: "Te escuché, pero no entendí qué querés hacer." },
      );
      if (r!.propuesta && esDeVenta(r!.propuesta)) aplicarVenta(m.id, r!.propuesta);
    } catch (error: any) {
      actualizar(m.id, (x) => ({
        ...x,
        fase: "error",
        error: error?.message ?? "No se pudo procesar el dictado.",
      }));
    } finally {
      voz.cancelar();
    }
  });

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

  // ------------------------------------------------------------ actuar

  async function ejecutar(m: Mensaje, entidades: Record<string, unknown>, despues: number | null) {
    if (!storeId || !m.propuesta?.intencion) return;
    setEjecutandoId(m.id);
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
    seguir(m, completar(m.propuesta!, { producto: op.nombre, productId: op.productId }, op));
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
    efecto.acciones.forEach(despachar);
    const destino = mesaDe(p);

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
        lineas: lineas.map((l) => ({ nombre: l.nombre, imagen: l.imagen, cantidad: l.cantidad, costo: l.costo })),
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
  if (!conversando) {
    return (
      <div className="flex flex-1 flex-col">
        <Bienvenida sugerencias={sugerencias} onSugerencia={usarSugerencia}>
          {compositor}
        </Bienvenida>
      </div>
    );
  }

  const panelAbierto = mesa.abierta !== null;
  // Ampliado: el panel ocupa todo y el chat se esconde (solo en pantalla ancha;
  // en el teléfono el panel ya es de pantalla completa).
  const ampliada = dividido && mesa.ampliada;
  // Con el panel al costado el chat es una columna angosta: sin tope de ancho.
  const anchoChat = dividido ? "" : "max-w-[880px]";

  return (
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
          <div
            ref={hilo}
            className={cn(
              "mx-auto flex w-full flex-1 flex-col gap-3 pb-4 sm:gap-3.5",
              anchoChat,
              dividido && "min-h-0 overflow-y-auto pr-1 [scrollbar-width:thin]",
            )}
          >
            {mensajes.map((m) =>
              m.evento ? (
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
                <Burbuja mensaje={m} />
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
              {guia && (
                <FranjaGuia mensaje={guia.mensaje} onAccion={alAccionGuia} onCerrar={() => setGuia(null)} />
              )}
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
            />
          </div>
        )}
      </div>

      {/* ---- la mesa, en el teléfono: sube desde abajo a pantalla casi completa */}
      {!ancho && (
        <Drawer open={panelAbierto} onOpenChange={(abierto) => !abierto && despachar({ tipo: "cerrar" })}>
          <DrawerContent className="h-[92dvh]">
            <DrawerTitle className="sr-only">{mesa.abierta === "compra" ? "Compra" : "Venta"}</DrawerTitle>
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
            />
          </DrawerContent>
        </Drawer>
      )}
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
  children,
}: {
  sugerencias: string[];
  onSugerencia: (s: string) => void;
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
