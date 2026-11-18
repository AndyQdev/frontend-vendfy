import { Megaphone } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { AnuncioDeOrigen } from "@/entities/whatsapp/model/inbox-types";

const RED: Record<AnuncioDeOrigen["red"], string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  otra: "un anuncio",
};

/** "hace 3 h", "hace 2 d": cuánto pasó desde que tocó el anuncio. */
export function haceCuanto(iso: string | null, ahora = Date.now()): string {
  if (!iso) return "";
  const min = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/** Nombre corto del anuncio: el título, o el principio del texto. */
export function nombreDelAnuncio(a: AnuncioDeOrigen): string {
  const base = a.titulo && !/^chatea con nosotros$/i.test(a.titulo) ? a.titulo : a.texto || a.titulo || "Anuncio";
  return base.replace(/^[^\p{L}\p{N}]+/u, "").slice(0, 40);
}

/** Pastilla para la lista de conversaciones. */
export function ChipAnuncio({ anuncio, className }: { anuncio: AnuncioDeOrigen; className?: string }) {
  return (
    <span
      title={`Vino de ${RED[anuncio.red]}: ${anuncio.texto ?? anuncio.titulo ?? ""}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
        anuncio.vigente
          ? "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Megaphone className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate normal-case tracking-normal">{nombreDelAnuncio(anuncio)}</span>
    </span>
  );
}

/** Aviso arriba del chat: quien atiende a mano necesita el mismo contexto que el agente. */
export function AvisoAnuncio({ anuncio }: { anuncio: AnuncioDeOrigen }) {
  return (
    <div className="flex shrink-0 items-start gap-2 border-b border-border/60 bg-sky-50 px-4 py-2.5 text-xs text-sky-900 dark:bg-sky-900/20 dark:text-sky-200">
      <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 leading-snug">
        <p>
          <span className="font-semibold">Vino de un anuncio en {RED[anuncio.red]}</span>{" "}
          <span className="text-sky-800/80 dark:text-sky-200/70">{haceCuanto(anuncio.desde)}</span>
          {!anuncio.vigente && (
            <span className="text-sky-800/80 dark:text-sky-200/70"> · ya no suma la venta al anuncio</span>
          )}
        </p>
        {anuncio.texto && <p className="mt-0.5 line-clamp-2 text-sky-900/80 dark:text-sky-100/80">{anuncio.texto}</p>}
      </div>
    </div>
  );
}
