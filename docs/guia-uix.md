# Vendfy — Guía de UI/UX

Referencia del rediseño de septiembre de 2026. La imagen aprobada está en
`docs/redising/image.png` y el pedido completo en `docs/redising/instrucciones.md`.
El sistema general (radios, sombras, reglas) sale de `C:\Trabajos\infraestructura\uix`;
esto es lo propio de Vendfy.

---

## 1. Decisiones de estructura

| Decisión | Qué se aplicó |
| --- | --- |
| Fondo | Plano `#F3F5F7`. Se eliminó el Liquid Glass (vidrio, blur, fondo beige con radiales). |
| Navegación | Arriba, en tres burbujas. **No hay barra lateral.** |
| Rutas | Todas en un carril que se desplaza de costado. Sin menú "Más". Orden en `widgets/app-header/model/routes.ts`. |
| Teléfono | El header se parte en dos filas y el carril se desliza con el dedo. No hay hamburguesa de rutas. |
| Scroll | Uno solo, el de la página. Header `sticky` arriba; el campo del asistente `sticky` abajo. |

## 2. Color

| Token | Valor | Para qué |
| --- | --- | --- |
| `--background` | `#F3F5F7` | Fondo de página |
| `--card` | `#FFFFFF` | Tarjetas, burbujas, campos |
| `--tinta` | `#0F172A` | Bloque de marca, ruta activa, píldoras oscuras |
| `--primary` | `#0E7490` | Botón principal, foco, enlaces (5,4:1 con blanco) |
| `--acento` | `#06B6D4` | Puntos, festón, barras, checks. **Nunca con texto encima** (2,4:1) |
| `--primary-soft` | `#E6F4F7` | Globo del usuario, fondos suaves |
| `--border` | `#E3E8EE` | Bordes de tarjeta |
| `--input` | `#D8DEE6` | Bordes de campos y del botón secundario |

La escala `emerald-*` de Tailwind está **aliasada a la marca cian** y corrida un
paso hacia lo oscuro (`emerald-500` = `#0E7490`), porque 366 clases la escriben a
mano. Código nuevo: usar los tokens (`bg-primary`, `text-primary`), no `emerald`.

## 3. Tipografía

| Uso | Fuente |
| --- | --- |
| Título de pantalla (`.titulo-pagina`) | Sora 800, mayúsculas, 22 / 28 / 30 px |
| Interfaz | Plus Jakarta Sans, 13–14 px |
| Precios, stock, códigos, horas (`.cifra`) | JetBrains Mono |
| Etiquetas y cabeceras de tabla (`.etiqueta`) | 11 px, 700, mayúsculas espaciadas |

## 4. Forma y profundidad

Escala de radios (en `tailwind.config.js`, sobre las claves estándar para que
`tailwind-merge` resuelva conflictos): `rounded-md` 10 botones · `rounded-lg` 12
campos · `rounded-xl` 16 tarjetas · `rounded-2xl` 20 burbujas del header ·
`rounded-3xl` 24 modales.

Sombras: `shadow-sm/md` = tarjeta (casi invisible) · `shadow-lg/xl` = lo que
flota · `shadow-2xl` = modal. Cualquier `shadow-xl` viejo queda sobrio solo.

Nada se levanta al pasar el mouse. Los botones se oscurecen y se comprimen un
poco al presionar. Transiciones de 150 ms.

## 5. Header

```
[ Vendfy · ZENN · CIUDAD ]  [ Asistente  Inicio  Caja  Pedidos ③ … › ]  [ 🔔 🌐 | AR Andrés R. ]
    tinta, 56px, festón           blanca, se estira                        blanca
```

- El bloque de marca es el **selector de tienda**. Debajo cuelga el festón (el
  toldo): semicírculos de 8 px en el acento.
- Pedidos lleva el contador de pedidos por atender (`pendiente` + `por-confirmar`),
  de `usePendingOrdersCount`.
- La campana junta lo que espera al comerciante: pedidos, primeros pasos y el bot
  de WhatsApp sin conectar. **La guía de primeros pasos se abre desde ahí.**
- El tema claro/oscuro vive en el menú del perfil.
- El header publica su alto en `--alto-header`; Caja y el chat de WhatsApp lo
  restan para ocupar el alto justo.

## 6. Componentes de `shared/ui`

Todo lo que se dibuja sale de acá; no hay que escribir clases de color a mano.

- `Button` — `default` (principal), `outline` (secundario), `navy`, `soft`,
  `ghost`, `destructive`; prop `loading`.
- `Input`, `Textarea`, `SelectTrigger`, `NativeSelect` comparten
  `controlClasses` (`control.ts`): radio 12, borde `--input`, foco con halo.
- `Select` (Radix) y `NativeSelect` (un `<select>` real con la lista nuestra,
  portado de Cell Diagnostic) se ven idénticos. `NativeSelect` es para
  formularios con `register()`.
- `PageHeader` — título + contadores en cápsulas. Toda pantalla nueva empieza así.
- `Badge` — siempre en fondo suave: `success`, `warning`, `destructive`, `info`.

## 7. Asistente (`/omnibox`)

- Columna centrada de 880 px, sin tarjeta que la envuelva.
- Mensaje del usuario a la derecha, cian suave, hora y doble check.
- Respuesta: avatar de la tiendita + tarjeta blanca. La de acción tiene tres
  disposiciones: apilada en el teléfono, información en fila con botones abajo
  en tablet, todo en una fila en escritorio.
- Contadores: **HECHAS** y **EN ESPERA** de la conversación actual. No dicen
  "hoy" porque la conversación vive en memoria y se pierde al recargar.

## 8. Lo que quedó pendiente

- `features/dashboard/` y `pages/dashboard/` no se tocaron: estaban sin subir a
  git (trabajo en curso). Tienen un degradado en `DashboardIllustration.tsx`.
- Las pantallas viejas todavía usan `glass`, `glass-field`, `press`: ahora son
  alias planos (ver el final de `src/index.css`). Reemplazarlos cuando se toque
  cada pantalla.
- Las acciones principales de las pantallas viejas siguen arriba a la derecha
  (`PageHeader` acepta `actions` por eso). El lugar bueno es la fila de filtros.
- "Publicar en la web" y "link del producto", que aparecen en la imagen de
  referencia, no existen en el backend del asistente. No se inventaron tarjetas
  para acciones que el servidor no ejecuta.
