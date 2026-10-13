import type { ResultadoEscaneo, TiendaDelProducto } from "@/entities/product/model/escaneo";
import type { FraseVoz } from "@/shared/voz";
import { apocopar, haceCuantoEnLetras, mayuscula, nombreCorto, numeroALetras } from "@/shared/voz/letras";
import type { ResultadoAgregar } from "./venta";

/**
 * Lo que dice la voz al escanear, según dónde se esté. Cada pantalla dice lo
 * que sirve ahí: en Caja el precio y cuántos van, en Inventario el stock, en
 * Compras cuántas veces se compró… sin repetir "cincuenta bolivianos" en
 * todos lados.
 *
 * Se arma con piezas cortas que el servidor guarda por su texto: "Mermelada
 * Arcor." + "Tienes cuatro." + "¿Agregas, quitas o cuentas?". Cada pieza se
 * genera una sola vez (para todos los comercios) y después sale al instante;
 * el nombre del producto, la primera vez que se lo escanea.
 */

const texto = (t: string): FraseVoz => ({ tipo: "texto", texto: t });
const n = (x: number) => numeroALetras(x);
/** "un pedido", "veintiún clientes". */
const nMasc = (x: number) => apocopar(numeroALetras(x));
/** "una vez", "veintiuna veces". */
const nFem = (x: number) => numeroALetras(x).replace(/uno$/, "una");

/** "Mermelada Arcor." */
export function fraseNombre(nombre: string): FraseVoz {
  return texto(`${mayuscula(nombreCorto(nombre))}.`);
}

function tiendaDe(r: ResultadoEscaneo, tiendaId: string | null): TiendaDelProducto | null {
  const tiendas = r.producto?.tiendas ?? [];
  return tiendas.find((t) => t.storeId === tiendaId) ?? tiendas[0] ?? null;
}

const precioDe = (t: TiendaDelProducto): FraseVoz => ({ tipo: "precio", monto: t.price, moneda: t.currency });

/** "Van dos." (las de 2 a 20 ya están guardadas como aviso). */
export function fraseVan(cantidad: number): FraseVoz {
  return cantidad >= 2 && cantidad <= 20 ? { tipo: "aviso", aviso: "van", n: cantidad } : texto(`Van ${n(cantidad)}.`);
}

// ─── Las frases fijas: se precalientan junto con los precios ───────────────

const PREGUNTA_FICHA = "¿Lo vendes o lo compras?";

/** Lo que pregunta el alta por voz cuando falta un dato. */
export const PREGUNTAS_ALTA = {
  precio: "¿A qué precio lo vendes?",
  precioTrasCosto: "¿Y a qué precio lo vendes?",
  nombre: "¿Cómo se llama el producto?",
  repetir: "No te entendí. ¿Me lo repites?",
} as const;
const PREGUNTA_INVENTARIO = "¿Agregas, quitas o cuentas?";

export const FRASES_FIJAS: string[] = [
  PREGUNTA_FICHA,
  PREGUNTA_INVENTARIO,
  "No tienes stock.",
  "Tienes uno.",
  ...Array.from({ length: 19 }, (_, i) => `Tienes ${n(i + 2)}.`),
  "La última vez,",
  "Primera compra.",
  "Completo.",
  "No estaba en la compra.",
  "Pedido armado.",
  "Ya están todos.",
  "Esto no va en el pedido.",
  "Nunca lo compraste.",
  "Todavía no lo vendiste.",
  "No está en ningún pedido.",
  "Ningún cliente lo compró todavía.",
  "No está registrado.",
  "¿Lo damos de alta?",
  ...Object.values(PREGUNTAS_ALTA),
  ...[1, 2, 3, 4, 5].flatMap((de) => Array.from({ length: de }, (_, i) => `${mayuscula(n(i + 1))} de ${n(de)}.`)),
];

// ─── Productos, la ficha y el asistente ────────────────────────────────────

/** "Mermelada Arcor. Cincuenta bolivianos. ¿Lo vendes o lo compras?" */
export function frasesFicha(r: ResultadoEscaneo, tiendaId: string | null): FraseVoz[] {
  const p = r.producto;
  if (!p) return frasesNoRegistrado();
  const t = tiendaDe(r, tiendaId);
  if (!t) return [fraseNombre(p.name), { tipo: "aviso", aviso: "sin_tienda" }];
  return [fraseNombre(p.name), precioDe(t), texto(PREGUNTA_FICHA)];
}

/** Un código que el comercio no tiene: se abre la hoja para darlo de alta. */
export function frasesNoRegistrado(): FraseVoz[] {
  return [texto("No está registrado."), texto("¿Lo damos de alta?")];
}

// ─── Caja ──────────────────────────────────────────────────────────────────

/** "Cincuenta bolivianos." y desde la segunda: "Cincuenta bolivianos. Van dos." */
export function frasesCaja(resultado: ResultadoAgregar): FraseVoz[] {
  if (resultado.ok === false) {
    return [{ tipo: "aviso", aviso: resultado.motivo }];
  }
  const precio = precioDe(resultado.tienda);
  return resultado.cantidad >= 2 ? [precio, fraseVan(resultado.cantidad)] : [precio];
}

// ─── Inventario ────────────────────────────────────────────────────────────

/**
 * "Mermelada Arcor. Tienes cuatro. ¿Agregas, quitas o cuentas?"
 * Lo que se vende por peso o volumen no dice el número (serían gramos):
 * solo el nombre y la pregunta.
 */
export function frasesInventario(r: ResultadoEscaneo, tiendaId: string | null): FraseVoz[] {
  const p = r.producto;
  if (!p) return frasesNoRegistrado();
  const t = tiendaDe(r, tiendaId);
  const frases = [fraseNombre(p.name)];
  if (t && p.inventoryType === "unit") {
    const stock = Math.max(0, Math.floor(t.stock));
    frases.push(texto(stock === 0 ? "No tienes stock." : stock === 1 ? "Tienes uno." : `Tienes ${n(stock)}.`));
  }
  frases.push(texto(PREGUNTA_INVENTARIO));
  return frases;
}

// ─── Nueva compra ──────────────────────────────────────────────────────────

/**
 * La primera vez: "Mermelada Arcor. La última vez, cuarenta y cinco
 * bolivianos." (o "Primera compra."); después: "Van dos.".
 */
export function frasesNuevaCompra(
  nombre: string,
  cantidad: number,
  ultimoCosto: { monto: number; moneda: string } | null,
): FraseVoz[] {
  if (cantidad >= 2) return [fraseVan(cantidad)];
  if (!ultimoCosto || !(ultimoCosto.monto > 0)) return [fraseNombre(nombre), texto("Primera compra.")];
  return [fraseNombre(nombre), texto("La última vez,"), { tipo: "precio", monto: ultimoCosto.monto, moneda: ultimoCosto.moneda }];
}

// ─── Recibir una compra ────────────────────────────────────────────────────

/** "Dos de tres.", "Tres de tres. Completo.", "Llegaron cuatro. Pediste tres." */
export function frasesRecepcion(llego: number, pedido: number): FraseVoz[] {
  if (llego > pedido) return [texto(`Llegaron ${n(llego)}.`), texto(`Pediste ${n(pedido)}.`)];
  const cuenta = texto(`${mayuscula(n(llego))} de ${n(pedido)}.`);
  return llego === pedido ? [cuenta, texto("Completo.")] : [cuenta];
}

/** "Mermelada Arcor. No estaba en la compra." */
export function frasesNoEstabaEnLaCompra(nombre: string): FraseVoz[] {
  return [fraseNombre(nombre), texto("No estaba en la compra.")];
}

// ─── Armar un pedido ───────────────────────────────────────────────────────

export type ArmadoParaVoz =
  | { tipo: "sumado"; listas: number; lleva: number; pedidoCompleto: boolean }
  | { tipo: "ya_estan" }
  | { tipo: "no_esta" };

/** "Uno de dos.", "Pedido armado.", "Ya están todos.", "Esto no va en el pedido." */
export function frasesArmado(a: ArmadoParaVoz): FraseVoz[] {
  if (a.tipo === "no_esta") return [texto("Esto no va en el pedido.")];
  if (a.tipo === "ya_estan") return [texto("Ya están todos.")];
  if (a.pedidoCompleto) return [texto("Pedido armado.")];
  return [texto(`${mayuscula(n(a.listas))} de ${n(a.lleva)}.`)];
}

// ─── Las listas que se filtran al escanear ─────────────────────────────────

/** Compras: "Mermelada Arcor. Lo compraste tres veces. La última, hace cinco días." */
export function frasesCompras(
  nombre: string,
  r: { compras: number; ultima: string | null } | undefined,
): FraseVoz[] {
  const frases = [fraseNombre(nombre)];
  if (!r || r.compras === 0) return [...frases, texto("Nunca lo compraste.")];
  frases.push(texto(r.compras === 1 ? "Lo compraste una vez." : `Lo compraste ${nFem(r.compras)} veces.`));
  const hace = haceCuantoEnLetras(r.ultima);
  if (hace && r.compras > 1) frases.push(texto(`La última, ${hace}.`));
  else if (hace) frases.push(texto(`Fue ${hace}.`));
  return frases;
}

const PERIODO: Record<string, string> = {
  day: "hoy",
  week: "esta semana",
  month: "este mes",
  year: "este año",
};

/**
 * Ventas: "Mermelada Arcor. Vendiste doce este mes." (el período es el filtro
 * de la lista). Lo que se vende por peso dice en cuántas ventas.
 */
export function frasesVentas(
  nombre: string,
  r: { unidades: number; ventas: number } | undefined,
  periodo?: string | null,
): FraseVoz[] {
  const cuando = periodo ? PERIODO[periodo] : undefined;
  const frases = [fraseNombre(nombre)];
  if (!r || r.ventas === 0) {
    return [...frases, texto(cuando ? `No lo vendiste ${cuando}.` : "Todavía no lo vendiste.")];
  }
  const cola = cuando ? ` ${cuando}` : "";
  frases.push(
    texto(
      Number.isInteger(r.unidades)
        ? `Vendiste ${n(r.unidades)}${cola}.`
        : `Está en ${nFem(r.ventas)} ${r.ventas === 1 ? "venta" : "ventas"}${cola}.`,
    ),
  );
  return frases;
}

/** Pedidos: "Mermelada Arcor. Está en tres pedidos." */
export function frasesPedidos(nombre: string, pedidos: number): FraseVoz[] {
  return [
    fraseNombre(nombre),
    texto(pedidos === 0 ? "No está en ningún pedido." : `Está en ${nMasc(pedidos)} ${pedidos === 1 ? "pedido" : "pedidos"}.`),
  ];
}

/** Clientes: "Mermelada Arcor. Te lo compraron cuatro clientes." */
export function frasesClientes(nombre: string, clientes: number): FraseVoz[] {
  return [
    fraseNombre(nombre),
    texto(
      clientes === 0
        ? "Ningún cliente lo compró todavía."
        : clientes === 1
          ? "Te lo compró un cliente."
          : `Te lo compraron ${nMasc(clientes)} clientes.`,
    ),
  ];
}

/** Reportes: "Reporte de Mermelada Arcor." */
export function frasesReporte(nombre: string): FraseVoz[] {
  return [texto(`Reporte de ${nombreCorto(nombre)}.`)];
}
