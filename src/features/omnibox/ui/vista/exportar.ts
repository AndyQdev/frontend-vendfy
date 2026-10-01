import { useQueryClient } from "@tanstack/react-query";

import { claveConclusionVista, consultaFuenteVista } from "@/entities/omnibox/api";
import type { TablaVista } from "@/entities/omnibox/model/types";

import { libroExcel } from "../../model/excel";
import { hojasDeVista, nombreArchivo, type DatosDeVista } from "../../model/exportar";
import type { Analisis } from "../../model/mesa";

/**
 * Exportar una vista (G4).
 *
 * Excel: los datos salen del mismo caché que dibujó el panel (no se vuelven a
 * pedir) y la conclusión solo si ya estaba escrita: exportar no gasta IA.
 *
 * PDF: la vista en una ventana limpia (sin el chat, los botones ni el modo
 * oscuro) y el cuadro de impresión del navegador, que deja guardarla como
 * PDF. Los gráficos son SVG: salen nítidos a cualquier tamaño.
 */
export function useExportarVista(storeId: string, tienda: string) {
  const qc = useQueryClient();

  async function excel(analisis: Analisis): Promise<void> {
    const { vista, pregunta } = analisis;
    const datos: DatosDeVista = {};
    await Promise.all(
      vista.piezas.map(async (p) => {
        if (p.tipo === "conclusion") return;
        if (p.tipo === "comparativa") {
          datos[p.id] = (await Promise.all(
            p.periodos.map((periodo) => qc.fetchQuery(consultaFuenteVista(storeId, p.fuente, { ...p.params, periodo }))),
          )) as [TablaVista, TablaVista];
        } else {
          datos[p.id] = await qc.fetchQuery(consultaFuenteVista(storeId, p.fuente, p.params));
        }
      }),
    );
    const conclusion = qc.getQueryData<string>(claveConclusionVista(storeId, pregunta, vista)) ?? null;
    const fecha = new Date();
    const bytes = libroExcel(hojasDeVista(vista, datos, { pregunta, tienda, fecha, conclusion }), fecha);
    descargar(
      new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      nombreArchivo(vista.titulo, fecha, "xlsx"),
    );
  }

  return { excel, pdf: (contenedor: HTMLElement, titulo: string) => imprimirVista(contenedor, { titulo, tienda, fecha: new Date() }) };
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Abre la vista sola en otra ventana y lanza la impresión. Devuelve false si
 * el navegador bloqueó la ventana.
 */
export function imprimirVista(contenedor: HTMLElement, meta: { titulo: string; tienda: string; fecha: Date }): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  // Los estilos de la app, con las rutas absolutas (la ventana nueva no tiene base).
  const estilos = Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'))
    .map((n) => (n instanceof HTMLLinkElement ? `<link rel="stylesheet" href="${escapar(n.href)}">` : n.outerHTML))
    .join("\n");
  const copia = contenedor.cloneNode(true) as HTMLElement;
  copia.querySelectorAll("[data-no-imprimir]").forEach((n) => n.remove());
  const f = meta.fecha;
  const cuando = `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}/${f.getFullYear()}`;

  w.document.open();
  w.document.write(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapar(meta.titulo)}</title>
${estilos}
<style>
  @page { size: A4; margin: 12mm; }
  html, body { background: #fff !important; }
  .imprimir-cabecera { margin: 0 0 12px; padding: 0 16px 10px; border-bottom: 1px solid #e3e8ee; }
  .imprimir-cabecera h1 { font-size: 18px; font-weight: 700; margin: 0; color: #0f172a; }
  .imprimir-cabecera p { font-size: 12px; color: #64748b; margin: 2px 0 0; }
  section { break-inside: avoid; box-shadow: none !important; }
  .recharts-wrapper, .recharts-surface { max-width: 100% !important; height: auto !important; }
  [data-no-imprimir] { display: none !important; }
  * { animation: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
</head>
<body>
<header class="imprimir-cabecera">
  <h1>${escapar(meta.titulo)}</h1>
  <p>${escapar(meta.tienda)} · ${cuando} · Vendfy</p>
</header>
${copia.outerHTML}
</body>
</html>`);
  w.document.close();
  const lanzar = () => {
    w.focus();
    w.print();
  };
  // Espera a que carguen los estilos y las fotos: imprimir antes sale en blanco.
  if (w.document.readyState === "complete") setTimeout(lanzar, 400);
  else w.addEventListener("load", () => setTimeout(lanzar, 400));
  return true;
}
