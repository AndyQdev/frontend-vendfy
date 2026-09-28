import * as React from "react"
import { cn } from "../lib/cn"

/**
 * Botón de las acciones con IA ("Crear con IA", "Conectar bot").
 *
 * Antes llevaba un borde animado con degradado y brillo. El sistema es plano:
 * ahora es un botón azul marino, el mismo peso que el principal pero neutro,
 * con el ícono que ya dice qué hace. `alwaysActive` se conserva para no romper
 * a quien lo pasa, pero ya no cambia nada.
 */
export interface ButtonMagicProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  /** Obsoleto: se mantiene por compatibilidad. */
  alwaysActive?: boolean
}

const ButtonMagic = React.forwardRef<HTMLButtonElement, ButtonMagicProps>(
  ({ className, children, alwaysActive: _alwaysActive, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-tinta px-4 text-[13px] font-semibold text-tinta-foreground",
          "transition-[background-color,transform] duration-150 hover:bg-tinta/90 active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-acento",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
ButtonMagic.displayName = "ButtonMagic"

export { ButtonMagic }
