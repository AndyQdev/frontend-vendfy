import { useRef, useState, type FormEvent } from "react";
import {
  ArrowUp,
  Camera,
  Clock,
  Loader2,
  Mic,
  Search,
  Sparkles,
  Square,
  Store,
} from "lucide-react";
import { toast } from "sonner";

import {
  useConfirmar,
  useDictar,
  useEstadoVoz,
  useIntenciones,
  useInterpretar,
} from "@/entities/omnibox/api";
import type { ProductoOpcion } from "@/entities/omnibox/model/types";
import { useStore } from "@/app/providers/auth";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/cn";

import { useDictado } from "../model/use-dictado";
import { TarjetaActividad, type Actividad } from "./TarjetaActividad";

/**
 * El omnibox: la vista operativa del comerciante.
 *
 * Escribe (o dicta) lo que quiere hacer y el sistema responde con una tarjeta
 * ya llena que él confirma de un toque. No es un chat: no hay burbujas, no hay
 * avatar, no hay prosa. La IA no ejecuta — la IA llena el formulario.
 *
 * Los chips de sugerencia no son adorno: un cuadro de texto vacío no le dice a
 * nadie qué puede pedir, y ese es el problema que hunde a las interfaces
 * conversacionales.
 */
export function OmniboxPage() {
  const { selectedStore } = useStore();
  const storeId =
    selectedStore && selectedStore !== "all" ? selectedStore.id : null;

  const [texto, setTexto] = useState("");
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [ejecutandoId, setEjecutandoId] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const { data: intenciones } = useIntenciones();
  const { data: estadoVoz } = useEstadoVoz();
  const interpretar = useInterpretar();
  const confirmar = useConfirmar();
  const dictar = useDictar();

  /**
   * El dictado entrega el audio; el servidor transcribe E interpreta, porque es
   * el único que conoce el catálogo y puede sesgar el reconocimiento hacia los
   * nombres de los productos de ESTA tienda.
   */
  const voz = useDictado(async (audio) => {
    if (!storeId) return;
    try {
      const r = await dictar.mutateAsync({ audio, storeId });
      if (!r?.transcripcion.texto) {
        toast.info("No se entendió nada. Probá de nuevo, más cerca del micrófono.");
        return;
      }
      if (!r.propuesta) {
        // Se entendió el audio pero no la intención: se deja el texto en el
        // campo para que lo corrija en vez de obligarlo a dictar otra vez.
        setTexto(r.transcripcion.texto);
        return;
      }
      setActividades((prev) => [
        {
          id: crypto.randomUUID(),
          texto: r.transcripcion.texto,
          propuesta: r.propuesta!,
          hora: new Date(),
        },
        ...prev,
      ]);
    } catch (error: any) {
      toast.error(error?.message ?? "No se pudo procesar el dictado");
    } finally {
      voz.cancelar();
    }
  });

  // Los ejemplos salen del catálogo del backend, no de una lista escrita acá:
  // así una intención nueva aparece sola en las sugerencias.
  const sugerencias = (intenciones ?? [])
    .filter((i) => i.disponible)
    .slice(0, 5)
    .map((i) => ({ id: i.id, texto: i.ejemplos[0] }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const consulta = texto.trim();
    if (!consulta || !storeId) return;

    setTexto("");
    try {
      const propuesta = await interpretar.mutateAsync({ texto: consulta, storeId });
      setActividades((prev) => [
        {
          id: crypto.randomUUID(),
          texto: consulta,
          propuesta: propuesta!,
          hora: new Date(),
        },
        ...prev,
      ]);
    } catch (error: any) {
      toast.error(error?.message ?? "No se pudo interpretar");
      setTexto(consulta); // se devuelve el texto: reescribirlo es el peor castigo
    }
  }

  async function ejecutar(
    a: Actividad,
    entidades: Record<string, unknown>,
  ) {
    if (!storeId || !a.propuesta.intencion) return;
    setEjecutandoId(a.id);
    try {
      const resultado = await confirmar.mutateAsync({
        intencion: a.propuesta.intencion,
        entidades,
        storeId,
      });
      setActividades((prev) =>
        prev.map((x) =>
          x.id === a.id ? { ...x, cerrada: { resumen: resultado!.resumen } } : x,
        ),
      );
      toast.success(resultado!.resumen);
    } catch (error: any) {
      toast.error(error?.message ?? "No se pudo ejecutar");
    } finally {
      setEjecutandoId(null);
    }
  }

  /**
   * Elegir entre productos ambiguos NO ejecuta: completa la entidad y vuelve a
   * pasar por la política de confirmación. Ejecutar de una sería saltarse el
   * paso que hace segura toda la pantalla.
   */
  function elegirProducto(a: Actividad, opcion: ProductoOpcion) {
    const entidades = {
      ...a.propuesta.entidades,
      producto: opcion.nombre,
      productId: opcion.productId,
    };
    setActividades((prev) =>
      prev.map((x) =>
        x.id === a.id
          ? {
              ...x,
              propuesta: {
                ...x.propuesta,
                entidades,
                opciones: [],
                ejecutable: x.propuesta.faltan.length === 0,
              },
            }
          : x,
      ),
    );
  }

  function completarDato(a: Actividad, slot: string, valor: string) {
    const numerico = ["precio", "cantidad", "costo"].includes(slot);
    const entidades = {
      ...a.propuesta.entidades,
      [slot]: numerico ? Number(valor) : valor,
    };
    ejecutar({ ...a, propuesta: { ...a.propuesta, entidades } }, entidades);
  }

  if (!storeId) {
    return (
      <div className="p-4 sm:p-6">
        <div className="glass rounded-[26px] py-16 text-center">
          <Store className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="font-medium">Elegí una tienda</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            El asistente trabaja sobre una tienda a la vez. Elegila arriba a la
            izquierda: con “todas” no sabe a cuál sumarle el stock.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* --- el campo ---
          `.glass` y `rounded-[26px]`: son las convenciones del panel (ver
          index.css). Con `bg-card` a secas la tarjeta se ve como un rectángulo
          gris sobre el fondo con textura, en vez de un panel del sistema. */}
      <section className="glass rounded-[26px] p-4">
        <form onSubmit={enviar} className="flex items-center gap-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            {interpretar.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Search className="h-5 w-5 text-primary" />
            )}
          </div>

          <Input
            ref={campo}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí o dictá lo que querés hacer…"
            aria-label="Qué querés hacer"
            disabled={interpretar.isPending}
            className="glass-field h-11 rounded-2xl border-0 text-base focus-visible:ring-0"
          />

          {/* Dictar: el caso que gana por goleada es hablarle mientras se
              desempaca, con las manos ocupadas. El anillo crece con la voz
              para que se vea que está escuchando — un botón que solo cambia de
              color no distingue "grabando" de "colgado". */}
          <Button
            type="button"
            variant={voz.estado === "grabando" ? "destructive" : "outline"}
            size="icon"
            className="relative h-11 w-11 shrink-0"
            aria-label={voz.estado === "grabando" ? "Detener el dictado" : "Dictar"}
            onClick={voz.alternar}
            disabled={
              !voz.soportado ||
              !estadoVoz?.disponible ||
              voz.estado === "procesando" ||
              interpretar.isPending
            }
            title={
              !voz.soportado
                ? "Tu navegador no puede grabar audio"
                : !estadoVoz?.disponible
                  ? "El dictado no está configurado en el servidor"
                  : voz.estado === "grabando"
                    ? "Tocá para terminar"
                    : "Dictar"
            }
          >
            {voz.estado === "procesando" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : voz.estado === "grabando" ? (
              <Square className="h-4 w-4 fill-current" />
            ) : (
              <Mic className="h-5 w-5" />
            )}

            {voz.estado === "grabando" && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-destructive/60"
                style={{ transform: `scale(${1 + voz.nivel * 0.35})` }}
              />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Sacar una foto"
            disabled
            title="Pronto: cargar desde una foto"
          >
            <Camera className="h-5 w-5" />
          </Button>

          {/* El botón de enviar no es opcional.
              Sin un submit en el formulario, Enter no envía nada: se escribe,
              se aprieta Enter y no pasa absolutamente nada. Y en un teléfono ni
              siquiera hay Enter a mano. Se ve al probarlo, no al leerlo. */}
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Enviar"
            disabled={!texto.trim() || interpretar.isPending}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </form>

        {voz.estado === "grabando" && (
          // `text-destructive` es rojo oscuro y sobre el fondo oscuro del
          // panel queda ilegible. El par claro/oscuro es el que se usa en el
          // resto del proyecto.
          <p className="mt-2 flex items-center gap-2 text-xs font-medium text-red-700 dark:text-red-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-600 dark:bg-red-400" />
            Escuchando… tocá el cuadrado para terminar
          </p>
        )}
        {voz.estado === "procesando" && (
          <p className="mt-2 text-xs text-muted-foreground">Transcribiendo…</p>
        )}
        {voz.error && (
          <p
            role="alert"
            className="mt-2 text-xs font-medium text-red-700 dark:text-red-400"
          >
            {voz.error}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Por ejemplo:
          </span>
          {sugerencias.map((s) => (
            <button
              key={s.id}
              type="button"
              data-testid="omnibox-sugerencia"
              onClick={() => {
                setTexto(s.texto);
                campo.current?.focus();
              }}
              className="glass-chip press rounded-full px-3 py-1.5 text-xs"
            >
              {s.texto}
            </button>
          ))}
        </div>
      </section>

      {/* --- historial --- */}
      {actividades.length > 0 && (
        <>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Actividad de esta sesión
          </h2>

          <div className="space-y-3">
            {actividades.map((a) => (
              <TarjetaActividad
                key={a.id}
                actividad={a}
                storeId={storeId}
                ejecutando={ejecutandoId === a.id}
                onConfirmar={(x) => ejecutar(x, x.propuesta.entidades)}
                onElegirProducto={elegirProducto}
                onCompletarDato={completarDato}
              />
            ))}
          </div>
        </>
      )}

      {actividades.length === 0 && (
        <div
          data-testid="omnibox-vacio"
          className={cn(
            "glass rounded-[26px] py-16 text-center",
            "text-sm text-muted-foreground",
          )}
        >
          <Sparkles className="mx-auto mb-3 h-8 w-8 opacity-40" />
          <p className="font-medium text-foreground">Pedile algo a tu sistema</p>
          <p className="mx-auto mt-1 max-w-sm">
            Preguntá por stock, registrá lo que llegó o cambiá un precio. Lo que
            toque inventario o dinero te lo muestra antes de hacerlo.
          </p>
        </div>
      )}
    </div>
  );
}
