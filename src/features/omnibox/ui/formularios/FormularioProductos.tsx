import type { ReactNode } from "react";
import { Check, Loader2, Mic, PackagePlus, PanelRight, ShoppingCart, Sparkles, Trash2, TriangleAlert, X } from "lucide-react";

import type { BorradorProducto } from "@/entities/omnibox/model/types";
import { useCategoriasAsistente } from "@/entities/omnibox/api";
import { cn } from "@/shared/lib/cn";

import { cambiarBorrador, faltan, faltanProducto, textoFaltaProductos, type Formulario } from "../../model/formularios";
import { BotonCta, BotonSecundario, Cabecera, Estado, Tarjeta, dinero } from "../piezas";

const CAMPO = "h-10 w-full min-w-0 rounded-lg border bg-card px-3 text-sm outline-none focus:border-primary";

/** "15", "15,50", "" → número o null (mientras escribe "15," sigue siendo 15). */
function numero(v: string): number | null {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Productos nuevos, en el chat (G7a): uno o varios, con lo que se sabe
 * (lo que dijo la persona o el catálogo) y lo que falta marcado. Se completa
 * escribiendo acá o diciéndolo ("el alcohol a 15 y el mouse a 60"); el estado
 * vive en el mensaje, así sobrevive a recargar la página. Si se dijo que se
 * compraron, al crearlos queda la compra cargada (no registrada).
 *
 * Antes la respuesta era "todavía no lo hago desde acá" y un botón a Productos.
 */
export function TarjetaProductosNuevos({
  formulario: f,
  storeId,
  hora,
  aviso,
  onCambiar,
  onCrear,
  onDescartar,
  enPanel = false,
}: {
  formulario: Formulario;
  storeId: string;
  hora: string;
  /** Lo que se sabe de antes (el catálogo dice que el código es tal cosa). */
  aviso?: string | null;
  onCambiar: (productos: BorradorProducto[]) => void;
  onCrear: () => void;
  onDescartar: () => void;
  /** En el panel de la derecha (G9b): sin el marco de tarjeta, ocupa el panel. */
  enPanel?: boolean;
}) {
  const { data: categorias = [] } = useCategoriasAsistente(storeId);
  const lista = f.productos ?? [];

  if (f.estado === "descartado") {
    return (
      <div
        data-testid="formulario-productos"
        data-estado="descartado"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-[13px] text-muted-foreground"
      >
        <X className="size-4 shrink-0" />
        <span>Descartado</span>
        <span className="truncate line-through">{lista.map((b) => b.nombre).filter(Boolean).join(", ") || "Productos nuevos"}</span>
        <span className="cifra ml-auto text-[11px]">{hora}</span>
      </div>
    );
  }

  if (f.estado === "creado" && f.creados) {
    const comprados = f.creados.filter((c) => c.compra);
    return (
      <Marco enPanel={enPanel} estado="hecha" hora={hora}>
        <div data-testid="formulario-productos" data-estado="creado">
          <Estado icono={Check} tono="exito" titulo={f.creados.length === 1 ? `Producto creado: ${f.creados[0].nombre}` : `${f.creados.length} productos creados`}>
            <ul className="mt-1 space-y-0.5">
              {f.creados.map((c) => (
                <li key={c.productId} data-testid="producto-creado" className="flex gap-2">
                  <span className="truncate text-foreground">{c.nombre}</span>
                  <span className="cifra shrink-0">Bs {dinero(c.precio)}</span>
                </li>
              ))}
            </ul>
            {comprados.length ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs">
                <ShoppingCart className="size-3.5 shrink-0" />
                {comprados.length === f.creados.length ? "Quedaron cargados" : `${comprados.length} quedaron cargados`} en la compra: revisala y registrala.
              </p>
            ) : null}
          </Estado>
        </div>
      </Marco>
    );
  }

  const falta = faltan(f);
  const creando = f.estado === "creando";
  // El precio escrito deja de ser sugerido; el costo escrito, con el margen de la tienda, lo sugiere (G9b).
  const cambiar = (i: number, cambios: Partial<BorradorProducto>) =>
    onCambiar(lista.map((b, j) => (j === i ? cambiarBorrador(b, cambios, f.margen) : b)));
  const quitar = (i: number) => onCambiar(lista.filter((_, j) => j !== i));

  return (
    <Marco enPanel={enPanel} estado="productos-nuevos" hora={hora}>
      <form
        data-testid="formulario-productos"
        data-estado={f.estado}
        onSubmit={(e) => {
          e.preventDefault();
          if (!falta.length && !creando) onCrear();
        }}
      >
        <Cabecera icono={PackagePlus}>{lista.length === 1 ? "Producto nuevo" : `${lista.length} productos nuevos`}</Cabecera>
        {aviso ? <p className="-mt-1 mb-3 text-[13px] text-muted-foreground">{aviso}</p> : null}

        <ul className="space-y-3">
          {lista.map((b, i) => {
            const queFalta = faltanProducto(b);
            const enCategoria = b.categoria && !b.categoria.id ? `nueva:${b.categoria.nombre}` : (b.categoria?.id ?? "");
            return (
              <li key={i} data-testid="producto-nuevo" className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    value={b.nombre}
                    onChange={(e) => cambiar(i, { nombre: e.target.value })}
                    placeholder="Nombre del producto"
                    aria-label={`Nombre del producto ${i + 1}`}
                    className={cn(CAMPO, queFalta.includes("nombre") ? "border-warning" : "border-border", "font-medium")}
                  />
                  {lista.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => quitar(i)}
                      aria-label={`Sacar ${b.nombre || "este producto"}`}
                      className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </div>
                {/* Lo comprado va primero: cuántos y a cuánto (G9b). Del costo sale el precio sugerido. */}
                {b.compra ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-muted-foreground">Compraste (unidades)</span>
                      <input
                        value={b.compra.cantidad ?? ""}
                        onChange={(e) => cambiar(i, { compra: { ...b.compra!, cantidad: numero(e.target.value) } })}
                        inputMode="numeric"
                        placeholder="¿Cuántos?"
                        aria-label={`Cuántos ${b.nombre || ""} compraste`}
                        className={cn(CAMPO, "cifra", b.compra.cantidad ? "border-border" : "border-warning")}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-muted-foreground">Te costó c/u (Bs)</span>
                      <input
                        value={b.compra.costo ?? ""}
                        onChange={(e) => cambiar(i, { compra: { ...b.compra!, costo: numero(e.target.value) } })}
                        inputMode="decimal"
                        placeholder="0,00"
                        aria-label={`Costo de ${b.nombre || ""}`}
                        className={cn(CAMPO, "cifra", b.compra.costo ? "border-border" : "border-warning")}
                      />
                    </label>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                      Precio de venta (Bs)
                      {b.sugerido ? (
                        <span
                          data-testid="precio-sugerido"
                          title={`Lo propuse con lo que le ganás habitualmente al costo (+${b.sugerido.margen} %). Cambialo si querés.`}
                          className="inline-flex items-center gap-0.5 rounded-full bg-primary-soft px-1.5 font-medium text-primary"
                        >
                          <Sparkles className="size-3" />
                          sugerido +{b.sugerido.margen} %
                        </span>
                      ) : null}
                    </span>
                    <input
                      value={b.precio ?? ""}
                      onChange={(e) => cambiar(i, { precio: numero(e.target.value) })}
                      inputMode="decimal"
                      placeholder={b.compra && !b.compra.costo ? "Sale del costo" : "0,00"}
                      aria-label={`Precio de ${b.nombre || `el producto ${i + 1}`}`}
                      className={cn(CAMPO, "cifra", queFalta.includes("precio") && !(b.compra && !b.compra.costo) ? "border-warning" : "border-border")}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-muted-foreground">Categoría</span>
                    <select
                      value={enCategoria}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) cambiar(i, { categoria: null });
                        else if (v.startsWith("nueva:")) cambiar(i, { categoria: { id: null, nombre: v.slice(6) } });
                        else cambiar(i, { categoria: { id: v, nombre: categorias.find((c) => c.id === v)?.nombre ?? "" } });
                      }}
                      aria-label={`Categoría de ${b.nombre || `el producto ${i + 1}`}`}
                      className={cn(CAMPO, "border-border pr-2")}
                    >
                      <option value="">Sin categoría</option>
                      {b.categoria && !b.categoria.id ? <option value={`nueva:${b.categoria.nombre}`}>{b.categoria.nombre} (nueva)</option> : null}
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {b.compra ? null : (
                  <label className="block w-1/2 pr-1">
                    <span className="mb-1 block text-[11px] text-muted-foreground">Stock inicial (opcional)</span>
                    <input
                      value={b.stock ?? ""}
                      onChange={(e) => cambiar(i, { stock: numero(e.target.value) })}
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={`Stock inicial de ${b.nombre || ""}`}
                      className={cn(CAMPO, "cifra border-border")}
                    />
                  </label>
                )}
                {b.codigo ? <p className="cifra text-[11px] text-muted-foreground">Código de barras: {b.codigo.replace(/^0+(?=\d{8})/, "")}</p> : null}
                {b.venta ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShoppingCart className="size-3.5 shrink-0" />
                    Al crearlo, se agrega a la venta ({b.venta.cantidad}).
                  </p>
                ) : null}
                {b.existente ? (
                  <p className="flex items-start gap-1.5 text-xs font-medium text-warning-soft-foreground">
                    <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" />
                    Ya tenés «{b.existente.nombre}». Sacalo de la lista o cambiale el nombre.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>

        {falta.length ? (
          <p data-testid="formulario-falta" className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Mic className="mt-px size-3.5 shrink-0" />
            <span>
              {textoFaltaProductos(f)} Podés escribirlo acá o decírmelo en el chat («{ejemplo(lista)}»).
            </span>
          </p>
        ) : null}
        {f.error ? <p className="mt-2 text-xs font-medium text-destructive">{f.error}</p> : null}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <BotonSecundario type="button" onClick={onDescartar} disabled={creando}>
            Descartar
          </BotonSecundario>
          <BotonCta type="submit" data-testid="formulario-crear" disabled={falta.length > 0 || creando}>
            {creando ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
            {lista.length === 1 ? "Crear" : `Crear ${lista.length}`}
          </BotonCta>
        </div>
      </form>
    </Marco>
  );
}

/**
 * En el panel no hay tarjeta: el panel ya es el marco. Fuera del render (un
 * componente definido adentro se vuelve a montar en cada tecla y el campo
 * pierde el foco).
 */
function Marco({ enPanel, estado, hora, children }: { enPanel: boolean; estado: string; hora: string; children: ReactNode }) {
  return enPanel ? <div className="p-4">{children}</div> : <Tarjeta estado={estado} hora={hora}>{children}</Tarjeta>;
}

/** "el alcohol a 15" (o, de lo comprado sin costo, "el mouse me costó 35"): un ejemplo con el primero que falta. */
function ejemplo(lista: BorradorProducto[]): string {
  const sin = lista.find((b) => !(b.precio && b.precio > 0)) ?? lista[0];
  const nombre = (sin?.nombre || "el producto").toLowerCase().split(" ")[0];
  if (sin?.compra && !sin.compra.costo) return lista.length > 1 ? `el ${nombre} me costó 35` : "me costó 35";
  return lista.length > 1 ? `${nombre} a 15` : "a 15";
}

/**
 * El formulario está a la derecha (G9b): en el chat queda lo que se está
 * armando y lo que falta, con el botón para volver a él y el de crear. Se
 * sigue completando acá hablando ("el mouse me costó 35").
 */
export function ResumenProductosNuevos({
  formulario: f,
  hora,
  abierto,
  onAbrir,
  onCrear,
}: {
  formulario: Formulario;
  hora: string;
  /** El panel lo está mostrando. */
  abierto: boolean;
  onAbrir: () => void;
  onCrear: () => void;
}) {
  const lista = f.productos ?? [];
  const falta = faltan(f);
  const creando = f.estado === "creando";
  return (
    <Tarjeta estado="productos-nuevos" hora={hora}>
      <div data-testid="resumen-productos" data-estado={f.estado} className="flex items-start gap-3 pr-12">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <PackagePlus className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{lista.length === 1 ? "Producto nuevo" : `${lista.length} productos nuevos`}</p>
          <ul className="mt-1 space-y-0.5 text-[13px]">
            {lista.map((b, i) => (
              <li key={i} className="flex min-w-0 items-baseline gap-2">
                <span className="min-w-0 truncate text-foreground">{b.nombre || "Sin nombre"}</span>
                {b.compra?.costo ? <span className="cifra shrink-0 text-xs text-muted-foreground">costo Bs {dinero(b.compra.costo)}</span> : null}
                <span className="cifra ml-auto shrink-0 text-muted-foreground">
                  {b.precio ? `Bs ${dinero(b.precio)}${b.sugerido ? " (sugerido)" : ""}` : "—"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted-foreground">{falta.length ? textoFaltaProductos(f) : "Listo para crear."}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <BotonSecundario type="button" onClick={onAbrir} disabled={abierto}>
          <PanelRight className="size-4" />
          {abierto ? "A la derecha" : "Ver el formulario"}
        </BotonSecundario>
        <BotonCta type="button" data-testid="resumen-productos-crear" onClick={onCrear} disabled={falta.length > 0 || creando}>
          {creando ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
          {lista.length === 1 ? "Crear" : `Crear ${lista.length}`}
        </BotonCta>
      </div>
    </Tarjeta>
  );
}
