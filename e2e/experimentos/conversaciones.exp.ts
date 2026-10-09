import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { API_URL } from "../helpers/env";

/**
 * Banco de CONVERSACIONES (G8) contra el modelo de verdad: no frases sueltas,
 * sino lo que la gente dice de verdad, en varios turnos, con lo que tiene que
 * pasar en cada uno. Salen de las conversaciones reales guardadas (super-admin)
 * y de los errores que se encontraron leyéndolas.
 *
 * Revisa lo que se puede revisar solo (qué tarjeta, qué número, que no diga
 * algo falso) y deja la transcripción COMPLETA en
 * e2e/experimentos/salida/conversaciones.md, para leerla: que una respuesta
 * pase las reglas no quiere decir que esté bien dicha.
 *
 * Solo interpreta: no confirma ninguna tarjeta, no crea ni cobra nada.
 * Gasta créditos: se corre a mano al tocar el router, el agente o sus herramientas.
 *
 *   npx playwright test -c playwright.experimentos.config.ts conversaciones
 *   API=https://api.vendfy.shop ...   contra producción
 */

const API = process.env.API ?? API_URL;
const TIENDA = "df56cf2c-ba01-4b62-b69b-912dd296a194";

interface Turno {
  dice: string;
  /** La intención de la respuesta (agente = la resolvió el agente). */
  intencion?: string | string[];
  /** Tarjetas que tiene que haber preparado (por intención). */
  tarjetas?: string[];
  /** Texto que tiene que aparecer (en la respuesta o sus tarjetas). */
  contiene?: (string | RegExp)[];
  /** Texto que NO puede aparecer (lo falso, lo que manda a otro lado). */
  noContiene?: (string | RegExp)[];
  /** Una revisión a medida sobre la respuesta. */
  revisar?: (p: any) => string | null;
}

const productosDe = (p: any) => [...(p?.agente?.acciones ?? []), p].flatMap((a: any) => a?.entidades?.productos ?? []);

const ESCENARIOS: { nombre: string; turnos: Turno[] }[] = [
  {
    nombre: "crear un producto que no existe (con la frase tal cual)",
    turnos: [
      { dice: "Hey no tengo el producto alvohol crealo", intencion: "agente", tarjetas: ["crear_producto"], contiene: [/Alcohol/], noContiene: ["Alvohol", "todavía no sé", "andá a"] },
      // En la pantalla "a 15" se anota sin servidor; acá va al agente con el formulario a la vista.
      { dice: "a 15", tarjetas: ["completar_formulario"], revisar: (p) => (productosDe(p)[0]?.precio === 15 ? null : `precio ${productosDe(p)[0]?.precio}`) },
    ],
  },
  {
    nombre: "compré cosas nuevas: se crean y quedan para la compra",
    turnos: [
      {
        dice: "Acabo de registgrar varias compras alcohol, vacunas,y un maus ayudame a crear",
        tarjetas: ["crear_producto"],
        noContiene: ["No hay nada en la compra"],
        revisar: (p) => {
          const lista = productosDe(p);
          if (lista.length !== 3) return `esperaba 3 productos, vinieron ${lista.length}`;
          if (lista.some((b: any) => !b.compra)) return "no quedaron marcados como comprados";
          if (lista.some((b: any) => b.compra?.cantidad)) return "inventó una cantidad comprada que nadie dijo";
          return null;
        },
      },
      {
        dice: "el alcohol a 15, las vacunas a 80 y el maus a 60",
        tarjetas: ["completar_formulario"],
        contiene: ["Bs 15", "Bs 80", "Bs 60"],
        revisar: (p) => {
          const precios = productosDe(p).map((b: any) => b.precio).sort((a: number, b: number) => a - b);
          return JSON.stringify(precios) === "[15,60,80]" ? null : `precios ${JSON.stringify(precios)}`;
        },
      },
      { dice: "sacá las vacunas", tarjetas: ["completar_formulario"], contiene: ["Saqué Vacunas"], revisar: (p) => (productosDe(p).length === 2 ? null : "no sacó las vacunas") },
    ],
  },
  { nombre: "cargá vos un mouse", turnos: [{ dice: "Como que no, carga tu un maus", tarjetas: ["crear_producto"], noContiene: ["Crear producto →", "todavía no"] }] },
  {
    nombre: "vender algo que no existe: crearlo y a la venta",
    turnos: [{ dice: "vendé un mouse logitech", tarjetas: ["crear_producto"], contiene: [/venta/i], revisar: (p) => (productosDe(p)[0]?.venta ? null : "no quedó para la venta") }],
  },
  {
    nombre: "el que menos compró (ranking al revés)",
    turnos: [
      { dice: "Dime que cliente a comprado mas en todo este timepo", intencion: "analizar" },
      {
        dice: "Comparalo con el clinete que menos ventas tuvo",
        intencion: "cambiar_vista",
        revisar: (p) => ((p?.vista?.piezas ?? []).some((x: any) => x.params?.sentido === "menor") ? null : "no hay ranking de menor a mayor"),
      },
    ],
  },
  {
    nombre: "se rompieron 2: resta, no deja 2",
    turnos: [
      {
        dice: "se rompieron 2 frascos de sauvage",
        revisar: (p) => {
          const v = p?.vistaPrevia ?? p?.agente?.acciones?.find((a: any) => a.intencion === "ajustar_stock")?.vistaPrevia;
          return v && v.despues === v.antes - 2 ? null : `stock ${v?.antes} → ${v?.despues}`;
        },
      },
    ],
  },
  { nombre: "bajar 10 % una categoría", turnos: [{ dice: "bajá 10% los perfumes", tarjetas: ["cambiar_precios"] }] },
  { nombre: "varios stocks en una frase", turnos: [{ dice: "cuánto me queda de sauvage y de acqua di gio", contiene: ["Sauvage", "Acqua"] }] },
  { nombre: "dos cosas en una frase", turnos: [{ dice: "sumá un sauvage a la venta y decime cuánto me queda de acqua di gio", tarjetas: ["agregar_a_venta"], contiene: [/Acqua di Gi[oò]/, /quedan? \d+/] }] },
  { nombre: "los pedidos", turnos: [{ dice: "qué pedidos tengo pendientes", tarjetas: ["ver_pedidos"] }] },
  { nombre: "cancelar un pedido (solo la tarjeta)", turnos: [{ dice: "cancelá el pedido 1625", tarjetas: ["estado_pedido"] }] },
  { nombre: "lo que ya estaba así", turnos: [{ dice: "ocultá la chaqueta de la web", contiene: [/ya/i], noContiene: ["No pude resolverlo"] }] },
  { nombre: "crear un cliente", turnos: [{ dice: "creá el cliente Marta Prueba Cero, su teléfono es 00000177", tarjetas: ["crear_cliente"] }] },
  { nombre: "saludo y ayuda", turnos: [{ dice: "hola, qué podés hacer?", intencion: "agente", noContiene: [/andá a|ingresá a/i] }] },
  {
    nombre: "lo que no sabe, no lo inventa",
    turnos: [
      { dice: "qué hora es?", revisar: (p) => verificarHora(p?.agente?.texto ?? "") },
      { dice: "qué tiempo hace hoy en santa cruz?", contiene: [/no (tengo|s[eé])/i] },
      { dice: "cuánto vende la tienda de al lado?", contiene: [/no (tengo|s[eé]|puedo)/i] },
    ],
  },
  { nombre: "un código de barras que no está", turnos: [{ dice: "7770108082002", tarjetas: [], revisar: (p) => (p?.intencion === "crear_producto" ? null : `intención ${p?.intencion}`) }] },
];

/** La hora que dijo, contra la de Bolivia ahora (±5 minutos). */
function verificarHora(texto: string): string | null {
  const m = texto.match(/(\d{1,2}):(\d{2})/);
  if (!m) return `no dijo la hora: ${texto}`;
  const ahora = new Date(Date.now() - 4 * 3600_000);
  const dicha = Number(m[1]) * 60 + Number(m[2]);
  const real = ahora.getUTCHours() * 60 + ahora.getUTCMinutes();
  return Math.abs(dicha - real) <= 5 || Math.abs(dicha + 720 - real) <= 5 ? null : `dijo ${m[0]}, son las ${ahora.getUTCHours()}:${String(ahora.getUTCMinutes()).padStart(2, "0")}`;
}

/** Todo lo que se le muestra a la persona, en texto: para "contiene" y "noContiene". */
function textoDe(p: any): string {
  const partes: string[] = [p?.agente?.texto ?? "", p?.aviso ?? "", p?.resultado?.resumen ?? "", p?.vista?.titulo ?? ""];
  for (const a of p?.agente?.acciones ?? []) partes.push(a.titulo ?? "", a.aviso ?? "", JSON.stringify(a.entidades ?? {}));
  for (const b of productosDe(p)) partes.push(b.nombre ?? "");
  return partes.join(" · ");
}

const SALIDA = path.join("e2e", "experimentos", "salida");
let token = "";
const informe: string[] = [];
let ok = 0;

test.describe.configure({ mode: "default" });

test.beforeAll(async ({ request }) => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const r = await request.post(`${API}/api/auth/login`, { data: { email: "test@gmail.com", password: "12345678" } });
  token = (await r.json()).data.accessToken;
});

test.afterAll(() => {
  fs.writeFileSync(
    path.join(SALIDA, "conversaciones.md"),
    [`# Banco de conversaciones — ${new Date().toISOString()} — ${API}`, "", `**${ok}/${ESCENARIOS.length} conversaciones sin problemas**`, "", ...informe].join("\n"),
  );
});

for (const esc of ESCENARIOS) {
  test(esc.nombre, async ({ request }) => {
    test.setTimeout(240_000);
    let historial: { dijo: string; respuesta: string }[] = [];
    let formulario: any[] | null = null;
    let vista: any = null;
    const problemas: string[] = [];
    informe.push(`## ${esc.nombre}`);
    for (const turno of esc.turnos) {
      const contexto = {
        abierta: null,
        venta: { lineas: [] },
        compra: { lineas: [] },
        historial,
        ...(formulario ? { formulario: { tipo: "productos", productos: formulario } } : {}),
        ...(vista ? { enPantalla: "analisis", vista } : {}),
      };
      const t0 = Date.now();
      const r = await request.post(`${API}/api/omnibox/interpretar`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { storeId: TIENDA, texto: turno.dice, contexto },
        timeout: 90_000,
      });
      const p = (await r.json()).data;
      const ms = Date.now() - t0;

      // Lo que la pantalla haría con la respuesta: el formulario abierto, la vista en pantalla.
      for (const a of [p, ...(p?.agente?.acciones ?? [])]) {
        if (a?.intencion === "crear_producto" || a?.intencion === "completar_formulario") formulario = a.entidades?.productos ?? formulario;
        if (a?.vista) vista = a.vista;
      }
      const tarjetas = (p?.agente?.acciones ?? []).map((a: any) => a.intencion);
      const respuesta = p?.agente ? `${p.agente.texto}${tarjetas.length ? ` [preparé: ${tarjetas.join(", ")}]` : ""}` : p?.vista ? `Análisis "${p.vista.titulo}"` : (p?.resultado?.resumen ?? p?.aviso ?? p?.intencion ?? "");
      historial = [...historial, { dijo: turno.dice, respuesta: String(respuesta).slice(0, 180) }].slice(-4);

      const aqui: string[] = [];
      const intenciones = turno.intencion ? [turno.intencion].flat() : null;
      if (intenciones && !intenciones.includes(p?.intencion)) aqui.push(`intención ${p?.intencion}`);
      for (const t of turno.tarjetas ?? []) if (!tarjetas.includes(t) && p?.intencion !== t) aqui.push(`falta la tarjeta ${t}`);
      const texto = textoDe(p);
      for (const c of turno.contiene ?? []) if (!(typeof c === "string" ? texto.includes(c) : c.test(texto))) aqui.push(`no dice ${c}`);
      for (const c of turno.noContiene ?? []) if (typeof c === "string" ? texto.includes(c) : c.test(texto)) aqui.push(`dice ${c}`);
      const extra = turno.revisar?.(p);
      if (extra) aqui.push(extra);
      problemas.push(...aqui.map((x) => `«${turno.dice}»: ${x}`));

      informe.push(
        `- **«${turno.dice}»** (${(ms / 1000).toFixed(1)} s · ${p?.intencion}${p?.agente ? ` · ${p.agente.motivo}` : ""})`,
        `  - ${String(respuesta).replace(/\n/g, " ")}`,
        ...(aqui.length ? [`  - ❌ ${aqui.join("; ")}`] : []),
      );
    }
    if (!problemas.length) ok++;
    informe.push("");
    expect.soft(problemas, esc.nombre).toEqual([]);
  });
}
