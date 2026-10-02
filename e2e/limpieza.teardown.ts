import { existsSync, readFileSync } from "node:fs";

import { test as teardown } from "@playwright/test";

import { ARCHIVO_INICIO } from "./helpers/env";
import { limpiarConversaciones } from "./helpers/mock";

/**
 * Después de toda la corrida: borra las conversaciones de la tienda de prueba
 * que se guardaron durante ella (G5). Las de antes de la corrida no se tocan.
 */
teardown("borrar las conversaciones que crearon las pruebas", async ({ request }) => {
  if (!existsSync(ARCHIVO_INICIO)) return;
  await limpiarConversaciones(request, new Date(readFileSync(ARCHIVO_INICIO, "utf8").trim()));
});
