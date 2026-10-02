/**
 * Configuración de las pruebas, en un solo lugar y con fallo temprano.
 *
 * Una variable que falta tiene que reventar acá con un mensaje que diga cuál,
 * y no diez minutos después como un `expect` que no encuentra un elemento
 * porque la app nunca pudo autenticarse.
 */

function requerida(nombre: string, porDefecto?: string): string {
  const valor = process.env[nombre] ?? porDefecto;
  if (!valor) {
    throw new Error(`Falta la variable ${nombre}. Definila en el entorno antes de correr los tests.`);
  }
  return valor;
}

/** Puerto de la app. El mismo de `npm run dev`: si ya está abierta, se reutiliza. */
export const PUERTO_APP = Number(process.env.E2E_PUERTO ?? 5173);

/**
 * Backend contra el que se prueba. 3099 porque el 3001 lo suele ocupar otro
 * proyecto en esta máquina. Para otro: `E2E_API_URL=http://localhost:3001`.
 */
export const API_URL = requerida("E2E_API_URL", "http://localhost:3099");

/**
 * Tienda de prueba: Abarrotes Don Juan, 24 productos con foto. Las pruebas
 * que venden o compran la dejan con el stock como estaba.
 */
export const COMERCIO_EMAIL = requerida("E2E_STORE_EMAIL", "juan@abarrotes.com");
export const COMERCIO_PASSWORD = requerida("E2E_STORE_PASSWORD", "12345678");
export const TIENDA = {
  id: requerida("E2E_STORE_ID", "86f9ea0a-312f-43ff-9416-54883661fddc"),
  name: "Abarrotes Don Juan",
  slug: "abarrotes-don-juan",
};

/** Cuándo empezó la corrida (lo escribe auth.setup): la limpieza del final borra lo creado desde ahí. */
export const ARCHIVO_INICIO = "e2e/.auth/inicio.txt";
