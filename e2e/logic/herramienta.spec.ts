import { expect, test } from "@playwright/test";

import type { HerramientaGenerada, TablaVista } from "../../src/entities/omnibox/model/types";
import { serializarMensajes, restaurarMensajes, restaurarMesa, HERRAMIENTA_CORTADA } from "../../src/features/omnibox/model/conversacion";
import { validarPropuesta, vistaDeRespaldo } from "../../src/features/omnibox/model/herramienta";
import { mensajeDePrecios, nuevoMensaje, type Mensaje } from "../../src/features/omnibox/model/mensaje";
import { MESA_INICIAL, mesaReducer } from "../../src/features/omnibox/model/mesa";
import { huella, leerMensaje, paginaSandbox, politicaSandbox } from "../../src/features/omnibox/model/sandbox";

/**
 * G6 sin navegador: lo que se acepta de una herramienta (sus propuestas y
 * sus mensajes), el documento del iframe, y cómo entra la herramienta en la
 * mesa y en las conversaciones guardadas. El aislamiento en sí se prueba en
 * el navegador (flows/herramientas.spec.ts).
 */

const DATOS: Record<string, TablaVista> = {
  bebidas: {
    columnas: [{ clave: "producto", titulo: "Producto", tipo: "producto" }],
    filas: [
      { producto: "Coca Cola 2L", _productId: "p-coca", _precio: 12, precio: 12 },
      { producto: "Sprite 2L", _productId: "p-sprite", _precio: 12, precio: 12 },
      { producto: "Agua 2L", _productId: "p-agua", _precio: 5, precio: 5 },
    ],
  },
};

const precios = (cambios: { productId: string; precio: unknown }[], motivo = "Suba del 10 %") => ({ tipo: "precios", cambios, motivo });

test.describe("lo que propone una herramienta", () => {
  test("precios de productos que estaban en sus datos: con el antes, redondeados", () => {
    const r = validarPropuesta(precios([{ productId: "p-coca", precio: 13.2 }, { productId: "p-agua", precio: 5.4999 }]), DATOS);
    expect(r.error).toBeUndefined();
    expect(r.propuesta!.cambios).toEqual([
      { productId: "p-coca", producto: "Coca Cola 2L", antes: 12, precio: 13.2, grande: false },
      { productId: "p-agua", producto: "Agua 2L", antes: 5, precio: 5.5, grande: false },
    ]);
    expect(r.propuesta!.motivo).toBe("Suba del 10 %");
  });

  test("un producto que no estaba en sus datos no pasa (aunque exista en la tienda)", () => {
    expect(validarPropuesta(precios([{ productId: "p-otro", precio: 10 }]), DATOS).error).toMatch(/no estaba en sus datos/);
  });

  for (const [nombre, precio] of [
    ["cero", 0],
    ["negativo", -3],
    ["texto", "gratis"],
    ["infinito", Infinity],
  ] as const) {
    test(`un precio ${nombre} no pasa`, () => {
      expect(validarPropuesta(precios([{ productId: "p-coca", precio }]), DATOS).error).toMatch(/no es válido/);
    });
  }

  test("otra acción, sin cambios, repetidos o demasiados: no", () => {
    expect(validarPropuesta({ tipo: "borrar_todo" }, DATOS).error).toMatch(/todavía no se puede/);
    expect(validarPropuesta(null, DATOS).error).toMatch(/todavía no se puede/);
    expect(validarPropuesta(precios([]), DATOS).error).toMatch(/ningún cambio/);
    expect(validarPropuesta(precios([{ productId: "p-coca", precio: 13 }, { productId: "p-coca", precio: 14 }]), DATOS).error).toMatch(
      /dos veces/,
    );
    const muchos = Array.from({ length: 101 }, () => ({ productId: "p-coca", precio: 13 }));
    expect(validarPropuesta(precios(muchos), DATOS).error).toMatch(/demasiados/);
  });

  test("lo que no cambia se saca; si no cambia nada, se dice", () => {
    const r = validarPropuesta(precios([{ productId: "p-coca", precio: 12 }, { productId: "p-sprite", precio: 13 }]), DATOS);
    expect(r.propuesta!.cambios.map((c) => c.productId)).toEqual(["p-sprite"]);
    expect(validarPropuesta(precios([{ productId: "p-coca", precio: 12.001 }]), DATOS).error).toMatch(/los mismos/);
  });

  test("un cambio de más del 50 % se marca", () => {
    const r = validarPropuesta(precios([{ productId: "p-coca", precio: 30 }, { productId: "p-agua", precio: 2 }]), DATOS);
    expect(r.propuesta!.cambios.map((c) => c.grande)).toEqual([true, true]);
  });

  test("el motivo se acota (lo escribe la IA)", () => {
    const r = validarPropuesta(precios([{ productId: "p-coca", precio: 13 }], `  muy\n\nlargo ${"x".repeat(400)}`), DATOS);
    expect(r.propuesta!.motivo.length).toBe(200);
    expect(r.propuesta!.motivo.startsWith("muy largo")).toBe(true);
  });
});

test.describe("el iframe", () => {
  test("la política no deja hacer ninguna petición: ni red, ni scripts de afuera, ni imágenes, ni eval", () => {
    const p = politicaSandbox();
    expect(p).toContain("default-src 'none'");
    expect(p).toContain("connect-src 'none'");
    expect(p).toContain("script-src 'unsafe-inline'");
    expect(p).not.toContain("unsafe-eval");
    expect(p).not.toMatch(/https?:/);
    expect(p).toContain("img-src data: blob:");
    expect(p).toContain("form-action 'none'");
  });

  test("el documento lleva la política, los colores del tema y el arranque", () => {
    const claro = paginaSandbox({ tema: "claro" });
    expect(claro).toContain('http-equiv="Content-Security-Policy"');
    expect(claro).toContain("--primary: 193 82% 31%");
    expect(claro).toContain("color-scheme: light");
    expect(claro).toContain('tipo: "preparada"');
    // Sin librerías adentro: llegan por mensaje (el documento queda chico).
    expect(claro.length).toBeLessThan(12_000);
    const oscuro = paginaSandbox({ tema: "oscuro" });
    expect(oscuro).toContain('<html lang="es" class="dark">');
    expect(oscuro).toContain("--primary: 189 80% 42%");
  });

  test("cada versión del código tiene su huella (la corregida, su propio iframe)", () => {
    const a = 'exports.default = function H() { return "a"; }';
    const b = 'exports.default = function H() { return "b"; }';
    expect(a.length).toBe(b.length);
    expect(huella(a)).not.toBe(huella(b));
    expect(huella(a)).toBe(huella(a));
  });

  test("de lo que manda el iframe, solo lo que tiene forma de mensaje de la herramienta", () => {
    expect(leerMensaje({ tipo: "lista" })).toBeNull(); // sin la marca
    expect(leerMensaje({ vendfy: true, tipo: "otra-cosa" })).toBeNull();
    expect(leerMensaje("lista")).toBeNull();
    expect(leerMensaje({ vendfy: true, tipo: "altura", alto: -5 })).toBeNull();
    expect(leerMensaje({ vendfy: true, tipo: "altura", alto: 1e9 })).toEqual({ tipo: "altura", alto: 20_000 });
    expect(leerMensaje({ vendfy: true, tipo: "error", mensaje: "x".repeat(5000) })).toMatchObject({ tipo: "error" });
    expect((leerMensaje({ vendfy: true, tipo: "error", mensaje: "x".repeat(5000) }) as { mensaje: string }).mensaje.length).toBe(1000);
    expect(leerMensaje({ vendfy: true, tipo: "proponer", accion: { tipo: "precios" } })).toEqual({
      tipo: "proponer",
      accion: { tipo: "precios" },
    });
  });
});

const GENERADA: HerramientaGenerada = {
  id: "h1",
  titulo: "Simulador de bebidas",
  descripcion: "Mové el %.",
  plan: {
    titulo: "Simulador de bebidas",
    descripcion: "",
    fuentes: [{ alias: "precios_bebidas", fuente: "precios_por_producto", params: { buscar: "bebidas", limite: 50 } }],
  },
  tsx: "export default function H() { return null }",
  codigo: "exports.default = function H() { return null }",
  datos: DATOS,
  modelo: "gemini",
  intentos: 1,
  ms: 40_000,
  creada: "2026-10-02T06:00:00.000Z",
};

test.describe("en la mesa y en la conversación", () => {
  test("la herramienta se abre en el panel, tiene su pestaña y el producto vuelve a la mesa de antes", () => {
    let m = mesaReducer({ ...MESA_INICIAL, ultima: "compra" }, { tipo: "usarHerramienta", herramienta: { mensajeId: "m1", titulo: "Simulador" } });
    expect(m.abierta).toBe("herramienta");
    m = mesaReducer(m, { tipo: "cerrar" });
    expect(mesaReducer(m, { tipo: "abrir", mesa: "herramienta" }).abierta).toBe("herramienta");
    expect(mesaReducer(MESA_INICIAL, { tipo: "abrir", mesa: "herramienta" }).abierta).toBeNull();
    const viendo = mesaReducer(mesaReducer(m, { tipo: "abrir", mesa: "herramienta" }), {
      tipo: "verProducto",
      producto: { productId: "p", storeProductId: "sp", nombre: "Coca", codigo: null, imagen: null, precio: 12, stock: 3 } as any,
    });
    expect(viendo.abierta).toBe("compra");
  });

  test("los datos de respaldo: las fuentes que leyó, como tablas", () => {
    const v = vistaDeRespaldo(GENERADA);
    expect(v.titulo).toBe("Simulador de bebidas");
    expect(v.piezas).toEqual([
      { id: "datos-1", tipo: "tabla", fuente: "precios_por_producto", params: { buscar: "bebidas", limite: 50 }, titulo: "Precios bebidas" },
    ]);
  });

  test("guardada a medio armar queda como error; unos precios a medio aplicar vuelven a esperar", () => {
    const armando: Mensaje = { ...nuevoMensaje("qué pasa si subo", false), fase: "listo", herramienta: { fase: "armando", desde: 1 } };
    const lista: Mensaje = { ...nuevoMensaje("otra", false), fase: "listo", herramienta: { fase: "lista", generada: GENERADA } };
    const p = validarPropuesta(precios([{ productId: "p-coca", precio: 13 }]), DATOS).propuesta!;
    const aplicando = mensajeDePrecios(p, { mensajeId: lista.id, titulo: GENERADA.titulo });
    aplicando.precios!.estado = "aplicando";

    const guardados = serializarMensajes([armando, lista, aplicando]);
    expect(guardados[0].herramienta).toEqual({ fase: "error", error: HERRAMIENTA_CORTADA });
    expect(guardados[2].precios).toMatchObject({ estado: "pendiente" });

    const vuelta = restaurarMensajes(JSON.parse(JSON.stringify(guardados)));
    expect(vuelta[1].herramienta).toEqual({ fase: "lista", generada: GENERADA });
    expect(vuelta[2].precios?.propuesta.cambios[0]).toMatchObject({ productId: "p-coca", precio: 13 });
  });

  test("la mesa guardada con la herramienta abierta vuelve abierta; sin referencia válida, no", () => {
    expect(restaurarMesa({ abierta: "herramienta", herramienta: { mensajeId: "m1", titulo: "S" } })).toMatchObject({
      abierta: "herramienta",
      herramienta: { mensajeId: "m1", titulo: "S" },
    });
    expect(restaurarMesa({ abierta: "herramienta", herramienta: { mensajeId: 5 } })).toMatchObject({ abierta: null, herramienta: null });
  });
});
