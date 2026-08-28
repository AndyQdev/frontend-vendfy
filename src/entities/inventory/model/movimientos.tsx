import {
  AlertTriangle,
  Archive,
  ArrowUpDown,
  Boxes,
  DollarSign,
  Minus,
  Package,
  Plus,
  ShoppingCart,
} from "lucide-react";
import type { MovementType } from "./types";

export interface ConfigMovimiento {
  label: string;
  description: string;
  /** Clases del punto de color en las listas. */
  color: string;
  /** Clases del chip: fondo + texto, con su variante oscura. */
  chip: string;
  icon: React.ReactNode;
}

/**
 * Cómo se muestra cada tipo de asiento del libro.
 *
 * Los seis primeros los puede registrar una persona; el resto los genera el
 * motor de consumo al vender, cancelar o fraccionar, y aparecen acá solo para
 * poder leerlos en el historial.
 */
export const MOVEMENT_TYPE_CONFIG: Record<MovementType, ConfigMovimiento> = {
  purchase: {
    label: "Compra",
    description: "Entró mercadería comprada",
    color: "bg-blue-500",
    chip: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
    icon: <ShoppingCart className="h-3.5 w-3.5" />,
  },
  sale: {
    label: "Venta",
    description: "Salida por una venta completada",
    color: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
    icon: <DollarSign className="h-3.5 w-3.5" />,
  },
  adjustment_in: {
    label: "Ajuste +",
    description: "Corrección hacia arriba, sin compra",
    color: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
    icon: <Plus className="h-3.5 w-3.5" />,
  },
  adjustment_out: {
    label: "Ajuste −",
    description: "Corrección hacia abajo, sin venta",
    color: "bg-orange-500",
    chip: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
    icon: <Minus className="h-3.5 w-3.5" />,
  },
  waste: {
    label: "Merma",
    description: "Perdido, derramado o dañado",
    color: "bg-red-500",
    chip: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  sample: {
    label: "Muestra",
    description: "Entregado como prueba, sin cobrar",
    color: "bg-violet-500",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-900/20 dark:text-violet-400",
    icon: <Package className="h-3.5 w-3.5" />,
  },
  // ── Automáticos: los genera el motor de consumo ──────────────────────
  consumption: {
    label: "Consumo",
    description: "Salida por un pedido",
    color: "bg-emerald-600",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
    icon: <ShoppingCart className="h-3.5 w-3.5" />,
  },
  return: {
    label: "Devolución",
    description: "Reversa del consumo de un pedido",
    color: "bg-sky-500",
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-900/20 dark:text-sky-400",
    icon: <ArrowUpDown className="h-3.5 w-3.5" />,
  },
  fraction: {
    label: "Fraccionamiento",
    description: "Se abrió y trasvasó producto",
    color: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
    icon: <Boxes className="h-3.5 w-3.5" />,
  },
  assembly: {
    label: "Armado",
    description: "Se armó un producto compuesto",
    color: "bg-teal-500",
    chip: "bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-400",
    icon: <Boxes className="h-3.5 w-3.5" />,
  },
  container_open: {
    label: "Envase abierto",
    description: "Cambio de estado del envase",
    color: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    icon: <Archive className="h-3.5 w-3.5" />,
  },
  container_empty: {
    label: "Envase vacío",
    description: "El envase llegó a cero",
    color: "bg-slate-500",
    chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    icon: <Archive className="h-3.5 w-3.5" />,
  },
};

/** Los tipos que puede elegir una persona, en el orden en que se ofrecen. */
export const TIPOS_MANUALES: MovementType[] = [
  "purchase",
  "adjustment_in",
  "adjustment_out",
  "waste",
  "sample",
];

/**
 * Un motivo en las palabras del comerciante.
 *
 * La persona que ajusta el stock no piensa en "adjustment_out": piensa en
 * "se derramó" o "conté y había menos". El concepto traduce esa intención al
 * tipo de asiento correcto, para que después el historial y los reportes de
 * merma cuadren sin que nadie tenga que elegir bien un término técnico.
 */
export interface Concepto {
  id: string;
  label: string;
  ayuda: string;
  type: MovementType;
  direccion: "in" | "out";
  /** Si además hay que preguntar cuánto costó (alimenta el costo promedio). */
  pideCosto?: boolean;
}

export const CONCEPTOS: Concepto[] = [
  {
    id: "uso",
    label: "Se usó o se consumió",
    ayuda: "Salió producto sin que fuera una venta registrada",
    type: "adjustment_out",
    direccion: "out",
  },
  {
    id: "merma",
    label: "Merma o derrame",
    ayuda: "Se perdió, se derramó o llegó dañado",
    type: "waste",
    direccion: "out",
  },
  {
    id: "muestra",
    label: "Muestra al cliente",
    ayuda: "Se entregó como prueba, sin cobrar",
    type: "sample",
    direccion: "out",
  },
  {
    id: "conteo_menos",
    label: "Corrección de conteo",
    ayuda: "Contaste y había menos de lo que decía el sistema",
    type: "adjustment_out",
    direccion: "out",
  },
  {
    id: "compra",
    label: "Compra",
    ayuda: "Entró mercadería que compraste",
    type: "purchase",
    direccion: "in",
    pideCosto: true,
  },
  {
    id: "devolucion",
    label: "Devolución de un cliente",
    ayuda: "Volvió producto al stock",
    type: "adjustment_in",
    direccion: "in",
  },
  {
    id: "conteo_mas",
    label: "Corrección de conteo",
    ayuda: "Contaste y había más de lo que decía el sistema",
    type: "adjustment_in",
    direccion: "in",
  },
];

export function conceptosPara(direccion: "in" | "out"): Concepto[] {
  return CONCEPTOS.filter((c) => c.direccion === direccion);
}

/**
 * Si el movimiento saca stock. Se prefiere `direction`, que ya viene
 * calculado del backend; la lista de tipos es el respaldo para los asientos
 * viejos que todavía no lo traen.
 */
export function esSalida(type: MovementType, direction?: number): boolean {
  if (typeof direction === "number") return direction < 0;
  return !["purchase", "adjustment_in", "assembly", "return"].includes(type);
}
