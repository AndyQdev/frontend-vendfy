import type { Dispatch, ReactNode } from "react";
import { BarChart3, FileText, List, Maximize2, Minimize2, Package, PackagePlus, ShoppingCart, SlidersHorizontal, Truck, X } from "lucide-react";

import type { FichaRecurso, ListaRecurso } from "@/entities/omnibox/model/types";

import { cn } from "@/shared/lib/cn";

import { unidades, type AccionMesa, type Mesa, type TipoMesa } from "../../model/mesa";
import { resumenPiezas } from "../../model/vistas";
import { PanelVista } from "../vista/PanelVista";
import { BotonIcono, FotoProducto } from "../piezas";
import { AccionesAnalisis } from "../vista/AccionesAnalisis";
import type { AccionesVista } from "../vista/acciones";
import { FichaProducto } from "./FichaProducto";
import { VentaBorrador } from "./VentaBorrador";
import { CompraBorrador } from "./CompraBorrador";
import { PanelFicha } from "../recursos/PanelFicha";
import { PanelLista } from "../recursos/PanelLista";
import { ICONO_RECURSO } from "../recursos/TarjetasRecursos";

/**
 * La mesa de trabajo: el panel de la derecha.
 *
 * Cabecera (qué se está mirando, ampliar, cerrar), dos pestañas —el producto y
 * lo que se está armando— y el cuerpo con su propio scroll. El mismo
 * componente va en la columna derecha del escritorio y en la hoja que sube
 * desde abajo en el teléfono: cambia el marco, no el contenido.
 */
export function PanelMesa({
  mesa,
  despachar,
  storeId,
  enHoja = false,
  onCobrar,
  cobrando = false,
  errorCobro = null,
  onRegistrarCompra,
  registrando = false,
  errorCompra = null,
  tienda = "",
  acciones = null,
  herramienta: cuerpoHerramienta = null,
  listaInicial,
  fichaInicial,
  onAccionFicha,
  productos: cuerpoProductos = null,
}: {
  mesa: Mesa;
  despachar: Dispatch<AccionMesa>;
  storeId: string;
  onCobrar: () => void;
  cobrando?: boolean;
  errorCobro?: string | null;
  onRegistrarCompra: () => void;
  registrando?: boolean;
  errorCompra?: string | null;
  /** Dentro de la hoja del teléfono: sin borde ni botón de ampliar. */
  enHoja?: boolean;
  /** El nombre de la tienda: va en lo que se exporta de un análisis. */
  tienda?: string;
  /** Lo que un análisis puede hacer afuera: abrir un producto, cargar a la compra (G4). */
  acciones?: AccionesVista | null;
  /** La herramienta a medida abierta (G6), ya armada: vive en su mensaje, no en la mesa. */
  herramienta?: ReactNode;
  /** La lista y la ficha (G9a) como las trajo el agente: se ven sin esperar. */
  listaInicial?: ListaRecurso;
  fichaInicial?: FichaRecurso;
  onAccionFicha?: (accion: FichaRecurso["acciones"][number], ficha: FichaRecurso) => void;
  /** El formulario de productos nuevos (G9b), ya armado: vive en su mensaje. */
  productos?: ReactNode;
}) {
  if (!mesa.abierta) return null;
  // El análisis (G3) y la herramienta (G6) se muestran en el mismo panel, con su propia pestaña.
  const analisis = mesa.abierta === "analisis" ? mesa.analisis : null;
  if (mesa.abierta === "analisis" && !analisis) return null;
  const herramienta = mesa.abierta === "herramienta" ? mesa.herramienta : null;
  if (mesa.abierta === "herramienta" && (!herramienta || !cuerpoHerramienta)) return null;
  // La lista y la ficha (G9a) tampoco son mesas: se miran y se abren.
  const lista = mesa.abierta === "lista" ? mesa.lista : null;
  const ficha = mesa.abierta === "ficha" ? mesa.ficha : null;
  if ((mesa.abierta === "lista" && !lista) || (mesa.abierta === "ficha" && !ficha)) return null;
  // Los productos nuevos (G9b): el formulario que se llena conversando.
  const nuevos = mesa.abierta === "productos" && mesa.productos && cuerpoProductos ? mesa.productos : null;
  if (mesa.abierta === "productos" && !nuevos) return null;
  const mirando = Boolean(analisis || herramienta || lista || ficha || nuevos);

  const esVenta = mesa.abierta === "venta";
  const lineas = esVenta ? mesa.venta.lineas : mesa.compra.lineas;
  const verProducto = !mirando && mesa.pestana === "producto" && mesa.producto;

  return (
    <aside
      data-testid="omnibox-mesa"
      data-mesa={mesa.abierta}
      aria-label={analisis ? "Análisis" : herramienta ? "Herramienta" : lista ? lista.titulo : ficha ? ficha.titulo : esVenta ? "Venta" : "Compra"}
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-card",
        !enHoja && "rounded-xl border border-border shadow-card",
      )}
    >
      {/* ---- cabecera */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        {analisis ? (
          <>
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <BarChart3 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p data-testid="vista-titulo" className="truncate font-semibold leading-tight">
                {analisis.vista.titulo}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Análisis · {resumenPiezas(analisis.vista).length} piezas
              </p>
            </div>
          </>
        ) : nuevos ? (
          <>
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <PackagePlus className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">Productos nuevos</p>
              <p className="truncate text-xs text-muted-foreground">Se completan acá o diciéndomelo</p>
            </div>
          </>
        ) : lista || ficha ? (
          <>
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              {(() => {
                const Icono = ICONO_RECURSO[(lista ? lista.consulta.recurso : ficha!.recurso)] ?? FileText;
                return <Icono className="size-5" />;
              })()}
            </span>
            <div className="min-w-0 flex-1">
              <p data-testid="recurso-titulo" className="truncate font-semibold leading-tight">
                {lista ? lista.titulo : ficha!.titulo}
              </p>
              <p className="truncate text-xs text-muted-foreground">{lista ? "Lista" : "Ficha"}</p>
            </div>
          </>
        ) : herramienta ? (
          <>
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <SlidersHorizontal className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p data-testid="herramienta-titulo" className="truncate font-semibold leading-tight">
                {herramienta.titulo}
              </p>
              <p className="truncate text-xs text-muted-foreground">Herramienta a medida</p>
            </div>
          </>
        ) : verProducto ? (
          <>
            <FotoProducto src={mesa.producto!.imagen} className="size-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{mesa.producto!.nombre}</p>
              {mesa.producto!.codigo && (
                <p className="cifra truncate text-xs text-muted-foreground">{mesa.producto!.codigo}</p>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              {esVenta ? <ShoppingCart className="size-5" /> : <Truck className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{esVenta ? "Venta" : "Compra"}</p>
              <p className="text-xs text-muted-foreground">
                {lineas.length === 0
                  ? "Todavía no agregaste nada"
                  : `${lineas.length} ${lineas.length === 1 ? "producto" : "productos"} · ${unidades(lineas)} un`}
              </p>
            </div>
          </>
        )}

        {analisis ? <AccionesAnalisis analisis={analisis} storeId={storeId} tienda={tienda} /> : null}
        {!enHoja && (
          <BotonIcono
            etiqueta={mesa.ampliada ? "Achicar el panel" : "Ampliar el panel"}
            onClick={() => despachar({ tipo: "ampliar" })}
          >
            {mesa.ampliada ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </BotonIcono>
        )}
        <BotonIcono etiqueta="Cerrar el panel" onClick={() => despachar({ tipo: "cerrar" })}>
          <X className="size-4" />
        </BotonIcono>
      </header>

      {/* ---- pestañas: el producto, la venta y la compra. Tocar Venta o
          Compra cambia de mesa sin perder la otra (queda en el chip). */}
      <div role="tablist" className="flex overflow-x-auto border-b border-border px-2 [scrollbar-width:none]">
        <Pestana
          activa={!mirando && mesa.pestana === "producto"}
          onClick={() =>
            // Desde el análisis o la herramienta, el producto es de la mesa con la que se venía trabajando.
            despachar(
              mirando
                ? { tipo: "abrir", mesa: mesa.ultima, pestana: "producto" }
                : { tipo: "pestana", pestana: "producto" },
            )
          }
          icono={<Package className="size-4" />}
        >
          Producto
        </Pestana>
        <Pestana
          destino="venta"
          activa={!mirando && mesa.pestana === "borrador" && esVenta}
          onClick={() => despachar({ tipo: "abrir", mesa: "venta", pestana: "borrador" })}
          icono={<ShoppingCart className="size-4" />}
        >
          Venta
          <Cuenta n={mesa.venta.lineas.length} />
        </Pestana>
        <Pestana
          destino="compra"
          activa={!mirando && mesa.pestana === "borrador" && mesa.abierta === "compra"}
          onClick={() => despachar({ tipo: "abrir", mesa: "compra", pestana: "borrador" })}
          icono={<Truck className="size-4" />}
        >
          Compra
          <Cuenta n={mesa.compra.lineas.length} />
        </Pestana>
        {mesa.analisis ? (
          <Pestana
            activa={Boolean(analisis)}
            onClick={() => despachar({ tipo: "abrir", mesa: "analisis" })}
            icono={<BarChart3 className="size-4" />}
          >
            Análisis
          </Pestana>
        ) : null}
        {mesa.herramienta ? (
          <Pestana
            activa={Boolean(herramienta)}
            onClick={() => despachar({ tipo: "abrir", mesa: "herramienta" })}
            icono={<SlidersHorizontal className="size-4" />}
          >
            Herramienta
          </Pestana>
        ) : null}
        {mesa.productos && cuerpoProductos ? (
          <Pestana activa={Boolean(nuevos)} onClick={() => despachar({ tipo: "abrir", mesa: "productos" })} icono={<PackagePlus className="size-4" />}>
            Nuevos
          </Pestana>
        ) : null}
        {mesa.lista ? (
          <Pestana activa={Boolean(lista)} onClick={() => despachar({ tipo: "abrir", mesa: "lista" })} icono={<List className="size-4" />}>
            {mesa.lista.titulo || "Lista"}
          </Pestana>
        ) : null}
        {mesa.ficha ? (
          <Pestana activa={Boolean(ficha)} onClick={() => despachar({ tipo: "abrir", mesa: "ficha" })} icono={<FileText className="size-4" />}>
            Ficha
          </Pestana>
        ) : null}
      </div>

      {/* ---- cuerpo */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {nuevos ? (
          cuerpoProductos
        ) : lista ? (
          <PanelLista
            key={lista.mensajeId}
            lista={lista}
            inicial={listaInicial}
            storeId={storeId}
            despachar={despachar}
            tienda={tienda}
          />
        ) : ficha ? (
          <PanelFicha
            key={`${ficha.recurso}:${ficha.id}`}
            ficha={ficha}
            inicial={fichaInicial}
            storeId={storeId}
            despachar={despachar}
            onAccion={onAccionFicha}
          />
        ) : herramienta ? (
          cuerpoHerramienta
        ) : analisis ? (
          <PanelVista
            key={analisis.mensajeId}
            analisis={analisis}
            storeId={storeId}
            despachar={despachar}
            ampliada={mesa.ampliada && !enHoja}
            acciones={acciones}
          />
        ) : mesa.pestana === "producto" ? (
          mesa.producto ? (
            <FichaProducto
              producto={mesa.producto}
              storeId={storeId}
              mesa={mesa.abierta as TipoMesa}
              compra={mesa.compra}
              onAgregar={(cantidad, costo, costoAnterior, costoAnteriorUsd) => {
                if (esVenta) {
                  despachar({ tipo: "agregarVenta", producto: mesa.producto!, cantidad });
                } else {
                  despachar({
                    tipo: "agregarCompra",
                    producto: mesa.producto!,
                    cantidad,
                    costo: costo ?? 0,
                    costoAnterior: costoAnterior ?? null,
                    costoAnteriorUsd: costoAnteriorUsd ?? null,
                  });
                }
                // Directo a lo que se está armando: se ve que entró y el total,
                // sin tener que adivinar que hay que tocar la otra pestaña.
                despachar({ tipo: "pestana", pestana: "borrador" });
              }}
            />
          ) : (
            <Vacio>Tocá un producto en el chat para verlo acá.</Vacio>
          )
        ) : esVenta ? (
          <VentaBorrador
            venta={mesa.venta}
            despachar={despachar}
            storeId={storeId}
            onCobrar={onCobrar}
            cobrando={cobrando}
            error={errorCobro}
          />
        ) : (
          <CompraBorrador
            compra={mesa.compra}
            despachar={despachar}
            storeId={storeId}
            onRegistrar={onRegistrarCompra}
            registrando={registrando}
            error={errorCompra}
          />
        )}
      </div>
    </aside>
  );
}

function Pestana({
  activa,
  onClick,
  icono,
  children,
  destino,
}: {
  /** Marca para la coreografía: lo que entra a esta mesa vuela hasta acá si la línea no está a la vista. */
  destino?: "venta" | "compra";
  activa: boolean;
  onClick: () => void;
  icono: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      data-pestana={destino}
      onClick={onClick}
      className={cn(
        "-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4",
        activa
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icono}
      {children}
    </button>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="px-6 py-16 text-center text-sm text-muted-foreground">{children}</p>;
}

function Cuenta({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="cifra ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
      {n}
    </span>
  );
}
