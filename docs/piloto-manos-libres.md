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
  ui/PilotoVendfy.tsx    la bola: en la esquina cerrada, al centro abierta, subtítulos, F9
  ui/OrbeMagico.tsx      la bola animada (late con tu voz y con la de Vendfy)
  ui/FocoPiloto.tsx      marco que late + flecha al elemento (data-piloto)
  oido/                  «Oye Vendfy»: detector en un worker (onnxruntime-web),
                         corte de la frase y WAV para el servidor
src/shared/nativo/       puente con la app de Windows (Tauri) y la de Android
src-tauri/               la app de Windows (.exe)
herramientas/oye-vendfy/ cómo se entrena el detector
```

- Cada pantalla se presta al piloto mientras está montada (`registrarPantalla("caja" | "inventario" | "producto", api)`) y marca lo que se puede señalar con `data-piloto="caja:pago"`, `inventario:<productId>`, `pedido:<orderId>`, `producto:precio`…
- El servidor es el mismo intérprete del asistente (`/omnibox/interpretar` y `/omnibox/voz`). Nuevo en el backend: el ajuste de stock de varios (`entidades.lote`) y la verificación de la palabra (`palabra=1`).
- **Cómo se ve**: cerrado es una bola en la esquina de abajo a la izquierda (gira sola con CSS; con manos libres, el halo respira). Al abrirse (F9, tocarla o «Oye Vendfy") suena una campana corta (`sonarActivacion`, osciladores en `shared/voz/sonidos.ts`) y la bola vuela al centro de abajo. Ahí late con el nivel del micrófono al escuchar y con el volumen real de la voz al hablar (`nivelVoz()`: la voz pasa por un `AnalyserNode` en `shared/voz/motor.ts`). Lo que dice sale como subtítulo y lo que dijiste, arriba en chico. Si lo que señala quedaría tapado, todo sube arriba. El teclado de la izquierda abre un campo para escribir (las pruebas usan `piloto-teclado` → `piloto-campo`). Al volver a escuchar tras una pregunta suena un toque corto (`sonarTurno`); al cerrar, `sonarCierre`.
- **Voz por defecto: Mateo** (`Algieba`, de hombre y grave). Lo guardado sin `vozElegida` pasa a Mateo; si la persona elige otra en Ajustes de voz, se respeta.
- **Manos libres**: nada sale del equipo hasta que el detector oye la palabra. Entonces manda el audio con la palabra adelante; si Whisper no la encuentra, fue falsa alarma y se cierra solo.

## Las tres apps (como Claude: web, escritorio, celular)

Una sola aplicación, la web. Las otras dos la abren y suman lo nativo. Hoy
abren **vendfy-panel.vercel.app** (cuenta de Vercel andyqdev): app.vendfy.shop
sigue en la cuenta pausada hasta que se verifique el dominio; sirven lo mismo.

| | Carpeta | Agrega |
|---|---|---|
| Windows (.exe) | `src-tauri/` (Tauri 2) | Bandeja del reloj, arranca con Windows, F9 desde cualquier programa, cerrar = esconder, trae la ventana al frente al oír la palabra (aunque esté minimizada) |
| Android (.apk) | repo `ecommerce-movil` (Expo + WebView + `modules/vendfy-oido`) | **Oído del teléfono**: servicio de micrófono con notificación que oye «Oye Vendfy» con la app en segundo plano o la pantalla apagada, enciende la pantalla y trae Vendfy al frente (con «Mostrar sobre otras apps»; si no, un aviso para tocar). Con el teléfono bloqueado no se muestra encima: se ve al desbloquear. Cámara, «atrás» dentro del panel |

El oído del teléfono corre el mismo detector y los mismos modelos del panel
(los baja de `/oido/` y los guarda para usar sin conexión). El panel lo usa por
`window.vendfyNativo.oido` (`src/features/piloto/oido/oido-telefono.ts`) y no
abre el micrófono del navegador; recibe "oyó la palabra" y "esto es lo que
dijo" por el evento `vendfy-oido`.

```bash
# Windows
VENDFY_URL=http://127.0.0.1:5173 npx tauri dev       # contra el panel local
npx tauri build --bundles nsis                         # instalador (1,9 MB)

# Android (en ecommerce-movil)
npm run apk                                            # APK de producción: solo ARM, ~60 MB
# De prueba en emulador, contra el panel local y con un WAV como micrófono:
EXPO_PUBLIC_VENDFY_URL=http://127.0.0.1:5173 EXPO_PUBLIC_OIDO_ARCHIVO=http://127.0.0.1:8765/android.wav npm run apk
```

## Pruebas

```bash
npm run test:logic                                   # piloto, respuestas, oído (253)
E2E_API_URL=http://localhost:3913 npx playwright test e2e/flows/piloto.spec.ts   # 8: Caja, Inventario, Pedidos, Productos
E2E_API_URL=http://localhost:3913 npx playwright test -c playwright.voz.config.ts # «Oye Vendfy» con micrófono simulado
```

Las de punta a punta dejan la tienda de prueba como estaba (anulan la venta, devuelven el stock, dan de baja el producto).

## Pendiente

- **app.vendfy.shop**: agregar en el DNS (Hostinger) el TXT `_vercel.vendfy.shop`
  que pide Vercel para pasar el dominio a la cuenta andyqdev.
- **El detector**: v3 oye la palabra el 92 % de las veces (86 % en medio de una
  conversación) con 1,7 falsas alarmas por hora (las descarta el servidor). Lo
  que más lo mejoraría: grabaciones reales de personas diciendo «Oye Vendfy».
- Firmar el instalador .exe (sin firma, Windows muestra «editor desconocido») y
  la APK con una llave propia (hoy usa la de depuración de Expo; para Play Store
  hace falta la propia).
