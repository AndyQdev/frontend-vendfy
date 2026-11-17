import { createContext, useContext, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { TableCell } from "@/shared/ui/table";
import { cn } from "@/shared/lib/cn";
import {
  colorDeNivel,
  desglosarEnvases,
  formatearCantidad,
} from "@/entities/inventory/model/envases";
import type { Inventory } from "@/entities/inventory/model/types";
import type { AlcanceAjuste, DireccionAjuste } from "./AjusteStockDialog";
import { useAcceso } from "@/app/providers/acceso";
import { PERMISO } from "@/shared/acceso/permisos";

type Abrir = (alcance: AlcanceAjuste, direccion: DireccionAjuste) => void;

/**
 * La misma pieza en la tabla y en la tarjeta.
 *
 * El control de -/+ es lo que se viene a hacer a esta pantalla, así que en el
 * teléfono tiene que estar igual que en escritorio. Lo único que cambia es la
 * envoltura: una celda de tabla o una caja suelta. Por defecto es celda, de
 * modo que la tabla no necesita saber que esto existe.
 */
const Envoltura = createContext<"celda" | "caja">("celda");

function Celda({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  if (useContext(Envoltura) === "caja") {
    return <div className={className}>{children}</div>;
  }
  return <TableCell className={className}>{children}</TableCell>;
}

/**
 * El control de −/valor/+ como una sola pieza.
 *
 * Va en un grupo con bordes compartidos, y no como tres cosas sueltas, para
 * que se lea como un control y no como dos botones que casualmente están al
 * lado de un número. El − tira a rojo y el + a verde recién en hover: en
 * reposo son neutros, porque una tabla entera de flechas de colores cansa la
 * vista y deja de señalar nada.
 */
function GrupoPaso({
  valor,
  onMenos,
  onMas,
  menosDisabled,
  masDisabled,
  tituloMenos,
  tituloMas,
  ancho = "w-11",
  tono,
}: {
  valor: React.ReactNode;
  onMenos: () => void;
  onMas: () => void;
  menosDisabled?: boolean;
  masDisabled?: boolean;
  tituloMenos: string;
  tituloMas: string;
  ancho?: string;
  tono?: string;
}) {
  // Sin permiso de ajustar stock, solo el número: los −/+ no se ofrecen.
  const puedeAjustar = useAcceso().puede(PERMISO.GESTIONAR_INVENTARIO);
  if (!puedeAjustar) {
    return <span className={cn("inline-flex items-center px-1 text-sm font-semibold tabular-nums", tono ?? "text-foreground")}>{valor}</span>;
  }

  const base = cn(
    // 28 px alcanzan con el mouse; con el dedo, no. En el teléfono sube a 40,
    // que es lo más grande que entra sin que la tarjeta crezca de más.
    "flex h-7 w-7 max-md:h-10 max-md:w-10 shrink-0 items-center justify-center transition-colors",
    "text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
    "disabled:pointer-events-none disabled:opacity-25",
  );

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      <button
        type="button"
        onClick={onMenos}
        disabled={menosDisabled}
        title={tituloMenos}
        aria-label={tituloMenos}
        className={cn(
          base,
          "rounded-l-lg border-r border-border",
          "hover:bg-red-50 hover:text-red-600",
          "dark:hover:bg-red-900/20 dark:hover:text-red-400",
        )}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      <span
        className={cn(
          "flex items-center justify-center px-1 text-sm font-semibold tabular-nums",
          ancho,
          tono ?? "text-foreground",
        )}
      >
        {valor}
      </span>

      <button
        type="button"
        onClick={onMas}
        disabled={masDisabled}
        title={tituloMas}
        aria-label={tituloMas}
        className={cn(
          base,
          "rounded-r-lg border-l border-border",
          "hover:bg-emerald-50 hover:text-emerald-600",
          "dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Las dos celdas que explican cuánto hay: envases enteros y envase abierto.
 *
 * Ninguna escribe nada por su cuenta. Los botones solo abren el diálogo de
 * ajuste, que es donde se dice cuánto y por qué; el libro de movimientos es
 * append-only y un asiento sin explicación no se puede corregir después.
 */
export function CeldasExistencias({
  inventory,
  onAjustar,
}: {
  inventory: Inventory;
  onAjustar: Abrir;
}) {
  const unidad = inventory.product?.baseUnit;
  const { porMedida, contenido, total, sellados, abierto, gastado, porcentaje } =
    desglosarEnvases(inventory);

  // ── Producto por unidades ─────────────────────────────────────────────
  if (!porMedida) {
    return (
      <>
        <Celda>
          <div className="flex flex-col items-center gap-1">
            <GrupoPaso
              valor={total}
              tituloMenos="Quitar unidades"
              tituloMas="Agregar unidades"
              menosDisabled={total <= 0}
              onMenos={() => onAjustar("envase", "out")}
              onMas={() => onAjustar("envase", "in")}
            />
            <span className="text-[10px] text-muted-foreground">unidades</span>
          </div>
        </Celda>

        <Celda className="text-center">
          <span className="text-xs text-muted-foreground/70">
            No se fracciona
          </span>
        </Celda>
      </>
    );
  }

  // ── Producto por medida ───────────────────────────────────────────────
  const color = colorDeNivel(porcentaje);
  const etiquetaEnvase = formatearCantidad(contenido, unidad);

  return (
    <>
      {/* Envases sellados */}
      <Celda>
        <div className="flex flex-col items-center gap-1">
          <GrupoPaso
            valor={sellados}
            tituloMenos={`Quitar envases de ${etiquetaEnvase}`}
            tituloMas={`Agregar envases de ${etiquetaEnvase}`}
            menosDisabled={sellados <= 0}
            onMenos={() => onAjustar("envase", "out")}
            onMas={() => onAjustar("envase", "in")}
          />
          <span className="text-[10px] leading-tight text-muted-foreground">
            sellados · {etiquetaEnvase} c/u
          </span>
        </div>
      </Celda>

      {/* Envase abierto */}
      <Celda>
        <div className="mx-auto flex w-[10.5rem] flex-col items-center gap-1.5">
          <GrupoPaso
            valor={abierto > 0 ? formatearCantidad(abierto, unidad) : "cerrado"}
            ancho="w-16"
            tono={abierto > 0 ? color.texto : "text-muted-foreground"}
            tituloMenos="Registrar consumo del envase abierto"
            tituloMas={
              abierto === 0
                ? "No hay ningún envase abierto"
                : "Devolver al envase abierto"
            }
            menosDisabled={total <= 0}
            // Sumarle a un envase que no está abierto no significa nada:
            // volcaría producto dentro de un frasco sellado.
            masDisabled={abierto === 0}
            onMenos={() => onAjustar("contenido", "out")}
            onMas={() => onAjustar("contenido", "in")}
          />

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Contenido restante del envase abierto"
          >
            <div
              className={cn("h-full rounded-full transition-all", color.barra)}
              style={{ width: `${porcentaje}%` }}
            />
          </div>

          <span className="text-[10px] leading-tight text-muted-foreground">
            {abierto > 0 ? (
              <>
                queda {porcentaje}% · gastados{" "}
                {formatearCantidad(gastado, unidad)}
              </>
            ) : (
              <>ninguno empezado</>
            )}
          </span>

          {/* El total real, que es lo único que guarda la base. */}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {formatearCantidad(total, unidad)} en total
          </span>
        </div>
      </Celda>
    </>
  );
}

/**
 * Lo mismo, apilado, para la tarjeta del teléfono.
 *
 * Las dos cajas conviven en una fila y bajan una debajo de la otra cuando no
 * entran: en 360 px el envase abierto, con su barra, necesita el ancho entero.
 */
export function ExistenciasEnTarjeta({
  inventory,
  onAjustar,
}: {
  inventory: Inventory;
  onAjustar: Abrir;
}) {
  return (
    <Envoltura.Provider value="caja">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <CeldasExistencias inventory={inventory} onAjustar={onAjustar} />
      </div>
    </Envoltura.Provider>
  );
}
