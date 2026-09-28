import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Construction,
  HelpCircle,
  Loader2,
  Lock,
  Package,
  PackagePlus,
  Pencil,
  Receipt,
  RotateCcw,
  Search,
  Tag,
  UserPlus,
  X,
} from "lucide-react";

import {
  estadoDe,
  textoAccion,
  tituloCorto,
  type ProductoOpcion,
  type Propuesta,
} from "@/entities/omnibox/model/types";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/cn";

import { hora, recalcularDespues, type Mensaje } from "../model/mensaje";
import { ElegirProducto } from "./ElegirProducto";
import {
  BotonCta,
  BotonSecundario,
  CLASE_CTA,
  Cabecera,
  Diff,
  Divisor,
  FotoProducto,
  Panel,
  Tarjeta,
  Total,
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
  if (m.fase === "pensando") return <Pensando porVoz={m.porVoz && !m.texto} />;

  if (m.fase === "error" || !m.propuesta) {
    return (
      <Tarjeta estado="error">
        <Aviso icono={AlertCircle} tono="error">
          {m.error ?? "No pude procesarlo."}
        </Aviso>
        {m.texto && (
          <BotonSecundario onClick={acciones.onReintentar} className="w-full sm:w-auto">
            <RotateCcw className="h-4 w-4" />
            Reintentar
          </BotonSecundario>
        )}
      </Tarjeta>
    );
  }

  const p = m.propuesta;

  if (m.desenlace?.tipo === "hecho") {
    return <Hecha propuesta={p} desenlace={m.desenlace} cuando={m.hora} />;
  }
  if (m.desenlace?.tipo === "cancelado") {
    return (
      <div
        data-testid="omnibox-actividad"
        data-estado="cancelada"
        className="glass flex items-center gap-2.5 rounded-[22px] px-4 py-3 text-sm text-muted-foreground opacity-70"
      >
        <X className="h-4 w-4 shrink-0" />
        <span>Cancelado</span>
        {p.producto && <span className="truncate line-through">{p.producto.nombre}</span>}
      </div>
    );
  }

  const estado = estadoDe(p);
  switch (estado) {
    case "resuelta":
      return <Resuelta propuesta={p} />;
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
      return <Ambiguedad propuesta={p} onElegir={acciones.onElegirProducto} />;
    case "sin-producto":
      return (
        <SinProducto
          propuesta={p}
          storeId={storeId}
          onElegir={acciones.onElegirProducto}
        />
      );
    case "falta-dato":
      return (
        <FaltaDato
          propuesta={p}
          storeId={storeId}
          onGuardar={acciones.onCompletarDato}
          onElegir={acciones.onElegirProducto}
        />
      );
    case "sin-permiso":
      return <SinPermiso propuesta={p} tienda={tienda} />;
    case "sin-entender":
      return p.bloqueo === "sin-ejecutor" ? (
        <SinEjecutor propuesta={p} />
      ) : (
        <SinEntender aviso={p.aviso} sugerencias={sugerencias} onSugerencia={acciones.onSugerencia} />
      );
  }
}

// ------------------------------------------------------------ esperando

function Pensando({ porVoz }: { porVoz: boolean }) {
  return (
    <div
      data-testid="omnibox-pensando"
      aria-live="polite"
      className="glass flex w-fit items-center gap-3 rounded-2xl px-4 py-3"
    >
      <span className="flex gap-1" aria-hidden>
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="h-2 w-2 animate-bounce rounded-full bg-ring"
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
 * "Corregir" edita ahí mismo, y el diff y el total cambian mientras escribe.
 * Mandarlo a otra pantalla para cambiar un 20 por un 24 sería devolverle el
 * formulario que vinimos a sacar.
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
      <Cabecera icono={esPrecio ? Tag : Package}>{tituloCorto(p)}</Cabecera>

      <Panel className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <BloqueProducto
          producto={p.producto}
          nombre={e.producto}
          detalle={
            esEntrada && e.cantidad
              ? `${e.cantidad} unidades${e.costo ? ` × Bs ${formato(Number(e.costo))}` : ""}`
              : null
          }
        />

        {vp && despues != null && (
          <>
            <Divisor />
            <Diff
              etiqueta={vp.etiqueta}
              antes={vp.antes}
              despues={despues}
              prefijo={esPrecio ? "Bs " : undefined}
              icono={esPrecio ? Tag : Package}
            />
          </>
        )}

        {total != null && total > 0 && (
          <>
            <Divisor />
            <Total monto={total} />
          </>
        )}
      </Panel>

      {corrigiendo && (
        <div className="flex flex-wrap gap-3 px-1" data-testid="omnibox-corregir">
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
          className="glass-field h-11 rounded-xl"
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <BotonCta
          data-testid="omnibox-confirmar"
          onClick={() => onConfirmar(entidades, despues)}
          disabled={ejecutando || !valido}
        >
          {ejecutando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {textoAccion(p.intencion)}
        </BotonCta>

        {/* El segundo botón depende del caso: un ajuste se cancela (es un
            número que se dice, no hay nada que corregir más que ese); una
            entrada o un precio se corrigen, y ya corrigiendo se puede descartar. */}
        {esAjuste || corrigiendo ? (
          <BotonSecundario onClick={onCancelar} disabled={ejecutando}>
            <X className="h-4 w-4" />
            {corrigiendo ? "Descartar" : "Cancelar"}
          </BotonSecundario>
        ) : (
          <BotonSecundario onClick={() => setCorrigiendo(true)} disabled={ejecutando}>
            <Pencil className="h-4 w-4" />
            Corregir
          </BotonSecundario>
        )}
      </div>
    </Tarjeta>
  );
}

function Hecha({
  propuesta: p,
  desenlace,
  cuando,
}: {
  propuesta: Propuesta;
  desenlace: { resumen: string; despues: number | null; entidades: Record<string, unknown> };
  cuando: Date;
}) {
  const e = desenlace.entidades as Record<string, any>;
  const esPrecio = p.intencion === "cambiar_precio";
  const total = e.cantidad != null && e.costo ? Number(e.cantidad) * Number(e.costo) : null;

  const titulo =
    desenlace.despues != null
      ? esPrecio
        ? `Listo · precio Bs ${formato(desenlace.despues)}`
        : `Listo · stock ${formato(desenlace.despues)}`
      : `Listo · ${desenlace.resumen}`;

  return (
    <Tarjeta estado="hecha" apagada>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* `success` y no `emerald`: este proyecto remapea emerald a cian en
            tailwind.config, y un check cian se confunde con los botones. */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
          <Check className="h-5 w-5" strokeWidth={3} />
        </span>
        <FotoProducto src={p.producto?.imagen} className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{titulo}</p>
          <p className="truncate text-sm text-muted-foreground">{p.producto?.nombre ?? e.producto}</p>
          {e.cantidad != null && p.intencion === "registrar_entrada" && (
            <p className="text-sm text-muted-foreground">
              {e.cantidad} unidades{e.costo ? ` × Bs ${formato(Number(e.costo))}` : ""}
            </p>
          )}
        </div>
        {total != null && total > 0 && (
          <>
            <Divisor />
            <Total monto={total} apagado />
          </>
        )}
        <span className="ml-auto self-end text-xs text-muted-foreground">{hora(cuando)}</span>
      </div>
    </Tarjeta>
  );
}

// ------------------------------------------------------------ lecturas

function Resuelta({ propuesta: p }: { propuesta: Propuesta }) {
  const datos = p.resultado?.datos as any;

  if (Array.isArray(datos?.productos)) {
    const unidad = datos.tipo === "fractional" && datos.unidad ? datos.unidad : "u";
    return (
      <Tarjeta estado="resuelta">
        <Cabecera icono={Package}>{tituloCorto(p)}</Cabecera>
        <ListaProductos productos={datos.productos} unidad={unidad} />
      </Tarjeta>
    );
  }

  if (p.intencion === "consultar_ventas" && datos) {
    return (
      <Tarjeta estado="resuelta">
        <Cabecera icono={Receipt}>Ventas · {periodo(Number(p.entidades.periodo))}</Cabecera>
        <Panel className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Total vendido</p>
            <p className="font-display text-3xl font-bold tabular-nums text-ring">
              Bs {formato(Number(datos.total))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pedidos</p>
            <p className="font-display text-2xl font-bold tabular-nums">{datos.pedidos}</p>
          </div>
        </Panel>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta estado="resuelta">
      <Aviso icono={Check}>{p.resultado!.resumen}</Aviso>
    </Tarjeta>
  );
}

/**
 * Filas de producto con foto y stock. Tocar una abre la ficha: la respuesta ya
 * es el dato, pero si quiere ver más, está a un toque.
 */
function ListaProductos({ productos, unidad }: { productos: ProductoOpcion[]; unidad: string }) {
  return (
    <Panel className="divide-y divide-[var(--hairline)] overflow-hidden p-0">
      {productos.map((pr) => (
        <Link
          key={pr.storeProductId}
          to={`/products/${pr.productId}`}
          data-testid="omnibox-fila-stock"
          className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-ring/5"
        >
          <FotoProducto src={pr.imagen} className="h-11 w-11" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{pr.nombre}</p>
            <p className="text-xs text-muted-foreground">Bs {formato(Number(pr.precio))}</p>
          </div>
          <p
            className={cn(
              "font-display text-lg font-bold tabular-nums",
              Number(pr.stock) <= 0 && "text-red-600 dark:text-red-400",
            )}
          >
            {formato(Number(pr.stock))}
            <span className="ml-0.5 text-sm font-semibold text-ring">{unidad}</span>
          </p>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </Panel>
  );
}

// ------------------------------------------------------------ elegir

function Ambiguedad({
  propuesta: p,
  onElegir,
}: {
  propuesta: Propuesta;
  onElegir: (o: ProductoOpcion) => void;
}) {
  return (
    <Tarjeta estado="ambiguedad">
      <Cabecera icono={HelpCircle}>{tituloCorto(p)} · ¿cuál es?</Cabecera>
      <Panel className="divide-y divide-[var(--hairline)] overflow-hidden p-0">
        {p.opciones.map((o) => (
          <button
            key={o.storeProductId}
            type="button"
            data-testid="omnibox-opcion"
            onClick={() => onElegir(o)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-ring/5"
          >
            <FotoProducto src={o.imagen} className="h-11 w-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{o.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {formato(Number(o.stock))} en stock · Bs {formato(Number(o.precio))}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </Panel>
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
  onElegir,
}: {
  propuesta: Propuesta;
  storeId: string;
  onElegir: (o: ProductoOpcion) => void;
}) {
  const [buscando, setBuscando] = useState(false);
  const navigate = useNavigate();
  const nombre = p.noEncontrado ?? "";

  return (
    <Tarjeta estado="sin-producto">
      <Aviso icono={Search}>
        No está en tu catálogo.{" "}
        <span className="text-muted-foreground">Buscaste “{nombre}”.</span>
      </Aviso>

      {buscando ? (
        <ElegirProducto storeId={storeId} textoInicial="" onElegir={onElegir} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <BotonCta onClick={() => navigate(`/products/create?nombre=${encodeURIComponent(nombre)}`)}>
            <PackagePlus className="h-4 w-4" />
            Crear ahora
          </BotonCta>
          <BotonSecundario onClick={() => setBuscando(true)}>
            <Search className="h-4 w-4" />
            Buscar otro nombre
          </BotonSecundario>
        </div>
      )}
    </Tarjeta>
  );
}

/** Falta un dato: se pide ahí mismo, con el producto a la vista. */
function FaltaDato({
  propuesta: p,
  storeId,
  onGuardar,
  onElegir,
}: {
  propuesta: Propuesta;
  storeId: string;
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
      <Tarjeta estado="falta-dato">
        <Cabecera icono={Package}>{tituloCorto(p)} · {falta.pregunta}</Cabecera>
        <ElegirProducto storeId={storeId} onElegir={onElegir} />
      </Tarjeta>
    );
  }

  const decimal = falta.slot === "precio" || falta.slot === "costo";

  return (
    <Tarjeta estado="falta-dato">
      <Cabecera icono={Package}>{tituloCorto(p)}</Cabecera>
      <form
        className="space-y-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (valor.trim()) onGuardar(falta.slot, valor.trim());
        }}
      >
        <Panel className="flex flex-wrap items-end gap-x-5 gap-y-3">
          {(p.producto || e.producto) && <BloqueProducto producto={p.producto} nombre={e.producto} />}
          <Campo
            etiqueta={falta.pregunta}
            valor={valor}
            onCambio={setValor}
            decimal={decimal}
            autoFocus
          />
        </Panel>
        <BotonCta type="submit" disabled={!valor.trim()} className="w-full">
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
 * Sin permiso: un candado y a quién pedírselo. No es un error del sistema y
 * no tiene que parecerlo — el sistema entendió perfecto.
 *
 * El botón solo aparece si hay a quién escribirle (`VITE_SOPORTE_WHATSAPP`).
 * Un botón de "pedir acceso" que no le llega a nadie es peor que no tenerlo.
 */
function SinPermiso({ propuesta: p, tienda }: { propuesta: Propuesta; tienda: string }) {
  const accion = (p.intencion && PARA[p.intencion]) || "hacer eso";
  const soporte = (import.meta.env.VITE_SOPORTE_WHATSAPP as string | undefined)?.replace(/\D/g, "");
  const texto = `Hola, necesito permiso para ${accion} en Vendfy (tienda ${tienda}).`;

  return (
    <Tarjeta estado="sin-permiso">
      <Aviso icono={Lock}>No tenés permiso para {accion}.</Aviso>
      {soporte ? (
        <a
          href={`https://wa.me/${soporte}?text=${encodeURIComponent(texto)}`}
          target="_blank"
          rel="noreferrer"
          className={cn(CLASE_CTA, "w-full")}
        >
          <UserPlus className="h-4 w-4" />
          Pedir acceso al administrador
        </a>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">
          Pedíselo a quien administra tu cuenta.
        </p>
      )}
    </Tarjeta>
  );
}

/** Dónde se hace hoy lo que el asistente todavía no sabe hacer. */
const DONDE: Record<string, [string, string]> = {
  crear_producto: ["/products/create", "Crear producto"],
  venta_mostrador: ["/caja", "Ir a Caja"],
  cancelar_pedido: ["/orders", "Ir a Pedidos"],
  estado_pedido: ["/orders", "Ir a Pedidos"],
  ocultar_de_web: ["/products", "Ir a Productos"],
  buscar_cliente: ["/customers", "Ir a Clientes"],
};

function SinEjecutor({ propuesta: p }: { propuesta: Propuesta }) {
  const navigate = useNavigate();
  const destino = p.intencion ? DONDE[p.intencion] : undefined;
  return (
    <Tarjeta estado="sin-ejecutor">
      <Aviso icono={Construction}>
        Entendí: <span className="font-semibold">{p.titulo?.toLowerCase()}</span>. Todavía no lo
        hago desde acá.
      </Aviso>
      {destino && (
        <BotonSecundario onClick={() => navigate(destino[0])} className="w-full sm:w-auto">
          {destino[1]}
          <ChevronRight className="h-4 w-4" />
        </BotonSecundario>
      )}
    </Tarjeta>
  );
}

function SinEntender({
  aviso,
  sugerencias,
  onSugerencia,
}: {
  aviso: string | null;
  sugerencias: string[];
  onSugerencia: (t: string) => void;
}) {
  return (
    <Tarjeta estado="sin-entender">
      <Aviso icono={HelpCircle}>{aviso ?? "No entendí qué querés hacer."}</Aviso>
      {sugerencias.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">Probá así:</span>
          {sugerencias.slice(0, 3).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSugerencia(s)}
              className="glass-chip press rounded-full px-3 py-1.5 text-xs"
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

function Aviso({
  icono: Icono,
  tono,
  children,
}: {
  icono: typeof Lock;
  tono?: "error";
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 px-1">
      <Icono
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0",
          tono === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
        )}
      />
      <p className="text-sm font-medium sm:text-[15px]">{children}</p>
    </div>
  );
}

function BloqueProducto({
  producto,
  nombre,
  detalle,
}: {
  producto: ProductoOpcion | null;
  nombre?: string;
  detalle?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 basis-[12rem] items-center gap-3">
      <FotoProducto src={producto?.imagen} className="h-16 w-16" />
      <div className="min-w-0">
        <p className="truncate font-semibold">{producto?.nombre ?? nombre}</p>
        {detalle && <p className="text-sm text-muted-foreground">{detalle}</p>}
      </div>
    </div>
  );
}

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
    <label className="space-y-1">
      <span className="block text-xs text-muted-foreground">{etiqueta}</span>
      <Input
        type="number"
        inputMode={decimal ? "decimal" : "numeric"}
        step={decimal ? "0.01" : "1"}
        min="0"
        autoFocus={autoFocus}
        value={valor == null ? "" : String(valor)}
        onChange={(ev) => onCambio(ev.target.value)}
        className="glass-field h-11 w-32 rounded-xl text-base font-semibold tabular-nums"
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
