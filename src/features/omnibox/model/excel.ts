/**
 * Un .xlsx sin librerías (G4 · exportar una vista).
 *
 * Un .xlsx es un zip con unos pocos XML adentro. Se arma el mínimo que Excel,
 * LibreOffice y Google Sheets abren sin quejarse: el libro, una hoja por
 * pieza, estilos (encabezado en negrita, plata con dos decimales) y el zip
 * SIN compresión (método "stored"), que no necesita deflate.
 *
 * Los números van como números (se pueden sumar en Excel), no como texto
 * con formato. Puro: se prueba en e2e/logic/excel.spec.ts.
 */

export type CeldaExcel = string | number | null;

export interface HojaExcel {
  nombre: string;
  /** "dinero" se muestra con dos decimales; "texto" y "numero", tal cual. */
  columnas: { titulo: string; tipo: "texto" | "numero" | "dinero"; ancho?: number }[];
  filas: CeldaExcel[][];
}

// ------------------------------------------------------------ zip (stored)

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Un zip sin compresión. Nombres en UTF-8 (bit 11). */
export function zip(archivos: { nombre: string; datos: Uint8Array }[], fecha = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const hora = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | Math.floor(fecha.getSeconds() / 2);
  const dia = ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const a of archivos) {
    const nombre = enc.encode(a.nombre);
    const crc = crc32(a.datos);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // versión necesaria
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, hora, true);
    local.setUint16(12, dia, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, a.datos.length, true);
    local.setUint32(22, a.datos.length, true);
    local.setUint16(26, nombre.length, true);
    local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nombre, a.datos);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, hora, true);
    cd.setUint16(14, dia, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, a.datos.length, true);
    cd.setUint32(24, a.datos.length, true);
    cd.setUint16(28, nombre.length, true);
    // extra, comentario, disco, atributos: 0
    cd.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(cd.buffer), nombre);

    desplazamiento += 30 + nombre.length + a.datos.length;
  }

  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, desplazamiento, true);

  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of todo) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
}

// ------------------------------------------------------------ hojas

/** Caracteres que XML 1.0 no admite (controles) fuera; lo demás, escapado. */
function xml(texto: string): string {
  return texto
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnaExcel(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Excel no admite : \ / ? * [ ] en el nombre de una hoja, ni más de 31 letras, ni repetidos. */
export function nombresDeHoja(nombres: string[]): string[] {
  const usados = new Set<string>();
  return nombres.map((n) => {
    const base = (n.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim() || "Hoja").slice(0, 31);
    let nombre = base;
    for (let k = 2; usados.has(nombre.toLowerCase()); k++) nombre = `${base.slice(0, 31 - String(k).length - 1)} ${k}`;
    usados.add(nombre.toLowerCase());
    return nombre;
  });
}

const ESTILO = { normal: 0, encabezado: 1, dinero: 2 };

function hojaXml(h: HojaExcel): string {
  const cols = h.columnas
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho ?? (c.tipo === "texto" ? 32 : 14)}" customWidth="1"/>`)
    .join("");
  const celda = (v: CeldaExcel, fila: number, col: number, estilo: number) => {
    const ref = `${columnaExcel(col)}${fila}`;
    if (v == null || v === "") return "";
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}" s="${estilo}"><v>${v}</v></c>`;
    return `<c r="${ref}" s="${estilo === ESTILO.dinero ? ESTILO.normal : estilo}" t="inlineStr"><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
  };
  const encabezado = `<row r="1">${h.columnas.map((c, i) => celda(c.titulo, 1, i, ESTILO.encabezado)).join("")}</row>`;
  const filas = h.filas
    .map(
      (f, r) =>
        `<row r="${r + 2}">${f.map((v, i) => celda(v, r + 2, i, h.columnas[i]?.tipo === "dinero" ? ESTILO.dinero : ESTILO.normal)).join("")}</row>`,
    )
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${encabezado}${filas}</sheetData></worksheet>`
  );
}

const ESTILOS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="3">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** El libro entero, listo para descargar. */
export function libroExcel(hojas: HojaExcel[], fecha = new Date()): Uint8Array {
  if (hojas.length === 0) throw new Error("Un libro necesita al menos una hoja");
  const enc = new TextEncoder();
  const nombres = nombresDeHoja(hojas.map((h) => h.nombre));
  const tipos =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    hojas
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("") +
    `</Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;
  const libro =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${nombres.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>` +
    `</workbook>`;
  const relsLibro =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    hojas
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("") +
    `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  return zip(
    [
      { nombre: "[Content_Types].xml", datos: enc.encode(tipos) },
      { nombre: "_rels/.rels", datos: enc.encode(rels) },
      { nombre: "xl/workbook.xml", datos: enc.encode(libro) },
      { nombre: "xl/_rels/workbook.xml.rels", datos: enc.encode(relsLibro) },
      { nombre: "xl/styles.xml", datos: enc.encode(ESTILOS) },
      ...hojas.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, datos: enc.encode(hojaXml(h)) })),
    ],
    fecha,
  );
}
