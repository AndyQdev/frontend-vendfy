import { defineConfig, devices } from "@playwright/test";

import { API_URL, PUERTO_APP } from "./e2e/helpers/env";

/**
 * "Oye Vendfy" de punta a punta: Chrome usa un WAV como si fuera el micrófono
 * (--use-file-for-fake-audio-capture), el detector corre en el navegador y el
 * servidor transcribe y verifica la palabra (gasta Whisper, no la IA cara).
 *
 * Cada archivo de e2e/voz elige su audio con `test.use({ launchOptions })`:
 * por eso corre en un worker propio, uno a la vez.
 *
 *   E2E_API_URL=http://localhost:3913 npx playwright test -c playwright.voz.config.ts
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: [/auth\.setup\.ts/, /[\\/]voz[\\/].*\.spec\.ts/],
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PUERTO_APP}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "voz",
      testMatch: /[\\/]voz[\\/].*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: "e2e/.auth/session.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PUERTO_APP} --strictPort`,
    port: PUERTO_APP,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { VITE_API_URL: API_URL },
  },
});
