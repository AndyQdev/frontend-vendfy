import { useState } from "react";
import { ArrowRight, Loader2, PackageX, Pencil, Sparkles, Truck } from "lucide-react";

import type { PedidoResumen, Propuesta } from "@/entities/omnibox/model/types";
import { cn } from "@/shared/lib/cn";

import { BloqueProducto, BotonCta, BotonSecundario, Cabecera, Tarjeta, dinero } from "../piezas";

/**
 * Lo que escribe el agente (G7b): texto, como en cualquier chat. Las tarjetas
 * que preparó van debajo, cada una como un mensaje aparte con sus botones.
 */
export function TextoAgente({ texto, hora }: { texto: string; hora: string }) {
  return (
    <div data-testid="agente-texto" className="flex min-w-0 flex-1 items-start gap-2 px-1 py-1">
      <p className="min-w-0 flex-1 whitespace-pre-line text-[15px] leading-relaxed text-foreground">{texto}</p>
      <span className="cifra mt-1 shrink-0 text-[11px] text-muted-foreground">{hora}</span>
    </div>
  );
}

interface Fila {
  campo: string;
  etiqueta: string;
  antes: string;
  despues: string;
}

/**
 * Cambiar un producto (G7a): precio, nombre, categoría, código o si se ve en
 * la web. Cada fila dice cómo está y cómo va a quedar; nada se guarda sin el toque.
 */
export function TarjetaCambioProducto({
  propuesta: p,
  hora,
  ejecutando,
  onConfirmar,
  onCancelar,
}: {
  propuesta: Propuesta;
  hora: string;
  ejecutando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const filas = ((p.entidades as { filas?: Fila[] }).filas ?? []) as Fila[];
  return (
    <Tarjeta estado="cambio-producto" hora={hora}>
      <Cabecera icono={Pencil}>Cambiar producto</Cabecera>
      <BloqueProducto producto={p.producto} nombre={p.titulo ?? undefined} compacto />
      <ul data-testid="cambio-filas" className="mt-3 space-y-1.5">
        {filas.map((f) => (
          <li key={f.campo} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
            <span className="w-full text-muted-foreground sm:w-36">{f.etiqueta}</span>
            <span className="cifra font-medium text-foreground">{f.antes}</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
            <span className="cifra font-bold text-primary">{f.despues}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <BotonSecundario type="button" onClick={onCancelar} disabled={ejecutando}>
          Cancelar
        </BotonSecundario>
        <BotonCta type="button" data-testid="cambio-confirmar" onClick={onConfirmar} disabled={ejecutando || filas.length === 0}>
          {ejecutando ? <Loader2 className="size-4 animate-spin" /> : null}
          Guardar cambios
        </BotonCta>
      </div>
    </Tarjeta>
  );
}

/** Dar de baja: deja de aparecer para vender y comprar. Botón serio, porque no se deshace desde acá. */
export function TarjetaBajaProducto({
  propuesta: p,
  hora,
  ejecutando,
  onConfirmar,
  onCancelar,
}: {
  propuesta: Propuesta;
  hora: string;
  ejecutando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const e = p.entidades as { producto?: string; stock?: number };
  return (
    <Tarjeta estado="baja-producto" hora={hora}>
      <Cabecera icono={PackageX}>Dar de baja</Cabecera>
      <BloqueProducto producto={p.producto} nombre={e.producto} compacto />
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        Deja de aparecer para vender y comprar, en todas tus tiendas. Las ventas y compras que ya tuvo quedan en el historial.
        {e.stock ? ` Todavía tiene ${e.stock} en stock.` : ""}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <BotonSecundario type="button" onClick={onCancelar} disabled={ejecutando}>
          Cancelar
        </BotonSecundario>
        <button
          type="button"
          data-testid="baja-confirmar"
          onClick={onConfirmar}
          disabled={ejecutando}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 sm:h-10"
        >
          {ejecutando ? <Loader2 className="size-4 animate-spin" /> : null}
          Sí, dar de baja
        </button>
      </div>
    </Tarjeta>
  );
}

export const NOMBRE_ESTADO: Record<string, string> = {
  "por-confirmar": "Por confirmar",
  pendiente: "Pendiente",
  "en-proceso": "En proceso",
  "en-camino": "En camino",
  completado: "Completado",
  cancelado: "Cancelado",
};

const TONO_ESTADO: Record<string, string> = {
  "por-confirmar": "bg-warning-soft text-warning-soft-foreground",
  pendiente: "bg-warning-soft text-warning-soft-foreground",
  "en-proceso": "bg-primary-soft text-primary",
  "en-camino": "bg-primary-soft text-primary",
  completado: "bg-success-soft text-success-soft-foreground",
  cancelado: "bg-muted text-muted-foreground",
};

function ChipEstado({ estado }: { estado: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", TONO_ESTADO[estado] ?? "bg-muted text-muted-foreground")}>
      {NOMBRE_ESTADO[estado] ?? estado}
    </span>
  );
}

/** Mover un pedido de estado (G7d). Cancelar devuelve el stock: botón serio. */
export function TarjetaEstadoPedido({
  propuesta: p,
  hora,
  ejecutando,
  onConfirmar,
  onCancelar,
}: {
  propuesta: Propuesta;
  hora: string;
  ejecutando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const e = p.entidades as { numero?: number; estado: string; antes: string; cliente?: string | null; total?: number; productos?: string };
  const cancela = e.estado === "cancelado";
  return (
    <Tarjeta estado="estado-pedido" hora={hora}>
      <Cabecera icono={Truck}>Pedido #{e.numero}</Cabecera>
      <p className="text-sm font-semibold text-foreground">
        {e.cliente ?? "Sin cliente"}
        {e.total != null ? <span className="cifra font-normal text-muted-foreground"> · Bs {dinero(e.total)}</span> : null}
      </p>
      {e.productos ? <p className="mt-0.5 text-[13px] text-muted-foreground">{e.productos}</p> : null}
      <p className="mt-3 flex items-center gap-2">
        <ChipEstado estado={e.antes} />
        <ArrowRight className="size-3.5 text-muted-foreground" />
        <ChipEstado estado={e.estado} />
      </p>
      {cancela ? <p className="mt-2 text-xs text-muted-foreground">Al cancelarlo, lo que llevaba vuelve al stock y al cliente le llega el aviso.</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <BotonSecundario type="button" onClick={onCancelar} disabled={ejecutando}>
          {cancela ? "No" : "Cancelar"}
        </BotonSecundario>
        <button
          type="button"
          data-testid="estado-pedido-confirmar"
          onClick={onConfirmar}
          disabled={ejecutando}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-50 sm:h-10",
            cancela ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary-strong",
          )}
        >
          {ejecutando ? <Loader2 className="size-4 animate-spin" /> : null}
          {cancela ? "Sí, cancelar el pedido" : `Pasar a ${NOMBRE_ESTADO[e.estado]?.toLowerCase()}`}
        </button>
      </div>
    </Tarjeta>
  );
}

/** El siguiente paso normal de un pedido (el botón rápido de la lista). */
const SIGUIENTE: Record<string, string> = {
  "por-confirmar": "pendiente",
  pendiente: "en-proceso",
  "en-proceso": "en-camino",
  "en-camino": "completado",
};

/**
 * "¿Qué pedidos tengo?" (G7d): la lista, cada uno con su estado y el paso
 * siguiente a un toque (que arma la tarjeta para confirmar, no lo mueve solo).
 */
export function TarjetaPedidos({
  propuesta: p,
  hora,
  onMover,
}: {
  propuesta: Propuesta;
  hora: string;
  onMover: (pedido: PedidoResumen, estado: string) => void;
}) {
  const pedidos = ((p.entidades as { pedidos?: PedidoResumen[] }).pedidos ?? []) as PedidoResumen[];
  const [abierto, setAbierto] = useState<string | null>(null);
  return (
    <Tarjeta estado="lista-pedidos" hora={hora}>
      <Cabecera icono={Truck}>{pedidos.length === 1 ? "1 pedido" : `${pedidos.length} pedidos`}</Cabecera>
      {pedidos.length === 0 ? <p className="text-[13px] text-muted-foreground">No hay pedidos con ese filtro.</p> : null}
      <ul className="divide-y divide-border">
        {pedidos.map((x) => {
          // Pedidos de NUMERO (#1625) con "estado" en español: viene normalizado por el servidor o crudo.
          const estado = Object.keys(NOMBRE_ESTADO).find((k) => k === x.estado || NOMBRE_ESTADO[k] === x.estado) ?? x.estado;
          const siguiente = SIGUIENTE[estado];
          return (
            <li key={x.orderId} data-testid="pedido-fila" className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="cifra">#{x.numero}</span>
                    <span className="truncate">{x.cliente ?? "Sin cliente"}</span>
                    <ChipEstado estado={estado} />
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{x.productos}</p>
                  <p className="cifra mt-0.5 text-xs text-muted-foreground">
                    {x.fecha} · Bs {dinero(x.total)}
                  </p>
                </div>
                {siguiente || estado !== "cancelado" ? (
                  <button
                    type="button"
                    onClick={() => setAbierto(abierto === x.orderId ? null : x.orderId)}
                    className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    Mover
                  </button>
                ) : null}
              </div>
              {abierto === x.orderId ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["pendiente", "en-proceso", "en-camino", "completado", "cancelado"]
                    .filter((s) => s !== estado)
                    .map((s) => (
                      <button
                        key={s}
                        type="button"
                        data-testid={`pedido-mover-${s}`}
                        onClick={() => {
                          setAbierto(null);
                          onMover({ ...x, estado }, s);
                        }}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium",
                          s === siguiente ? "border-primary bg-primary-soft text-primary" : s === "cancelado" ? "border-destructive/40 text-destructive" : "border-border text-foreground",
                        )}
                      >
                        {s === "cancelado" ? "Cancelar" : NOMBRE_ESTADO[s]}
                      </button>
                    ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}

/** Para el ícono del agente cuando hace falta (por ahora el texto va sin tarjeta). */
export const IconoAgente = Sparkles;
