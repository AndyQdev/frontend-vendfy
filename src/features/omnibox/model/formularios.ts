/**
 * Formularios que se llenan conversando (G6b).
 *
 * "Es para Edwin" → no existe → el chat muestra "Nuevo cliente" con el
 * nombre. "Su teléfono 71890031" completa ESE formulario: no va al servidor,
 * no abre otra pantalla, no llena ningún otro. Hay uno solo activo a la vez
 * (el más reciente que sigue abierto), y la tarjeta dice qué falta.
 *
 * Lo que se saca de la frase son reglas (números de teléfono, correos, "se
 * llama…"): sin modelo, instantáneo, y nunca inventa un dato.
 *
 * Puro: se prueba en e2e/logic/formularios.spec.ts.
 */

import type { BorradorProducto, ProductoOpcion } from "@/entities/omnibox/model/types";

/**
 * "cliente": el "Nuevo cliente" (G6b). "productos": uno o varios productos
 * nuevos (G7a), que se completan igual: escribiendo en la tarjeta o
 * diciéndolo ("el alcohol a 15 y el mouse a 60").
 */
export type TipoFormulario = "cliente" | "productos";

export interface Campo {
  clave: string;
  etiqueta: string;
  requerido: boolean;
}

export const CAMPOS: Record<TipoFormulario, Campo[]> = {
  cliente: [
    { clave: "nombre", etiqueta: "nombre", requerido: true },
    { clave: "telefono", etiqueta: "teléfono", requerido: true },
    { clave: "email", etiqueta: "correo", requerido: false },
  ],
  // Los productos van en `productos` (una lista), no en campos sueltos.
  productos: [],
};

export interface Formulario {
  tipo: TipoFormulario;
  campos: Record<string, string>;
  /** Los productos del formulario de productos nuevos. */
  productos?: BorradorProducto[];
  estado: "abierto" | "creando" | "creado" | "descartado";
  error?: string;
  /** Lo que se creó (su id, para seguir con la venta). */
  creado?: { id: string; nombre: string };
  /** Los productos que se crearon (con lo que se compró, para cargar la compra). */
  creados?: (ProductoOpcion & { compra: BorradorProducto["compra"]; venta?: BorradorProducto["venta"] })[];
}

export function nuevoFormularioProductos(productos: BorradorProducto[]): Formulario {
  return { tipo: "productos", campos: {}, productos: productos.map((p) => ({ ...p })), estado: "abierto" };
}

/** Qué le falta a cada producto para poder crearse: "precio", "nombre", o que ya existe. */
export function faltanProducto(b: BorradorProducto): string[] {
  const f: string[] = [];
  if ((b.nombre ?? "").trim().length < 2) f.push("nombre");
  if (!(typeof b.precio === "number" && b.precio > 0)) f.push("precio");
  if (b.existente) f.push("ya existe");
  return f;
}

export function nuevoFormulario(tipo: TipoFormulario, campos: Record<string, string> = {}): Formulario {
  return { tipo, campos: { ...campos }, estado: "abierto" };
}

/** Un campo es válido si alcanza para crear: nombre de 2 letras, teléfono de 7 dígitos, correo con @. */
function valido(clave: string, valor: string | undefined): boolean {
  const v = (valor ?? "").trim();
  if (clave === "nombre") return v.length >= 2;
  if (clave === "telefono") return v.replace(/\D/g, "").length >= 7;
  if (clave === "email") return /^\S+@\S+\.\S+$/.test(v);
  return v.length > 0;
}

/** Lo que falta para poder crear ("teléfono"; o "precio de Alcohol" en los productos). */
export function faltan(f: Formulario): Campo[] {
  if (f.tipo === "productos") {
    const lista = f.productos ?? [];
    if (lista.length === 0) return [{ clave: "productos", etiqueta: "algún producto", requerido: true }];
    return lista.flatMap((b, i) =>
      faltanProducto(b).map((que) => ({
        clave: `${i}.${que}`,
        etiqueta: que === "ya existe" ? `${b.nombre} ya existe` : `${que === "precio" ? "el precio" : "el nombre"}${lista.length > 1 && b.nombre ? ` de ${b.nombre}` : ""}`,
        requerido: true,
      })),
    );
  }
  return CAMPOS[f.tipo].filter((c) => c.requerido && !valido(c.clave, f.campos[c.clave]));
}

export const completo = (f: Formulario) => faltan(f).length === 0;

/**
 * Un precio dicho solo: "a 15", "15 bs", "Bs 15,50", "precio 15", "lo vendo a
 * 20". Para completar el formulario de UN producto sin ir al servidor; con
 * varios productos ("el alcohol a 15 y el mouse a 60") lo resuelve el agente.
 */
export function precioDeFrase(frase: string): number | null {
  const t = normalizar(frase).replace(/(\d),(\d)/g, "$1.$2");
  const m =
    t.match(/^(?:a|en|por|precio(?: de venta)?|vale|cuesta|lo vendo a|se vende a|ponele|pone(?:le)?)?\s*(?:bs\.?\s*)?(\d+(?:\.\d{1,2})?)\s*(?:bs|bolivianos|pesos)?\.?$/) ?? null;
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "zacarías inexistente" → "Zacarías Inexistente". */
export function titular(t: string): string {
  return t
    .trim()
    .split(/\s+/)
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

/**
 * Lo que la frase aporta a un formulario de cliente, solo con reglas:
 * - teléfono: 7 u 8 dígitos (dictados con espacios o guiones: "718 900 31"),
 *   con o sin el 591 adelante;
 * - correo: algo@algo.algo;
 * - nombre: "se llama Edwin Rojas", "su nombre es…", "ponele de nombre…".
 * Devuelve solo los campos que encontró (vacío si la frase no es para esto).
 */
export function camposDeFrase(tipo: TipoFormulario, frase: string): Record<string, string> {
  const encontrados: Record<string, string> = {};
  if (tipo !== "cliente") return encontrados;

  const correo = frase.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (correo) encontrados.email = correo[0].toLowerCase();

  const sinCorreo = correo ? frase.replace(correo[0], " ") : frase;
  let digitos = sinCorreo.replace(/[^\d]/g, "");
  if (digitos.startsWith("591") && digitos.length >= 10) digitos = digitos.slice(3);
  if (digitos.length >= 7 && digitos.length <= 8) encontrados.telefono = digitos;

  const nombre = sinCorreo.match(/(?:se llama|su nombre es|el nombre es|nombre:?|ponele de nombre)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]{2,60})/i);
  if (nombre) encontrados.nombre = titular(nombre[1].replace(/\s+(y|con|su|el|la)\s.*$/i, ""));
  return encontrados;
}

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** "Sí", "crealo", "créalos", "listo": con el formulario completo, es crear. */
export function esConfirmacion(frase: string): boolean {
  return /^(si|dale|listo|ok|crealo|crealos|creala|crealas|crea|crear|guardalo|guardalos|guarda|confirmo|confirmar)[.! ]*$/.test(normalizar(frase));
}

/** El formulario activo: el más reciente que sigue abierto (uno solo a la vez). */
export function formularioActivo<T extends { id: string; formulario?: Formulario }>(mensajes: T[]): T | null {
  for (let i = mensajes.length - 1; i >= 0; i--) {
    const f = mensajes[i].formulario;
    if (f && (f.estado === "abierto" || f.estado === "creando")) return mensajes[i];
  }
  return null;
}

/** Lo que se le contesta en el chat al completar ("Anoté el teléfono: 71890031."). */
export function resumenCompletado(f: Formulario, nuevos: Record<string, string>): string {
  if (f.tipo === "productos") {
    const resto = faltan(f);
    return resto.length ? `Anoté el precio. Falta ${resto.map((c) => c.etiqueta).join(", ")}.` : "Anoté el precio. Ya está todo: tocá Crear o decime «crealo».";
  }
  const partes = CAMPOS[f.tipo]
    .filter((c) => nuevos[c.clave])
    .map((c) => `${c.etiqueta}: ${nuevos[c.clave]}`);
  const resto = faltan({ ...f, campos: { ...f.campos, ...nuevos } });
  return `Anoté ${partes.join(" y ")}.${
    resto.length ? ` Falta ${resto.map((c) => c.etiqueta).join(" y ")}.` : " Ya está todo: tocá Crear o decime «crealo»."
  }`;
}

/** "a", "a y b", "a, b y c". */
const enLista = (cosas: string[]) => (cosas.length <= 1 ? (cosas[0] ?? "") : `${cosas.slice(0, -1).join(", ")} y ${cosas[cosas.length - 1]}`);

/**
 * Lo que falta del formulario de productos, agrupado: "Falta el precio de
 * Alcohol, Vacunas y Mouse" (y no "el precio de Alcohol, el precio de…").
 */
export function textoFaltaProductos(f: Formulario): string | null {
  const lista = f.productos ?? [];
  if (!lista.length) return "Falta algún producto.";
  const sinPrecio = lista.filter((b) => faltanProducto(b).includes("precio")).map((b) => b.nombre || "uno sin nombre");
  const sinNombre = lista.filter((b) => faltanProducto(b).includes("nombre")).length;
  const repetidos = lista.filter((b) => b.existente).map((b) => b.nombre);
  const partes: string[] = [];
  if (sinPrecio.length) partes.push(lista.length === 1 ? "el precio de venta" : `el precio de ${enLista(sinPrecio)}`);
  if (sinNombre) partes.push(sinNombre === 1 ? "el nombre de un producto" : `el nombre de ${sinNombre} productos`);
  const falta = partes.length ? `Falta ${enLista(partes)}.` : "";
  const ya = repetidos.length ? ` ${enLista(repetidos)} ya ${repetidos.length === 1 ? "existe" : "existen"}.` : "";
  return falta || ya ? `${falta}${ya}`.trim() : null;
}
