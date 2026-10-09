import { expect, test } from "@playwright/test";

import {
  camposDeFrase,
  completo,
  esConfirmacion,
  faltan,
  formularioActivo,
  nuevoFormulario,
  nuevoFormularioProductos,
  precioDeFrase,
  resumenCompletado,
  textoFaltaProductos,
} from "../../src/features/omnibox/model/formularios";
import type { BorradorProducto } from "../../src/entities/omnibox/model/types";

/**
 * Formularios que se llenan conversando (G6b): "es para Edwin" y después
 * "su teléfono 71890031" completa ESE formulario, sin servidor y sin IA.
 */

test.describe("lo que una frase aporta al formulario de cliente", () => {
  test("el teléfono: dictado con espacios, con 591, o suelto", () => {
    expect(camposDeFrase("cliente", "Su telefono 71890031")).toEqual({ telefono: "71890031" });
    expect(camposDeFrase("cliente", "es el 718 900 31")).toEqual({ telefono: "71890031" });
    expect(camposDeFrase("cliente", "+591 71890031")).toEqual({ telefono: "71890031" });
  });

  test("el correo y el nombre", () => {
    expect(camposDeFrase("cliente", "su correo es Edwin.R@gmail.com")).toEqual({ email: "edwin.r@gmail.com" });
    expect(camposDeFrase("cliente", "se llama edwin rojas y su número 71890031")).toEqual({ nombre: "Edwin Rojas", telefono: "71890031" });
  });

  test("una frase que no es para el formulario no aporta nada", () => {
    expect(camposDeFrase("cliente", "vendé 2 cocas")).toEqual({});
    expect(camposDeFrase("cliente", "cuánto vendí ayer")).toEqual({});
    // Un precio no es un teléfono.
    expect(camposDeFrase("cliente", "a 35 bolivianos")).toEqual({});
  });
});

test.describe("el formulario", () => {
  test("dice qué falta y cuándo está completo", () => {
    const f = nuevoFormulario("cliente", { nombre: "Edwin" });
    expect(faltan(f).map((c) => c.etiqueta)).toEqual(["teléfono"]);
    expect(completo({ ...f, campos: { ...f.campos, telefono: "71890031" } })).toBe(true);
  });

  test("lo que se contesta al anotar", () => {
    const f = nuevoFormulario("cliente", { nombre: "Edwin" });
    expect(resumenCompletado(f, { telefono: "71890031" })).toBe("Anoté teléfono: 71890031. Ya está todo: tocá Crear o decime «crealo».");
    expect(resumenCompletado(nuevoFormulario("cliente"), { telefono: "71890031" })).toBe("Anoté teléfono: 71890031. Falta nombre.");
  });

  test("uno solo activo: el más reciente que sigue abierto", () => {
    const viejo = { id: "a", formulario: { ...nuevoFormulario("cliente"), estado: "creado" as const } };
    const abierto = { id: "b", formulario: nuevoFormulario("cliente", { nombre: "Edwin" }) };
    const otro = { id: "c" };
    expect(formularioActivo([viejo, abierto, otro])?.id).toBe("b");
    expect(formularioActivo([viejo, otro])).toBeNull();
  });

  test("con el formulario completo, «crealo» o «sí» es crear", () => {
    expect(esConfirmacion("crealo")).toBe(true);
    expect(esConfirmacion("Sí!")).toBe(true);
    expect(esConfirmacion("sí, pero cambiale el nombre")).toBe(false);
  });
});

// ------------------------------------------------------------ productos nuevos (G7a)


const prod = (nombre: string, precio: number | null = null, extra: Partial<BorradorProducto> = {}): BorradorProducto => ({
  nombre,
  precio,
  stock: null,
  categoria: null,
  codigo: null,
  marca: null,
  compra: null,
  existente: null,
  ...extra,
});

test.describe("el formulario de productos nuevos", () => {
  test("le falta el precio a cada uno, y se dice agrupado", () => {
    const f = nuevoFormularioProductos([prod("Alcohol"), prod("Vacunas"), prod("Mouse", 60)]);
    expect(completo(f)).toBe(false);
    expect(faltan(f).map((c) => c.etiqueta)).toEqual(["el precio de Alcohol", "el precio de Vacunas"]);
    expect(textoFaltaProductos(f)).toBe("Falta el precio de Alcohol y Vacunas.");
  });

  test("uno solo: «falta el precio de venta»", () => {
    expect(textoFaltaProductos(nuevoFormularioProductos([prod("Mouse")]))).toBe("Falta el precio de venta.");
  });

  test("uno que ya existe no se puede crear", () => {
    const f = nuevoFormularioProductos([prod("Sauvage", 100, { existente: { productId: "x", nombre: "Sauvage" } })]);
    expect(completo(f)).toBe(false);
    expect(textoFaltaProductos(f)).toBe("Sauvage ya existe.");
  });

  test("completo: se puede crear", () => {
    expect(completo(nuevoFormularioProductos([prod("Alcohol", 15), prod("Mouse", 60)]))).toBe(true);
  });

  test("un precio dicho solo, sin servidor", () => {
    expect(precioDeFrase("a 15")).toBe(15);
    expect(precioDeFrase("15 bs")).toBe(15);
    expect(precioDeFrase("Bs 15,50")).toBe(15.5);
    expect(precioDeFrase("precio 20")).toBe(20);
    expect(precioDeFrase("lo vendo a 35")).toBe(35);
    // Una frase con más cosas va al agente.
    expect(precioDeFrase("el alcohol a 15 y el mouse a 60")).toBeNull();
    expect(precioDeFrase("compré 10")).toBeNull();
  });

  test("«créalos» también es crear", () => {
    expect(esConfirmacion("créalos")).toBe(true);
    expect(esConfirmacion("Crealas!")).toBe(true);
  });
});
