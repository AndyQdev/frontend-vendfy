import * as React from "react"
import { cn } from "../lib/cn"


const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onChange, onWheel, ...props }, ref) => {
    const isNumber = type === "number";

    // Para inputs numéricos: limpia ceros a la izquierda ("08" → "8") antes de
    // que el onChange del consumidor lo vea. Mantiene "0", "0.5" y vacío.
    const handleChange = isNumber
      ? (e: React.ChangeEvent<HTMLInputElement>) => {
          const v = e.target.value;
          if (/^-?0\d/.test(v)) {
            e.target.value = v.replace(/^(-?)0+(?=\d)/, "$1");
          }
          onChange?.(e);
        }
      : onChange;

    // En inputs numéricos, el scroll del mouse cambia el valor por accidente.
    // Quitamos el foco al hacer scroll para que la rueda mueva la página.
    const handleWheel = isNumber
      ? (e: React.WheelEvent<HTMLInputElement>) => {
          if (document.activeElement === e.currentTarget) {
            (e.currentTarget as HTMLInputElement).blur();
          }
          onWheel?.(e);
        }
      : onWheel;

    return (
      <input
        type={type}
        className={cn(
          "glass-field flex h-10 w-full rounded-2xl px-4 py-2 text-base ring-offset-background transition-[box-shadow,border-color] duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-0 focus-visible:border-[color:var(--glass-bd)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          // Quita las flechas internas en inputs numéricos (Chrome/Safari/Firefox)
          isNumber && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0",
          className
        )}
        ref={ref}
        onChange={handleChange}
        onWheel={handleWheel}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
