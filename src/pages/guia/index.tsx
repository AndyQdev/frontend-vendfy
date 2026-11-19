import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, MousePointerClick } from "lucide-react";

import { VendfyLogo } from "@/shared/files/VendfyLogo";
import { cn } from "@/shared/lib/cn";

import guia from "./guia.json";
import marcasJson from "./marcas.json";

/**
 * `/guia`, pública (fuera de <Protected />): cómo se usa cada pantalla del panel,
 * con la captura real y cada botón resaltado y explicado.
 *
 * Las capturas y las cajas de los botones salen de `scripts/guia/capturar.cjs`
 * (lee `guia.json`, escribe `public/guia/*.webp` y `marcas.json`). Si cambia una
 * pantalla, se vuelve a correr el script; el texto se edita en `guia.json`.
 */
type Caja = { x: number; y: number; w: number; h: number } | null;
type Marca = { titulo: string; texto: string };
type Pantalla = { id: string; titulo: string; ruta: string; resumen: string; marcas: Marca[] };

const PANTALLAS = (guia.pantallas as Pantalla[]).filter((p) => (marcasJson as Record<string, Caja[]>)[p.id]);
const CAJAS = marcasJson as Record<string, Caja[]>;

export default function GuiaPage() {
  useEffect(() => {
    document.title = "Guía de uso · Vendfy";
  }, []);

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <VendfyLogo variant="full" size={36} />
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Entrar al panel <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="flex max-w-3xl flex-col gap-3">
            <p className="text-xs font-bold tracking-[0.16em] text-emerald-600 dark:text-emerald-400">GUÍA DE USO</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Cómo se usa Vendfy, pantalla por pantalla</h1>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
              Cada pantalla con su captura real. Los números marcan los botones: pasa el cursor (o toca) un número o una
              explicación y la captura enfoca ese botón.
            </p>
          </div>
          <nav aria-label="Pantallas de la guía" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {PANTALLAS.map((p, i) => (
              <a
                key={p.id}
                href={`#${p.id}`}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
              >
                {i + 1}. {p.titulo}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        {PANTALLAS.map((p, i) => (
          <SeccionPantalla key={p.id} pantalla={p} numero={i + 1} cajas={CAJAS[p.id] ?? []} />
        ))}
        <footer className="flex flex-col items-center gap-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <BookOpen className="size-5" aria-hidden />
          <p>Las capturas son de una tienda de demostración. Lo que ves en tu panel depende de tu plan y de tu rol.</p>
        </footer>
      </div>
    </main>
  );
}

function SeccionPantalla({ pantalla, numero, cajas }: { pantalla: Pantalla; numero: number; cajas: Caja[] }) {
  const [activa, setActiva] = useState<number | null>(null);
  const visibles = pantalla.marcas.map((m, i) => ({ ...m, i, caja: cajas[i] })).filter((m) => m.caja);

  return (
    <section
      id={pantalla.id}
      className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            {numero}
          </span>
          <h2 className="text-lg font-semibold">{pantalla.titulo}</h2>
        </div>
        <code className="self-start rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:self-auto">
          {pantalla.ruta.replace("{tienda}", ":tienda")}
        </code>
      </div>
      <p className="px-5 pt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{pantalla.resumen}</p>

      <div className="grid items-start gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700" onMouseLeave={() => setActiva(null)}>
          <img
            src={`/guia/${pantalla.id}.webp`}
            alt={`Pantalla de ${pantalla.titulo} en el panel de Vendfy`}
            className="block h-auto w-full"
            loading={numero <= 2 ? "eager" : "lazy"}
          />
          {visibles.map((m, k) => {
            const c = m.caja!;
            const enfocada = activa === m.i;
            return (
              <button
                key={m.i}
                type="button"
                aria-label={`${k + 1}. ${m.titulo}`}
                onMouseEnter={() => setActiva(m.i)}
                onFocus={() => setActiva(m.i)}
                onClick={() => setActiva(enfocada ? null : m.i)}
                className={cn(
                  "absolute rounded-md border-2 transition-all duration-200 focus-visible:outline-none sm:rounded-lg",
                  enfocada
                    ? "z-20 border-emerald-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]"
                    : "z-10 border-emerald-500/80 hover:border-emerald-400",
                )}
                style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%` }}
              >
                <span
                  className={cn(
                    "absolute -left-2 -top-2 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow ring-2 ring-white transition sm:-left-2.5 sm:-top-2.5 sm:size-6 sm:text-[11px]",
                    enfocada ? "scale-110 bg-emerald-500" : "bg-emerald-600",
                  )}
                >
                  {k + 1}
                </span>
              </button>
            );
          })}
        </div>

        <ol className="flex flex-col gap-2">
          {visibles.map((m, k) => (
            <li key={m.i}>
              <button
                type="button"
                onMouseEnter={() => setActiva(m.i)}
                onMouseLeave={() => setActiva(null)}
                onFocus={() => setActiva(m.i)}
                onBlur={() => setActiva(null)}
                onClick={() => setActiva(activa === m.i ? null : m.i)}
                className={cn(
                  "flex w-full gap-3 rounded-xl border p-3 text-left transition",
                  activa === m.i
                    ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/20"
                    : "border-slate-200 hover:border-emerald-300 dark:border-slate-700 dark:hover:border-emerald-600",
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                  {k + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{m.titulo}</span>
                  <span className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{m.texto}</span>
                </span>
              </button>
            </li>
          ))}
          <li className="flex items-center gap-2 px-1 pt-1 text-xs text-slate-500 dark:text-slate-400">
            <MousePointerClick className="size-4" aria-hidden /> Toca un número para enfocar el botón.
          </li>
        </ol>
      </div>
    </section>
  );
}
