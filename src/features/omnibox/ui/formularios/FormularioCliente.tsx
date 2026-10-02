import { Check, Loader2, Mic, UserPlus } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import { faltan, type Formulario } from "../../model/formularios";
import { BotonCta, BotonSecundario, Estado } from "../piezas";

/**
 * El "Nuevo cliente" del chat (G6b), controlado: lo que tiene vive en el
 * mensaje, así se completa escribiendo acá O diciéndolo en el chat ("su
 * teléfono 71890031"), y sobrevive a recargar la página. Dice qué falta.
 */
export function FormularioCliente({
  formulario: f,
  onCampo,
  onCrear,
  onVolver,
}: {
  formulario: Formulario;
  onCampo: (clave: string, valor: string) => void;
  onCrear: () => void;
  /** Volver a las opciones (si había clientes parecidos). */
  onVolver?: () => void;
}) {
  if (f.estado === "creado" && f.creado) {
    return (
      <div data-testid="formulario-cliente" data-estado="creado" className="p-3">
        <Estado icono={Check} tono="exito" titulo={`Cliente creado: ${f.creado.nombre}`}>
          {f.campos.telefono}
          {f.campos.email ? ` · ${f.campos.email}` : ""}
        </Estado>
      </div>
    );
  }

  const falta = faltan(f);
  const creando = f.estado === "creando";
  return (
    <form
      data-testid="formulario-cliente"
      data-estado={f.estado}
      className="space-y-3 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!falta.length && !creando) onCrear();
      }}
    >
      <p className="text-sm font-semibold">Nuevo cliente</p>
      <input
        value={f.campos.nombre ?? ""}
        onChange={(e) => onCampo("nombre", e.target.value)}
        placeholder="Nombre"
        aria-label="Nombre del cliente"
        className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
      />
      <input
        value={f.campos.telefono ?? ""}
        onChange={(e) => onCampo("telefono", e.target.value)}
        placeholder="Teléfono (WhatsApp)"
        inputMode="tel"
        aria-label="Teléfono del cliente"
        className={cn(
          "cifra h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:border-primary",
          falta.some((c) => c.clave === "telefono") ? "border-warning" : "border-border",
        )}
      />
      {falta.length ? (
        <p data-testid="formulario-falta" className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Mic className="mt-px size-3.5 shrink-0" />
          <span>
            Falta {falta.map((c) => c.etiqueta).join(" y ")}. Podés escribirlo acá o decírmelo en el chat («su teléfono es…»).
          </span>
        </p>
      ) : null}
      {f.error ? <p className="text-xs font-medium text-destructive">{f.error}</p> : null}
      <div className={cn("grid gap-2", onVolver ? "grid-cols-2" : "grid-cols-1")}>
        {onVolver ? (
          <BotonSecundario type="button" onClick={onVolver}>
            Volver
          </BotonSecundario>
        ) : null}
        <BotonCta type="submit" data-testid="formulario-crear" disabled={falta.length > 0 || creando}>
          {creando ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Crear
        </BotonCta>
      </div>
    </form>
  );
}
