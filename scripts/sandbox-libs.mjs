// Junta en public/sandbox/librerias.js lo que usan las herramientas a medida
// (Fase G6): React, ReactDOM, PropTypes, Recharts y Tailwind, en ese orden
// (Recharts espera React y PropTypes ya cargados). Siempre la MISMA versión
// que usa la app. Lo corre vite.config.ts al arrancar `vite` y `vite build`.
//
// El iframe aislado no las descarga: no puede hacer NINGUNA petición. La
// pantalla lee este archivo (de su propio dominio) y se lo pasa por
// postMessage junto con el código; adentro se inyecta como script.
//
// Tailwind para el navegador no viene en node_modules: está en el repo
// (vendor/tailwind-play-3.4.17.js, de cdn.tailwindcss.com/3.4.17).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const deNodeModules = (ruta) => {
  const paquete = ruta.split("/")[0];
  return join(dirname(require.resolve(`${paquete}/package.json`)), ruta.slice(paquete.length + 1));
};

const libs = [
  deNodeModules("react/umd/react.production.min.js"),
  deNodeModules("react-dom/umd/react-dom.production.min.js"),
  deNodeModules("prop-types/prop-types.min.js"),
  deNodeModules("recharts/umd/Recharts.js"),
  join(process.cwd(), "vendor", "tailwind-play-3.4.17.js"),
];
const destino = join(process.cwd(), "public", "sandbox");
mkdirSync(destino, { recursive: true });
const texto = libs.map((l) => readFileSync(l, "utf8")).join("\n;\n");
writeFileSync(join(destino, "librerias.js"), texto);
console.log(`sandbox: ${libs.length} librerías en public/sandbox/librerias.js (${Math.round(texto.length / 1024)} KB)`);
