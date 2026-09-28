import * as React from "react"
import { cn } from "../lib/cn"
import { controlClasses } from "./control"


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
          controlClasses,
          // 16 px en el teléfono: con menos, iOS hace zoom al enfocar el campo.
          "flex h-10 py-2 text-base md:text-sm",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
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
