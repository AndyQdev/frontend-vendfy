import { useEffect, useState } from "react";
import { AlertCircle, PanelRight, RotateCcw, SlidersHorizontal, Table2 } from "lucide-react";

import type { VistaSpec } from "@/entities/omnibox/model/types";

import { vistaDeRespaldo } from "../../model/herramienta";
import type { EstadoHerramienta } from "../../model/mensaje";
import { BotonSecundario, Estado, Tarjeta } from "../piezas";

/** Lo que tarda en general (ver e2e/experimentos): para que la espera tenga un horizonte. */
const TARDA = "suele tardar menos de un minuto";

/**
 * La respuesta a "¿qué pasa si…?" en el chat (G6). La herramienta de verdad
 * está en el panel; acá queda el progreso mientras se arma (tarda: la escribe
 * el modelo más capaz y se revisa y se compila), y después qué se armó y el
 * botón para volver a abrirla.
 */
export function TarjetaHerramienta({
  estado,
  hora,
  abierta,
  onAbrir,
  onReintentar,
  onVerDatos,
}: {
  estado: EstadoHerramienta | undefined;
  hora: string;
  abierta: boolean;
  onAbrir: () => void;
  onReintentar: () => void;
  onVerDatos: (vista: VistaSpec) => void;
}) {
  // Sin estado: la propuesta acaba de llegar y en este mismo instante se pide la herramienta.
  if (!estado) return <Armando desde={Date.now()} />;
  if (estado.fase === "armando") return <Armando desde={estado.desde} />;

  if (estado.fase === "error") {
    return (
      <Tarjeta estado="error" hora={hora}>
        <div data-testid="tarjeta-herramienta" data-fase="error">
          <Estado icono={AlertCircle} tono="error" titulo="No pude armar la herramienta">
            {estado.error}
          </Estado>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:pl-11">
            <BotonSecundario data-testid="herramienta-reintentar" onClick={onReintentar}>
              <RotateCcw />
              Armarla de nuevo
            </BotonSecundario>
            {estado.generada ? (
              <BotonSecundario onClick={() => onVerDatos(vistaDeRespaldo(estado.generada!))}>
                <Table2 />
                Ver sus datos en una tabla
              </BotonSecundario>
            ) : null}
          </div>
        </div>
      </Tarjeta>
    );
  }

  const g = estado.generada;
  return (
    <Tarjeta estado="herramienta" hora={hora}>
      <div data-testid="tarjeta-herramienta" data-fase="lista">
        <div className="flex items-start gap-3 pr-12">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <SlidersHorizontal className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{g.titulo}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Herramienta a medida · la armó la IA con tus datos</p>
          </div>
        </div>
        {g.descripcion ? <p className="mt-2 text-[13px] leading-relaxed text-foreground sm:pl-[3.25rem]">{g.descripcion}</p> : null}
        <div className="mt-3 sm:pl-[3.25rem]">
          {abierta ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <PanelRight className="size-3.5" />
              Abierta en el panel
            </p>
          ) : (
            <BotonSecundario data-testid="herramienta-abrir" onClick={onAbrir} className="w-full sm:w-auto">
              <SlidersHorizontal />
              Abrir herramienta
            </BotonSecundario>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

/** Mientras se arma: cuánto va y cuánto suele tardar. Sin pasos inventados: no hay forma de saber en cuál va. */
function Armando({ desde }: { desde: number }) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const segundos = Math.max(0, Math.round((ahora - desde) / 1000));
  return (
    <div
      data-testid="tarjeta-herramienta"
      data-fase="armando"
      aria-live="polite"
      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <SlidersHorizontal className="size-4 motion-safe:animate-pulse" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Armando una herramienta a medida…</p>
        <p className="text-xs text-muted-foreground">Leo tus datos y escribo la herramienta; {TARDA}.</p>
      </div>
      <span className="cifra shrink-0 text-xs text-muted-foreground" aria-label={`${segundos} segundos`}>
        {segundos} s
      </span>
    </div>
  );
}
