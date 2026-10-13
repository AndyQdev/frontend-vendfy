import { FRASES_FIJAS } from "../model/frases";
import { useState } from "react";
import { motion } from "motion/react";
import { AudioLines, Check, Mic, Play, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Switch } from "@/shared/ui/switch";
import {
  precalentarVoz,
  probarVoz,
  setPreferenciasVoz,
  useHablando,
  usePreferenciasVoz,
  useVoces,
  type VozDisponible,
} from "@/shared/voz";
import { setSonidoActivo, sonidoActivo } from "../model/sonido";
import { BarrasVoz } from "./piezas";

/** Lo que dice cada voz al elegirla: también es la prueba de cómo suena un precio. */
const muestra = (v: VozDisponible) => `Hola, soy ${v.nombre}. Así te voy a decir los precios: quince bolivianos con cincuenta.`;

/**
 * Sonido y voz del escáner: decir el precio, los bips, y quién habla.
 * Va en la hoja del producto y en Caja (donde la hoja no se abre).
 */
export function AjustesVoz({ className, align = "end" }: { className?: string; align?: "start" | "center" | "end" }) {
  const prefs = usePreferenciasVoz();
  const [bips, setBips] = useState(sonidoActivo);
  const [probando, setProbando] = useState<string | null>(null);
  const hablando = useHablando();
  const { data, isLoading } = useVoces();
  const algo = prefs.precios || bips;

  const elegir = (v: VozDisponible) => {
    setPreferenciasVoz({ voz: v.id });
    setProbando(v.id);
    probarVoz(v.id, muestra(v));
    // Los precios del comercio y las frases fijas con la voz nueva, para que suenen al instante.
    void precalentarVoz(FRASES_FIJAS);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Sonido y voz del escáner"
          title="Sonido y voz"
          className={cn(
            "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          {algo ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[320px] p-0">
        <div className="space-y-3 p-4">
          <p className="text-sm font-semibold">Sonido y voz</p>
          <label className="flex cursor-pointer items-start gap-3">
            <AudioLines className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Decir el precio</span>
              <span className="block text-xs text-muted-foreground">
                Al escanear, una voz dice el precio, si queda poco y cuántos van.
              </span>
            </span>
            <Switch checked={prefs.precios} onCheckedChange={(v) => setPreferenciasVoz({ precios: v })} />
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <Mic className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Escuchar al dar de alta</span>
              <span className="block text-xs text-muted-foreground">
                Si el producto no está registrado, dime nombre, precio y cantidad y lo completo.
              </span>
            </span>
            <Switch checked={prefs.escuchar} onCheckedChange={(v) => setPreferenciasVoz({ escuchar: v })} />
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <Volume2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Bips del escáner</span>
              <span className="block text-xs text-muted-foreground">Un sonido distinto si lo encontró o no.</span>
            </span>
            <Switch
              checked={bips}
              onCheckedChange={(v) => {
                setSonidoActivo(v);
                setBips(v);
              }}
            />
          </label>
        </div>

        <div className="border-t border-border p-2">
          <p className="px-2 pb-1.5 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Quién habla
          </p>
          {isLoading && <p className="px-2 py-3 text-xs text-muted-foreground">Cargando voces…</p>}
          <div className="space-y-0.5" role="radiogroup" aria-label="Voz">
            {(data?.voces ?? []).map((v) => {
              const activa = prefs.voz === v.id;
              const suena = hablando && probando === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={activa}
                  onClick={() => elegir(v)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activa ? "bg-primary-soft" : "hover:bg-muted",
                  )}
                >
                  <motion.span
                    animate={suena ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                    transition={suena ? { duration: 0.8, repeat: Infinity } : undefined}
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
                      activa ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                  >
                    {suena ? <BarrasVoz activa className="h-3.5" /> : v.nombre[0]}
                  </motion.span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{v.nombre}</span>
                    <span className="block text-xs text-muted-foreground">
                      {v.tono} · voz {v.genero}
                    </span>
                  </span>
                  {activa ? (
                    <Check className="size-4 text-primary" aria-hidden />
                  ) : (
                    <Play className="size-3.5 text-muted-foreground" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
          {data && !data.disponible && (
            <p className="px-2 pb-1 pt-2 text-xs text-muted-foreground">
              La voz natural no está disponible ahora: habla la voz del navegador.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
