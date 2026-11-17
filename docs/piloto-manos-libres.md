# Piloto «Vendfy» y manos libres («Oye Vendfy»)

Un asistente tipo Siri que **maneja las pantallas reales** del panel: lleva a
la Caja, al Inventario, a Pedidos o al formulario de producto, lo llena frente
a la persona, señala lo que pregunta y hace lo pedido solo cuando dice «sí».
Se le habla con el botón **Vendfy** (abajo a la izquierda), con **F9** o, con
manos libres prendido, diciendo **«Oye Vendfy»**.

Rama `piloto-vendfy` (panel, backend y app de Android). **Todavía no está en
producción.**

## Qué hace hoy

| Pantalla | Ejemplo | Qué se ve |
|---|---|---|
| Caja | «vende 2 sprite y un agua» → «no» → «con QR» → «sí» | Carga el carrito, marca el total, el pago y el botón Cobrar; cobra con el sí |
| Inventario | «el stock de la sprite está mal, hay 30» · «arregla el stock: sprite 30, pepsi 30 y agua 40» | Escribe el producto en el buscador y marca la fila; con varios, tabla antes → después |
| Pedidos | «pasa el pedido 1630 a en camino» | Marca el pedido en el tablero y lo mueve con el sí (cancelar no: se toca) |
| Productos | «crea un producto galletas oreo a 8 bolivianos» | Llena el formulario real, pregunta lo que falta («¿Cuántas tienes?») y lo crea con el sí |
| Consultas | «¿a cuánto está el dólar?» | Lo dice sin cambiar de pantalla |

Lo que todavía no hace en pantalla (compras, delivery, cuotas, cambiar productos) lo deja abierto en el asistente.

## Cómo está armado

```
src/features/piloto/
  model/plan.ts          lo que entendió el servidor → qué hacer en qué pantalla
  model/respuestas.ts    «sí», «no», «con QR», «doce»… sin servidor
  model/use-piloto.ts    el conductor: escucha, lleva, llena, pregunta, confirma
  model/use-manos-libres.ts  prende/apaga el oído (preferencia del equipo)
  lib/estado.ts          estado + registro de pantallas (registrarPantalla)
  ui/PilotoVendfy.tsx    botón, tarjeta flotante, F9
  ui/FocoPiloto.tsx      marco que late + flecha al elemento (data-piloto)
  oido/                  «Oye Vendfy»: detector en un worker (onnxruntime-web),
                         corte de la frase y WAV para el servidor
src/shared/nativo/       puente con la app de Windows (Tauri) y la de Android
src-tauri/               la app de Windows (.exe)
herramientas/oye-vendfy/ cómo se entrena el detector
```

- Cada pantalla se presta al piloto mientras está montada (`registrarPantalla("caja" | "inventario" | "producto", api)`) y marca lo que se puede señalar con `data-piloto="caja:pago"`, `inventario:<productId>`, `pedido:<orderId>`, `producto:precio`…
- El servidor es el mismo intérprete del asistente (`/omnibox/interpretar` y `/omnibox/voz`). Nuevo en el backend: el ajuste de stock de varios (`entidades.lote`) y la verificación de la palabra (`palabra=1`).
- **Manos libres**: nada sale del equipo hasta que el detector oye la palabra. Entonces manda el audio con la palabra adelante; si Whisper no la encuentra, fue falsa alarma y se cierra solo.

## Las tres apps (como Claude: web, escritorio, celular)

Una sola aplicación, la web. Las otras dos la abren y suman lo nativo:

| | Carpeta | Agrega |
|---|---|---|
| Windows (.exe) | `src-tauri/` (Tauri 2) | Bandeja del reloj, arranca con Windows, F9 desde cualquier programa, cerrar = esconder, trae la ventana al frente al oír la palabra |
| Android (.apk) | repo `vendfy-app`, rama `piloto-vendfy` (Expo + WebView) | Micrófono y cámara con el permiso del sistema, pantalla encendida con manos libres, «atrás» dentro del panel |

```bash
# Windows, contra el panel local
VENDFY_URL=http://localhost:5173 npx tauri dev     # o cargo build en src-tauri
npx tauri build                                      # instalador NSIS
```

## Pruebas

```bash
npm run test:logic                                   # piloto, respuestas, oído (253)
E2E_API_URL=http://localhost:3913 npx playwright test e2e/flows/piloto.spec.ts   # 8: Caja, Inventario, Pedidos, Productos
E2E_API_URL=http://localhost:3913 npx playwright test -c playwright.voz.config.ts # «Oye Vendfy» con micrófono simulado
```

Las de punta a punta dejan la tienda de prueba como estaba (anulan la venta, devuelven el stock, dan de baja el producto).

## Pendiente

- **El detector**: la v1 acierta 93 % pero dispara de más con música y tele. La v2 (con MUSAN) está en entrenamiento. Hasta entonces manos libres queda apagado por defecto.
- Android con la pantalla apagada (servicio nativo de micrófono).
- El instalador .exe firmado (sin firma, Windows muestra «editor desconocido»).
- Desplegar: backend (con `GEMINI_BASE_URL` de Vertex y `VOZ_TTS_API_KEY`) y después el panel.
