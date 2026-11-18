/**
 * Exportar un listado del panel a Excel (H4).
 *
 * Cada pantalla arma sus hojas con lo que el usuario está viendo (sus filtros,
 * su tienda, su período) y esto se encarga del nombre del archivo y de la
 * descarga. El libro lo arma `libroExcel`, sin librerías.
 */
import { libroExcel, type CeldaExcel, type HojaExcel } from "./excel";

export type { CeldaExcel, HojaExcel };

/** aaaa-mm-dd en hora local (no UTC: a la noche en Bolivia ya sería mañana). */
export function fechaArchivo(fecha = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}

/** dd/mm/aaaa, o "" si no hay fecha. */
export function fechaCelda(valor: string | number | Date | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  // "2026-11-17" sin hora es una fecha de calendario: no se convierte a UTC.
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split("-");
    return `${d}/${m}/${a}`;
  }
  const f = new Date(valor);
  if (Number.isNaN(f.getTime())) return String(valor);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(f.getDate())}/${p(f.getMonth() + 1)}/${f.getFullYear()}`;
}

/** dd/mm/aaaa hh:mm. */
export function fechaHoraCelda(valor: string | number | Date | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const f = new Date(valor);
  if (Number.isNaN(f.getTime())) return String(valor);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${fechaCelda(f)} ${p(f.getHours())}:${p(f.getMinutes())}`;
}

/** Un número o null: lo que llega como texto desde la API ("12.50") vuelve a número. */
export function numeroCelda(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Texto para el nombre del archivo: sin acentos, espacios ni símbolos. */
function slug(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "todas"
  );
}

/** vendfy-<listado>-<tienda o "todas">-<aaaa-mm-dd>.xlsx */
export function nombreArchivoListado(listado: string, tienda: string | null | undefined, fecha = new Date()): string {
  return `vendfy-${slug(listado)}-${tienda ? slug(tienda) : "todas"}-${fechaArchivo(fecha)}.xlsx`;
}

/** Arma el libro y lo descarga. */
export function descargarExcel(hojas: HojaExcel[], nombre: string): void {
  const bytes = libroExcel(hojas);
  const blob = new Blob([bytes as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/**
 * Todas las filas de un listado que pagina desde el servidor: se piden de a
 * `tamano` hasta completar `countData`. El tope evita colgar el navegador con
 * una tienda enorme (lo que pase de ahí no entra en el archivo).
 */
export async function traerTodas<T>(
  pedir: (limit: number, offset: number) => Promise<{ data?: T[] | null; countData?: number }>,
  tamano = 200,
  tope = 20_000,
): Promise<T[]> {
  const filas: T[] = [];
  for (let offset = 0; offset < tope; offset += tamano) {
    const r = await pedir(tamano, offset);
    const pagina = r.data ?? [];
    filas.push(...pagina);
    const total = r.countData ?? 0;
    if (pagina.length < tamano || (total > 0 && filas.length >= total)) break;
  }
  return filas.slice(0, tope);
}
