import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight, FileText, MessageCircle, Package, PanelRight, Radio, Receipt, Star, Store, Tags, Truck, Users } from "lucide-react";

import type { FichaRecurso, IdRecurso, ListaRecurso } from "@/entities/omnibox/model/types";

import { celda, resumenLista } from "../../model/recursos";
import { BotonSecundario, Tarjeta } from "../piezas";
import { EstadoChip } from "./EstadoChip";

export const ICONO_RECURSO: Record<IdRecurso, LucideIcon> = {
  ventas: Receipt,
  compras: Truck,
  productos: Package,
  clientes: Users,
  movimientos: ArrowLeftRight,
  categorias: Tags,
  marcas: Tags,
  resenas: Star,
  tiendas: Store,
  conversaciones: MessageCircle,
  lives: Radio,
};

/**
 * La lista en el chat (G9a): qué se pidió, cuántos son y las primeras filas.
 * La lista entera está a la derecha; en el teléfono, se abre con el botón.
 */
export function TarjetaLista({
  lista,
  hora,
  abierta,
  onAbrir,
}: {
  lista: ListaRecurso;
  hora: string;
  /** Esta es la lista que está a la vista. */
  abierta: boolean;
  onAbrir: () => void;
}) {
  const Icono = ICONO_RECURSO[lista.recurso] ?? FileText;
  const [primera, segunda] = lista.columnas;
  const plata = lista.columnas.find((c) => c.formato === "dinero");
  return (
    <Tarjeta estado="lista" hora={hora}>
      <div data-testid="tarjeta-lista" data-recurso={lista.recurso} className="flex items-start gap-3 pr-12">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <Icono className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="cifra text-sm font-semibold text-foreground">{resumenLista(lista)}</p>
          {lista.chips.length ? <p className="mt-0.5 text-xs text-muted-foreground">{lista.chips.map((c) => c.texto).join(" · ")}</p> : null}
        </div>
      </div>
      {lista.filas.length ? (
        <ul className="mt-2.5 space-y-1 text-[13px] sm:pl-[3.25rem]">
          {lista.filas.slice(0, 3).map((f, i) => (
            <li key={String(f._id ?? i)} className="flex min-w-0 items-baseline gap-2">
              <span className="min-w-0 truncate text-foreground">
                {celda(f[primera.clave], primera.formato)}
                {segunda && segunda.formato !== "dinero" ? <span className="text-muted-foreground"> · {celda(f[segunda.clave], segunda.formato)}</span> : null}
              </span>
              {plata ? <span className="cifra ml-auto shrink-0 text-muted-foreground">{celda(f[plata.clave], "dinero")}</span> : null}
            </li>
          ))}
          {lista.resumen.total > 3 ? <li className="text-xs text-muted-foreground">y {lista.resumen.total - 3} más</li> : null}
        </ul>
      ) : null}
      <div className="mt-3 flex justify-end">
        <BotonSecundario type="button" data-testid="tarjeta-lista-abrir" onClick={onAbrir} disabled={abierta}>
          <PanelRight className="size-4" />
          {abierta ? "A la derecha" : "Ver la lista"}
        </BotonSecundario>
      </div>
    </Tarjeta>
  );
}

/** La ficha en el chat (G9a): qué es y lo principal; la ficha entera, a la derecha. */
export function TarjetaFicha({
  ficha,
  hora,
  abierta,
  onAbrir,
}: {
  ficha: FichaRecurso;
  hora: string;
  abierta: boolean;
  onAbrir: () => void;
}) {
  const Icono = ICONO_RECURSO[ficha.recurso] ?? FileText;
  return (
    <Tarjeta estado="ficha" hora={hora}>
      <div data-testid="tarjeta-ficha" data-recurso={ficha.recurso} className="flex items-start gap-3 pr-12">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <Icono className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {ficha.titulo}
            {ficha.subtitulo ? <EstadoChip texto={ficha.subtitulo} /> : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ficha.datos
              .slice(0, 3)
              .map((d) => `${d.etiqueta}: ${d.valor}`)
              .join(" · ")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <BotonSecundario type="button" data-testid="tarjeta-ficha-abrir" onClick={onAbrir} disabled={abierta}>
          <PanelRight className="size-4" />
          {abierta ? "A la derecha" : "Abrir"}
        </BotonSecundario>
      </div>
    </Tarjeta>
  );
}
