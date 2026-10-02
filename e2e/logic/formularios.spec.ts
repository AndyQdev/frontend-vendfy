import { expect, test } from "@playwright/test";

import {
  camposDeFrase,
  completo,
  esConfirmacion,
  faltan,
  formularioActivo,
  nuevoFormulario,
  resumenCompletado,
} from "../../src/features/omnibox/model/formularios";

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
