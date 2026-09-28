/**
 * Las clases que comparte todo control de formulario: Input, Textarea, el
 * disparador del Select y el NativeSelect.
 *
 * Estaban copiadas en cada archivo y ya habían empezado a divergir (uno con
 * `rounded-2xl`, otro con `rounded-xl`, el foco en tres grosores distintos).
 * Con una sola constante, los cuatro se ven y se comportan igual.
 *
 * - Radio 12 px, borde #D8DEE6: un campo se ve más "abierto" que una tarjeta.
 * - Foco: borde cian oscuro + halo de 3 px al 15 %. Se ve sin gritar.
 * - Inválido (`aria-invalid`): borde y halo rojos, sin clase aparte.
 */
export const controlClasses = [
  "w-full rounded-lg border border-input bg-card px-3.5 text-sm text-foreground",
  "placeholder:text-muted-foreground",
  "transition-[border-color,box-shadow] duration-150",
  "hover:border-border-strong",
  "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/15",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
  "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-destructive/15",
].join(" ");
