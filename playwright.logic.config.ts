import { defineConfig } from "@playwright/test";

/**
 * Pruebas de lógica pura: sin navegador, sin backend, sin base.
 *
 * Corren en milisegundos. Acá van los reductores del asistente —la mesa, el
 * carrito, la compra—, que son lo que más se rompe en silencio: un carrito que
 * pierde una línea no tira ningún error, solo cobra de menos.
 */
export default defineConfig({
  testDir: "./e2e/logic",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  timeout: 10_000,
});
