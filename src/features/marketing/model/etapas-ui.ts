import {
  BadgeCheck,
  CircleOff,
  MessageCircle,
  MessagesSquare,
  ReceiptText,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import type { Etapa } from "@/entities/marketing/model/types";

/**
 * Cómo se ve cada etapa del tablero. Un color por etapa, del frío al cálido
 * (del primer mensaje a la compra), y gris para lo perdido.
 */
export const ETAPA_ESTILO: Record<
  Etapa,
  { icono: LucideIcon; columna: string; acento: string; chip: string; borde: string }
> = {
  nuevo: {
    icono: MessageCircle,
    columna: "bg-sky-50/80 dark:bg-sky-950/25",
    acento: "bg-sky-500",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    borde: "border-sky-200/70 dark:border-sky-900/50",
  },
  conversando: {
    icono: MessagesSquare,
    columna: "bg-indigo-50/80 dark:bg-indigo-950/25",
    acento: "bg-indigo-500",
    chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    borde: "border-indigo-200/70 dark:border-indigo-900/50",
  },
  cotizado: {
    icono: ReceiptText,
    columna: "bg-amber-50/80 dark:bg-amber-950/25",
    acento: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    borde: "border-amber-200/70 dark:border-amber-900/50",
  },
  pidio: {
    icono: ShoppingBag,
    columna: "bg-violet-50/80 dark:bg-violet-950/25",
    acento: "bg-violet-500",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    borde: "border-violet-200/70 dark:border-violet-900/50",
  },
  compro: {
    icono: BadgeCheck,
    columna: "bg-emerald-50/80 dark:bg-emerald-950/25",
    acento: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    borde: "border-emerald-200/70 dark:border-emerald-900/50",
  },
  perdido: {
    icono: CircleOff,
    columna: "bg-slate-100/80 dark:bg-slate-900/40",
    acento: "bg-slate-400",
    chip: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    borde: "border-slate-200 dark:border-slate-800",
  },
};

/**
 * Respuestas rápidas según en qué quedó la persona. Son el punto de partida:
 * se editan antes de enviar. `{tienda}` y `{nombre}` se reemplazan.
 */
export const RESPUESTAS_RAPIDAS: Record<Etapa, Array<{ titulo: string; texto: string }>> = {
  nuevo: [
    { titulo: "Saludar", texto: "¡Hola{nombre}! Gracias por escribir a {tienda} 😊 ¿Qué producto te interesa? Te paso fotos y precio." },
    { titulo: "Ayudar a elegir", texto: "¿Buscas algo en especial? Cuéntame y te ayudo a elegir." },
  ],
  conversando: [
    { titulo: "Ofrecer separarlo", texto: "¿Te lo separo? Puedes pagar con QR y te lo enviamos hoy." },
    { titulo: "Más fotos", texto: "¿Quieres que te mande más fotos o detalles?" },
  ],
  cotizado: [
    { titulo: "Cerrar el pedido", texto: "Te guardé tu pedido 🙌 ¿Lo confirmamos? Te paso el QR para pagar." },
    { titulo: "Resolver la duda", texto: "¿Hay algo que te frene para confirmar? Te ayudo con lo que necesites." },
  ],
  pidio: [
    { titulo: "Confirmar entrega", texto: "Tu pedido ya está en preparación. ¿A qué hora te queda mejor recibirlo?" },
    { titulo: "Avisar envío", texto: "¡Tu pedido ya salió! Te avisamos cuando esté cerca." },
  ],
  compro: [
    { titulo: "Agradecer", texto: "¡Gracias por tu compra{nombre}! ¿Qué te pareció? Cualquier cosa, aquí estamos." },
    { titulo: "Pedir reseña", texto: "Nos ayudaría mucho tu opinión: ¿cómo te fue con tu compra?" },
  ],
  perdido: [
    { titulo: "Recuperar", texto: "¡Hola{nombre}! ¿Pudiste decidirte? Si todavía te interesa, te ayudo con lo que necesites." },
    { titulo: "Novedades", texto: "¡Hola{nombre}! Llegaron cosas nuevas a {tienda}. ¿Te paso fotos?" },
  ],
};

export function completarTexto(texto: string, tienda: string, nombre: string | null): string {
  return texto.split("{tienda}").join(tienda).split("{nombre}").join(nombre ? `, ${nombre}` : "");
}

/** El primer nombre si parece un nombre (no un teléfono ni un apodo con números). */
export function primerNombre(nombre: string | null | undefined): string | null {
  const n = (nombre ?? "").trim().split(/\s+/)[0];
  return n && /^\p{L}{2,}$/u.test(n) ? n : null;
}

/** Iniciales y un color estable por persona, para el avatar de la tarjeta. */
const COLORES_AVATAR = [
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
];

export function avatarDe(nombre: string | null, telefono: string): { iniciales: string; color: string } {
  const base = (nombre ?? "").trim();
  const partes = base.split(/\s+/).filter((p) => /\p{L}/u.test(p));
  const iniciales = partes.length ? (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase() : telefono.slice(-2);
  let h = 0;
  for (const ch of telefono) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { iniciales, color: COLORES_AVATAR[h % COLORES_AVATAR.length] };
}
