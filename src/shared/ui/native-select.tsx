import * as React from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "../lib/cn"
import { controlClasses } from "./control"

/**
 * NATIVE SELECT — un `<select>` de verdad con la lista dibujada por nosotros.
 *
 * Portado del `Selector` de Cell Diagnostic. Se usa donde el control tiene que
 * seguir siendo nativo: formularios con `register()` de react-hook-form,
 * pruebas que hacen `selectOption()`, y el lector de pantalla, que ya sabe
 * anunciar un `<select>` sin ayuda.
 *
 * **Lo único que se reemplaza es la lista que se despliega**: la del navegador
 * sale con esquinas rectas y el azul del sistema operativo, y no hay CSS que
 * la alcance. Se corta el gesto que la abre y se abre la nuestra, idéntica a
 * la del `Select` de Radix. El `<select>` sigue mandando —él guarda el valor y
 * pinta lo elegido—, así que no hay dos estados que desincronizar.
 *
 * Tres detalles que no son detalles (los tres salieron de E2E intermitentes
 * en Cell Diagnostic):
 *
 *  - El `ref` va DERECHO al `<select>`. Con `useImperativeHandle` llegaba un
 *    paso tarde y `reset()` de react-hook-form podía no escribir el valor.
 *  - El foco no se mueve nunca del `<select>`: todo el teclado se atiende ahí.
 *    Es lo único que convive con la trampa de foco de un Dialog de Radix.
 *  - La lista corta la propagación de `pointerdown`: vive en `document.body`,
 *    fuera del Dialog, y sin cortar un clic en una opción cerraba el modal.
 */

const ALTO_MAXIMO = 288
const SEPARACION = 6
const MARGEN = 8

interface OpcionPlana {
  valor: string
  etiqueta: string
  /** Texto gris a la derecha, solo en la lista (`data-detalle` en el <option>). */
  detalle?: string
  deshabilitada: boolean
}

function textoDe(hijos: React.ReactNode): string {
  if (typeof hijos === "string" || typeof hijos === "number") return String(hijos)
  if (Array.isArray(hijos)) return hijos.map(textoDe).join("")
  if (React.isValidElement(hijos)) {
    return textoDe((hijos.props as { children?: React.ReactNode }).children)
  }
  return ""
}

/** Los `<option>` hijos: la misma fuente que usa el `<select>`. */
function leerOpciones(hijos: React.ReactNode): OpcionPlana[] {
  const salida: OpcionPlana[] = []

  React.Children.forEach(hijos, (hijo) => {
    if (!React.isValidElement(hijo)) return

    if (hijo.type === React.Fragment) {
      salida.push(...leerOpciones((hijo.props as { children?: React.ReactNode }).children))
      return
    }
    if (hijo.type !== "option") return

    const props = hijo.props as {
      value?: string | number | readonly string[]
      children?: React.ReactNode
      disabled?: boolean
      "data-detalle"?: string
    }
    const etiqueta = textoDe(props.children)

    salida.push({
      valor: props.value === undefined ? etiqueta : String(props.value),
      etiqueta,
      detalle: props["data-detalle"],
      deshabilitada: Boolean(props.disabled),
    })
  })

  return salida
}

interface Ubicacion {
  izquierda: number
  ancho: number
  arriba?: number
  abajo?: number
  altoMaximo: number
}

export interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  /** Densidad compacta: filtros y paginación. */
  compact?: boolean
  /** Clases del contenedor (ancho fijo dentro de una fila flex, por ejemplo). */
  containerClassName?: string
}

export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(function NativeSelect(
  { className, invalid, compact = false, containerClassName, children, disabled, onPointerDown, onKeyDown, ...props },
  ref
) {
  const contenedor = React.useRef<HTMLDivElement>(null)
  const lista = React.useRef<HTMLDivElement>(null)

  const [abierta, setAbierta] = React.useState(false)
  const [resaltada, setResaltada] = React.useState(0)
  const [ubicacion, setUbicacion] = React.useState<Ubicacion | null>(null)
  const [valorActual, setValorActual] = React.useState("")

  const opciones = React.useMemo(() => leerOpciones(children), [children])

  const buscarSelect = React.useCallback(() => contenedor.current?.querySelector("select") ?? null, [])

  const ubicar = React.useCallback(() => {
    const caja = contenedor.current?.getBoundingClientRect()
    if (!caja) return

    const libreAbajo = window.innerHeight - caja.bottom - SEPARACION - MARGEN
    const libreArriba = caja.top - SEPARACION - MARGEN
    // Hacia arriba solo si abajo no entra y arriba entra mejor.
    const haciaArriba = libreAbajo < Math.min(ALTO_MAXIMO, 160) && libreArriba > libreAbajo

    setUbicacion({
      izquierda: caja.left,
      ancho: caja.width,
      arriba: haciaArriba ? undefined : caja.bottom + SEPARACION,
      abajo: haciaArriba ? window.innerHeight - caja.top + SEPARACION : undefined,
      altoMaximo: Math.max(96, Math.min(ALTO_MAXIMO, haciaArriba ? libreArriba : libreAbajo)),
    })
  }, [])

  const abrir = React.useCallback(() => {
    const elemento = buscarSelect()
    if (!elemento || disabled) return

    ubicar()
    const actual = opciones.findIndex((o) => o.valor === elemento.value)
    setValorActual(elemento.value)
    setResaltada(actual >= 0 ? actual : 0)
    setAbierta(true)
  }, [buscarSelect, disabled, opciones, ubicar])

  /**
   * Escribe por el setter del prototipo: React vigila `value` para saber si
   * cambió, y escribiendo por arriba de ese vigilante dispara `onChange`, que
   * es lo que escuchan tanto las pantallas como react-hook-form.
   */
  const elegir = React.useCallback(
    (valor: string) => {
      const elemento = buscarSelect()
      if (!elemento) return

      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(elemento) as object, "value")
      if (descriptor?.set) descriptor.set.call(elemento, valor)
      else elemento.value = valor

      elemento.dispatchEvent(new Event("change", { bubbles: true }))
      setAbierta(false)
    },
    [buscarSelect]
  )

  React.useEffect(() => {
    if (!abierta) return

    function afuera(evento: PointerEvent) {
      const destino = evento.target as Node
      if (contenedor.current?.contains(destino)) return
      if (lista.current?.contains(destino)) return
      setAbierta(false)
    }

    document.addEventListener("pointerdown", afuera, true)
    window.addEventListener("resize", ubicar)
    window.addEventListener("scroll", ubicar, true)
    return () => {
      document.removeEventListener("pointerdown", afuera, true)
      window.removeEventListener("resize", ubicar)
      window.removeEventListener("scroll", ubicar, true)
    }
  }, [abierta, ubicar])

  React.useEffect(() => {
    if (!abierta) return
    lista.current?.querySelector<HTMLElement>(`[data-indice="${resaltada}"]`)?.scrollIntoView({ block: "nearest" })
  }, [abierta, resaltada])

  function mover(paso: number) {
    if (opciones.length === 0) return
    let siguiente = resaltada
    for (let vuelta = 0; vuelta < opciones.length; vuelta += 1) {
      siguiente = (siguiente + paso + opciones.length) % opciones.length
      if (!opciones[siguiente].deshabilitada) break
    }
    setResaltada(siguiente)
  }

  function alBorde(desdeElFinal: boolean) {
    const orden = opciones.map((_, i) => i)
    if (desdeElFinal) orden.reverse()
    const encontrada = orden.find((i) => !opciones[i].deshabilitada)
    if (encontrada !== undefined) setResaltada(encontrada)
  }

  /** `preventDefault` en pointerdown corta la lista del navegador antes de que se arme. */
  function alApuntar(evento: React.PointerEvent<HTMLSelectElement>) {
    onPointerDown?.(evento)
    if (evento.defaultPrevented || disabled) return

    evento.preventDefault()
    evento.currentTarget.focus()
    if (abierta) setAbierta(false)
    else abrir()
  }

  function alTeclear(evento: React.KeyboardEvent<HTMLSelectElement>) {
    onKeyDown?.(evento)
    if (evento.defaultPrevented || disabled) return

    if (!abierta) {
      // Las flechas sueltas se dejan pasar: cambian la opción sin desplegar.
      const abre = evento.key === " " || evento.key === "F4" || (evento.altKey && evento.key === "ArrowDown")
      if (abre) {
        evento.preventDefault()
        abrir()
      }
      return
    }

    switch (evento.key) {
      case "Escape":
        evento.preventDefault()
        setAbierta(false)
        break
      case "ArrowDown":
        evento.preventDefault()
        mover(1)
        break
      case "ArrowUp":
        evento.preventDefault()
        mover(-1)
        break
      case "Home":
        evento.preventDefault()
        alBorde(false)
        break
      case "End":
        evento.preventDefault()
        alBorde(true)
        break
      case "Enter":
      case " ": {
        evento.preventDefault()
        const opcion = opciones[resaltada]
        if (opcion && !opcion.deshabilitada) elegir(opcion.valor)
        break
      }
      case "Tab":
        setAbierta(false)
        break
    }
  }

  return (
    <div ref={contenedor} className={cn("relative", containerClassName)}>
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-expanded={abierta}
        onPointerDown={alApuntar}
        onKeyDown={alTeclear}
        className={cn(
          controlClasses,
          "cursor-pointer appearance-none bg-none",
          compact ? "h-9 pl-3 pr-8 text-[13px]" : "h-10 pr-9 text-base md:text-sm",
          abierta && "border-primary ring-[3px] ring-primary/15",
          className
        )}
        {...props}
      >
        {children}
      </select>

      <ChevronDown
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground transition-transform duration-150",
          compact ? "right-2.5 size-3.5" : "right-3 size-4",
          abierta && "rotate-180"
        )}
      />

      {abierta && ubicacion
        ? createPortal(
            <div
              ref={lista}
              role="listbox"
              aria-label="Opciones"
              onPointerDown={(evento) => evento.stopPropagation()}
              style={{
                left: ubicacion.izquierda,
                top: ubicacion.arriba,
                bottom: ubicacion.abajo,
                minWidth: ubicacion.ancho,
                maxWidth: `calc(100vw - ${MARGEN * 2}px)`,
                maxHeight: ubicacion.altoMaximo,
              }}
              className={cn(
                // z-[60]: por encima de un Dialog (z-50). `pointer-events-auto`
                // porque un Dialog modal le apaga el puntero al body.
                "scroll-fino pointer-events-auto fixed z-[60] overflow-y-auto",
                "rounded-xl border border-border bg-popover p-1.5 shadow-float outline-none",
                "aparecer"
              )}
            >
              {opciones.map((opcion, indice) => {
                const elegida = opcion.valor === valorActual
                return (
                  <div
                    key={`${opcion.valor}-${indice}`}
                    role="option"
                    aria-selected={elegida}
                    aria-disabled={opcion.deshabilitada || undefined}
                    data-indice={indice}
                    onPointerEnter={() => {
                      if (!opcion.deshabilitada) setResaltada(indice)
                    }}
                    onClick={() => {
                      if (!opcion.deshabilitada) elegir(opcion.valor)
                    }}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-2 rounded-md transition-colors",
                      compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-[13px]",
                      elegida ? "font-semibold text-foreground" : "text-foreground/80",
                      indice === resaltada && !opcion.deshabilitada && "bg-muted text-foreground",
                      opcion.deshabilitada && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{opcion.etiqueta}</span>
                    {opcion.detalle ? (
                      <span className="min-w-0 shrink truncate text-xs text-muted-foreground">{opcion.detalle}</span>
                    ) : null}
                    {elegida ? <Check aria-hidden className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} /> : null}
                  </div>
                )
              })}

              {opciones.length === 0 ? (
                <p className="px-3 py-2 text-[13px] text-muted-foreground">No hay opciones.</p>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  )
})
