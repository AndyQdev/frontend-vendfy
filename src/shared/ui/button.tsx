import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "../lib/cn"

/**
 * Botón del sistema.
 *
 * - `default` es LA acción principal de la pantalla: cian oscuro #0E7490,
 *   texto blanco (5,4:1). Uno por vista.
 * - `outline` es el secundario: blanco con borde, texto marino. Es el
 *   "Cancelar" de al lado del principal.
 * - `navy` es la acción de peso equivalente pero neutra.
 * - `soft` es el cian suave, para acciones de apoyo dentro de una tarjeta.
 *
 * Radio 10 px, alto 40 px. Ningún botón se levanta al pasar el mouse: solo se
 * oscurece, y se comprime un poco al presionar.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-semibold",
    "transition-[background-color,border-color,color,transform] duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-strong",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-card text-foreground hover:border-border-strong hover:bg-muted",
        secondary: "bg-muted text-foreground hover:bg-border",
        ghost: "text-foreground hover:bg-muted",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline active:scale-100",
        navy: "bg-tinta text-tinta-foreground hover:bg-tinta/90",
        soft: "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/70",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3",
        lg: "h-11 px-5 text-sm",
        icon: "size-10 p-0",
        "icon-sm": "size-8 rounded-md p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Muestra un spinner y deshabilita. Solo en botones reales, no con asChild. */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const clases = cn(buttonVariants({ variant, size }), className)

    // Radix Slot exige UN solo hijo: con asChild no se antepone el spinner.
    if (asChild) {
      return (
        <Slot ref={ref} className={clases} {...props}>
          {children}
        </Slot>
      )
    }

    return (
      <button ref={ref} className={clases} disabled={disabled || loading} {...props}>
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
