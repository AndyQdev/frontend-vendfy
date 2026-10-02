import { useState } from "react";
import { AlertCircle, Loader2, Table2 } from "lucide-react";

import type { HerramientaGenerada, VistaSpec } from "@/entities/omnibox/model/types";
import { useCorregirHerramienta } from "@/entities/omnibox/api";

import { vistaDeRespaldo } from "../../model/herramienta";
import { hora, type EstadoHerramienta } from "../../model/mensaje";
import { BotonSecundario, Estado } from "../piezas";
import { SandboxHerramienta } from "./SandboxHerramienta";

/** "de las 10:24" si fue hoy; "del 28/9" si no. Los datos son una foto de ese momento. */
function cuando(iso: string | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "de cuando se armó";
  return d.toDateString() === new Date().toDateString() ? `de las ${hora(d)}` : `del ${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * La herramienta a medida en el panel (G6).
 *
 * Si se rompe al dibujarse (o al usarla), el error vuelve al modelo UNA vez,
 * con los mismos datos, y la corregida reemplaza a la rota. Si se rompe de
 * nuevo no se insiste: se dice, y sus datos quedan a un toque como tablas.
 */
export function PanelHerramienta({
  estado,
  pregunta,
  storeId,
  onCambio,
  onProponer,
  onVerDatos,
}: {
  estado: EstadoHerramienta;
  pregunta: string;
  storeId: string;
  onCambio: (e: EstadoHerramienta) => void;
  onProponer: (accion: unknown, generada: HerramientaGenerada) => void;
  onVerDatos: (vista: VistaSpec) => void;
}) {
  const corregir = useCorregirHerramienta();
  const [corrigiendo, setCorrigiendo] = useState(false);

  if (estado.fase === "armando") return null;

  if (estado.fase === "error") {
    return (
      <div data-testid="herramienta-rota" className="space-y-3 p-4">
        <Estado icono={AlertCircle} tono="error" titulo="La herramienta no funcionó">
          {estado.error}
        </Estado>
        {estado.generada ? (
          <div className="sm:pl-11">
            <BotonSecundario data-testid="herramienta-ver-datos" onClick={() => onVerDatos(vistaDeRespaldo(estado.generada!))}>
              <Table2 />
              Ver sus datos en una tabla
            </BotonSecundario>
          </div>
        ) : null}
      </div>
    );
  }

  const g = estado.generada;

  async function alFallar(mensaje: string) {
    if (estado.fase !== "lista") return;
    if (estado.corregida || corrigiendo) {
      onCambio({ fase: "error", error: `Se rompió al usarla (${mensaje}). Probá pidiéndola de otra forma.`, generada: g });
      return;
    }
    setCorrigiendo(true);
    try {
      const r = await corregir.mutateAsync({ storeId, pregunta, plan: g.plan, tsx: g.tsx, error: mensaje, datos: g.datos });
      onCambio({ fase: "lista", generada: { ...g, tsx: r.tsx, codigo: r.codigo }, corregida: true });
    } catch (e: any) {
      onCambio({ fase: "error", error: e?.message ?? "No se pudo corregir.", generada: g });
    } finally {
      setCorrigiendo(false);
    }
  }

  return (
    <div data-testid="omnibox-herramienta" className="flex min-h-full flex-col">
      {g.descripcion ? <p className="px-4 pt-3 text-[13px] leading-relaxed text-muted-foreground">{g.descripcion}</p> : null}
      {corrigiendo ? (
        <p data-testid="herramienta-corrigiendo" role="status" className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning-soft-foreground">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          Tuvo un error al dibujarse. La estoy corrigiendo…
        </p>
      ) : (
        <SandboxHerramienta
          codigo={g.codigo}
          datos={g.datos}
          titulo={g.titulo}
          onError={alFallar}
          onProponer={(accion) => onProponer(accion, g)}
          className="flex-1"
        />
      )}
      <p className="mt-auto border-t border-border px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        La armó la IA para esta pregunta, con tus datos {cuando(g.creada)}. No cambia nada por su cuenta: lo que proponga, lo
        revisás antes.
      </p>
    </div>
  );
}
