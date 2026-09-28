import { useRef, useState, type FormEvent } from "react";
import { Camera, Clock, Loader2, Mic, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useConfirmar, useIntenciones, useInterpretar } from "@/entities/omnibox/api";
import type { ProductoOpcion } from "@/entities/omnibox/model/types";
import { useStore } from "@/app/providers/auth";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/cn";

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
  const interpretar = useInterpretar();
  const confirmar = useConfirmar();

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
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Elegí una tienda para usar el asistente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* --- el campo --- */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
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
            className="h-11 border-0 text-base shadow-none focus-visible:ring-0"
          />

          {/* Voz y cámara: todavía no conectados, pero visibles. El caso que
              gana por goleada es dictar mientras se desempaca. */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl"
            aria-label="Dictar"
            disabled
            title="Pronto: dictar con la voz"
          >
            <Mic className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl"
            aria-label="Sacar una foto"
            disabled
            title="Pronto: cargar desde una foto"
          >
            <Camera className="h-5 w-5" />
          </Button>
        </form>

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
              className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-accent"
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
            "rounded-xl border border-dashed py-16 text-center",
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
