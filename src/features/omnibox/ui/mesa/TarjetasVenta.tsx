import { useState } from "react";
import { Check, Info, ShoppingCart, User, UserPlus, Users } from "lucide-react";

import type { ClienteOpcion, LineaContexto, ProductoOpcion, Propuesta } from "@/entities/omnibox/model/types";
import { cn } from "@/shared/lib/cn";

import { ElegirProducto } from "../ElegirProducto";
import { Cabecera, Estado, FotoProducto, Tarjeta, dinero } from "../piezas";
import { NuevoCliente } from "./SelectorCliente";

/**
 * Las tarjetas del chat para las frases sobre la venta.
 *
 * Son cortas a propósito: lo importante ya pasó en el panel (la línea
 * agregada, el cliente puesto). Esta tarjeta es el registro de que pasó, para
 * que el hilo cuente la venta entera se haya armado hablando o tocando.
 */

/** "Agregado a la venta · 2 × Coca Cola 2L · Bs 24,00". */
export function TarjetaMesa({
  resumen,
  imagen,
  hora,
}: {
  resumen: string;
  imagen?: string | null;
  hora: string;
}) {
  return (
    <div
      data-testid="omnibox-actividad"
      data-estado="mesa"
      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-card"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
      {imagen !== undefined && <FotoProducto src={imagen} className="size-8" />}
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{resumen}</p>
      <span className="cifra shrink-0 text-[11px] text-muted-foreground">{hora}</span>
    </div>
  );
}

/** La frase no se puede aplicar: se dice por qué, sin sugerir otra cosa. */
export function TarjetaAviso({ aviso, hora }: { aviso: string; hora: string }) {
  return (
    <Tarjeta estado="aviso" hora={hora}>
      <Estado icono={Info} tono="aviso" titulo={aviso} />
    </Tarjeta>
  );
}

/**
 * "Es para José" con dos José: se elige, NUNCA se adivina. Y si no hay
 * nadie con ese nombre, se ofrece crearlo ahí mismo con el nombre dicho.
 */
export function ElegirClienteChat({
  propuesta: p,
  hora,
  onElegir,
}: {
  propuesta: Propuesta;
  hora: string;
  onElegir: (c: { id: string; nombre: string }) => void;
}) {
  const opciones = p.clientes ?? [];
  const dicho = String((p.entidades as any).nombre ?? "");
  const [creando, setCreando] = useState(opciones.length === 0);

  return (
    <Tarjeta estado="elegir-cliente" hora={hora}>
      <Cabecera icono={opciones.length > 0 ? Users : User}>
        {p.aviso ?? "¿Para quién es la venta?"}
      </Cabecera>

      {opciones.length > 0 && (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {opciones.map((c: ClienteOpcion) => (
            <button
              key={c.id}
              type="button"
              data-testid="omnibox-opcion-cliente"
              onClick={() => onElegir({ id: c.id, nombre: c.nombre })}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold uppercase text-primary">
                {c.nombre.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold capitalize">{c.nombre.toLowerCase()}</p>
                {/* Lo que distingue a dos José: el teléfono y si es de siempre. */}
                <p className="cifra text-xs text-muted-foreground">
                  {c.telefono} · {c.compras} {c.compras === 1 ? "compra" : "compras"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {creando ? (
        <div className="rounded-lg border border-border">
          <NuevoCliente
            nombreInicial={titular(dicho)}
            onCreado={(id, nombre) => onElegir({ id, nombre })}
            onVolver={() => setCreando(false)}
            sinVolver={opciones.length === 0}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="flex items-center gap-2 px-1 text-[13px] font-medium text-primary hover:underline"
        >
          <UserPlus className="size-4" />
          Es otro: crear “{titular(dicho)}”
        </button>
      )}
    </Tarjeta>
  );
}

/** "Sacá la coca" con dos cocas en la venta: ¿cuál? */
export function ElegirLineaChat({
  propuesta: p,
  hora,
  onElegir,
}: {
  propuesta: Propuesta;
  hora: string;
  onElegir: (l: LineaContexto) => void;
}) {
  return (
    <Tarjeta estado="elegir-linea" hora={hora}>
      <Cabecera icono={ShoppingCart}>{p.aviso ?? "¿Cuál?"}</Cabecera>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {(p.lineas ?? []).map((l) => (
          <button
            key={l.productId}
            type="button"
            data-testid="omnibox-opcion-linea"
            onClick={() => onElegir(l)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
          >
            <span className="truncate font-semibold">{l.nombre}</span>
            <span className="cifra shrink-0 text-xs text-muted-foreground">{l.cantidad} en la venta</span>
          </button>
        ))}
      </div>
    </Tarjeta>
  );
}

/**
 * "zacarías inexistente" → "Zacarías Inexistente": así se guarda en la agenda.
 * Por palabras y no con `\b`: para `\b` la "í" no es letra, y quedaba
 * "ZacarÍAs".
 */
function titular(t: string): string {
  return t
    .split(" ")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

/**
 * Un pedido de varias cosas, dicho de una vez.
 *
 * Cada producto en su renglón: lo claro ya entró (✓); lo dudoso ("empire")
 * se elige acá —uno o VARIOS, cada toque agrega uno—; lo que no existe se
 * busca con otro nombre. El cliente, igual. La tarjeta no se cierra hasta que
 * no quede nada por elegir: es la lista de lo que falta.
 */
export function TarjetaPedido({
  propuesta: p,
  storeId,
  hora,
  onElegirItem,
  onElegirCliente,
}: {
  propuesta: Propuesta;
  storeId: string;
  hora: string;
  onElegirItem: (indice: number, producto: ProductoOpcion) => void;
  onElegirCliente: (c: { id: string; nombre: string }) => void;
}) {
  const items = p.items ?? [];
  const e = p.entidades as Record<string, any>;
  const pendientes =
    items.filter((it) => !it.agregados?.length).length +
    (e.nombre && !p.clienteAplicado ? 1 : 0);
  const esCompra = p.intencion === "agregar_a_compra";

  return (
    <Tarjeta estado={pendientes ? "pedido" : "pedido-listo"} hora={hora}>
      <Cabecera icono={ShoppingCart}>
        {pendientes
          ? `Agregué lo que quedó claro · falta${pendientes === 1 ? "" : "n"} ${pendientes} por elegir`
          : esCompra
            ? "Cargado a la compra"
            : "Agregado a la venta"}
      </Cabecera>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {items.map((it, i) => (
          <li key={i} data-testid="omnibox-item-pedido" className="px-3 py-2.5">
            {it.producto ? (
              <Listo imagen={it.producto.imagen}>
                {it.cantidad} × {it.producto.nombre}
                <span className="cifra ml-1.5 text-xs text-muted-foreground">
                  {esCompra
                    ? `a Bs ${dinero(it.precio ?? p.costos?.[it.producto.productId]?.ultimoCosto ?? 0)} c/u`
                    : `Bs ${dinero((it.precio ?? Number(it.producto.precio)) * it.cantidad)}`}
                </span>
              </Listo>
            ) : it.opciones.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[13px] font-semibold">
                  “{it.buscado}” ×{it.cantidad} · <span className="font-normal text-muted-foreground">elegí uno o varios</span>
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {it.opciones.map((o) => {
                    const elegido = it.agregados?.includes(o.productId);
                    return (
                      <button
                        key={o.productId}
                        type="button"
                        data-testid="omnibox-opcion-item"
                        aria-pressed={elegido}
                        onClick={() => onElegirItem(i, o)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
                          elegido ? "border-primary bg-primary-soft" : "border-border hover:bg-muted/60",
                        )}
                      >
                        <FotoProducto src={o.imagen} className="size-9" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold">{o.nombre}</span>
                          <span className={cn("cifra text-[11px]", Number(o.stock) <= 0 ? "text-destructive" : "text-muted-foreground")}>
                            {Number(o.stock)} en stock · Bs {dinero(Number(o.precio))}
                          </span>
                        </span>
                        {elegido && <Check className="size-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[13px] font-semibold">
                  No encontré “{it.noEncontrado ?? it.buscado}” ·{" "}
                  <span className="font-normal text-muted-foreground">buscalo con otro nombre</span>
                </p>
                {it.agregados?.length ? (
                  <Listo imagen={null}>Agregado</Listo>
                ) : (
                  <ElegirProducto storeId={storeId} textoInicial="" autoFoco={false} onElegir={(o) => onElegirItem(i, o)} />
                )}
              </div>
            )}
          </li>
        ))}

        {e.nombre && (
          <li data-testid="omnibox-cliente-pedido" className="px-3 py-2.5">
            {p.clienteAplicado ? (
              <Listo imagen={undefined}>
                <User className="mr-1.5 inline size-4 text-muted-foreground" />
                Para {p.clienteAplicado}
              </Listo>
            ) : (
              <ClientePendiente propuesta={p} onElegir={onElegirCliente} />
            )}
          </li>
        )}
      </ul>
    </Tarjeta>
  );
}

function Listo({ imagen, children }: { imagen: string | null | undefined; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
      {imagen !== undefined && <FotoProducto src={imagen} className="size-8" />}
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{children}</p>
    </div>
  );
}

/** El cliente del pedido que falta: dos parecidos, o nadie con ese nombre. */
function ClientePendiente({
  propuesta: p,
  onElegir,
}: {
  propuesta: Propuesta;
  onElegir: (c: { id: string; nombre: string }) => void;
}) {
  const opciones = p.clientes ?? [];
  const dicho = String((p.entidades as any).nombre ?? "");
  if (opciones.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-[13px] font-semibold">No tenés a “{titular(dicho)}” como cliente</p>
        <div className="rounded-lg border border-border">
          <NuevoCliente nombreInicial={titular(dicho)} onCreado={(id, n) => onElegir({ id, nombre: n })} onVolver={() => {}} sinVolver />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-semibold">¿Para cuál {titular(dicho)}?</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {opciones.map((c) => (
          <button
            key={c.id}
            type="button"
            data-testid="omnibox-opcion-cliente"
            onClick={() => onElegir({ id: c.id, nombre: c.nombre })}
            className="rounded-lg border border-border px-2.5 py-2 text-left hover:bg-muted/60"
          >
            <span className="block truncate text-[13px] font-semibold capitalize">{c.nombre.toLowerCase()}</span>
            <span className="cifra text-[11px] text-muted-foreground">
              {c.telefono} · {c.compras} {c.compras === 1 ? "compra" : "compras"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
