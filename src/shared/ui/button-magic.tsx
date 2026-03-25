import * as React from "react"
import { cn } from "../lib/cn"

export interface ButtonMagicProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

const ButtonMagic = React.forwardRef<HTMLButtonElement, ButtonMagicProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "btn-magic inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold tracking-wide cursor-pointer border-none px-4 py-2 h-9 text-white relative rounded-xl z-0 transition-transform duration-200 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
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
