import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { columnaExcel, crc32, libroExcel, nombresDeHoja, zip } from "../../src/features/omnibox/model/excel";

/**
 * El .xlsx sin librerías (G4). Se revisa la estructura del zip byte a byte;
 * que Excel lo abra se comprobó leyéndolo con openpyxl (el archivo de
 * muestra queda en la carpeta temporal: `vendfy-vista-prueba.xlsx`).
 */

/** Lee el directorio central de un zip: nombre, tamaño, CRC y dónde empieza cada archivo. */
function leerZip(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fin = bytes.length - 22;
  expect(v.getUint32(fin, true)).toBe(0x06054b50);
  const total = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const dec = new TextDecoder();
  const archivos: { nombre: string; datos: Uint8Array; crc: number }[] = [];
  for (let i = 0; i < total; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const crc = v.getUint32(p + 16, true);
    const tam = v.getUint32(p + 20, true);
    const largoNombre = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const nombre = dec.decode(bytes.subarray(p + 46, p + 46 + largoNombre));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const inicio = local + 30 + v.getUint16(local + 26, true);
    archivos.push({ nombre, datos: bytes.subarray(inicio, inicio + tam), crc });
    p += 46 + largoNombre;
  }
  return archivos;
}

test("CRC-32 conocido: el de \"123456789\" es CBF43926", () => {
  expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
});

test("el zip se puede volver a leer y cada archivo trae su CRC correcto", () => {
  const enc = new TextEncoder();
  const bytes = zip([
    { nombre: "a.txt", datos: enc.encode("hola") },
    { nombre: "carpeta/ñandú.xml", datos: enc.encode("<x>á</x>") },
  ]);
  const archivos = leerZip(bytes);
  expect(archivos.map((a) => a.nombre)).toEqual(["a.txt", "carpeta/ñandú.xml"]);
  for (const a of archivos) expect(crc32(a.datos)).toBe(a.crc);
  expect(new TextDecoder().decode(archivos[1].datos)).toBe("<x>á</x>");
});

test("columnas de Excel: A, Z, AA, AZ, BA", () => {
  expect([0, 25, 26, 51, 52].map(columnaExcel)).toEqual(["A", "Z", "AA", "AZ", "BA"]);
});

test("nombres de hoja que Excel acepta: sin / ni [ ], 31 letras como mucho, sin repetir", () => {
  expect(nombresDeHoja(["Ventas 01/10", "Ventas 01/10", "x".repeat(40), ""])).toEqual([
    "Ventas 01 10",
    "Ventas 01 10 2",
    "x".repeat(31),
    "Hoja",
  ]);
});

test("el libro tiene las partes de un .xlsx, una hoja por pieza, y números como números", () => {
  const bytes = libroExcel([
    {
      nombre: "Lo más vendido",
      columnas: [
        { titulo: "Producto", tipo: "texto" },
        { titulo: "Unidades", tipo: "numero" },
        { titulo: "Vendido", tipo: "dinero" },
      ],
      filas: [
        ["Arroz grano largo 5kg", 1, 35],
        ["Café <Nescafé> & cía", 2, 1234.5],
      ],
    },
    { nombre: "Resumen", columnas: [{ titulo: "Dato", tipo: "texto" }, { titulo: "Valor", tipo: "texto" }], filas: [["Vista", "Prueba"]] },
  ]);
  writeFileSync(join(tmpdir(), "vendfy-vista-prueba.xlsx"), bytes);

  const archivos = leerZip(bytes);
  expect(archivos.map((a) => a.nombre)).toEqual([
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
    "xl/worksheets/sheet1.xml",
    "xl/worksheets/sheet2.xml",
  ]);
  const hoja = new TextDecoder().decode(archivos[5].datos);
  // El monto va como número con el estilo de plata, no como texto.
  expect(hoja).toContain('<c r="C3" s="2"><v>1234.5</v></c>');
  // El texto se escapa: un "<" en un nombre no rompe el XML.
  expect(hoja).toContain("Café &lt;Nescafé&gt; &amp; cía");
  expect(new TextDecoder().decode(archivos[2].datos)).toContain('<sheet name="Lo más vendido" sheetId="1" r:id="rId1"/>');
});
