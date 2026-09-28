import { Fragment, useEffect, useRef, useState } from "react";
import { Sparkles, Store } from "lucide-react";
import { toast } from "sonner";

import {
  useConfirmar,
  useDictar,
  useEstadoVoz,
  useIntenciones,
  useInterpretar,
} from "@/entities/omnibox/api";
import type { ProductoOpcion, Propuesta } from "@/entities/omnibox/model/types";
import { useStore } from "@/app/providers/auth";

import { completar, nuevoMensaje, type Mensaje } from "../model/mensaje";
import { useDictado } from "../model/use-dictado";
import { Burbuja } from "./Burbuja";
import { Compositor } from "./Compositor";
import { Respuesta } from "./Respuesta";

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
  const hilo = useRef<HTMLDivElement>(null);

  const { data: intenciones } = useIntenciones();
  const { data: estadoVoz, isLoading: consultandoVoz } = useEstadoVoz();
  const interpretar = useInterpretar();
  const confirmar = useConfirmar();
  const dictar = useDictar();

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
  const ultimo = mensajes[mensajes.length - 1];
  useEffect(() => {
    const el = hilo.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [mensajes.length, ultimo?.fase]);

  // ------------------------------------------------------------ preguntar

  async function interpretarEn(id: string, consulta: string) {
    if (!storeId) return;
    try {
      const propuesta = await interpretar.mutateAsync({ texto: consulta, storeId });
      actualizar(id, (m) => ({ ...m, fase: "listo", propuesta: propuesta! }));
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
      const r = await dictar.mutateAsync({ audio, storeId });
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
    const numerico = ["precio", "cantidad", "costo"].includes(slot);
    seguir(m, completar(m.propuesta!, { [slot]: numerico ? Number(valor) : valor }));
  }

  function usarSugerencia(s: string) {
    setTexto(s);
    campo.current?.focus();
  }

  // ------------------------------------------------------------ pantalla

  if (!storeId) {
    return (
      <div className="glass rounded-[26px] py-16 text-center">
        <Store className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="font-medium">Elegí una tienda</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          El asistente trabaja sobre una tienda a la vez. Elegila arriba a la izquierda: con
          “todas” no sabe a cuál sumarle el stock.
        </p>
      </div>
    );
  }

  return (
    // Misma altura que el chat de WhatsApp del panel: la pantalla menos la
    // cabecera. El hilo scrollea adentro y el campo queda siempre abajo.
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[26rem] flex-col">
      {/* Barra de scroll fina y cian: la gris del navegador corta el vidrio. */}
      <div
        ref={hilo}
        className="-mx-1 flex-1 overflow-y-auto px-1 [scrollbar-color:hsl(var(--ring)/0.35)_transparent] [scrollbar-width:thin]"
      >
        <div className="mx-auto flex min-h-full w-full max-w-[52rem] flex-col gap-3 pb-2">
          {mensajes.length === 0 ? (
            <Bienvenida sugerencias={sugerencias} onSugerencia={usarSugerencia} />
          ) : (
            mensajes.map((m) => (
              <Fragment key={m.id}>
                <Burbuja mensaje={m} />
                <Respuesta
                  mensaje={m}
                  storeId={storeId}
                  tienda={tienda!.name}
                  ejecutando={ejecutandoId === m.id}
                  sugerencias={sugerencias}
                  onConfirmar={(entidades, despues) => ejecutar(m, entidades, despues)}
                  onCancelar={() => actualizar(m.id, (x) => ({ ...x, desenlace: { tipo: "cancelado" } }))}
                  onElegirProducto={(op) => elegirProducto(m, op)}
                  onCompletarDato={(slot, valor) => completarDato(m, slot, valor)}
                  onReintentar={() => reintentar(m)}
                  onSugerencia={usarSugerencia}
                />
              </Fragment>
            ))
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[52rem]">
        <Compositor
          ref={campo}
          texto={texto}
          onTexto={setTexto}
          onEnviar={enviar}
          voz={voz}
          vozDisponible={Boolean(estadoVoz?.disponible)}
          consultandoVoz={consultandoVoz}
        />
      </div>
    </div>
  );
}

/**
 * La pantalla vacía. Los ejemplos no son adorno: un campo vacío no le dice a
 * nadie qué puede pedir, y ese es el problema que hunde a los chats.
 */
function Bienvenida({
  sugerencias,
  onSugerencia,
}: {
  sugerencias: string[];
  onSugerencia: (s: string) => void;
}) {
  return (
    <div
      data-testid="omnibox-vacio"
      className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center"
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[var(--cta-shadow)]"
        style={{ background: "var(--primary-grad)" }}
      >
        <Sparkles className="h-7 w-7" />
      </div>
      <div>
        <h2 className="font-display text-xl font-bold">¿Qué necesitás?</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Escribí o dictá como se lo dirías a tu empleado. Lo que toque stock o plata te lo
          muestro antes de hacerlo.
        </p>
      </div>
      <div className="flex max-w-xl flex-wrap justify-center gap-2">
        {sugerencias.map((s) => (
          <button
            key={s}
            type="button"
            data-testid="omnibox-sugerencia"
            onClick={() => onSugerencia(s)}
            className="glass-chip press rounded-full px-3.5 py-2 text-sm"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
