import { useState } from "react";
import { AlertTriangle, Check, Loader2, Tag, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import type { PreciosPropuestos } from "../../model/mensaje";
import { BotonCta, BotonSecundario, Cabecera, Estado, Tarjeta, dinero } from "../piezas";

/** Más filas que esto se pliegan: la tarjeta no puede tapar todo el chat. */
const VISIBLES = 6;

/**
 * Lo que propuso una herramienta (G6), como cualquier acción N1: se revisa y
 * se confirma. La herramienta no cambia nada; esta tarjeta sí, y dice
 * exactamente qué: cada producto con su precio de ahora y el nuevo. Un cambio
 * de más del 50 % se marca (puede ser un error de la herramienta).
 */
export function TarjetaPrecios({
  precios,
  hora,
  onConfirmar,
  onCancelar,
}: {
  precios: PreciosPropuestos;
  hora: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const [todas, setTodas] = useState(false);
  const { propuesta, origen, estado } = precios;
  const n = propuesta.cambios.length;
  const titulo = n === 1 ? "Cambiar 1 precio" : `Cambiar ${n} precios`;

  if (estado === "cancelado") {
    return (
      <div
        data-testid="tarjeta-precios"
        data-estado="cancelado"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-[13px] text-muted-foreground"
      >
        <X className="size-4 shrink-0" />
        <span>Cancelado</span>
        <span className="truncate line-through">{titulo}</span>
        <span className="cifra ml-auto text-[11px]">{hora}</span>
      </div>
    );
  }

  if (estado === "aplicado") {
    return (
      <Tarjeta estado="hecha" hora={hora}>
        <div data-testid="tarjeta-precios" data-estado="aplicado">
          <Estado icono={Check} tono="exito" titulo={precios.resumen ?? titulo}>
            Lo propuso «{origen.titulo}».
          </Estado>
        </div>
      </Tarjeta>
    );
  }

  const filas = todas ? propuesta.cambios : propuesta.cambios.slice(0, VISIBLES);
  const grandes = propuesta.cambios.filter((c) => c.grande).length;
  const aplicando = estado === "aplicando";

  return (
    <Tarjeta estado="espera-confirmacion" hora={hora}>
      <div data-testid="tarjeta-precios" data-estado={estado}>
        <Cabecera icono={Tag}>{titulo}</Cabecera>
        <p className="-mt-2 mb-3 text-xs text-muted-foreground">
          Lo propuso «{origen.titulo}».{propuesta.motivo ? ` ${propuesta.motivo}` : ""}
        </p>

        <ul className="divide-y divide-border rounded-lg border border-border">
          {filas.map((c) => {
            const variacion = c.antes ? ((c.precio - c.antes) / c.antes) * 100 : null;
            return (
              <li key={c.productId} data-testid="precio-cambio" className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate text-foreground">{c.producto}</span>
                {c.antes !== null ? <span className="cifra text-muted-foreground line-through">Bs {dinero(c.antes)}</span> : null}
                <span className="cifra font-bold text-primary">Bs {dinero(c.precio)}</span>
                {variacion !== null ? (
                  <span
                    className={cn(
                      "cifra w-14 shrink-0 text-right text-xs",
                      c.grande ? "font-semibold text-warning" : "text-muted-foreground",
                    )}
                  >
                    {variacion > 0 ? "+" : ""}
                    {variacion.toLocaleString("es-BO", { maximumFractionDigits: 1 })} %
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {n > VISIBLES ? (
          <button type="button" onClick={() => setTodas(!todas)} className="mt-1.5 text-xs font-medium text-primary hover:underline">
            {todas ? "Ver menos" : `Ver los ${n - VISIBLES} restantes`}
          </button>
        ) : null}

        {grandes > 0 ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            {grandes === 1 ? "Un precio cambia" : `${grandes} precios cambian`} más del 50 %. Revísalo antes de confirmar.
          </p>
        ) : null}
        {estado === "error" && precios.error ? (
          <p role="alert" className="mt-3 rounded-lg bg-destructive-soft px-3 py-2 text-xs text-destructive">
            {precios.error}
          </p>
        ) : null}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <BotonSecundario data-testid="precios-cancelar" onClick={onCancelar} disabled={aplicando}>
            Cancelar
          </BotonSecundario>
          <BotonCta data-testid="precios-confirmar" onClick={onConfirmar} disabled={aplicando}>
            {aplicando ? <Loader2 className="animate-spin" /> : <Check />}
            {aplicando ? "Cambiando…" : titulo}
          </BotonCta>
        </div>
      </div>
    </Tarjeta>
  );
}
