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

export type TipoFormulario = "cliente";

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
};

export interface Formulario {
  tipo: TipoFormulario;
  campos: Record<string, string>;
  estado: "abierto" | "creando" | "creado" | "descartado";
  error?: string;
  /** Lo que se creó (su id, para seguir con la venta). */
  creado?: { id: string; nombre: string };
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

/** Lo que falta para poder crear ("teléfono"). */
export function faltan(f: Formulario): Campo[] {
  return CAMPOS[f.tipo].filter((c) => c.requerido && !valido(c.clave, f.campos[c.clave]));
}

export const completo = (f: Formulario) => faltan(f).length === 0;

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

/** "Sí", "crealo", "listo": con el formulario completo, es crear. */
export function esConfirmacion(frase: string): boolean {
  return /^(si|dale|listo|ok|crealo|crea|crear|guardalo|guarda|confirmo|confirmar)[.! ]*$/.test(normalizar(frase));
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
  const partes = CAMPOS[f.tipo]
    .filter((c) => nuevos[c.clave])
    .map((c) => `${c.etiqueta}: ${nuevos[c.clave]}`);
  const resto = faltan({ ...f, campos: { ...f.campos, ...nuevos } });
  return `Anoté ${partes.join(" y ")}.${
    resto.length ? ` Falta ${resto.map((c) => c.etiqueta).join(" y ")}.` : " Ya está todo: tocá Crear o decime «crealo»."
  }`;
}
