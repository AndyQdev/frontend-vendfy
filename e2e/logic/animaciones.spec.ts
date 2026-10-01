import { expect, test } from "@playwright/test";

import { frenar, interpolar, trayectoria } from "../../src/features/omnibox/ui/coreografia/animaciones";

/**
 * Lo calculable del seguimiento visual (Fase G1): el recorrido del vuelo y el
 * conteo del total. Lo que se ve se prueba en el navegador (flows/seguimiento).
 */

test.describe("el total que cuenta", () => {
  test("arranca en el valor de antes y termina EXACTO en el nuevo", () => {
    expect(interpolar(18, 54, 0)).toBe(18);
    expect(interpolar(18, 54, 1)).toBe(54);
  });

  test("a mitad de camino ya recorrió más de la mitad (frena al llegar)", () => {
    const medio = interpolar(0, 100, 0.5);
    expect(medio).toBeGreaterThan(50);
    expect(medio).toBeLessThan(100);
  });

  test("siempre en centavos: nunca muestra Bs 17,9999", () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const v = interpolar(3.33, 9.99, t);
      expect(Math.round(v * 100) / 100).toBe(v);
    }
  });

  test("también cuenta hacia abajo (quitar un producto)", () => {
    expect(interpolar(54, 18, 1)).toBe(18);
    expect(interpolar(54, 18, 0.5)).toBeLessThan(36);
  });

  test("fuera de rango no se pasa", () => {
    expect(frenar(-1)).toBe(0);
    expect(frenar(2)).toBe(1);
  });
});

test.describe("el vuelo al carrito", () => {
  const origen = { left: 100, top: 400, width: 32, height: 32 };
  const destino = { left: 700, top: 200, width: 44, height: 44 };

  test("empieza donde está la foto y termina sobre la línea, a su tamaño", () => {
    const k = trayectoria(origen, destino);
    expect(k[0].transform).toBe("translate(0px, 0px) scale(1)");
    expect(k.at(-1)!.transform).toBe(`translate(600px, -200px) scale(${44 / 32})`);
  });

  test("pasa por un punto más alto que la recta: se lee como un vuelo", () => {
    const k = trayectoria(origen, destino, 60);
    // Mitad de la recta: y = -100; con el arco, 60 px más arriba.
    expect(k[1].transform).toContain("translate(300px, -160px)");
    expect(k[1].offset).toBe(0.5);
  });

  test("una foto sin tamaño no rompe la cuenta", () => {
    const k = trayectoria({ ...origen, width: 0 }, destino);
    expect(k.at(-1)!.transform).toContain("scale(1)");
  });
});
