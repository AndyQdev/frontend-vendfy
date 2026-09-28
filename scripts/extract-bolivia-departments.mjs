/**
 * Genera `src/features/dashboard/ui/daily-tower/bolivia-departments.ts`.
 *
 * Fuente: Natural Earth `ne_10m_admin_1_states_provinces` (dominio público,
 * https://www.naturalearthdata.com/about/terms-of-use/). Se descarga aparte:
 *
 *   curl -L -o /tmp/bo-admin1.json \
 *     https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
 *   node scripts/extract-bolivia-departments.mjs /tmp/bo-admin1.json
 *
 * El archivo original pesa 40 MB y trae el mundo entero. Acá se recorta a los 9
 * departamentos de Bolivia y se simplifica cada contorno, porque el mapa del
 * dashboard se dibuja en un lienzo chico: más detalle no se ve y sí se paga.
 */

import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = process.argv[2] ?? "/tmp/bo-admin1.json";

/**
 * El mismo archivo va a los dos paquetes: el frontend lo usa para dibujar el
 * mapa y el backend para decidir a qué departamento pertenece cada venta. Es
 * dato generado, no código: se regenera, no se edita.
 */
const OUTPUTS = [
  "src/features/dashboard/ui/daily-tower/bolivia-departments.ts",
  "../ventas-service/src/inventory/lib/bolivia-departments.ts",
];

/** Tolerancia de simplificación en grados. ~0.02° ≈ 2 km. */
const TOLERANCE = 0.02;
/** Anillos más chicos que esto se descartan: son islas y ruido de frontera. */
const MIN_RING_POINTS = 12;

function perpendicularDistance(point, start, end) {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);

  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + clamped * dx), y - (y1 + clamped * dy));
}

/** Douglas-Peucker. */
function simplify(points, tolerance) {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let index = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(
      points[i],
      points[0],
      points[points.length - 1],
    );
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance <= tolerance) {
    return [points[0], points[points.length - 1]];
  }

  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(area / 2);
}

const geojson = JSON.parse(readFileSync(SOURCE, "utf8"));
const features = geojson.features.filter(
  (feature) => feature.properties.admin === "Bolivia",
);

if (features.length !== 9) {
  console.warn(`Se esperaban 9 departamentos y llegaron ${features.length}.`);
}

const departments = features
  .map((feature) => {
    const { name, iso_3166_2: iso } = feature.properties;
    const geometry = feature.geometry;
    const polygons =
      geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

    // Sólo el anillo exterior de cada polígono; los huecos no aportan a 3 cm
    // de alto en pantalla y duplicarían los vértices.
    const rings = polygons
      .map((polygon) => polygon[0])
      .filter((ring) => ring.length >= MIN_RING_POINTS)
      .map((ring) => simplify(ring, TOLERANCE))
      .filter((ring) => ring.length >= 4)
      .sort((a, b) => ringArea(b) - ringArea(a))
      // Con el contorno principal alcanza: las islas fluviales sólo hacen ruido.
      .slice(0, 1);

    return {
      code: (iso ?? "").replace("BO-", ""),
      name,
      rings: rings.map((ring) =>
        ring.map(([lng, lat]) => [
          Number(lng.toFixed(4)),
          Number(lat.toFixed(4)),
        ]),
      ),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

const totalPoints = departments.reduce(
  (sum, department) =>
    sum + department.rings.reduce((count, ring) => count + ring.length, 0),
  0,
);

const file = `/**
 * Contornos de los 9 departamentos de Bolivia, simplificados.
 *
 * Generado por \`scripts/extract-bolivia-departments.mjs\` a partir de Natural
 * Earth \`ne_10m_admin_1_states_provinces\` (dominio público). No editar a mano:
 * volvé a correr el script si hace falta más o menos detalle.
 *
 * Total de vértices: ${totalPoints}
 */

export interface DepartmentShape {
  /** Código ISO 3166-2 sin el prefijo del país, por ejemplo \`S\` para Santa Cruz. */
  code: string;
  name: string;
  /** Anillos exteriores en [longitud, latitud]. */
  rings: Array<Array<[number, number]>>;
}

export const BOLIVIA_DEPARTMENTS: DepartmentShape[] = ${JSON.stringify(
  departments,
  null,
  2,
)};
`;

for (const output of OUTPUTS) {
  writeFileSync(output, file);
  console.log(`${departments.length} departamentos, ${totalPoints} vértices → ${output}`);
}
for (const department of departments) {
  console.log(
    `  ${department.code.padEnd(3)} ${department.name.padEnd(14)} ${department.rings[0]?.length ?? 0} pts`,
  );
}
