import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Construction,
  DollarSign,
  HelpCircle,
  Loader2,
  Lock,
  Package,
  PackagePlus,
  Pencil,
  Receipt,
  RotateCcw,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { NOMBRE_FUENTE, type DolarDelDia, type FuenteDolar } from "@/entities/exchange-rate/model/types";
import { origenDolar } from "@/entities/exchange-rate/ui/dolar";
import { formatDolar, formatDolares } from "@/shared/lib/money";

import {
  estadoDe,
  textoAccion,
  tituloCorto,
  type BorradorProducto,
  type LineaContexto,
  type PedidoResumen,
  type ProductoOpcion,
  type Propuesta,
  type VistaSpec,
} from "@/entities/omnibox/model/types";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/cn";

import { hora, recalcularDespues, type Mensaje } from "../model/mensaje";
import { ElegirProducto } from "./ElegirProducto";
import { ElegirClienteChat, ElegirLineaChat, TarjetaAviso, TarjetaGuia, TarjetaMesa, TarjetaPedido } from "./mesa/TarjetasVenta";
import { TarjetaConfirmarCompra } from "./mesa/TarjetaCompra";
import { TarjetaFactura } from "./mesa/TarjetaFactura";
import { TarjetaVista } from "./vista/TarjetaVista";
import { ChipsAlcance } from "./vista/Alcance";
import { TarjetaHerramienta } from "./herramienta/TarjetaHerramienta";
import { ResumenProductosNuevos, TarjetaProductosNuevos } from "./formularios/FormularioProductos";
import { FormularioCliente } from "./formularios/FormularioCliente";
import { TarjetaBajaProducto, TarjetaCambioProducto, TarjetaEstadoPedido, TarjetaPedidos, TextoAgente } from "./agente/TarjetasAgente";
import { TarjetaFicha, TarjetaLista } from "./recursos/TarjetasRecursos";
import { TarjetaOperacion } from "./recursos/TarjetaOperacion";
import { nuevoFormularioProductos } from "../model/formularios";
import {
  BloqueProducto,
  BotonCta,
  BotonSecundario,
  CLASE_CTA,
  Cabecera,
  Diff,
  Divisor,
  Estado,
  FotoProducto,
  Tarjeta,
  Total,
  dinero,
  formato,
} from "./piezas";

/**
 * Lo que responde el sistema a un mensaje.
 *
 * **Casi nunca es texto.** Es una tarjeta con la acción ya armada: la foto del
 * producto, lo que va a quedar, el total y los botones. Nadie lee un párrafo
 * con la coca en la mano; mira la botella, el 12 → 32 y aprieta.
 *
 * **Los botones no los redacta el modelo.** Salen del estado de la propuesta
 * (`estadoDe`, una función pura) y del catálogo de intenciones —código
 * nuestro—, así que el mismo caso se ve siempre igual y la IA no puede ofrecer
 * una acción que no existe.
 */
export interface AccionesRespuesta {
  onConfirmar: (entidades: Record<string, unknown>, despues: number | null) => void;
  onCancelar: () => void;
  onElegirProducto: (p: ProductoOpcion) => void;
  onCompletarDato: (slot: string, valor: string) => void;
  onReintentar: () => void;
  onSugerencia: (texto: string) => void;
  /** Abrir el producto en el panel de la derecha. Nada navega fuera del chat. */
  onVerProducto: (p: ProductoOpcion) => void;
  /** El producto que está abierto en el panel, para marcar su fila. */
  productoAbierto?: string;
  /** "Es para José" con dos José: el que se tocó. */
  onElegirCliente: (c: { id: string; nombre: string }) => void;
  /** "Sacá la coca" con dos cocas en la venta: la que se tocó. */
  onElegirLinea: (l: LineaContexto) => void;
  /** Un renglón dudoso de un pedido: el producto que se tocó. */
  onElegirItem: (indice: number, p: ProductoOpcion) => void;
  /** Un renglón de la factura que se descarta. */
  onOmitirItem: (indice: number) => void;
  /** "Registrá la compra": el toque que la confirma. */
  onConfirmarCompra: () => void;
  registrandoCompra: boolean;
  /** Lo que tiene la compra ahora, para decirlo en la confirmación. */
  resumenCompra: { lineas: number; total: number; proveedor: string; moneda?: "BOB" | "USD" };
  /** Un análisis (G3): mostrar su vista en el panel. */
  onAbrirVista: () => void;
  /** La vista de ESTE mensaje es la que está abierta en el panel. */
  vistaAbierta: boolean;
  /** El "Nuevo cliente" que se llena conversando (G6b). */
  onAbrirFormulario: () => void;
  onCampoFormulario: (clave: string, valor: string) => void;
  onCrearFormulario: () => void;
  onDescartarFormulario: () => void;
  /** Una herramienta a medida (G6): abrirla en el panel, armarla de nuevo, ver sus datos si se rompió. */
  onAbrirHerramienta: () => void;
  herramientaAbierta: boolean;
  onReintentarHerramienta: () => void;
  onVerDatosHerramienta: (vista: VistaSpec) => void;
  /** Productos nuevos (G7a): lo que se cambia en el formulario, crearlos, descartarlos. */
  onCambiarProductos: (productos: BorradorProducto[]) => void;
  onCrearProductos: () => void;
  onDescartarProductos: () => void;
  /** Confirmar la tarjeta que preparó el agente: cambiar o dar de baja un producto, mover un pedido. */
  onConfirmarAccion: () => void;
  /** "Mover" un pedido de la lista: arma la tarjeta para confirmar (G7d). */
  onMoverPedido: (pedido: PedidoResumen, estado: string) => void;
  /** "No está en tu catálogo" → crearlo acá mismo (G7a): nada manda a otra pantalla. */
  onCrearProductoEnChat: (nombre: string) => void;
  /** Una lista o una ficha (G9a): abrirla a la derecha, y si es la que está a la vista. */
  onAbrirRecurso: () => void;
  recursoAbierto: boolean;
  /** Confirmar una operación (G9c) con los datos como quedaron en la tarjeta. */
  onConfirmarOperacion: (datos: Record<string, string>) => void;
  /** El formulario de productos nuevos de ESTE mensaje va en el panel (G9b), y si se está viendo. */
  productosEnPanel: boolean;
  productosAbiertos: boolean;
  onAbrirProductos: () => void;
}

export function Respuesta({
  mensaje: m,
  storeId,
  tienda,
  ejecutando,
  sugerencias,
  ...acciones
}: {
  mensaje: Mensaje;
  storeId: string;
  tienda: string;
  ejecutando: boolean;
  sugerencias: string[];
} & AccionesRespuesta) {
  const cuando = hora(m.hora);

  if (m.fase === "pensando") return <Pensando porVoz={m.porVoz && !m.texto} />;

  if (m.fase === "error" || !m.propuesta) {
    return (
      <Tarjeta estado="error" hora={cuando}>
        <Estado icono={AlertCircle} tono="error" titulo="No pude hacerlo">
          {m.error ?? "No pude procesarlo."}
        </Estado>
        {m.texto && (
          <div className="mt-3 sm:pl-11">
            <BotonSecundario onClick={acciones.onReintentar} className="w-full sm:w-auto">
              <RotateCcw />
              Reintentar
            </BotonSecundario>
          </div>
        )}
      </Tarjeta>
    );
  }

  const p = m.propuesta;

  if (m.desenlace?.tipo === "hecho") {
    return <Hecha propuesta={p} desenlace={m.desenlace} hora={cuando} />;
  }
  if (m.desenlace?.tipo === "cancelado") {
    return (
      <div
        data-testid="omnibox-actividad"
        data-estado="cancelada"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-[13px] text-muted-foreground"
      >
        <X className="h-4 w-4 shrink-0" />
        <span>Cancelado</span>
        {p.producto && <span className="truncate line-through">{p.producto.nombre}</span>}
        <span className="cifra ml-auto text-[11px]">{cuando}</span>
      </div>
    );
  }

  if (m.desenlace?.tipo === "mesa") {
    return <TarjetaMesa resumen={m.desenlace.resumen} imagen={m.desenlace.imagen} hora={cuando} />;
  }
  if (m.desenlace?.tipo === "guia") {
    return <TarjetaGuia texto={m.desenlace.texto} nivel={m.desenlace.nivel} hora={cuando} />;
  }

  switch (estadoDe(p)) {
    case "agente":
      return <TextoAgente texto={p.agente!.texto} hora={cuando} />;
    case "productos-nuevos": {
      const f = m.formulario ?? nuevoFormularioProductos(((p.entidades as any).productos ?? []) as BorradorProducto[]);
      // A la derecha (G9b): en el chat, el resumen; abierto o creado, se ve como siempre.
      if (acciones.productosEnPanel && (f.estado === "abierto" || f.estado === "creando")) {
        return (
          <ResumenProductosNuevos
            formulario={f}
            hora={cuando}
            abierto={acciones.productosAbiertos}
            onAbrir={acciones.onAbrirProductos}
            onCrear={acciones.onCrearProductos}
          />
        );
      }
      return (
        <TarjetaProductosNuevos
          formulario={m.formulario ?? nuevoFormularioProductos(((p.entidades as any).productos ?? []) as BorradorProducto[])}
          storeId={storeId}
          hora={cuando}
          aviso={p.aviso}
          onCambiar={acciones.onCambiarProductos}
          onCrear={acciones.onCrearProductos}
          onDescartar={acciones.onDescartarProductos}
        />
      );
    }
    case "cambio-producto":
      return <TarjetaCambioProducto propuesta={p} hora={cuando} ejecutando={ejecutando} onConfirmar={acciones.onConfirmarAccion} onCancelar={acciones.onCancelar} />;
    case "baja-producto":
      return <TarjetaBajaProducto propuesta={p} hora={cuando} ejecutando={ejecutando} onConfirmar={acciones.onConfirmarAccion} onCancelar={acciones.onCancelar} />;
    case "estado-pedido":
      return <TarjetaEstadoPedido propuesta={p} hora={cuando} ejecutando={ejecutando} onConfirmar={acciones.onConfirmarAccion} onCancelar={acciones.onCancelar} />;
    case "lista-pedidos":
      return <TarjetaPedidos propuesta={p} hora={cuando} onMover={acciones.onMoverPedido} />;
    case "operacion":
      return (
        <TarjetaOperacion
          propuesta={p}
          hora={cuando}
          ejecutando={ejecutando}
          onConfirmar={acciones.onConfirmarOperacion}
          onCancelar={acciones.onCancelar}
        />
      );
    case "lista":
      return <TarjetaLista lista={(p.entidades as any).lista} hora={cuando} abierta={acciones.recursoAbierto} onAbrir={acciones.onAbrirRecurso} />;
    case "ficha":
      return <TarjetaFicha ficha={(p.entidades as any).ficha} hora={cuando} abierta={acciones.recursoAbierto} onAbrir={acciones.onAbrirRecurso} />;
    case "nuevo-cliente":
      return (
        <Tarjeta estado="nuevo-cliente" hora={cuando} className="p-0 sm:p-0">
          {m.formulario?.estado === "descartado" ? (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">Descartado</p>
          ) : m.formulario ? (
            <FormularioCliente formulario={m.formulario} onCampo={acciones.onCampoFormulario} onCrear={acciones.onCrearFormulario} />
          ) : null}
        </Tarjeta>
      );
    case "confirmar-compra":
      return (
        <TarjetaConfirmarCompra
          hora={cuando}
          resumen={acciones.resumenCompra}
          registrando={acciones.registrandoCompra}
          onConfirmar={acciones.onConfirmarCompra}
        />
      );
    case "pedido":
      if ((p.entidades as any).factura) {
        return (
          <TarjetaFactura
            mensajeId={m.id}
            propuesta={p}
            storeId={storeId}
            hora={cuando}
            onElegirItem={acciones.onElegirItem}
            onOmitirItem={acciones.onOmitirItem}
          />
        );
      }
      return (
        <TarjetaPedido
          propuesta={p}
          storeId={storeId}
          hora={cuando}
          onElegirItem={acciones.onElegirItem}
          onElegirCliente={acciones.onElegirCliente}
        />
      );
    case "elegir-cliente":
      return (
        <ElegirClienteChat
          propuesta={p}
          hora={cuando}
          onElegir={acciones.onElegirCliente}
          formulario={m.formulario}
          onAbrirFormulario={acciones.onAbrirFormulario}
          onCampoFormulario={acciones.onCampoFormulario}
          onCrearFormulario={acciones.onCrearFormulario}
          onDescartarFormulario={acciones.onDescartarFormulario}
        />
      );
    case "elegir-linea":
      return <ElegirLineaChat propuesta={p} hora={cuando} onElegir={acciones.onElegirLinea} />;
    case "aviso":
      return <TarjetaAviso aviso={p.aviso!} hora={cuando} />;
    case "vista":
      return (
        <TarjetaVista
          propuesta={p}
          hora={cuando}
          abierta={acciones.vistaAbierta}
          onAbrir={acciones.onAbrirVista}
          storeId={storeId}
          pregunta={String((p.entidades as { pregunta?: unknown }).pregunta ?? m.texto ?? "")}
        />
      );
    case "herramienta":
      return (
        <TarjetaHerramienta
          estado={m.herramienta}
          hora={cuando}
          abierta={acciones.herramientaAbierta}
          onAbrir={acciones.onAbrirHerramienta}
          onReintentar={acciones.onReintentarHerramienta}
          onVerDatos={acciones.onVerDatosHerramienta}
        />
      );
    case "resuelta":
      return (
        <Resuelta
          propuesta={p}
          hora={cuando}
          productoAbierto={acciones.productoAbierto}
          onVerProducto={acciones.onVerProducto}
          onSugerencia={acciones.onSugerencia}
        />
      );
    case "espera-confirmacion":
      return (
        <EsperaConfirmacion
          propuesta={p}
          ejecutando={ejecutando}
          onConfirmar={acciones.onConfirmar}
          onCancelar={acciones.onCancelar}
        />
      );
    case "ambiguedad":
      return <Ambiguedad propuesta={p} hora={cuando} onElegir={acciones.onElegirProducto} />;
    case "sin-producto":
      return (
        <SinProducto propuesta={p} storeId={storeId} hora={cuando} onElegir={acciones.onElegirProducto} onCrear={acciones.onCrearProductoEnChat} />
      );
    case "falta-dato":
      return (
        <FaltaDato
          propuesta={p}
          storeId={storeId}
          hora={cuando}
          onGuardar={acciones.onCompletarDato}
          onElegir={acciones.onElegirProducto}
        />
      );
    case "sin-permiso":
      return <SinPermiso propuesta={p} tienda={tienda} hora={cuando} />;
    case "sin-entender":
      return p.bloqueo === "sin-ejecutor" ? (
        <SinEjecutor propuesta={p} hora={cuando} />
      ) : (
        <SinEntender aviso={p.aviso} hora={cuando} sugerencias={sugerencias} onSugerencia={acciones.onSugerencia} />
      );
  }
}

// ------------------------------------------------------------ esperando

function Pensando({ porVoz }: { porVoz: boolean }) {
  return (
    <div
      data-testid="omnibox-pensando"
      aria-live="polite"
      className="flex w-fit items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card"
    >
      <span className="flex gap-1" aria-hidden>
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-acento"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">
        {porVoz ? "Escuchando lo que dijiste…" : "Pensando…"}
      </span>
    </div>
  );
}

// ------------------------------------------------------------ confirmar

/**
 * El caso que justifica todo el módulo: algo que toca stock o dinero.
 *
 *   escritorio:  [ producto ] │ [ 12 un → 32 un ] │ [ Confirmar / Cancelar ]
 *   teléfono:    [ producto ]
 *                Stock: 12 → 32 un
 *                [ Confirmar ]
 *                [ Cancelar  ]
 *
 * "Corregir" edita ahí mismo, y el cambio y el total se recalculan mientras
 * escribe. Mandarlo a otra pantalla para cambiar un 20 por un 24 sería
 * devolverle el formulario que vinimos a sacar.
 */
function EsperaConfirmacion({
  propuesta: p,
  ejecutando,
  onConfirmar,
  onCancelar,
}: {
  propuesta: Propuesta;
  ejecutando: boolean;
  onConfirmar: (entidades: Record<string, unknown>, despues: number | null) => void;
  onCancelar: () => void;
}) {
  const [entidades, setEntidades] = useState<Record<string, unknown>>(p.entidades);
  const [corrigiendo, setCorrigiendo] = useState(false);

  const e = entidades as Record<string, any>;
  const esAjuste = p.intencion === "ajustar_stock";
  const esPrecio = p.intencion === "cambiar_precio";
  const esEntrada = p.intencion === "registrar_entrada";

  const vp = p.vistaPrevia;
  const despues = vp ? recalcularDespues(p.intencion, vp.antes, entidades) : null;
  const total =
    e.cantidad != null && e.costo != null && e.costo !== ""
      ? Number(e.cantidad) * Number(e.costo)
      : null;

  // Lo que no se puede mandar: una entrada de cero, un precio de cero.
  const valido = esPrecio
    ? Number(e.precio) > 0
    : esEntrada
      ? Number(e.cantidad) > 0
      : Number(e.cantidad) >= 0 && e.cantidad !== "";

  const poner = (slot: string, valor: string) =>
    setEntidades((prev) => ({ ...prev, [slot]: valor === "" ? "" : Number(valor) }));

  return (
    <Tarjeta estado="espera-confirmacion">
      <p className="etiqueta mb-2.5 text-[10.5px]">{tituloCorto(p)}</p>

      {/* Tres disposiciones: apilada en el teléfono; en tablet la información
          en fila y los botones abajo a la derecha; en escritorio, todo en una
          fila. Achicar la fila de escritorio a 800 px cortaba el nombre. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <BloqueProducto
            producto={p.producto}
            nombre={e.producto}
            detalle={
              esEntrada && e.cantidad
                ? `${e.cantidad} unidades${e.costo ? ` × Bs ${dinero(Number(e.costo))}` : ""}`
                : null
            }
          />

          {vp && despues != null ? (
            <>
              <Divisor />
              <Diff etiqueta={vp.etiqueta} antes={vp.antes} despues={despues} precio={esPrecio} />
            </>
          ) : null}

          {total != null && total > 0 ? (
            <>
              <Divisor />
              <Total monto={total} />
            </>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start lg:w-[156px] lg:shrink-0 lg:flex-col">
          <BotonCta
            data-testid="omnibox-confirmar"
            onClick={() => onConfirmar(entidades, despues)}
            disabled={ejecutando || !valido}
          >
            {ejecutando ? <Loader2 className="animate-spin" /> : null}
            {textoAccion(p.intencion)}
          </BotonCta>

          {/* El segundo botón depende del caso: un ajuste se cancela (es un
              número que se dice, no hay más que corregir); una entrada o un
              precio se corrigen, y ya corrigiendo se puede descartar. */}
          {esAjuste || corrigiendo ? (
            <BotonSecundario onClick={onCancelar} disabled={ejecutando}>
              {corrigiendo ? "Descartar" : "Cancelar"}
            </BotonSecundario>
          ) : (
            <BotonSecundario onClick={() => setCorrigiendo(true)} disabled={ejecutando}>
              <Pencil />
              Corregir
            </BotonSecundario>
          )}
        </div>
      </div>

      {corrigiendo && (
        <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3" data-testid="omnibox-corregir">
          {esEntrada && (
            <>
              <Campo etiqueta="Cantidad" valor={e.cantidad} onCambio={(v) => poner("cantidad", v)} autoFocus />
              <Campo etiqueta="Costo c/u (Bs)" valor={e.costo} onCambio={(v) => poner("costo", v)} decimal />
            </>
          )}
          {esPrecio && (
            <Campo etiqueta="Precio nuevo (Bs)" valor={e.precio} onCambio={(v) => poner("precio", v)} decimal autoFocus />
          )}
        </div>
      )}

      {esAjuste && (
        <Input
          value={e.motivo ?? ""}
          onChange={(ev) => setEntidades((prev) => ({ ...prev, motivo: ev.target.value }))}
          placeholder="Motivo (opcional)"
          aria-label="Motivo del ajuste"
          className="mt-3"
        />
      )}
    </Tarjeta>
  );
}

/** "Listo": compacta, bastante más baja que la tarjeta que la originó. */
function Hecha({
  propuesta: p,
  desenlace,
  hora: cuando,
}: {
  propuesta: Propuesta;
  desenlace: { resumen: string; despues: number | null; entidades: Record<string, unknown> };
  hora: string;
}) {
  const e = desenlace.entidades as Record<string, any>;
  const esPrecio = p.intencion === "cambiar_precio";
  const nombre = p.producto?.nombre ?? e.producto;

  const detalle =
    desenlace.despues != null && nombre
      ? esPrecio
        ? `El precio de ${nombre} quedó en Bs ${dinero(desenlace.despues)}.`
        : `El stock de ${nombre} se actualizó correctamente a ${formato(desenlace.despues)} unidades.`
      : desenlace.resumen;

  return (
    <Tarjeta estado="hecha" hora={cuando} className="py-3 sm:py-3.5">
      <Estado icono={Check} tono="exito" titulo="Listo">
        {detalle}
      </Estado>
    </Tarjeta>
  );
}

// ------------------------------------------------------------ lecturas

function Resuelta({
  propuesta: p,
  hora: cuando,
  productoAbierto,
  onVerProducto,
  onSugerencia,
}: {
  propuesta: Propuesta;
  hora: string;
  productoAbierto?: string;
  onVerProducto: (p: ProductoOpcion) => void;
  /** Mandar una frase como si se escribiera ("las ventas de José"). */
  onSugerencia?: (texto: string) => void;
}) {
  const datos = p.resultado?.datos as any;

  // "¿A cuánto está el dólar?" / "¿cuántos dólares entraron hoy?" (C0, sin modelo).
  if (p.intencion === "consultar_dolar" && datos) {
    const dolar = datos.dolar as DolarDelDia | null;
    const otra: FuenteDolar | null = dolar ? (dolar.fuente === "bcb" ? "binance" : "bcb") : null;
    const valorOtra = otra && !dolar?.otraFuente ? datos.fuentes?.[otra] : null;
    const hoy = datos.hoy as { dolares: number; ventas: number; bs: number } | null;
    return (
      <Tarjeta estado="resuelta" hora={cuando}>
        <Cabecera icono={DollarSign}>El dólar</Cabecera>
        <div data-testid="tarjeta-dolar" className="flex flex-wrap items-end gap-x-8 gap-y-3">
          {dolar ? (
            <div>
              <p className="text-xs text-muted-foreground">$us 1 =</p>
              <p className="cifra mt-1 text-2xl font-bold text-primary">Bs {formatDolar(dolar.valor)}</p>
              <p className="text-xs text-muted-foreground">{origenDolar(dolar)}</p>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">{p.resultado!.resumen}</p>
          )}
          {valorOtra && otra && (
            <div>
              <p className="text-xs text-muted-foreground">{NOMBRE_FUENTE[otra]}</p>
              <p className="cifra mt-1 text-lg font-semibold text-foreground">Bs {formatDolar(valorOtra.valor)}</p>
            </div>
          )}
          {hoy && (
            <div>
              <p className="text-xs text-muted-foreground">Cobrado hoy en dólares</p>
              <p className="cifra mt-1 text-lg font-semibold text-foreground">{formatDolares(hoy.dolares)}</p>
              <p className="cifra text-xs text-muted-foreground">
                {hoy.ventas === 0
                  ? "ninguna venta"
                  : `${hoy.ventas} ${hoy.ventas === 1 ? "venta" : "ventas"} · Bs ${dinero(hoy.bs)}`}
              </p>
            </div>
          )}
        </div>
      </Tarjeta>
    );
  }

  // "Datos de José" (G6b): su ficha, ahí mismo, y a un toque sus ventas.
  if (Array.isArray(datos?.clientes)) {
    return (
      <Tarjeta estado="resuelta" hora={cuando}>
        <div data-testid="tarjeta-clientes" className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {(datos.clientes as { id: string; nombre: string; telefono: string; compras: number; ultimaCompra: string | null }[]).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold uppercase text-primary">
                {c.nombre.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.nombre}</p>
                <p className="cifra text-xs text-muted-foreground">
                  {c.telefono} · {c.compras} {c.compras === 1 ? "compra" : "compras"}
                  {c.ultimaCompra
                    ? ` · última: ${new Date(c.ultimaCompra).toLocaleDateString("es-BO", { day: "numeric", month: "short" })}`
                    : ""}
                </p>
              </div>
              {onSugerencia ? (
                <BotonSecundario data-testid="cliente-ver-ventas" onClick={() => onSugerencia(`las ventas de ${c.nombre}`)} className="h-8 px-3">
                  Ver sus ventas
                </BotonSecundario>
              ) : null}
            </div>
          ))}
        </div>
      </Tarjeta>
    );
  }

  // "¿Esas son solo de José?" (G6b): la respuesta, escrita, con de quién es lo que se ve.
  if (p.intencion === "explicar_vista") {
    return (
      <div data-testid="vista-explicacion" className="flex min-w-0 flex-1 flex-col gap-1.5 px-1">
        <p className="text-[15px] leading-relaxed text-foreground">{p.resultado!.resumen}</p>
        <ChipsAlcance filtros={datos?.filtros} />
      </div>
    );
  }

  if (Array.isArray(datos?.productos)) {
    const unidad = datos.tipo === "fractional" && datos.unidad ? datos.unidad : "un";
    return (
      <Tarjeta estado="resuelta" hora={cuando}>
        <Cabecera icono={Package}>{tituloCorto(p)}</Cabecera>
        <ListaProductos
          productos={datos.productos}
          unidad={unidad}
          abierto={productoAbierto}
          onVer={onVerProducto}
        />
      </Tarjeta>
    );
  }

  if (p.intencion === "consultar_ventas" && datos) {
    return (
      <Tarjeta estado="resuelta" hora={cuando}>
        {/* El servidor manda el período con su nombre ("Agosto", "Últimos 30 días"); las
            conversaciones guardadas antes traen solo los días. */}
        <Cabecera icono={Receipt}>
          Ventas · {typeof datos.periodo === "string" ? datos.periodo : periodo(Number(p.entidades.periodo))}
        </Cabecera>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Total vendido</p>
            <p className="cifra mt-1 text-2xl font-bold text-primary">Bs {dinero(Number(datos.total))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pedidos</p>
            <p className="cifra mt-1 text-2xl font-bold text-foreground">{datos.pedidos}</p>
          </div>
        </div>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta estado="resuelta" hora={cuando}>
      <Estado icono={Check} tono="exito" titulo="Listo">
        {p.resultado!.resumen}
      </Estado>
    </Tarjeta>
  );
}

/**
 * Filas de producto con foto y stock. Tocar una abre la ficha: la respuesta ya
 * es el dato, pero si quiere ver más, está a un toque.
 */
function ListaProductos({
  productos,
  unidad,
  abierto,
  onVer,
}: {
  productos: ProductoOpcion[];
  unidad: string;
  abierto?: string;
  onVer: (p: ProductoOpcion) => void;
}) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {productos.map((pr) => (
        <button
          key={pr.storeProductId}
          type="button"
          onClick={() => onVer(pr)}
          aria-pressed={abierto === pr.productId}
          data-testid="omnibox-fila-stock"
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
            // La fila cuya ficha está a la derecha se marca: se ve de dónde salió.
            abierto === pr.productId && "bg-primary-soft hover:bg-primary-soft",
          )}
        >
          <FotoProducto src={pr.imagen} className="size-11" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{pr.nombre}</p>
            <p className="cifra text-xs text-muted-foreground">Bs {dinero(Number(pr.precio))}</p>
          </div>
          <p
            className={cn(
              "cifra text-[15px] font-bold",
              Number(pr.stock) <= 0 ? "text-destructive" : "text-foreground",
            )}
          >
            {formato(Number(pr.stock))}
            <span className="ml-1 text-xs font-semibold text-muted-foreground">{unidad}</span>
          </p>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ elegir

function Ambiguedad({
  propuesta: p,
  hora: cuando,
  onElegir,
}: {
  propuesta: Propuesta;
  hora: string;
  onElegir: (o: ProductoOpcion) => void;
}) {
  return (
    <Tarjeta estado="ambiguedad" hora={cuando}>
      <Cabecera icono={HelpCircle}>{tituloCorto(p)} · ¿cuál es?</Cabecera>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {p.opciones.map((o) => (
          <button
            key={o.storeProductId}
            type="button"
            data-testid="omnibox-opcion"
            onClick={() => onElegir(o)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
          >
            <FotoProducto src={o.imagen} className="size-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{o.nombre}</p>
              <p className="text-xs text-muted-foreground">
                <span className="cifra">{formato(Number(o.stock))} un</span> en stock ·{" "}
                <span className="cifra">Bs {dinero(Number(o.precio))}</span>
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </Tarjeta>
  );
}

/**
 * Nombró un producto que no existe. No se le vuelve a preguntar "¿qué
 * producto?": se le dice que no está y se le ofrecen las dos salidas reales.
 */
function SinProducto({
  propuesta: p,
  storeId,
  hora: cuando,
  onElegir,
  onCrear,
}: {
  propuesta: Propuesta;
  storeId: string;
  hora: string;
  onElegir: (o: ProductoOpcion) => void;
  onCrear: (nombre: string) => void;
}) {
  const [buscando, setBuscando] = useState(false);
  const nombre = p.noEncontrado ?? "";

  return (
    <Tarjeta estado="sin-producto" hora={cuando}>
      <Estado icono={Search} tono="neutro" titulo="No está en tu catálogo">
        Buscaste “{nombre}”.
      </Estado>

      <div className="mt-3 sm:pl-11">
        {buscando ? (
          <ElegirProducto storeId={storeId} textoInicial="" onElegir={onElegir} />
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <BotonCta data-testid="sin-producto-crear" onClick={() => onCrear(nombre)}>
              <PackagePlus />
              Crear ahora
            </BotonCta>
            <BotonSecundario onClick={() => setBuscando(true)}>
              <Search />
              Buscar otro nombre
            </BotonSecundario>
          </div>
        )}
      </div>
    </Tarjeta>
  );
}

/** Falta un dato: se pide ahí mismo, con el producto a la vista. */
function FaltaDato({
  propuesta: p,
  storeId,
  hora: cuando,
  onGuardar,
  onElegir,
}: {
  propuesta: Propuesta;
  storeId: string;
  hora: string;
  onGuardar: (slot: string, valor: string) => void;
  onElegir: (o: ProductoOpcion) => void;
}) {
  const [valor, setValor] = useState("");
  const falta = p.faltan[0];
  const e = p.entidades as Record<string, any>;

  // Un producto se ELIGE, no se escribe: la ejecución necesita el id, y un
  // nombre tipeado llega sin él y falla después de que la persona ya lo puso.
  if (falta.slot === "producto") {
    return (
      <Tarjeta estado="falta-dato" hora={cuando}>
        <Cabecera icono={Package}>
          {tituloCorto(p)} · {falta.pregunta}
        </Cabecera>
        <ElegirProducto storeId={storeId} onElegir={onElegir} />
      </Tarjeta>
    );
  }

  // El pago no se escribe: son tres opciones y se tocan.
  if (falta.slot === "pago") {
    return (
      <Tarjeta estado="falta-dato" hora={cuando}>
        <Cabecera icono={Receipt}>{falta.pregunta}</Cabecera>
        <div className="grid grid-cols-3 gap-2">
          {(["efectivo", "qr", "tarjeta"] as const).map((pago) => (
            <BotonSecundario key={pago} onClick={() => onGuardar("pago", pago)}>
              {pago === "qr" ? "QR" : pago[0].toUpperCase() + pago.slice(1)}
            </BotonSecundario>
          ))}
        </div>
      </Tarjeta>
    );
  }

  const decimal = falta.slot === "precio" || falta.slot === "costo";
  const esTexto = falta.slot === "nombre";

  return (
    <Tarjeta estado="falta-dato" hora={cuando}>
      <p className="etiqueta mb-2.5 text-[10.5px]">{tituloCorto(p)}</p>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-5"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (valor.trim()) onGuardar(falta.slot, valor.trim());
        }}
      >
        {(p.producto || e.producto) && <BloqueProducto producto={p.producto} nombre={e.producto} />}
        {esTexto ? (
          <label className="flex-1 space-y-1">
            <span className="block text-xs text-muted-foreground">{falta.pregunta}</span>
            <Input autoFocus value={valor} onChange={(ev) => setValor(ev.target.value)} className="h-11" />
          </label>
        ) : (
          <Campo etiqueta={falta.pregunta} valor={valor} onCambio={setValor} decimal={decimal} autoFocus />
        )}
        <BotonCta type="submit" disabled={!valor.trim()} className="sm:w-[156px]">
          Seguir
        </BotonCta>
      </form>
    </Tarjeta>
  );
}

// ------------------------------------------------------------ no se puede

const PARA: Record<string, string> = {
  consultar_ventas: "ver ventas",
  consultar_stock: "ver el inventario",
  buscar_producto: "ver productos",
  registrar_entrada: "cargar mercadería",
  ajustar_stock: "ajustar stock",
  cambiar_precio: "cambiar precios",
  crear_producto: "crear productos",
  venta_mostrador: "registrar ventas",
  cancelar_pedido: "cancelar pedidos",
  estado_pedido: "ver pedidos",
  buscar_cliente: "ver clientes",
  ocultar_de_web: "cambiar la tienda web",
};

/**
 * Sin permiso: un candado ámbar y a quién pedírselo. No es un error del
 * sistema y no tiene que parecerlo — el sistema entendió perfecto.
 *
 * El botón solo aparece si hay a quién escribirle (`VITE_SOPORTE_WHATSAPP`).
 * Un botón de "pedir acceso" que no le llega a nadie es peor que no tenerlo.
 */
function SinPermiso({ propuesta: p, tienda, hora: cuando }: { propuesta: Propuesta; tienda: string; hora: string }) {
  const accion = (p.intencion && PARA[p.intencion]) || "hacer eso";
  const soporte = (import.meta.env.VITE_SOPORTE_WHATSAPP as string | undefined)?.replace(/\D/g, "");
  const texto = `Hola, necesito permiso para ${accion} en Vendfy (tienda ${tienda}).`;

  return (
    <Tarjeta estado="sin-permiso" hora={cuando}>
      <Estado icono={Lock} tono="aviso" titulo="No tienes permiso">
        Solo los administradores pueden {accion}.
        <br />
        Si necesitas hacerlo, pídele a un administrador de la tienda.
      </Estado>
      {soporte ? (
        <div className="mt-3 sm:pl-11">
          <a
            href={`https://wa.me/${soporte}?text=${encodeURIComponent(texto)}`}
            target="_blank"
            rel="noreferrer"
            className={cn(CLASE_CTA, "w-full sm:w-auto")}
          >
            <UserPlus />
            Pedir acceso al administrador
          </a>
        </div>
      ) : null}
    </Tarjeta>
  );
}

/**
 * Entendió pero no hay con qué hacerlo. Con el agente (G7b) casi no pasa: lo
 * que no tiene un ejecutor fijo lo resuelve él. Y si pasa, no se manda a otra
 * pantalla (antes había un botón "Ir a Productos"): se dice y se sigue acá.
 */
function SinEjecutor({ propuesta: p, hora: cuando }: { propuesta: Propuesta; hora: string }) {
  return (
    <Tarjeta estado="sin-ejecutor" hora={cuando}>
      <Estado icono={Construction} tono="neutro" titulo={`Entendí: ${p.titulo?.toLowerCase() ?? "eso"}`}>
        No pude prepararlo esta vez. Cuéntamelo con un poco más de detalle y lo armo acá.
      </Estado>
    </Tarjeta>
  );
}

function SinEntender({
  aviso,
  hora: cuando,
  sugerencias,
  onSugerencia,
}: {
  aviso: string | null;
  hora: string;
  sugerencias: string[];
  onSugerencia: (t: string) => void;
}) {
  return (
    <Tarjeta estado="sin-entender" hora={cuando}>
      <Estado icono={HelpCircle} tono="neutro" titulo={aviso ?? "No entendí qué quieres hacer."} />
      {sugerencias.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:pl-11">
          <span className="text-xs text-muted-foreground">Prueba así:</span>
          {sugerencias.slice(0, 3).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSugerencia(s)}
              className="rounded-full border border-input bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-border-strong hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

// ------------------------------------------------------------ piezas locales

function Campo({
  etiqueta,
  valor,
  onCambio,
  decimal,
  autoFocus,
}: {
  etiqueta: string;
  valor: unknown;
  onCambio: (v: string) => void;
  decimal?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      <Input
        type="number"
        inputMode={decimal ? "decimal" : "numeric"}
        step={decimal ? "0.01" : "1"}
        min="0"
        autoFocus={autoFocus}
        value={valor == null ? "" : String(valor)}
        onChange={(ev) => onCambio(ev.target.value)}
        className="cifra w-full font-semibold sm:w-36"
      />
    </label>
  );
}

function periodo(dias: number): string {
  const tabla: Record<number, string> = {
    1: "hoy",
    2: "desde ayer",
    3: "desde anteayer",
    7: "últimos 7 días",
    14: "últimos 14 días",
    30: "últimos 30 días",
    60: "últimos 60 días",
    365: "último año",
  };
  return tabla[dias] ?? `últimos ${dias} días`;
}
