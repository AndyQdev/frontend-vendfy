/**
 * El iframe aislado donde corre una herramienta a medida (Fase G6, N3).
 *
 * Tres barreras, además de la revisión del código en el servidor:
 *
 * 1. `sandbox="allow-scripts"` SIN `allow-same-origin`: el iframe tiene un
 *    origen opaco propio. No ve la sesión, las cookies ni el almacenamiento
 *    de Vendfy, ni puede tocar la ventana de afuera. Tampoco puede navegar,
 *    abrir ventanas ni mandar formularios (no se le dan esos permisos).
 * 2. CSP sin NINGÚN origen: el iframe no puede hacer una sola petición (ni
 *    fetch, ni scripts, ni imágenes de afuera: una imagen sería una forma de
 *    sacar datos por la URL). Sin eval. Las librerías tampoco se descargan:
 *    llegan como texto junto con el código y se inyectan adentro.
 * 3. Un solo canal: postMessage. Entran las librerías, el código y los
 *    datos; salen la altura, los errores y las PROPUESTAS, que la pantalla
 *    valida y hace confirmar.
 *
 * Puro: arma texto. Se prueba en e2e/logic/sandbox.spec.ts y en el navegador
 * con e2e/flows/herramientas.spec.ts (incluidos los intentos de escaparse).
 */

/**
 * React, ReactDOM, PropTypes, Recharts y Tailwind en un solo archivo (lo arma
 * scripts/sandbox-libs.mjs). Lo lee la pantalla, de su propio dominio.
 */
export const URL_LIBRERIAS = "/sandbox/librerias.js";

/** La política de seguridad del iframe: nada de afuera, ni siquiera de Vendfy. */
export function politicaSandbox(): string {
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "connect-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");
}

/** Los colores del sistema (index.css), para que la herramienta se vea como Vendfy. */
const TOKENS = {
  claro: {
    "--background": "210 20% 96%",
    "--foreground": "222 47% 11%",
    "--card": "0 0% 100%",
    "--muted": "210 20% 96%",
    "--muted-foreground": "215 16% 47%",
    "--border": "213 24% 91%",
    "--primary": "193 82% 31%",
    "--primary-foreground": "0 0% 100%",
    "--primary-soft": "191 51% 94%",
    "--success": "156 76% 36%",
    "--success-soft": "152 55% 93%",
    "--warning": "38 92% 50%",
    "--warning-soft": "40 96% 93%",
    "--destructive": "0 72% 51%",
    "--destructive-soft": "0 86% 97%",
    "--viz-1": "#0891b2",
    "--viz-2": "#eb6834",
    "--viz-3": "#4a3aa7",
    "--viz-4": "#eda100",
    "--viz-5": "#e87ba4",
    "--viz-6": "#008300",
  },
  oscuro: {
    "--background": "222 47% 7%",
    "--foreground": "210 30% 94%",
    "--card": "222 40% 11%",
    "--muted": "222 32% 15%",
    "--muted-foreground": "215 16% 64%",
    "--border": "222 26% 19%",
    "--primary": "189 80% 42%",
    "--primary-foreground": "222 47% 7%",
    "--primary-soft": "193 60% 16%",
    "--success": "156 64% 44%",
    "--success-soft": "156 45% 15%",
    "--warning": "38 92% 56%",
    "--warning-soft": "36 60% 15%",
    "--destructive": "0 70% 56%",
    "--destructive-soft": "0 45% 16%",
    "--viz-1": "#0ea5c6",
    "--viz-2": "#d95926",
    "--viz-3": "#9085e9",
    "--viz-4": "#c98500",
    "--viz-5": "#d55181",
    "--viz-6": "#008300",
  },
} as const;

/** Las clases de color que se le prometen al modelo (CONTRATO, punto 5) → Tailwind. */
const COLORES_TAILWIND = {
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  card: "hsl(var(--card))",
  muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
  border: "hsl(var(--border))",
  primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))", soft: "hsl(var(--primary-soft))" },
  success: { DEFAULT: "hsl(var(--success))", soft: "hsl(var(--success-soft))" },
  warning: { DEFAULT: "hsl(var(--warning))", soft: "hsl(var(--warning-soft))" },
  destructive: { DEFAULT: "hsl(var(--destructive))", soft: "hsl(var(--destructive-soft))" },
};

/**
 * El arranque dentro del iframe: espera las librerías, el código y los datos,
 * los corre y avisa. ES5 a propósito: es lo único que no pasa por el compilador.
 */
const ARRANQUE = String.raw`
(function () {
  var padre = window.parent;
  function enviar(m) { m.vendfy = true; padre.postMessage(m, "*"); }
  function texto(e) { return e && e.message ? String(e.message) : String(e); }
  window.addEventListener("error", function (e) {
    enviar({ tipo: "error", mensaje: texto(e.error || e.message), pila: e.error && e.error.stack ? String(e.error.stack).slice(0, 2000) : "" });
  });
  window.addEventListener("unhandledrejection", function (e) { enviar({ tipo: "error", mensaje: texto(e.reason) }); });
  document.addEventListener("securitypolicyviolation", function (e) {
    enviar({ tipo: "bloqueo", directiva: e.violatedDirective, recurso: String(e.blockedURI || "").slice(0, 200) });
  });
  // Un script inline creado acá adentro: lo permite 'unsafe-inline' (no es eval).
  function inyectar(codigo) { var s = document.createElement("script"); s.textContent = codigo; document.head.appendChild(s); }
  var cargada = false;
  window.addEventListener("message", function (ev) {
    if (ev.source !== padre || cargada) return;
    var d = ev.data || {};
    if (d.tipo !== "cargar" || typeof d.codigo !== "string" || typeof d.librerias !== "string") return;
    cargada = true;
    inyectar(d.librerias);
    if (!window.React || !window.ReactDOM || !window.Recharts) { enviar({ tipo: "error", mensaje: "No cargaron las librerías de la herramienta" }); return; }
    if (window.tailwind) window.tailwind.config = { darkMode: "class", theme: { extend: { colors: COLORES } } };
    // Una copia (postMessage clona): si la herramienta la ordena en el lugar, no rompe nada afuera.
    var datos = d.datos || {};
    function proponer(accion) { enviar({ tipo: "proponer", accion: JSON.parse(JSON.stringify(accion)) }); }
    var modulo = { exports: {} };
    window.__vendfyModulo = modulo;
    window.__vendfyRequerir = function (n) {
      if (n === "react") return window.React;
      if (n === "recharts") return window.Recharts;
      throw new Error("La herramienta no puede importar " + n);
    };
    inyectar("(function (module, exports, require) {\n" + d.codigo + "\n})(window.__vendfyModulo, window.__vendfyModulo.exports, window.__vendfyRequerir);");
    var Componente = modulo.exports && (modulo.exports.default || modulo.exports);
    if (typeof Componente !== "function") { enviar({ tipo: "error", mensaje: "La herramienta no exporta un componente" }); return; }
    var e = window.React.createElement;
    function Limite(props) { window.React.Component.call(this, props); this.state = { fallo: null }; }
    Limite.prototype = Object.create(window.React.Component.prototype);
    Limite.prototype.constructor = Limite;
    Limite.getDerivedStateFromError = function (err) { return { fallo: err }; };
    Limite.prototype.componentDidCatch = function (err) {
      enviar({ tipo: "error", mensaje: texto(err), pila: err && err.stack ? String(err.stack).slice(0, 2000) : "" });
    };
    Limite.prototype.render = function () {
      if (this.state.fallo) return e("div", { className: "m-4 rounded-xl border border-border bg-destructive-soft p-4 text-sm text-destructive" }, "La herramienta falló: " + texto(this.state.fallo));
      return this.props.children;
    };
    window.ReactDOM.createRoot(document.getElementById("raiz")).render(e(Limite, null, e(Componente, { datos: datos, proponer: proponer })));
    var ultimo = 0;
    new ResizeObserver(function () {
      var alto = Math.ceil(document.documentElement.scrollHeight);
      if (alto !== ultimo) { ultimo = alto; enviar({ tipo: "altura", alto: alto }); }
    }).observe(document.body);
    setTimeout(function () { enviar({ tipo: "lista" }); }, 50);
  });
  enviar({ tipo: "preparada" });
})();
`;

const escaparAtributo = (t: string) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** El documento entero del iframe (va en `srcdoc`): chico, sin librerías. */
export function paginaSandbox({ tema }: { tema: "claro" | "oscuro" }): string {
  const vars = Object.entries(TOKENS[tema])
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");
  return `<!doctype html>
<html lang="es"${tema === "oscuro" ? ' class="dark"' : ""}>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${escaparAtributo(politicaSandbox())}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { ${vars} color-scheme: ${tema === "oscuro" ? "dark" : "light"}; }
  html, body { margin: 0; background: hsl(var(--background)); color: hsl(var(--foreground));
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 14px; }
  #raiz { padding: 12px; }
  input, select, textarea, button { font: inherit; }
  input[type="range"], input[type="checkbox"], input[type="radio"] { accent-color: hsl(var(--primary)); }
</style>
</head>
<body>
<div id="raiz"></div>
<script>var COLORES = ${JSON.stringify(COLORES_TAILWIND)};${ARRANQUE}</script>
</body>
</html>`;
}

/**
 * Una huella del código (djb2): cada versión de una herramienta, su propio
 * iframe. Adentro el código se carga una sola vez; la corregida necesita uno nuevo.
 */
export function huella(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + texto.length.toString(36);
}

/** Entre dos propuestas de la misma herramienta: menos que esto es una ráfaga (un bucle), no una persona. */
export const PAUSA_PROPUESTAS = 800;

// ------------------------------------------------------------ lo que sale del iframe

export type MensajeSandbox =
  | { tipo: "preparada" }
  | { tipo: "lista" }
  | { tipo: "altura"; alto: number }
  | { tipo: "error"; mensaje: string; pila?: string }
  | { tipo: "bloqueo"; directiva: string; recurso: string }
  | { tipo: "proponer"; accion: unknown };

/** Lo que llega por postMessage, solo si tiene forma de mensaje de la herramienta. */
export function leerMensaje(d: unknown): MensajeSandbox | null {
  if (!d || typeof d !== "object" || (d as { vendfy?: unknown }).vendfy !== true) return null;
  const m = d as Record<string, unknown>;
  switch (m.tipo) {
    case "preparada":
    case "lista":
      return { tipo: m.tipo };
    case "altura":
      return typeof m.alto === "number" && m.alto > 0 ? { tipo: "altura", alto: Math.min(m.alto, 20_000) } : null;
    case "error":
      return { tipo: "error", mensaje: String(m.mensaje ?? "Error desconocido").slice(0, 1000), pila: typeof m.pila === "string" ? m.pila.slice(0, 2000) : undefined };
    case "bloqueo":
      return { tipo: "bloqueo", directiva: String(m.directiva ?? ""), recurso: String(m.recurso ?? "") };
    case "proponer":
      return { tipo: "proponer", accion: m.accion };
    default:
      return null;
  }
}
