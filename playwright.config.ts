import { defineConfig, devices } from "@playwright/test";

import { API_URL, PUERTO_APP } from "./e2e/helpers/env";

/**
 * Pruebas de extremo a extremo del panel: navegador real contra la app local,
 * y la app contra un backend de Vendfy real.
 *
 * `webServer` levanta la app sola; si ya está abierta, la reutiliza.
 *
 * El backend NO lo levanta Playwright a propósito: lo corre el desarrollador y
 * apunta a datos que no queremos que un test arranque o detenga por su cuenta.
 *
 * Los tests de lógica pura —sin navegador ni API— viven en
 * `playwright.logic.config.ts` y corren con `npm run test:logic`.
 */
export default defineConfig({
  testDir: "./e2e",
  // Las de voz usan un micrófono simulado: van con playwright.voz.config.ts.
  testIgnore: ["**/logic/**", "**/voz/**"],

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  // Serial: comparten sesión y datos del backend (y las ventas mueven stock).
  workers: 1,
  fullyParallel: false,

  timeout: 60_000,
  expect: { timeout: 15_000 },

  reporter: process.env.CI ? [["github"], ["list"]] : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: `http://localhost:${PUERTO_APP}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    // Al terminar todo, "limpieza" borra las conversaciones que crearon las
    // pruebas (G5: cada frase del chat guarda la conversación en la base).
    { name: "setup", testMatch: /auth\.setup\.ts/, teardown: "limpieza" },
    { name: "limpieza", testMatch: /limpieza\.teardown\.ts/ },
    {
      name: "escritorio",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: "e2e/.auth/session.json" },
      dependencies: ["setup"],
      // Un testIgnore de proyecto reemplaza al global: hay que repetir logic.
      testIgnore: [/movil\.spec\.ts/, /[\\/]logic[\\/]/, /[\\/]voz[\\/]/],
    },
    {
      name: "telefono",
      use: { ...devices["Pixel 7"], storageState: "e2e/.auth/session.json" },
      dependencies: ["setup"],
      // En el teléfono solo lo que cambia de disposición.
      testMatch: /movil\.spec\.ts/,
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PUERTO_APP} --strictPort`,
    port: PUERTO_APP,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_API_URL: API_URL },
  },
});
