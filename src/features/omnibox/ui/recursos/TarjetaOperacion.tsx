import { useState } from "react";
import { ArrowRight, Loader2, ShieldAlert, TriangleAlert, Wrench } from "lucide-react";

import type { Propuesta, VistaOperacion } from "@/entities/omnibox/model/types";
import { cn } from "@/shared/lib/cn";

import { BotonCta, BotonSecundario, Cabecera, Tarjeta } from "../piezas";

const CAMPO = "h-10 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary";

/**
 * Una operación para confirmar (G9c): confirmar o cancelar una compra, anular
 * una venta, editar un cliente, crear o borrar una categoría. Dice qué es,
 * qué cambia (antes → después) y qué más pasa; lo que se edita se puede
 * tocar ahí mismo. Las serias (no se deshacen, mueven stock, le avisan al
 * cliente) confirman en rojo. Si no se puede, lo dice y no ofrece confirmar.
 */
export function TarjetaOperacion({
  propuesta,
  hora,
  ejecutando,
  onConfirmar,
  onCancelar,
}: {
  propuesta: Propuesta;
  hora: string;
  ejecutando: boolean;
  /** Con los datos como quedaron en los campos. */
  onConfirmar: (datos: Record<string, string>) => void;
  onCancelar: () => void;
}) {
  const vista = (propuesta.entidades as { vista: VistaOperacion }).vista;
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(vista.editables.map((e) => [e.clave, e.valor])));

  // Con campos para tocar, lo que cambia se calcula de lo que dicen ahora (no de lo que propuso el agente).
  const filas = vista.editables.length
    ? vista.editables
        .filter((e) => (valores[e.clave] ?? "").trim() !== e.actual && (valores[e.clave] ?? "").trim() !== "")
        .map((e) => ({ etiqueta: e.etiqueta, antes: e.actual || "—", despues: valores[e.clave].trim() }))
    : vista.filas;
  const datos = vista.editables.length
    ? Object.fromEntries(vista.editables.map((e) => [e.clave, (valores[e.clave] ?? "").trim()]).filter(([, v]) => v))
    : vista.datos;
  const sinCambios = vista.editables.length > 0 && filas.length === 0;

  return (
    <Tarjeta estado="operacion" hora={hora}>
      <div data-testid="tarjeta-operacion" data-operacion={vista.operacion}>
        <Cabecera icono={vista.seria ? ShieldAlert : Wrench}>{vista.titulo}</Cabecera>
        {vista.sujeto ? <p className="-mt-1 mb-3 text-[13px] text-muted-foreground">{vista.sujeto}</p> : null}

        {vista.editables.length ? (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {vista.editables.map((e) => (
              <label key={e.clave} className="block">
                <span className="mb-1 block text-[11px] text-muted-foreground">{e.etiqueta}</span>
                <input
                  value={valores[e.clave] ?? ""}
                  onChange={(ev) => setValores((v) => ({ ...v, [e.clave]: ev.target.value }))}
                  type={e.tipo === "fecha" ? "date" : e.tipo === "email" ? "email" : "text"}
                  inputMode={e.tipo === "telefono" ? "tel" : undefined}
                  aria-label={e.etiqueta}
                  className={cn(CAMPO, e.tipo === "telefono" && "cifra")}
                />
              </label>
            ))}
          </div>
        ) : null}

        {filas.length ? (
          <ul data-testid="operacion-cambios" className="space-y-1 text-sm">
            {filas.map((f) => (
              <li key={f.etiqueta} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-muted-foreground">{f.etiqueta}</span>
                <span className="text-muted-foreground line-through decoration-1">{f.antes}</span>
                <ArrowRight className="size-3.5 self-center text-muted-foreground" />
                <span className="font-medium text-foreground">{f.despues}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {vista.detalle.length ? (
          <ul className="mt-2 space-y-0.5 text-[13px] text-muted-foreground">
            {vista.detalle.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : null}

        {vista.bloqueo ? (
          <p data-testid="operacion-bloqueo" className="mt-3 flex items-start gap-1.5 text-[13px] font-medium text-warning-soft-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            {vista.bloqueo}
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <BotonSecundario type="button" onClick={onCancelar} disabled={ejecutando}>
            {vista.bloqueo ? "Entendido" : "Cancelar"}
          </BotonSecundario>
          {vista.bloqueo ? null : (
            <BotonCta
              type="button"
              data-testid="operacion-confirmar"
              onClick={() => onConfirmar(datos)}
              disabled={ejecutando || sinCambios}
              className={cn(vista.seria && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            >
              {ejecutando ? <Loader2 className="size-4 animate-spin" /> : null}
              {sinCambios ? "Sin cambios" : "Confirmar"}
            </BotonCta>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}
