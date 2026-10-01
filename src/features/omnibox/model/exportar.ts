import type { PiezaVista, TablaVista, TipoColumna, VistaSpec } from "@/entities/omnibox/model/types";

import type { HojaExcel } from "./excel";
import { alertaDe, comparar, etiquetaPeriodo, periodoComun, resumenPiezas, variacion } from "./vistas";

/**
 * Una vista como libro de Excel (G4): una hoja "Resumen" (qué se preguntó,
 * de qué tienda, cuándo, las alertas y la conclusión) y una hoja por pieza
 * con TODAS sus filas, no solo las que se ven en pantalla.
 *
 * Puro: recibe los datos ya leídos (los mismos que dibujó el panel).
 */

/** Los datos de cada pieza, por id. La comparativa trae las dos lecturas. */
export type DatosDeVista = Record<string, TablaVista | [TablaVista, TablaVista] | undefined>;

const tipoExcel = (t: TipoColumna): HojaExcel["columnas"][number]["tipo"] =>
  t === "dinero" ? "dinero" : t === "numero" || t === "porcentaje" ? "numero" : "texto";

const numero = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

const nombreDe = (p: PiezaVista) => ("titulo" in p && p.titulo) || resumenPiezas({ titulo: "", piezas: [p] })[0];

function hojaDePieza(p: Exclude<PiezaVista, { tipo: "conclusion" | "alerta" }>, datos: DatosDeVista[string]): HojaExcel | null {
  if (!datos) return null;
  if (p.tipo === "comparativa") {
    if (!Array.isArray(datos)) return null;
    const [a, b] = datos;
    const col = (clave: string) => a.columnas.find((c) => c.clave === clave);
    const tipo = tipoExcel(col(p.valor)?.tipo ?? "numero");
    return {
      nombre: nombreDe(p),
      columnas: [
        { titulo: col(p.etiqueta)?.titulo ?? p.etiqueta, tipo: "texto" },
        { titulo: etiquetaPeriodo(p.periodos[0]), tipo },
        { titulo: etiquetaPeriodo(p.periodos[1]), tipo },
        { titulo: "Diferencia", tipo },
        { titulo: "Variación %", tipo: "numero" },
      ],
      filas: comparar(a.filas, b.filas, p.etiqueta, p.valor).map((f) => [f.etiqueta, f.a, f.b, f.diferencia, f.pct]),
    };
  }
  if (Array.isArray(datos)) return null;
  const t = datos;

  if (p.tipo === "indicadores") {
    return {
      nombre: nombreDe(p),
      columnas: [
        { titulo: "Indicador", tipo: "texto" },
        { titulo: "Valor", tipo: "numero" },
        { titulo: "Período anterior", tipo: "numero" },
        { titulo: "Variación %", tipo: "numero" },
      ],
      filas: t.filas.map((f) => [String(f.indicador), numero(f.valor), numero(f.anterior), variacion(f.valor, f.anterior)?.pct ?? null]),
    };
  }

  const columnas = t.columnas.filter((c) => c.clave !== "formato");
  const hoja: HojaExcel = {
    nombre: nombreDe(p),
    columnas: columnas.map((c) => ({ titulo: c.titulo, tipo: tipoExcel(c.tipo) })),
    filas: t.filas.map((f) =>
      columnas.map((c) => (tipoExcel(c.tipo) === "texto" ? (f[c.clave] == null ? null : String(f[c.clave])) : numero(f[c.clave]))),
    ),
  };
  // "Reponer": lo que se cargaría a la compra.
  if (p.tipo === "accion") {
    hoja.columnas.push({ titulo: "Comprar (sugerido)", tipo: "numero" }, { titulo: "Último costo", tipo: "dinero" });
    hoja.filas = hoja.filas.map((fila, i) => [...fila, numero(t.filas[i]._sugerido), numero(t.filas[i]._costo)]);
  }
  return hoja;
}

export function hojasDeVista(
  vista: VistaSpec,
  datos: DatosDeVista,
  meta: { pregunta: string; tienda: string; fecha: Date; conclusion?: string | null },
): HojaExcel[] {
  const periodo = periodoComun(vista);
  const f = meta.fecha;
  const dosCifras = (n: number) => String(n).padStart(2, "0");
  const resumen: HojaExcel = {
    nombre: "Resumen",
    columnas: [
      { titulo: "Dato", tipo: "texto", ancho: 18 },
      { titulo: "Valor", tipo: "texto", ancho: 90 },
    ],
    filas: [
      ["Vista", vista.titulo],
      ["Pregunta", meta.pregunta || null],
      ["Tienda", meta.tienda],
      ["Generado", `${dosCifras(f.getDate())}/${dosCifras(f.getMonth() + 1)}/${f.getFullYear()} ${dosCifras(f.getHours())}:${dosCifras(f.getMinutes())}`],
      ["Período", periodo ? etiquetaPeriodo(periodo) : "Cada pieza tiene el suyo"],
    ],
  };
  for (const p of vista.piezas) {
    if (p.tipo !== "alerta") continue;
    const t = datos[p.id];
    const alerta = t && !Array.isArray(t) ? alertaDe(p.fuente, t) : null;
    if (alerta) resumen.filas.push(["Alerta", alerta.detalle ? `${alerta.texto}: ${alerta.detalle}` : alerta.texto]);
  }
  if (meta.conclusion) resumen.filas.push(["Conclusión", meta.conclusion]);

  const hojas = vista.piezas.flatMap((p) =>
    p.tipo === "conclusion" || p.tipo === "alerta" ? [] : [hojaDePieza(p, datos[p.id])].filter((h): h is HojaExcel => h !== null),
  );
  return [resumen, ...hojas];
}

/** "Cómo vamos este año" → "como-vamos-este-ano-2026-10-01.xlsx". */
export function nombreArchivo(titulo: string, fecha: Date, extension: string): string {
  const base =
    titulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "vista";
  const d = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
  return `${base}-${d}.${extension}`;
}
