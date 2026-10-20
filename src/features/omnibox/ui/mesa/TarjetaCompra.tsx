import { useEffect, useState } from "react";
import { FileText, Loader2, PackageCheck, Truck } from "lucide-react";

import type { EventoCompra } from "../../model/mensaje";
import { hora } from "../../model/mensaje";
import { BotonCta, BotonSecundario, Cabecera, FotoProducto, Tarjeta, dinero } from "../piezas";
import { NumeroAnimado } from "../coreografia/NumeroAnimado";

/**
 * La compra registrada, en el hilo del chat.
 *
 * Sin "Anular": el sistema no anula una compra recibida (ya subió stock y
 * movió el costo). Se dice cómo corregirla, en vez de ofrecer un botón que no
 * puede cumplir.
 */
export function TarjetaCompra({ evento, cuando }: { evento: EventoCompra; cuando: Date }) {
  const { compra, lineas } = evento;
  return (
    <article
      data-testid="omnibox-compra"
      className="tarjeta-sella w-full space-y-3 rounded-xl border border-border bg-card p-4 shadow-card"
    >
      <header className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
          <PackageCheck className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Compra registrada · el stock ya subió</p>
          <p className="text-[13px] text-muted-foreground">
            {compra.proveedor ?? "Sin proveedor"}
            {compra.referencia ? ` · factura ${compra.referencia}` : ""} · {compra.unidades} un
          </p>
        </div>
        <div className="text-right">
          {/* En dólares: lo pagado en dólares, y en Bs lo que quedó en la compra. */}
          {compra.moneda === "USD" && compra.totalUsd != null ? (
            <>
              <p className="cifra text-xl font-bold">$us {dinero(compra.totalUsd)}</p>
              <p className="cifra text-[11px] text-muted-foreground">
                Bs {dinero(compra.total)} · {hora(cuando)}
              </p>
            </>
          ) : (
            <>
              <p className="cifra text-xl font-bold">Bs {dinero(compra.total)}</p>
              <p className="cifra text-[11px] text-muted-foreground">{hora(cuando)}</p>
            </>
          )}
        </div>
      </header>

      <ul className="flex flex-wrap gap-2">
        {lineas.map((l) => (
          <li key={l.nombre} className="flex items-center gap-2 rounded-lg border border-border py-1 pl-1 pr-2.5 text-[13px]">
            <FotoProducto src={l.imagen} className="size-7" />
            <span className="cifra font-semibold">{l.cantidad} ×</span>
            <span className="max-w-[12rem] truncate">{l.nombre}</span>
            <span className="cifra text-muted-foreground">
              a {compra.moneda === "USD" ? "$us" : "Bs"} {dinero(l.costo)}
            </span>
            {l.stock != null && <StockSube antes={l.stock} suma={l.cantidad} />}
          </li>
        ))}
      </ul>

      {compra.adjunto && (
        <a
          href={compra.adjunto}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
        >
          <FileText className="size-4" />
          Ver la factura
        </a>
      )}

      <p className="text-xs text-muted-foreground">
        Una compra recibida no se anula: si algo vino mal, corregilo con un ajuste de stock (“quedan 8 cocas no 12”).
      </p>
    </article>
  );
}

/**
 * "Registrá la compra", dicho: se confirma con un toque. A diferencia de
 * cobrar (D2), acá no hay vuelta atrás, así que no se hace sola.
 */
export function TarjetaConfirmarCompra({
  hora: cuando,
  resumen,
  registrando,
  onConfirmar,
}: {
  hora: string;
  /** `total` en la moneda de la compra (`moneda`, Bs si no se dice). */
  resumen: { lineas: number; total: number; proveedor: string; moneda?: "BOB" | "USD" };
  registrando: boolean;
  onConfirmar: () => void;
}) {
  const [descartada, setDescartada] = useState(false);
  if (descartada) {
    return (
      <Tarjeta estado="cancelada" hora={cuando}>
        <p className="text-[13px] text-muted-foreground">No la registré. La compra sigue armada a la derecha.</p>
      </Tarjeta>
    );
  }
  return (
    <Tarjeta estado="confirmar-compra" hora={cuando}>
      <Cabecera icono={Truck}>¿Registro la compra?</Cabecera>
      <p className="text-[13px] text-muted-foreground">
        {resumen.lineas} {resumen.lineas === 1 ? "producto" : "productos"} ·{" "}
        <span className="cifra font-semibold text-foreground">
          {resumen.moneda === "USD" ? "$us" : "Bs"} {dinero(resumen.total)}
        </span>
        {resumen.proveedor ? ` · ${resumen.proveedor}` : " · sin proveedor"}. Sube el stock y no se puede anular.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <BotonCta data-testid="omnibox-confirmar-compra-chat" onClick={onConfirmar} disabled={registrando || resumen.lineas === 0}>
          {registrando ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
          Registrar compra
        </BotonCta>
        <BotonSecundario onClick={() => setDescartada(true)} disabled={registrando}>
          Todavía no
        </BotonSecundario>
      </div>
    </Tarjeta>
  );
}

/** "stock 12 → 18": el stock cuenta hasta su valor nuevo al registrar la compra. */
function StockSube({ antes, suma }: { antes: number; suma: number }) {
  const [valor, setValor] = useState(antes);
  useEffect(() => {
    const t = window.setTimeout(() => setValor(antes + suma), 120);
    return () => window.clearTimeout(t);
  }, [antes, suma]);
  return (
    <span data-testid="omnibox-stock-sube" className="cifra rounded-md bg-success/10 px-1.5 text-success">
      stock {antes} → <NumeroAnimado valor={valor} formato={(n) => String(Math.round(n))} />
    </span>
  );
}
