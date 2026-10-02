import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import type { HerramientaGenerada } from "../../src/entities/omnibox/model/types";
import { validarPropuesta } from "../../src/features/omnibox/model/herramienta";
import { API_URL, COMERCIO_EMAIL, COMERCIO_PASSWORD, TIENDA } from "../helpers/env";
import { esperarHerramienta, marcoHerramienta, mensajes, montarHerramienta, type MensajeAnotado } from "../helpers/sandbox";

/**
 * Banco de experimentos de las herramientas a medida (G6), con el MODELO DE
 * VERDAD: cuánto de lo que escribe la IA funciona de verdad en el iframe.
 *
 * No es parte de la regresión (cuesta créditos y el modelo no responde igual
 * dos veces). Se corre a mano al cambiar el contrato o el modelo:
 *
 *   npx playwright test -c playwright.experimentos.config.ts
 *   PREGUNTAS="a|b" ...     otras preguntas
 *   REUSAR=1 ...            no vuelve a generar lo que ya está en salida/
 *
 * Por cada pregunta: la genera, la dibuja en claro, oscuro y teléfono, mueve
 * los controles, aprieta "Aplicar" y valida la propuesta como lo hace la
 * pantalla. Deja capturas e informe en e2e/experimentos/salida/.
 */

const PREGUNTAS = process.env.PREGUNTAS?.split("|").map((p) => p.trim()).filter(Boolean) ?? [
  "qué pasa si subo 10 % las bebidas",
  "armame un simulador de descuentos para los lácteos",
  "cuánto tengo que vender por día para cubrir un alquiler de 3000 Bs al mes",
  "simulá cuánto gano si bajo 5 % el precio del arroz",
  "calculadora de ganancia por producto",
  "si redondeo los precios de los snacks a números enteros cómo queda el margen",
];

const SALIDA = path.join("e2e", "experimentos", "salida");
const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

interface Informe {
  pregunta: string;
  generada: boolean;
  falloGeneracion?: string;
  ms?: number;
  intentos?: number;
  lineas?: number;
  modelo?: string;
  variantes: { nombre: string; estado: string; alto: number | null; errores: string[]; bloqueos: string[] }[];
  controles: { rangos: number; numeros: number; botones: string[] };
  errorAlInteractuar: string[];
  propuesta: string | null;
}

const informes: Informe[] = [];
let token = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const r = await request.post(`${API_URL}/api/auth/login`, { data: { email: COMERCIO_EMAIL, password: COMERCIO_PASSWORD } });
  token = (await r.json()).data.accessToken;
});

test.afterAll(() => {
  const filas = informes.map((i) => {
    const ok = i.generada && i.variantes.every((v) => v.estado === "lista" && v.errores.length === 0 && v.bloqueos.length === 0);
    return `| ${i.pregunta} | ${i.generada ? `${((i.ms ?? 0) / 1000).toFixed(0)} s · ${i.intentos} int · ${i.lineas} lín` : `NO: ${i.falloGeneracion}`} | ${i.variantes.map((v) => `${v.nombre}:${v.estado}${v.errores.length ? `(${v.errores.length} err)` : ""}${v.bloqueos.length ? `(${v.bloqueos.length} bloq)` : ""}`).join(" ")} | ${i.controles.rangos}r ${i.controles.numeros}n | ${i.propuesta ?? "—"} | ${ok && !i.errorAlInteractuar.length ? "OK" : "FALLA"} |`;
  });
  const md = [
    `# Herramientas a medida — ${new Date().toISOString()}`,
    "",
    "| Pregunta | Generación | Dibujo | Controles | Propuesta | |",
    "|---|---|---|---|---|---|",
    ...filas,
    "",
    "```json",
    JSON.stringify(informes, null, 1),
    "```",
  ].join("\n");
  fs.writeFileSync(path.join(SALIDA, "informe.md"), md);
});

for (const [n, pregunta] of PREGUNTAS.entries()) {
  test(`${n + 1}. ${pregunta}`, async ({ page, request }) => {
    test.setTimeout(6 * 60_000);
    const base = path.join(SALIDA, `${n + 1}-${slug(pregunta)}`);
    const informe: Informe = {
      pregunta,
      generada: false,
      variantes: [],
      controles: { rangos: 0, numeros: 0, botones: [] },
      errorAlInteractuar: [],
      propuesta: null,
    };
    informes.push(informe);

    // ---------------------------------------------------------------- generar
    let h: HerramientaGenerada;
    if (process.env.REUSAR && fs.existsSync(`${base}.json`)) {
      h = JSON.parse(fs.readFileSync(`${base}.json`, "utf8"));
    } else {
      const r = await request.post(`${API_URL}/api/omnibox/herramienta`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { storeId: TIENDA.id, pregunta },
        timeout: 5 * 60_000,
      });
      const j = await r.json();
      if (!j.data) {
        informe.falloGeneracion = `${r.status()} ${j.message}`;
        expect.soft(j.data, informe.falloGeneracion).toBeTruthy();
        return;
      }
      h = j.data;
      fs.writeFileSync(`${base}.json`, JSON.stringify(h, null, 1));
      fs.writeFileSync(`${base}.tsx`, h.tsx);
    }
    Object.assign(informe, { generada: true, ms: h.ms, intentos: h.intentos, lineas: h.tsx.split("\n").length, modelo: h.modelo });

    // ---------------------------------------------------------------- dibujar
    const problemas = (m: MensajeAnotado[]) => ({
      errores: m.filter((x) => x.tipo === "error").map((x) => String(x.mensaje)),
      bloqueos: m.filter((x) => x.tipo === "bloqueo").map((x) => `${x.directiva} ${x.recurso}`),
    });
    for (const v of [
      { nombre: "claro", tema: "claro" as const, ancho: 760 },
      { nombre: "oscuro", tema: "oscuro" as const, ancho: 760 },
      { nombre: "telefono", tema: "claro" as const, ancho: 390 },
    ]) {
      await page.setViewportSize({ width: v.ancho, height: 900 });
      await montarHerramienta(page, { codigo: h.codigo, datos: h.datos, tema: v.tema });
      const estado = await esperarHerramienta(page);
      await page.waitForTimeout(1200); // efectos, gráficos que se animan
      const m = await mensajes(page);
      const alto = [...m].reverse().find((x) => x.tipo === "altura")?.alto as number | undefined;
      informe.variantes.push({ nombre: v.nombre, estado, alto: alto ?? null, ...problemas(m) });
      await page.screenshot({ path: `${base}-${v.nombre}.png`, fullPage: true });
    }

    // ---------------------------------------------------------------- usar
    await page.setViewportSize({ width: 760, height: 900 });
    await montarHerramienta(page, { codigo: h.codigo, datos: h.datos });
    if ((await esperarHerramienta(page)) !== "lista") return;
    const marco = marcoHerramienta(page);
    const antes = (await mensajes(page)).length;

    const rangos = marco.locator('input[type="range"]');
    informe.controles.rangos = await rangos.count();
    for (let i = 0; i < informe.controles.rangos; i++) {
      await rangos.nth(i).focus();
      for (let k = 0; k < 5; k++) await rangos.nth(i).press("ArrowRight");
    }
    const numeros = marco.locator('input[type="number"]');
    informe.controles.numeros = await numeros.count();
    for (let i = 0; i < informe.controles.numeros; i++) await numeros.nth(i).fill("12");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${base}-movido.png`, fullPage: true });

    const botones = marco.getByRole("button");
    informe.controles.botones = (await botones.allInnerTexts()).map((t) => t.trim()).filter(Boolean).slice(0, 12);
    const aplicar = marco.getByRole("button", { name: /aplicar|proponer|revisar|cambiar/i }).first();
    if (await aplicar.count()) {
      await aplicar.click();
      await page.waitForTimeout(500);
    }
    const despues = (await mensajes(page)).slice(antes);
    informe.errorAlInteractuar = problemas(despues).errores;
    const prop = despues.find((x) => x.tipo === "proponer");
    if (prop) {
      const r = validarPropuesta(prop.accion, h.datos);
      informe.propuesta = r.error
        ? `INVÁLIDA: ${r.error}`
        : `${r.propuesta.cambios.length} cambios (${r.propuesta.cambios
            .slice(0, 3)
            .map((c) => `${c.producto} ${c.antes}→${c.precio}`)
            .join(", ")}) · ${r.propuesta.motivo}`;
    }

    for (const v of informe.variantes) {
      expect.soft(v.estado, `${v.nombre}: ${v.errores.join(" | ")}`).toBe("lista");
      expect.soft(v.bloqueos, v.nombre).toEqual([]);
    }
    expect.soft(informe.errorAlInteractuar).toEqual([]);
  });
}
