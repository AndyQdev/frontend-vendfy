import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/shared/lib/cn";
import { locucionActual, relojDeLocucion, turnoVoz } from "@/shared/voz";

import { aprenderRitmo, palabrasVisibles, pesarTexto, ritmoDeVoz, type TextoPesado } from "../lib/subtitulos";

/** Si la voz no empieza en este tiempo (sin red, sin cupo), se muestra todo. */
const ESPERA_MAX_S = 9;

/**
 * Qué fracción de lo dicho ya sonó (0 a 1), según el reloj del audio. Sin voz
 * para este texto (la voz apagada, «Te escucho…», la cortaron): 1, todo.
 */
function fraccionDicha(texto: string, pesado: TextoPesado, desde: number): number {
  const loc = locucionActual();
  if (!loc || loc.texto !== texto || loc.fallida) return 1;
  // La cortaron antes de terminar de programarla (otra cosa empezó a sonar).
  if (loc.id !== turnoVoz() && !loc.completa) return 1;
  if (loc.inicio === null) return performance.now() / 1000 - desde > ESPERA_MAX_S ? 1 : 0;
  const pasado = relojDeLocucion(loc) - loc.inicio;
  if (pasado <= 0) return 0;
  if (loc.completa) return pasado / Math.max(0.25, loc.fin - loc.inicio);
  // Todavía llega por partes: se adelanta al ritmo aprendido, sin llegar al final.
  return Math.min(0.92, (pasado * ritmoDeVoz()) / Math.max(1, pesado.total));
}

/**
 * Las palabras que ya se dijeron. Mira el reloj del audio en cada cuadro y
 * solo vuelve a dibujar cuando aparece una palabra nueva; nunca retrocede.
 */
function usePalabrasDichas(texto: string, pesado: TextoPesado): number {
  const [visibles, setVisibles] = useState(() => palabrasVisibles(pesado, fraccionDicha(texto, pesado, performance.now() / 1000)));
  useEffect(() => {
    const desde = performance.now() / 1000;
    let maximo = 0;
    let aprendido = false;
    let cuadro = 0;
    const paso = () => {
      const f = fraccionDicha(texto, pesado, desde);
      const n = Math.max(maximo, palabrasVisibles(pesado, f));
      if (n !== maximo) {
        maximo = n;
        setVisibles(n);
      }
      const loc = locucionActual();
      if (!aprendido && loc?.texto === texto && loc.completa && loc.inicio !== null) {
        aprendido = true;
        aprenderRitmo(pesado.total, loc.fin - loc.inicio);
      }
      if (maximo < pesado.palabras.length) cuadro = requestAnimationFrame(paso);
    };
    paso();
    return () => cancelAnimationFrame(cuadro);
  }, [texto, pesado]);
  return visibles;
}

/**
 * Lo que dice Vendfy, como subtítulos en vivo: las palabras salen a medida
 * que suenan, en una franja de vidrio de dos líneas que se corre sola hacia
 * arriba (lo viejo se desvanece por arriba). Terminado, se puede subir para
 * releer. Para lectores de pantalla y pruebas, la frase entera va aparte.
 */
export function SubtituloVendfy({ texto }: { texto: string }) {
  const pesado = useMemo(() => pesarTexto(texto), [texto]);
  const visibles = usePalabrasDichas(texto, pesado);
  const caja = useRef<HTMLDivElement>(null);
  const [desborda, setDesborda] = useState(false);

  // Siempre a la vista lo último que se dijo.
  useLayoutEffect(() => {
    const c = caja.current;
    if (!c) return;
    setDesborda(c.scrollHeight > c.clientHeight + 2);
    c.scrollTo({ top: c.scrollHeight, behavior: visibles > 1 ? "smooth" : "auto" });
  }, [visibles]);

  return (
    <div className="pointer-events-auto max-w-[min(34rem,calc(100vw-2rem))] rounded-2xl bg-white/80 px-4 py-2 shadow-float ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-900/75 dark:ring-white/10">
      <p data-testid="piloto-linea" className="sr-only">
        {texto}
      </p>
      <div
        ref={caja}
        aria-hidden
        className={cn(
          "max-h-[3.1em] overflow-y-auto text-center text-[15px] font-medium leading-[1.55] text-slate-900 [scrollbar-width:none] dark:text-white sm:text-[17px] [&::-webkit-scrollbar]:hidden",
          desborda && "[mask-image:linear-gradient(to_bottom,transparent,black_0.85em)]",
        )}
      >
        {visibles === 0 ? (
          <span className="subtitulo-espera inline-flex h-[1.55em] items-center gap-1" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        ) : (
          pesado.palabras.slice(0, visibles).map((p, i) => (
            <Fragment key={i}>
              {i > 0 && " "}
              <span className="subtitulo-palabra">{p.texto}</span>
            </Fragment>
          ))
        )}
      </div>
    </div>
  );
}
