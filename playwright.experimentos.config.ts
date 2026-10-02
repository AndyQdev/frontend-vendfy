import { defineConfig, devices } from "@playwright/test";

import { API_URL, PUERTO_APP } from "./e2e/helpers/env";

/**
 * Experimentos con el modelo de verdad (G6: herramientas a medida). No es
 * regresión: gasta créditos de IA y el resultado varía de una corrida a otra.
 * Ver e2e/experimentos/herramientas.exp.ts.
 */
export default defineConfig({
  testDir: "./e2e/experimentos",
  testMatch: /\.exp\.ts$/,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PUERTO_APP}` },
  webServer: {
    command: `npm run dev -- --port ${PUERTO_APP} --strictPort`,
    port: PUERTO_APP,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { VITE_API_URL: API_URL },
  },
});
