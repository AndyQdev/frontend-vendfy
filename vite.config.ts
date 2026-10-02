import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Arma public/sandbox/librerias.js (las librerías de las herramientas a
 * medida, G6) al arrancar `vite` o `vite build`, se invoquen como se invoquen.
 */
function libreriasSandbox(): Plugin {
  return {
    name: "vendfy-librerias-sandbox",
    buildStart() {
      execFileSync(process.execPath, [path.resolve(__dirname, "scripts/sandbox-libs.mjs")], { cwd: __dirname, stdio: "inherit" });
    },
  };
}

export default defineConfig({
  plugins: [react(), libreriasSandbox()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
});
