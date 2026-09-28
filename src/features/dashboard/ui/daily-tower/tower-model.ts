/**
 * Geometría y datos del mapa de Bolivia del dashboard.
 *
 * Este archivo es puro: no importa React ni Three.js. Todo lo que decide cuánto
 * se eleva cada departamento, cómo se proyectan las coordenadas y qué se dibuja
 * cuando no hay ventas vive acá, para poder razonarlo sin montar una escena.
 */

import { BOLIVIA_DEPARTMENTS } from "./bolivia-departments";

export interface DepartmentSales {
  code: string;
  name: string;
  sales: number;
  count: number;
}

/** Un departamento listo para extruir, en unidades de escena. */
export interface DepartmentShapeData {
  code: string;
  name: string;
  sales: number;
  count: number;
  /** Contorno proyectado al plano XZ, centrado en el origen. */
  outline: Array<[number, number]>;
  /** Altura de la extrusión. */
  height: number;
  /** 0 a 1 respecto del departamento que más vendió; tiñe el relleno. */
  intensity: number;
  /** Porcentaje sobre el total del período. */
  share: number;
  /** Centro del departamento, para colgar la etiqueta. */
  centroid: [number, number];
}

export interface MapLayout {
  departments: DepartmentShapeData[];
  total: number;
  /** true cuando no hay ventas en ningún departamento. */
  isEmpty: boolean;
}

/**
 * Rampa secuencial de un solo tono: más verde y más oscuro es más dinero. Cuatro
 * paradas en vez de dos porque con dos, ocho departamentos flojos terminaban
 * pintados casi del mismo color y el mapa no decía nada.
 *
 * Vive acá y no en la escena para que el fallback plano use exactamente la misma
 * rampa sin tener que importar nada de Three.js.
 */
export const SALES_RAMP = ["#A7F3D0", "#34D399", "#10B981", "#047857"];

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Color de la rampa para una intensidad de 0 a 1, como cadena CSS. */
export function rampColor(intensity: number): string {
  const clamped = Math.max(0, Math.min(1, intensity));
  const position = clamped * (SALES_RAMP.length - 1);
  const index = Math.min(SALES_RAMP.length - 2, Math.floor(position));
  const t = position - index;

  const start = hexToRgb(SALES_RAMP[index]);
  const end = hexToRgb(SALES_RAMP[index + 1]);
  const mix = start.map((channel, i) => Math.round(channel + (end[i] - channel) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

/** Ancho del mapa en unidades de escena. La altura sale de la proporción real. */
const MAP_WIDTH = 4.2;
/** Relieve mínimo: un departamento sin ventas igual se ve, no desaparece. */
const BASE_HEIGHT = 0.06;
/** Relieve máximo del departamento que más vendió. */
const MAX_HEIGHT = 1.15;
/**
 * Cuánto se encoge cada departamento hacia su centro. Deja una ranura fina entre
 * vecinos: sin esto el país se lee como una mancha sola y no como nueve piezas.
 */
const SHRINK = 0.986;

/** Recuadro que encierra a Bolivia, calculado una vez con los contornos reales. */
const BOUNDS = (() => {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const department of BOLIVIA_DEPARTMENTS) {
    for (const ring of department.rings) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  return { minLng, maxLng, minLat, maxLat };
})();

/**
 * Proyección equirectangular corregida por la latitud media. A la escala de un
 * país no se nota la diferencia con una proyección seria, y evita el achatado
 * que se ve si se usan los grados crudos.
 */
const LAT_CENTER = (BOUNDS.minLat + BOUNDS.maxLat) / 2;
const LNG_SPAN = (BOUNDS.maxLng - BOUNDS.minLng) * Math.cos((LAT_CENTER * Math.PI) / 180);
const SCALE = MAP_WIDTH / LNG_SPAN;

/**
 * Devuelve el punto en el plano de la figura, con el norte en +Y.
 *
 * La escena apoya esa figura girándola -90° sobre X, con lo que +Y pasa a -Z, o
 * sea al fondo de la escena. Así el norte queda arriba en pantalla. El SVG del
 * fallback invierte la Y por su cuenta, porque ahí el eje crece hacia abajo.
 */
export function project(lng: number, lat: number): [number, number] {
  const x = (lng - (BOUNDS.minLng + BOUNDS.maxLng) / 2) * Math.cos((LAT_CENTER * Math.PI) / 180);
  return [x * SCALE, (lat - LAT_CENTER) * SCALE];
}

/** Alto del mapa proyectado, para encuadrar la cámara. */
export const MAP_DEPTH = (BOUNDS.maxLat - BOUNDS.minLat) * SCALE;
export { MAP_WIDTH };

function centroidOf(outline: Array<[number, number]>): [number, number] {
  let x = 0;
  let y = 0;
  for (const [px, py] of outline) {
    x += px;
    y += py;
  }
  return [x / outline.length, y / outline.length];
}

export function buildMapLayout(sales: DepartmentSales[]): MapLayout {
  const byCode = new Map(sales.map((item) => [item.code, item]));
  const total = sales.reduce((sum, item) => sum + item.sales, 0);
  const max = sales.reduce((best, item) => Math.max(best, item.sales), 0);

  const departments = BOLIVIA_DEPARTMENTS.map((department) => {
    const data = byCode.get(department.code);
    const amount = data?.sales ?? 0;
    const intensity = max > 0 ? amount / max : 0;
    const projected = (department.rings[0] ?? []).map(([lng, lat]) => project(lng, lat));
    const center = centroidOf(projected);
    // Encoger hacia el centro es lo que abre la ranura entre departamentos.
    const outline = projected.map(
      ([x, y]) =>
        [
          center[0] + (x - center[0]) * SHRINK,
          center[1] + (y - center[1]) * SHRINK,
        ] as [number, number],
    );

    return {
      code: department.code,
      name: data?.name ?? department.name,
      sales: amount,
      count: data?.count ?? 0,
      outline,
      // Raíz cuadrada: con un solo departamento vendiendo, una escala lineal deja
      // a los otros ocho pegados al piso y el mapa se ve roto.
      height: BASE_HEIGHT + Math.sqrt(intensity) * MAX_HEIGHT,
      intensity,
      share: total > 0 ? (amount / total) * 100 : 0,
      centroid: center,
    };
  });

  return {
    departments,
    total,
    isEmpty: total <= 0,
  };
}

/** Departamentos con ventas, del que más vendió al que menos. */
export function rankedDepartments(layout: MapLayout): DepartmentShapeData[] {
  return layout.departments
    .filter((department) => department.sales > 0)
    .sort((a, b) => b.sales - a.sales);
}
