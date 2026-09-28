import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/cn"

/**
 * Insignia de estado.
 *
 * Fondo SUAVE, nunca el color pleno: una insignia llena compite con los
 * botones por la atención. Y siempre con la palabra escrita — el color
 * acompaña, no es el dato.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-semibold leading-5 transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary-soft text-primary-soft-foreground",
        secondary: "bg-muted text-muted-foreground",
        destructive: "bg-destructive-soft text-destructive-soft-foreground",
        outline: "border-border bg-card text-foreground",
        success: "bg-success-soft text-success-soft-foreground",
        warning: "bg-warning-soft text-warning-soft-foreground",
        info: "bg-info-soft text-info-soft-foreground",
        navy: "bg-tinta text-tinta-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
