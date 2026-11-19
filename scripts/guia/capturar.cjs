// Capturas de la guía pública (/guia). Lee src/pages/guia/guia.json, entra al panel
// con la cuenta de demostración, abre cada pantalla, mide dónde está cada botón
// marcado y guarda:
//   public/guia/<id>.png        la captura (después se pasa a WebP)
//   src/pages/guia/marcas.json  las cajas de cada marca, en % de la imagen
// Solo lee: no confirma, no guarda ni envía nada.
// Uso: GUIA_CORREO=... GUIA_CLAVE=... node scripts/guia/capturar.cjs [id1,id2]
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const RAIZ = path.join(__dirname, "..", "..");
const BASE = process.env.GUIA_BASE || "https://vendfy-panel.vercel.app";
const TIENDA = { id: "86f9ea0a-312f-43ff-9416-54883661fddc", name: "Abarrotes Don Juan", slug: "abarrotes-don-juan" };
const CORREO = process.env.GUIA_CORREO;
const CLAVE = process.env.GUIA_CLAVE;
const SOLO = process.argv[2] ? process.argv[2].split(",") : null;
const ANCHO = 1440, ALTO = 900;

const guia = JSON.parse(fs.readFileSync(path.join(RAIZ, "src/pages/guia/guia.json"), "utf8"));
const archivoMarcas = path.join(RAIZ, "src/pages/guia/marcas.json");
const marcas = fs.existsSync(archivoMarcas) ? JSON.parse(fs.readFileSync(archivoMarcas, "utf8")) : {};
const SAL = path.join(RAIZ, "public/guia");
fs.mkdirSync(SAL, { recursive: true });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function localizar(page0, o) {
  // "dentro": "dialog" busca solo dentro del panel o ventana abierta.
  const page = o.dentro ? page0.getByRole(o.dentro).last() : page0;
  if (o.etiqueta) return page.getByLabel(o.etiqueta, { exact: true }).first();
  if (o.testid) return page.getByTestId(o.testid).first();
  if (o.placeholder) return page.getByPlaceholder(new RegExp(o.placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).first();
  if (o.rol) return page.getByRole(o.rol, { name: new RegExp(o.nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first();
  if (o.texto) return page.getByText(o.texto, { exact: false }).nth((o.n || 1) - 1);
  throw new Error("objetivo sin forma: " + JSON.stringify(o));
}

async function entrar(page) {
  for (let i = 0; i < 3; i++) {
    await page.goto(BASE + "/login", { waitUntil: "networkidle" }).catch(() => {});
    await espera(1500);
    if (!/\/login/.test(page.url())) return;
    await page.locator("input[type=email]:visible").first().fill(CORREO);
    await page.locator("input[type=password]:visible").first().fill(CLAVE);
    await page.locator("button[type=submit]:visible").first().click();
    for (let k = 0; k < 30 && /\/login/.test(page.url()); k++) await espera(500);
    if (!/\/login/.test(page.url())) return;
  }
  throw new Error("No pude entrar");
}

async function ir(page, ruta) {
  for (let i = 0; i < 2; i++) {
    await page.goto(BASE + ruta, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    await espera(2500);
    if (/\/login/.test(page.url())) { await entrar(page); continue; }
    for (let k = 0; k < 20 && (await page.getByText(/Cargando tu espacio/).count()); k++) await espera(500);
    return;
  }
}

async function preparar(page, p) {
  if (!p) return;
  if (p.preguntar) {
    const caja = page.getByLabel("Qué necesitás").first();
    await caja.click();
    await caja.fill(p.preguntar);
    await caja.press("Enter");
    await espera(4000);
    for (let k = 0; k < 60 && (await page.getByText(/Pensando|Analizando|Buscando/).count()); k++) await espera(1000);
    await espera(2500);
    await caja.click();
  }
  if (p.tocar) for (const t of p.tocar) { await page.getByText(t).first().click().catch(() => {}); await espera(700); }
  if (p.pestana) { await page.getByRole("tab", { name: new RegExp(p.pestana) }).first().click(); await espera(2500); }
  if (p.boton) { await page.getByRole("button", { name: new RegExp(p.boton) }).first().click(); await espera(2000); }
  if (p.piloto) {
    await page.getByTestId("piloto-lanzador").first().click().catch(() => {});
    await espera(2500);
  }
  if (p.esperar) await espera(p.esperar);
}

(async () => {
  if (!CORREO || !CLAVE) throw new Error("Faltan GUIA_CORREO y GUIA_CLAVE");
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const ctx = await browser.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 1.5, permissions: ["microphone", "camera"], locale: "es-BO", timezoneId: "America/La_Paz", reducedMotion: "reduce" });
  await ctx.addInitScript((t) => {
    if (location.hostname.endsWith("vercel.app") || location.hostname.startsWith("localhost")) localStorage.setItem("selectedStore", JSON.stringify(t));
  }, TIENDA);
  // compras.vendfy.shop (la tienda pública, de la que sale el Diseño) puede servirse
  // desde una copia local: GUIA_TIENDA_LOCAL=http://localhost:3941
  if (process.env.GUIA_TIENDA_LOCAL) {
    await ctx.route("https://compras.vendfy.shop/**", async (route) => {
      const u = new URL(route.request().url());
      try { await route.fulfill({ response: await route.fetch({ url: process.env.GUIA_TIENDA_LOCAL + u.pathname + u.search, timeout: 60000 }) }); } catch { await route.abort(); }
    });
  }
  const page = await ctx.newPage();
  await entrar(page);
  // La Caja deja una venta en curso que se ve en las demás pantallas: va al final.
  const orden = [...guia.pantallas].sort((a, b) => (["caja", "piloto"].includes(a.id) ? 1 : 0) - (["caja", "piloto"].includes(b.id) ? 1 : 0));
  for (const pant of orden) {
    if (SOLO && !SOLO.includes(pant.id)) continue;
    try {
      await ir(page, pant.ruta.replace("{tienda}", TIENDA.id));
      await preparar(page, pant.preparar);
      const cajas = [];
      for (const m of pant.marcas) {
        const loc = localizar(page, m.objetivo);
        const b = await loc.boundingBox({ timeout: 6000 }).catch(() => null);
        if (!b) { console.log("  sin marca:", pant.id, m.titulo); cajas.push(null); continue; }
        const x = Math.max(0, b.x - 6), y = Math.max(0, b.y - 6);
        const w = Math.min(ANCHO - x, b.width + 12), h = Math.min(ALTO - y, b.height + 12);
        cajas.push({ x: +(x / ANCHO * 100).toFixed(2), y: +(y / ALTO * 100).toFixed(2), w: +(w / ANCHO * 100).toFixed(2), h: +(h / ALTO * 100).toFixed(2) });
      }
      await page.mouse.move(ANCHO - 5, ALTO - 5);
      await espera(400);
      await page.screenshot({ path: path.join(SAL, pant.id + ".png") });
      marcas[pant.id] = cajas;
      console.log("ok", pant.id, cajas.filter(Boolean).length + "/" + cajas.length);
      await page.keyboard.press("Escape").catch(() => {});
    } catch (e) {
      console.log("FALLÓ", pant.id, e.message.split("\n")[0]);
    }
  }
  fs.writeFileSync(archivoMarcas, JSON.stringify(marcas, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
