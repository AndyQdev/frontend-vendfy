import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  Package,
  Pencil,
  Search,
  Tag,
} from "lucide-react";

import {
  estadoDe,
  esDestructiva,
  textoAccion,
  type Propuesta,
  type ProductoOpcion,
} from "@/entities/omnibox/model/types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/cn";

export interface Actividad {
  id: string;
  texto: string;
  propuesta: Propuesta;
  hora: Date;
  /** Ya se ejecutó desde acá: la tarjeta pasa a resuelta. */
  cerrada?: { resumen: string };
}

/**
 * Una línea del historial de la sesión.
 *
 * La respuesta NO es prosa: es una tarjeta con lo que va a pasar, que el
 * comerciante confirma de un toque. Esa es la diferencia entre un chat de ayuda
 * y una forma de operar el sistema.
 *
 * **Los botones no los redacta el modelo.** Salen del estado de la propuesta y
 * del catálogo de intenciones —código nuestro—, así que el mismo caso se ve
 * siempre igual, se puede probar, y la IA no puede ofrecer una acción que no
 * existe.
 */
export function TarjetaActividad({
  actividad,
  onConfirmar,
  onElegirProducto,
  onCompletarDato,
  ejecutando,
}: {
  actividad: Actividad;
  onConfirmar: (a: Actividad) => void;
  onElegirProducto: (a: Actividad, opcion: ProductoOpcion) => void;
  onCompletarDato: (a: Actividad, slot: string, valor: string) => void;
  ejecutando: boolean;
}) {
  const { propuesta: p, cerrada } = actividad;
  const estado = cerrada ? "resuelta" : estadoDe(p);

  return (
    <div
      data-testid="omnibox-actividad"
      data-estado={estado}
      className={cn(
        // `.glass` + 22px: la convención de Card del panel.
        "glass rounded-[22px] transition-colors",
        estado === "espera-confirmacion" && "ring-1 ring-primary/30",
      )}
    >
      {/* cabecera: lo que escribió + en qué quedó */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 truncate text-sm">“{actividad.texto}”</p>
        <Insignia estado={estado} />
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
          {actividad.hora.toLocaleTimeString("es-BO", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        {estado === "resuelta" && (
          <Resuelta resumen={cerrada?.resumen ?? p.resultado!.resumen} datos={p.resultado?.datos} />
        )}

        {estado === "espera-confirmacion" && (
          <EsperaConfirmacion
            propuesta={p}
            ejecutando={ejecutando}
            onConfirmar={() => onConfirmar(actividad)}
          />
        )}

        {estado === "ambiguedad" && (
          <Ambiguedad
            opciones={p.opciones}
            onElegir={(o) => onElegirProducto(actividad, o)}
          />
        )}

        {estado === "falta-dato" && (
          <FaltaDato
            propuesta={p}
            ejecutando={ejecutando}
            onGuardar={(slot, valor) => onCompletarDato(actividad, slot, valor)}
          />
        )}

        {estado === "sin-entender" && (
          <p className="text-sm text-muted-foreground">
            {p.aviso ?? "No pude resolverlo."}
          </p>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ estados

function Resuelta({ resumen, datos }: { resumen: string; datos?: any }) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
      <p className="flex-1 text-sm font-medium">{resumen}</p>
      {datos?.stock !== undefined && (
        <>
          <Dato icono={Package} etiqueta="Stock" valor={`${datos.stock} ${datos.unidad ?? "unidades"}`} />
          {datos.precio !== undefined && (
            <Dato icono={Tag} etiqueta="Precio" valor={`Bs ${datos.precio}`} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * El caso que justifica todo el módulo.
 *
 * El diff (`12 → 32`) se lee de un vistazo: es lo que hace que confirmar sea
 * seguro y rápido a la vez. Sin él, confirmar es un acto de fe.
 */
function EsperaConfirmacion({
  propuesta: p,
  ejecutando,
  onConfirmar,
}: {
  propuesta: Propuesta;
  ejecutando: boolean;
  onConfirmar: () => void;
}) {
  const e = p.entidades as Record<string, any>;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="min-w-[180px] flex-1">
        <p className="font-semibold">{p.titulo}</p>
        <p className="text-sm text-muted-foreground">{e.producto}</p>
        <p className="text-sm text-muted-foreground">
          {[
            e.cantidad !== undefined && `${e.cantidad} unidades`,
            e.costo !== undefined && `Bs ${e.costo} c/u`,
            e.precio !== undefined && `Bs ${e.precio}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {p.vistaPrevia && (
        <Diff
          etiqueta={p.vistaPrevia.etiqueta}
          antes={p.vistaPrevia.antes}
          despues={p.vistaPrevia.despues}
        />
      )}

      {e.cantidad !== undefined && e.costo !== undefined && (
        <Dato
          etiqueta="Total"
          valor={`Bs ${(Number(e.cantidad) * Number(e.costo)).toFixed(2)}`}
          destacado
        />
      )}

      <div className="flex shrink-0 flex-col gap-2">
        <Button
          onClick={onConfirmar}
          disabled={ejecutando}
          variant={esDestructiva(p.intencion) ? "destructive" : "default"}
          className="gap-2"
        >
          {ejecutando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {textoAccion(p.intencion)}
        </Button>
        <Button variant="outline" className="gap-2" disabled={ejecutando}>
          <Pencil className="h-4 w-4" />
          Corregir
        </Button>
      </div>
    </div>
  );
}

/**
 * Varios productos parecidos.
 *
 * Se muestran TODOS los candidatos, con su stock y su precio: son los datos que
 * dejan elegir. Poner "Producto" debajo de cada uno no ayuda a nadie.
 */
function Ambiguedad({
  opciones,
  onElegir,
}: {
  opciones: ProductoOpcion[];
  onElegir: (o: ProductoOpcion) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="glass-track flex items-center gap-3 rounded-2xl p-3">
        <div className="glass-sm flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">Necesitamos precisar el producto</p>
          <p className="text-xs text-muted-foreground">Elegí una opción para continuar</p>
        </div>
      </div>

      {opciones.map((o) => (
        <button
          key={o.storeProductId}
          data-testid="omnibox-opcion"
          onClick={() => onElegir(o)}
          className="glass-field press-lift flex items-center gap-3 rounded-2xl p-3 text-left"
        >
          <Miniatura src={o.imagen} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{o.nombre}</p>
            <p className="text-xs text-muted-foreground">
              {o.stock} en stock · Bs {o.precio}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

/** Falta un dato: se pide ahí mismo, sin abrir otra pantalla. */
function FaltaDato({
  propuesta: p,
  ejecutando,
  onGuardar,
}: {
  propuesta: Propuesta;
  ejecutando: boolean;
  onGuardar: (slot: string, valor: string) => void;
}) {
  const falta = p.faltan[0];
  const [valor, setValor] = useState("");
  const e = p.entidades as Record<string, any>;
  // Precio y cantidad son números; el resto, texto.
  const numerico = falta.slot === "precio" || falta.slot === "cantidad" || falta.slot === "costo";

  return (
    <form
      className="flex flex-wrap items-center gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (valor.trim()) onGuardar(falta.slot, valor.trim());
      }}
    >
      <div className="min-w-[160px] flex-1">
        <p className="font-semibold">{p.titulo}</p>
        {e.producto && (
          <p className="text-sm text-muted-foreground">{e.producto}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Tag className="h-4 w-4 text-muted-foreground" />
        {falta.pregunta}
      </label>

      <div className="flex items-center">
        {numerico && falta.slot !== "cantidad" && (
          <span className="glass-track rounded-l-2xl px-3 py-2 text-sm text-muted-foreground">
            Bs
          </span>
        )}
        <Input
          autoFocus
          value={valor}
          onChange={(ev) => setValor(ev.target.value)}
          type={numerico ? "number" : "text"}
          step={numerico ? "0.01" : undefined}
          placeholder={numerico ? "0.00" : ""}
          aria-label={falta.pregunta}
          className={cn("glass-field w-32 rounded-2xl", numerico && falta.slot !== "cantidad" && "rounded-l-none")}
        />
      </div>

      <Button type="submit" disabled={!valor.trim() || ejecutando} className="gap-2">
        {ejecutando && <Loader2 className="h-4 w-4 animate-spin" />}
        {textoAccion(p.intencion)}
      </Button>
    </form>
  );
}

// ------------------------------------------------------------------ piezas

const INSIGNIAS = {
  resuelta: { icono: CheckCircle2, texto: "Consulta resuelta", clase: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400" },
  "espera-confirmacion": { icono: Clock, texto: "Espera confirmación", clase: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400" },
  ambiguedad: { icono: HelpCircle, texto: "Ambigüedad", clase: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400" },
  "falta-dato": { icono: AlertCircle, texto: "Falta un dato", clase: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400" },
  "sin-entender": { icono: HelpCircle, texto: "Sin resolver", clase: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
} as const;

function Insignia({ estado }: { estado: keyof typeof INSIGNIAS }) {
  const { icono: Icono, texto, clase } = INSIGNIAS[estado];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        clase,
      )}
    >
      <Icono className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{texto}</span>
    </span>
  );
}

/**
 * El `10 → 15`.
 *
 * Es lo que hace que confirmar sea revisar y no creer. Sin esto la tarjeta dice
 * qué se va a hacer pero no qué va a quedar, que es lo que el comerciante
 * necesita mirar antes de apretar.
 */
function Diff({
  etiqueta,
  antes,
  despues,
}: {
  etiqueta: string;
  antes: number;
  despues: number;
}) {
  return (
    <div className="glass-track flex items-center gap-3 rounded-2xl px-4 py-2">
      <div>
        <p className="text-xs text-muted-foreground">{etiqueta}</p>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tabular-nums text-muted-foreground">
            {antes}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-lg font-bold tabular-nums">{despues}</span>
        </div>
      </div>
    </div>
  );
}

function Dato({
  icono: Icono,
  etiqueta,
  valor,
  destacado,
}: {
  icono?: typeof Package;
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {Icono && <Icono className="h-4 w-4 text-muted-foreground" />}
      <div>
        <p className="text-xs text-muted-foreground">{etiqueta}</p>
        <p className={cn("font-semibold tabular-nums", destacado && "text-primary")}>
          {valor}
        </p>
      </div>
    </div>
  );
}

function Miniatura({ src }: { src: string | null }) {
  if (!src) {
    return (
      <div className="glass-track flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        <Package className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-10 w-10 shrink-0 rounded-xl object-cover"
      loading="lazy"
    />
  );
}
