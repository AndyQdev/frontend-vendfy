import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { API_URL } from "../helpers/env";

/**
 * Banco de preguntas de análisis (G6b) contra el MODELO DE VERDAD: mide si el
 * asistente entiende de quién y de qué se habla, y si nunca muestra datos de
 * toda la tienda como si fueran de alguien.
 *
 * Usa la TestStore (test@gmail.com), cargada con 4 meses de historia
 * (C:\Trabajos\Ecommerce\datos-prueba). No es regresión: gasta créditos y el
 * modelo varía. Se corre a mano al tocar el planificador, el router o las fuentes:
 *
 *   npx playwright test -c playwright.experimentos.config.ts analisis
 *   API=https://api.vendfy.shop ...   contra producción
 *
 * Cada caso es una conversación (una o varias frases); lo que se revisa es la
 * ÚLTIMA respuesta. Deja el informe en e2e/experimentos/salida/analisis.md.
 */

const API = process.env.API ?? API_URL;
const TIENDA = "df56cf2c-ba01-4b62-b69b-912dd296a194";

interface Espera {
  intencion?: string | string[];
  /** Filtros esperados por nombre (exacto). */
  filtros?: Partial<Record<"cliente" | "producto" | "categoria", string>>;
  /** Sin ningún filtro (es de toda la tienda). */
  sinFiltros?: boolean;
  /** Tiene que preguntar cuál (dos que coinciden). */
  eleccion?: boolean;
  /** Tiene que decir que no lo encontró (y no mostrar nada). */
  noEncontrado?: boolean;
  /** Algún período de las piezas. */
  periodo?: string;
  /** Texto que tiene que estar en el resultado (consultas y explicaciones). */
  contiene?: string;
}

const CASOS: { nombre: string; frases: string[]; espera: Espera }[] = [
  // ---- un cliente
  { nombre: "ventas de un cliente", frases: ["Dame todas las ventas que hizo José Luis Mamani"], espera: { intencion: "analizar", filtros: { cliente: "José Luis Mamani" } } },
  { nombre: "qué compró un cliente", frases: ["qué me compró Carla Gutiérrez este año"], espera: { filtros: { cliente: "Carla Gutiérrez" }, periodo: "este_anio" } },
  { nombre: "cliente por apellido", frases: ["cuánto me compró la señora Quispe"], espera: { filtros: { cliente: "Andrea Quispe" } } },
  { nombre: "dos que coinciden: pregunta", frases: ["cuánto me compró Luis este año"], espera: { eleccion: true } },
  { nombre: "cliente que no existe", frases: ["ventas de Edwin Torrico"], espera: { noEncontrado: true } },
  // ---- seguir hablando del mismo
  { nombre: "seguimiento: línea de tiempo", frases: ["las ventas de José Luis Mamani", "hazme una gráfica de cuánto fue comprando en una línea de tiempo"], espera: { filtros: { cliente: "José Luis Mamani" } } },
  { nombre: "seguimiento: qué le gusta", frases: ["las ventas de Carla Gutiérrez", "y qué productos le gustan más?"], espera: { filtros: { cliente: "Carla Gutiérrez" } } },
  { nombre: "seguimiento: otro tema vuelve a la tienda", frases: ["las ventas de José Luis Mamani", "qué es lo que más vendo"], espera: { sinFiltros: true } },
  { nombre: "seguimiento: ¿son solo de él?", frases: ["las ventas de José Luis Mamani", "esas son solo de él?"], espera: { intencion: "explicar_vista", contiene: "José Luis Mamani" } },
  // ---- categorías y productos
  { nombre: "categoría en un mes", frases: ["cuánto vendí de perfumes en septiembre"], espera: { filtros: { categoria: "Perfumes" }, periodo: "mes:2026-09" } },
  { nombre: "ganancia de una categoría", frases: ["cuánto me dejó el maquillaje este mes"], espera: { filtros: { categoria: "Maquillaje" } } },
  { nombre: "quién compra un producto", frases: ["quiénes compran Natura Kaiak"], espera: { filtros: { producto: "Natura Kaiak Masculino 100 ml" } } },
  { nombre: "cómo se vende un producto", frases: ["cómo se vende el Versace Eros"], espera: { filtros: { producto: "Versace Eros EDT 100 ml" } } },
  { nombre: "categoría que no existe", frases: ["cuánto vendí de bebidas"], espera: { noEncontrado: true } },
  // ---- toda la tienda (no tiene que inventar filtros)
  { nombre: "lo que más vendo", frases: ["qué es lo que más vendo"], espera: { sinFiltros: true } },
  { nombre: "mejores clientes", frases: ["quiénes son mis mejores clientes"], espera: { sinFiltros: true } },
  { nombre: "meses con nombre", frases: ["cómo me fue en septiembre comparado con agosto"], espera: { sinFiltros: true, periodo: "mes:2026-09" } },
  { nombre: "plata parada", frases: ["en qué tengo la plata parada"], espera: { sinFiltros: true } },
  { nombre: "reponer", frases: ["qué productos tengo que reponer"], espera: { sinFiltros: true } },
  { nombre: "ganancia por categoría", frases: ["cuánto gané en los últimos 30 días por categoría"], espera: { sinFiltros: true } },
  // ---- "cuánto vendí": el total solo si no nombra a nadie
  { nombre: "cuánto vendí ayer", frases: ["cuánto vendí ayer"], espera: { intencion: "consultar_ventas", contiene: "Ayer" } },
  { nombre: "cuánto vendí en agosto", frases: ["cuánto vendí en agosto"], espera: { intencion: "consultar_ventas", contiene: "Agosto" } },
  { nombre: "cuánto vendí a un cliente", frases: ["cuánto le vendí a Daniela Vargas"], espera: { filtros: { cliente: "Daniela Vargas" } } },
];

const SALIDA = path.join("e2e", "experimentos", "salida");
let token = "";
const filas: string[] = [];

test.describe.configure({ mode: "default" });

test.beforeAll(async ({ request }) => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const r = await request.post(`${API}/api/auth/login`, { data: { email: "test@gmail.com", password: "12345678" } });
  token = (await r.json()).data.accessToken;
});

test.afterAll(() => {
  const ok = filas.filter((f) => f.includes("| OK |")).length;
  fs.writeFileSync(
    path.join(SALIDA, "analisis.md"),
    [`# Banco de análisis — ${new Date().toISOString()} — ${API}`, "", `**${ok}/${filas.length}**`, "", "| Caso | Resultado | Filtros | Tiempo | |", "|---|---|---|---|---|", ...filas].join("\n"),
  );
});

for (const caso of CASOS) {
  test(caso.nombre, async ({ request }) => {
    test.setTimeout(120_000);
    let vista: any = null;
    let historial: { dijo: string; respuesta: string }[] = [];
    let foco: any = undefined;
    let p: any = null;
    let ms = 0;
    for (const texto of caso.frases) {
      const t0 = Date.now();
      const contexto = {
        abierta: "venta",
        venta: { lineas: [] },
        compra: { lineas: [] },
        ...(vista ? { enPantalla: "analisis", vista } : {}),
        historial,
        ...(foco ? { foco } : {}),
      };
      const r = await request.post(`${API}/api/omnibox/interpretar`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { storeId: TIENDA, texto, contexto },
        timeout: 90_000,
      });
      p = (await r.json()).data;
      ms = Date.now() - t0;
      if (p?.vista) {
        vista = p.vista;
        foco = p.vista.filtros && Object.keys(p.vista.filtros).length ? p.vista.filtros : undefined;
      }
      const respuesta = p?.vista ? `Análisis "${p.vista.titulo}"` : p?.resultado?.resumen ?? p?.aviso ?? p?.intencion ?? "";
      historial = [...historial, { dijo: texto, respuesta: String(respuesta).slice(0, 180) }].slice(-4);
    }

    const e = caso.espera;
    const problemas: string[] = [];
    const filtros = p?.vista?.filtros ?? {};
    const nombres = Object.fromEntries(Object.entries(filtros).map(([t, f]: [string, any]) => [t, f.nombre]));
    const intenciones = e.intencion ? [e.intencion].flat() : null;
    if (intenciones && !intenciones.includes(p?.intencion)) problemas.push(`intención ${p?.intencion}`);
    if (e.filtros) {
      for (const [t, n] of Object.entries(e.filtros)) if (nombres[t] !== n) problemas.push(`${t}: ${nombres[t] ?? "sin filtro"} (esperaba ${n})`);
    }
    if (e.sinFiltros && Object.keys(nombres).length) problemas.push(`filtró por ${JSON.stringify(nombres)}`);
    if (e.eleccion && !(p?.clientes?.length > 1 || p?.opciones?.length > 1)) problemas.push("no preguntó cuál");
    if (e.noEncontrado && (p?.vista || !/No encontré/.test(p?.aviso ?? ""))) problemas.push(`no dijo que no existe (${p?.aviso ?? p?.vista?.titulo})`);
    if (e.periodo) {
      const periodos = (p?.vista?.piezas ?? []).flatMap((x: any) => [x.params?.periodo, ...(x.periodos ?? [])]).filter(Boolean);
      if (!periodos.includes(e.periodo)) problemas.push(`período ${[...new Set(periodos)].join(",") || "—"} (esperaba ${e.periodo})`);
    }
    if (e.contiene && !String(p?.resultado?.resumen ?? "").includes(e.contiene)) problemas.push(`no dice "${e.contiene}": ${p?.resultado?.resumen ?? p?.aviso}`);

    const que = p?.vista ? `vista "${p.vista.titulo}"` : p?.resultado ? p.resultado.resumen.slice(0, 80) : p?.aviso ?? p?.intencion;
    filas.push(`| ${caso.nombre} | ${String(que).replace(/\|/g, "/")} | ${JSON.stringify(nombres)} | ${(ms / 1000).toFixed(1)} s | ${problemas.length ? `FALLA: ${problemas.join("; ")}` : "OK"} |`);
    expect.soft(problemas, caso.frases.join(" → ")).toEqual([]);
  });
}
