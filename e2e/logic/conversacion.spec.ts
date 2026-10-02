import { expect, test } from "@playwright/test";

import type { ProductoOpcion } from "../../src/entities/omnibox/model/types";
import {
  SIN_RESPUESTA,
  agrupar,
  cuandoFue,
  enCursoTexto,
  restaurarMensajes,
  restaurarMesa,
  serializarMensajes,
  serializarMesa,
} from "../../src/features/omnibox/model/conversacion";
import type { Mensaje } from "../../src/features/omnibox/model/mensaje";
import { MESA_INICIAL, mesaReducer, totalVenta, type AccionMesa } from "../../src/features/omnibox/model/mesa";

/**
 * Las conversaciones guardadas (G5), sin navegador: lo que se guarda vuelve
 * igual, lo que solo vive en la pestaña se convierte en algo con sentido, y
 * una mesa guardada con otra versión igual se abre.
 */

const coca: ProductoOpcion = {
  storeProductId: "sp-coca",
  productId: "coca",
  nombre: "Coca Cola 2L",
  codigo: null,
  imagen: null,
  precio: 12,
  stock: 40,
  similitud: 1,
};

const mensaje = (extra: Partial<Mensaje> = {}): Mensaje => ({
  id: crypto.randomUUID(),
  texto: "vendé 2 cocas",
  porVoz: false,
  hora: new Date("2026-10-01T14:30:00Z"),
  fase: "listo",
  ...extra,
});

test.describe("guardar y volver a abrir", () => {
  test("los mensajes vuelven iguales (la hora vuelve a ser una fecha)", () => {
    const antes = [mensaje(), mensaje({ texto: "cobrale con QR", porVoz: true })];
    const despues = restaurarMensajes(JSON.parse(JSON.stringify(serializarMensajes(antes))));
    expect(despues).toEqual(antes);
    expect(despues[0].hora).toBeInstanceOf(Date);
  });

  test("la mesa a medio armar vuelve entera: la venta sigue lista para cobrar", () => {
    const acciones: AccionMesa[] = [
      { tipo: "agregarVenta", producto: coca, cantidad: 2 },
      { tipo: "cliente", clienteId: "jose", nombre: "José" },
      { tipo: "abrir", mesa: "venta", pestana: "borrador" },
      { tipo: "ampliar", valor: true },
    ];
    const mesa = acciones.reduce(mesaReducer, MESA_INICIAL);
    const vuelta = restaurarMesa(JSON.parse(JSON.stringify(serializarMesa(mesa))));
    expect(vuelta.venta).toEqual(mesa.venta);
    expect(totalVenta(vuelta.venta)).toBe(24);
    expect(vuelta.abierta).toBe("venta");
    // "Ampliado" es de la pantalla de ese momento, no de la conversación.
    expect(vuelta.ampliada).toBe(false);
  });

  test("una respuesta que no llegó (se recargó pensando) queda como error que se entiende", () => {
    const [m] = restaurarMensajes(serializarMensajes([mensaje({ fase: "pensando" })]));
    expect(m.fase).toBe("error");
    expect(m.error).toBe(SIN_RESPUESTA);
  });

  test("la foto local de una factura no sobrevive: se guarda la que quedó en el servidor", () => {
    const conFoto = mensaje({
      texto: "Factura del proveedor",
      adjunto: { url: "blob:http://localhost/abc", nombre: "factura.jpg", esPdf: false },
      propuesta: { entidades: { adjunto: "https://storage.vendfy.shop/facturas/abc.jpg" } } as any,
    });
    const sinSubir = mensaje({ adjunto: { url: "blob:http://localhost/xyz", nombre: "otra.jpg", esPdf: false } });
    const [a, b] = serializarMensajes([conFoto, sinSubir]) as any[];
    expect(a.adjunto.url).toBe("https://storage.vendfy.shop/facturas/abc.jpg");
    expect(b.adjunto).toEqual({ url: "", nombre: "otra.jpg", esPdf: false });
  });

  test("una mesa rota o de otra versión igual se abre (lo que falta toma el valor inicial)", () => {
    expect(restaurarMesa(null)).toEqual(MESA_INICIAL);
    const vieja = restaurarMesa({ venta: { lineas: [{ productId: "coca", cantidad: 1 }, "basura", null] }, abierta: "otra-cosa" });
    expect(vieja.venta.lineas).toHaveLength(1);
    expect(vieja.venta.pago).toBeNull();
    expect(vieja.abierta).toBeNull();
    expect(vieja.compra).toEqual(MESA_INICIAL.compra);
  });

  test("un análisis abierto vuelve; uno roto no deja el panel en un estado imposible", () => {
    const vista = { titulo: "Ventas", piezas: [{ id: "p1", tipo: "indicadores", fuente: "kpis", params: {} }] };
    expect(restaurarMesa({ abierta: "analisis", analisis: { mensajeId: "m1", pregunta: "x", vista } }).abierta).toBe("analisis");
    expect(restaurarMesa({ abierta: "analisis", analisis: { mensajeId: "m1" } }).abierta).toBeNull();
  });

  test("lo que no tiene forma de mensaje se descarta", () => {
    expect(restaurarMensajes([null, "hola", { texto: "sin id" }, { id: "1", texto: "ok", hora: "no es fecha" }])).toHaveLength(1);
  });
});

test.describe("la lista de conversaciones", () => {
  const ahora = new Date(2026, 9, 2, 10, 0); // 2 oct 2026, 10:00 (hora local)
  const en = (d: number, h = 9) => new Date(2026, 9, d, h, 0).toISOString();

  test("agrupada como ChatGPT: Hoy, Ayer, Últimos 7 días, Anteriores", () => {
    const g = agrupar(
      [
        { id: "a", actualizada: en(2) },
        { id: "b", actualizada: en(1) },
        { id: "c", actualizada: new Date(2026, 8, 28, 9, 0).toISOString() },
        { id: "d", actualizada: new Date(2026, 8, 10).toISOString() },
      ],
      ahora,
    );
    expect(g.map((x) => [x.titulo, x.items.map((i) => i.id)])).toEqual([
      ["Hoy", ["a"]],
      ["Ayer", ["b"]],
      ["Últimos 7 días", ["c"]],
      ["Anteriores", ["d"]],
    ]);
  });

  test("cuándo fue: la hora si fue hoy, 'ayer', o el día", () => {
    expect(cuandoFue(en(2, 9), ahora)).toBe("09:00");
    expect(cuandoFue(en(1), ahora)).toBe("ayer");
    expect(cuandoFue(new Date(2026, 8, 28).toISOString(), ahora)).toBe("lun 28/9");
  });

  test("lo que quedó a medio armar", () => {
    expect(enCursoTexto({ venta: 2, compra: 0 })).toBe("Venta en curso · 2");
    expect(enCursoTexto({ venta: 1, compra: 3 })).toBe("Venta en curso · 1 · Compra en curso · 3");
    expect(enCursoTexto({ venta: 0, compra: 0 })).toBe("");
  });
});
