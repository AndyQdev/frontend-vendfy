import * as React from "react"
import { cn } from "../lib/cn"

/**
 * CABECERA DE PANTALLA — la primera fila de toda vista.
 *
 * Título en mayúsculas a la izquierda y, contra el margen derecho, los
 * contadores de la pantalla en cápsulas: la cifra grande y qué mide. Que esté
 * acá y no copiada en cada vista es lo que hace que todas las pantallas se
 * lean como el mismo sistema (la misma regla que Cell Diagnostic).
 *
 * `actions` existe porque las pantallas viejas tienen su botón principal
 * arriba a la derecha. El lugar bueno para la acción principal es la fila de
 * filtros, pegada al buscador y encima de la tabla sobre la que actúa; cuando
 * una pantalla se rehaga, conviene bajarla ahí.
 */
export interface PageStat {
  value: React.ReactNode
  label: string
  /** El color de la cifra, solo si dice algo: rojo urge, ámbar espera. */
  tone?: "default" | "success" | "warning" | "danger"
}

const TONO: Record<NonNullable<PageStat["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning-soft-foreground",
  danger: "text-destructive",
}

export function PageHeader({
  title,
  description,
  stats,
  actions,
  className,
}: {
  title: string
  /** Una línea de contexto bajo el título. Opcional: el título suele bastar. */
  description?: React.ReactNode
  stats?: PageStat[]
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="titulo-pagina min-w-0">
          {title}
        </h1>

        {stats?.length || actions ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {stats?.map((stat) => (
              <div
                key={stat.label}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 shadow-card sm:h-10 sm:gap-2 sm:px-3"
              >
                <span
                  className={cn(
                    "cifra text-sm font-bold leading-none sm:text-lg",
                    TONO[stat.tone ?? "default"]
                  )}
                >
                  {stat.value}
                </span>
                <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground sm:text-[10.5px]">
                  {stat.label}
                </span>
              </div>
            ))}
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        ) : null}
      </div>

      {description ? (
        <p className="max-w-[68ch] text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
