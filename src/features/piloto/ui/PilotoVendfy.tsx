import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowRight, ArrowUp, ArrowUpRight, Ear, EarOff, Keyboard, Loader2, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { alAtajoGlobal } from "@/shared/nativo";

import { usePiloto, type FasePiloto } from "../lib/estado";
import { useConductorPiloto } from "../model/use-piloto";
import { useManosLibres } from "../model/use-manos-libres";
import { buscarFoco, FocoPiloto } from "./FocoPiloto";
import { OrbeMagico } from "./OrbeMagico";
import { SubtituloVendfy } from "./SubtituloVendfy";

/** Lo que se lee debajo de la bola (cuando dice algo que los subtítulos no dicen ya). */
const ESTADO: Record<FasePiloto, string> = {
  apagado: "",
  escuchando: "Te escucho",
  pensando: "Entendiendo…",
  trabajando: "Haciéndolo…",
  hablando: "",
  esperando: "Toca la bola o pulsa F9 para contestar",
  listo: "",
  error: "No se pudo",
};

/** Vidrio claro (oscuro en el tema oscuro): deja ver la pantalla de atrás. */
const VIDRIO = "bg-white/80 ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-900/75 dark:ring-white/10";

/** Botón redondo de vidrio, a los lados de la bola. */
const CRISTAL = `pointer-events-auto grid size-10 place-items-center rounded-full ${VIDRIO} text-slate-700 shadow-float transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-white/85 dark:hover:bg-slate-800 dark:hover:text-white`;

/**
 * "Vendfy": el piloto que maneja el panel hablando. Cerrado es una bola en la
 * esquina (F9 o «Oye Vendfy» la abren); abierto, la bola va al centro de
 * abajo, late con la voz y lo que dice sale como subtítulo. Si lo que señala
 * en la pantalla quedaría tapado, la bola se va arriba.
 */
export function PilotoVendfy() {
  const e = usePiloto();
  const conductor = useConductorPiloto();
  const { activar, escribir, detener, nivel } = conductor;
  // Manos libres: el oído escucha "Oye Vendfy" sin mandar nada hasta oírla.
  const manos = useManosLibres(conductor);
  const esperaPalabra = manos.activo && manos.estado === "escuchando";
  // La bola late con la voz: el detector de las respuestas o, con manos libres,
  // el micrófono del oído (que es el que graba el pedido después de «Oye Vendfy»).
  const nivelManos = manos.nivel;
  const activoManos = useRef(manos.activo);
  activoManos.current = manos.activo;
  const nivelOrbe = useRef<{ current: number } | null>(null);
  nivelOrbe.current ??= {
    get current() {
      return Math.max(nivel.current, activoManos.current ? nivelManos.current : 0);
    },
    set current(_v: number) {},
  };
  const location = useLocation();
  const navigate = useNavigate();
  const [texto, setTexto] = useState("");
  const [teclado, setTeclado] = useState(false);
  const [arriba, setArriba] = useState(false);
  const grupo = useRef<HTMLElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  // F9 en cualquier pantalla. Con ref: el conductor cambia en cada dibujo.
  const atajo = useRef(activar);
  atajo.current = activar;
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key !== "F9" || ev.repeat) return;
      ev.preventDefault();
      atajo.current("atajo");
    };
    window.addEventListener("keydown", tecla);
    // En la app de Windows, F9 llega también desde cualquier otro programa.
    const quitar = alAtajoGlobal(() => atajo.current("atajo"));
    return () => {
      window.removeEventListener("keydown", tecla);
      quitar();
    };
  }, []);

  // Al cerrarse, el teclado vuelve a esconderse.
  useEffect(() => {
    if (!e.abierto) {
      setTeclado(false);
      setTexto("");
    }
  }, [e.abierto]);

  useEffect(() => {
    if (teclado) campo.current?.focus();
  }, [teclado]);

  // Si lo que señala queda debajo de la bola y los subtítulos, todo sube arriba.
  useEffect(() => {
    if (!e.abierto || !e.foco) {
      setArriba(false);
      return;
    }
    const foco = e.foco;
    const revisar = () => {
      const el = buscarFoco(foco);
      const g = grupo.current;
      if (!el || !g) return;
      const r = el.getBoundingClientRect();
      const c = g.getBoundingClientRect();
      const alto = c.height + 40;
      const ancho = c.width + 16;
      const izq = (window.innerWidth - ancho) / 2;
      const seCruzan = r.right > izq && r.left < izq + ancho;
      const tapaAbajo = seCruzan && r.bottom > window.innerHeight - alto;
      const tapaArriba = seCruzan && r.top < alto;
      setArriba((antes) => (antes ? !tapaArriba || tapaAbajo : tapaAbajo && !tapaArriba));
    };
    revisar();
    const reloj = window.setInterval(revisar, 300);
    return () => window.clearInterval(reloj);
  }, [e.abierto, e.foco]);

  // En el asistente ya hay un campo para hablar: la bola taparía el suyo.
  const enAsistente = location.pathname.startsWith("/omnibox");
  const ocupado = e.fase === "pensando" || e.fase === "trabajando";
  const estado =
    e.fase === "escuchando" && e.linea?.startsWith("Te escucho") ? "Toca la bola cuando termines" : ESTADO[e.fase];

  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setTexto("");
    void escribir(t);
  };

  return (
    <>
      <FocoPiloto />
      <LayoutGroup>
        <AnimatePresence>
          {!e.abierto && !enAsistente && (
            <motion.div
              key="lanzador"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className="group fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 z-40 flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => activar("boton")}
                aria-label="Hablarle a Vendfy (F9)"
                data-testid="piloto-lanzador"
                className="rounded-full transition-transform hover:scale-[1.06] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <motion.span layoutId="orbe-vendfy" className="block" transition={{ type: "spring", stiffness: 260, damping: 26 }}>
                  <OrbeMagico fase="apagado" tam={48} motor="css" atento={esperaPalabra} />
                </motion.span>
              </button>
              <button
                type="button"
                onClick={manos.alternar}
                aria-pressed={manos.activo}
                aria-label={manos.activo ? "Apagar manos libres" : "Prender manos libres: escuchar «Oye Vendfy»"}
                title={
                  manos.estado === "sin-permiso"
                    ? "Sin permiso para el micrófono"
                    : manos.activo
                      ? "Manos libres prendido: di «Oye Vendfy»"
                      : "Manos libres: escuchar «Oye Vendfy»"
                }
                data-testid="piloto-manos-libres"
                data-estado={manos.estado}
                className={cn(
                  "grid size-8 place-items-center rounded-full border shadow-float transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  manos.activo
                    ? "border-success/30 bg-success-soft text-success-soft-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {manos.estado === "cargando" ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : manos.activo ? (
                  <Ear className="size-3.5" aria-hidden />
                ) : (
                  <EarOff className="size-3.5" aria-hidden />
                )}
              </button>
              {/* El nombre y cómo llamarlo, al pasar el mouse. */}
              <span className="pointer-events-none hidden translate-x-[-4px] rounded-full bg-slate-950/85 px-3 py-1 text-xs font-medium text-white opacity-0 shadow-float transition group-hover:translate-x-0 group-hover:opacity-100 sm:block">
                Vendfy · <kbd className="font-sans font-semibold">F9</kbd>
                {esperaPalabra && <span className="text-white/70"> · di «Oye Vendfy»</span>}
              </span>
            </motion.div>
          )}

          {e.abierto && (
            <motion.div
              key="vendfy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className={cn(
                "pointer-events-none fixed inset-x-0 z-[80] flex justify-center px-4",
                arriba ? "top-[calc(1rem+env(safe-area-inset-top))]" : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]",
              )}
            >
              {/* Por encima de las hojas y diálogos de la pantalla (en el celular la Caja abre el
                  carrito en una hoja modal): sin esto la bola quedaba tapada y sin poder tocarse. */}
              <section
                ref={grupo}
                id="piloto-tarjeta"
                role="dialog"
                aria-label="Vendfy"
                data-testid="piloto-tarjeta"
                data-fase={e.fase}
                className={cn("flex max-w-full flex-col items-center gap-3", arriba && "flex-col-reverse")}
              >
                {e.tabla && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("pointer-events-auto w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl text-slate-900 shadow-float dark:text-white", VIDRIO)}
                    data-testid="piloto-tabla"
                  >
                    <p className="border-b border-black/5 px-3.5 py-2 text-xs font-semibold text-slate-500 dark:border-white/10 dark:text-white/60">{e.tabla.titulo}</p>
                    <ul className="max-h-44 divide-y divide-black/5 overflow-y-auto dark:divide-white/10">
                      {e.tabla.filas.map((f) => (
                        <li key={f.nombre} className="flex items-center gap-2 px-3.5 py-1.5 text-sm">
                          <span className="min-w-0 flex-1 truncate">{f.nombre}</span>
                          <span className={cn("text-slate-500 dark:text-white/55", /^[\d—]/.test(f.antes) && "cifra")}>{f.antes}</span>
                          <ArrowRight className="size-3.5 flex-none text-slate-400 dark:text-white/40" aria-label="pasa a" />
                          <span className={cn("font-semibold text-emerald-600 dark:text-emerald-300", /^\d/.test(f.despues) && "cifra")}>{f.despues}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}

                <div aria-live="polite" className="flex flex-col items-center gap-2">
                  {e.dicho && (
                    <p
                      className={cn("max-w-[min(30rem,calc(100vw-2rem))] truncate rounded-full px-3 py-0.5 text-[13px] text-slate-600 dark:text-white/70", VIDRIO)}
                      data-testid="piloto-dicho"
                    >
                      «{e.dicho}»
                    </p>
                  )}
                  {e.linea && <SubtituloVendfy key={e.linea} texto={e.linea} />}
                </div>

                {e.irAlAsistente && (
                  <button
                    type="button"
                    onClick={() => {
                      detener();
                      navigate("/omnibox");
                    }}
                    className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white shadow-float transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    Abrir el asistente <ArrowUpRight className="size-4" aria-hidden />
                  </button>
                )}

                {teclado && (
                  <form
                    onSubmit={enviar}
                    className={cn("pointer-events-auto flex w-[min(28rem,calc(100vw-2rem))] items-center gap-2 rounded-full p-1.5 pl-4 shadow-float", VIDRIO)}
                  >
                    <input
                      ref={campo}
                      value={texto}
                      onChange={(ev) => setTexto(ev.target.value)}
                      placeholder={e.pregunta ? "Contesta aquí o con F9…" : "Escríbele a Vendfy…"}
                      aria-label="Escribirle a Vendfy"
                      data-testid="piloto-campo"
                      className="h-8 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-white/45"
                    />
                    <button
                      type="submit"
                      disabled={!texto.trim()}
                      aria-label="Enviar"
                      className="grid size-8 flex-none place-items-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-600 disabled:bg-slate-900/10 disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:disabled:bg-white/10 dark:disabled:text-white/40"
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                  </form>
                )}

                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    onClick={() => setTeclado((v) => !v)}
                    aria-pressed={teclado}
                    aria-label={teclado ? "Ocultar el teclado" : "Escribir en vez de hablar"}
                    data-testid="piloto-teclado"
                    className={cn(CRISTAL, teclado && "bg-slate-900 text-white ring-slate-900 hover:bg-slate-900 hover:text-white dark:bg-white dark:text-slate-900 dark:hover:bg-white dark:hover:text-slate-900")}
                  >
                    <Keyboard className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    id="piloto-orbe"
                    onClick={() => activar("boton")}
                    disabled={ocupado}
                    aria-label={e.fase === "escuchando" ? "Ya terminé de hablar" : "Hablar (F9)"}
                    className="pointer-events-auto rounded-full transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-default"
                  >
                    <motion.span layoutId="orbe-vendfy" className="block" transition={{ type: "spring", stiffness: 260, damping: 26 }}>
                      <OrbeMagico fase={e.fase} tam={76} nivel={nivelOrbe.current} />
                    </motion.span>
                  </button>
                  <button type="button" onClick={detener} aria-label="Cerrar Vendfy" className={CRISTAL}>
                    <X className="size-4" aria-hidden />
                  </button>
                </div>

                <p
                  data-testid="piloto-estado"
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-medium text-slate-600 transition-opacity dark:text-white/75",
                    VIDRIO,
                    !estado && "invisible",
                  )}
                >
                  {estado || "·"}
                </p>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </>
  );
}
