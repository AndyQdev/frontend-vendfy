Quiero que implementes/rediseñes la pantalla ASISTENTE de Vendfy para que replique lo más fielmente posible la UI de la referencia aprobada que te adjunto.

PROYECTO
C:\Trabajos\Ecommerce\ecommerce-frontend

RUTA
/omnibox

IMPORTANTE
No quiero una reinterpretación ni otro diseño.
Quiero replicar esta UI aprobada y adaptarla correctamente a desktop y mobile.

La referencia visual aprobada es la imagen donde aparecen:
- Desktop grande a la izquierda.
- Mobile a la derecha.
- Header superior de Vendfy.
- Navegación horizontal por módulos.
- Chat operativo con tarjetas.
- Estética clara, blanca, azul marino y cian.

Antes de modificar código:
1. Inspeccioná cómo está construida actualmente /omnibox.
2. Identificá componentes reutilizables del proyecto.
3. Identificá el sistema actual de rutas.
4. Identificá los estilos globales, iconos y fuentes.
5. No rompas funcionalidad existente.
6. Reutilizá componentes cuando tenga sentido, pero no sacrifiques fidelidad visual.
7. No toques backend ni lógica de negocio que no sea necesaria para este rediseño.

==================================================
1. OBJETIVO VISUAL GENERAL
==================================================

La pantalla debe sentirse como una aplicación SaaS de retail real, construida por un equipo de producto.

NO usar:
- degradados
- glassmorphism
- blur decorativo
- glow
- neón
- auroras
- fondos artificiales
- elementos flotantes decorativos
- estrellas
- íconos de “magia”
- exceso de sombras
- transparencias innecesarias

Quiero una interfaz PLANA, CLARA, LIMPIA y MUY CUIDADA.

PALETA PRINCIPAL

--background: #F3F5F7;
--surface: #FFFFFF;
--navy: #0F172A;
--cyan-dark: #0E7490;
--cyan: #06B6D4;
--cyan-soft: #E6F4F7;
--border: #E3E8EE;
--text-primary: #0F172A;
--text-secondary: #64748B;
--success: #16A36A aproximadamente;
--warning: #F59E0B;
--danger: #EF4444;

No agregues otros colores fuertes si no son necesarios.

==================================================
2. ESTRUCTURA GENERAL DE /omnibox
==================================================

La pantalla debe seguir aproximadamente esta jerarquía:

AssistantPage
 ├── AppHeader
 │    ├── BrandBlock
 │    ├── NavigationRail
 │    └── HeaderActions
 │
 └── MainContent
      ├── PageHeading
      │    ├── "ASISTENTE"
      │    └── StatsCounters
      │
      └── ChatWorkspace
           ├── Conversation
           │    ├── UserMessage
           │    ├── ProductActionCard
           │    ├── SuccessCard
           │    ├── UserMessage
           │    ├── ProductPublishCard
           │    ├── SuccessCard
           │    ├── UserMessage
           │    ├── PermissionCard
           │    ├── UserMessage
           │    └── ProductLinkCard
           │
           └── ChatComposer

No construyas todo dentro de un único componente gigantesco.
Separá responsabilidades.

==================================================
3. LAYOUT DESKTOP
==================================================

BREAKPOINT PRINCIPAL DESKTOP:
>= 1024px

Referencia ideal:
1440px de ancho.

BODY / PAGE

background:
#F3F5F7

El contenido debe ocupar prácticamente todo el ancho disponible.

Padding exterior aproximado:
24px desktop.

La página debe tener:
- header arriba
- contenido debajo
- chat centrado
- input del chat pegado visualmente a la parte inferior de su área

NO debe aparecer sidebar lateral en esta pantalla.

==================================================
4. HEADER DESKTOP
==================================================

Esta parte es MUY IMPORTANTE.

Quiero una cabecera similar conceptualmente a Cell Diagnostic:
NO una única barra rectangular.

Debe estar formada por TRES BLOQUES visualmente separados:

[ MARCA ]   [ NAVEGACIÓN CENTRAL ]   [ ACCIONES/PERFIL ]

Cada bloque:
- fondo blanco, salvo bloque de marca que será navy
- border-radius grande
- borde fino
- sombra muy suave
- altura visual similar
- alineados horizontalmente

HEADER CONTAINER

display: flex;
align-items: center;
gap: aproximadamente 12px;
width: 100%;

No hagas que todo sea una única navbar gigante.

--------------------------------------------------
4.1 BLOQUE DE MARCA
--------------------------------------------------

Posición:
esquina superior izquierda.

Ancho aproximado:
180-200px.

Altura:
50-56px.

Fondo:
#0F172A

Border radius:
18-20px.

Contenido horizontal:
[ icono tienda ] [ textos ]

Icono:
pequeña tienda/toldo Vendfy.

Texto principal:
Vendfy

Texto secundario:
ZENN · TIENDA CENTRAL

Vendfy:
blanco, semibold/bold.

Subtexto:
blanco con opacidad aproximada 65-75%.

Debajo del bloque debe existir el pequeño detalle de toldo/festón.

IMPORTANTE:
el festón debe ser MUY sutil.

Puede implementarse:
- con pseudo-elemento CSS
- SVG pequeño
- una secuencia de semicírculos

NO quiero un gran adorno.

Debe sentirse como la terminación inferior del toldo de una tienda.

Este es prácticamente el único elemento decorativo característico de Vendfy.

--------------------------------------------------
4.2 NAVEGACIÓN CENTRAL
--------------------------------------------------

Debe ocupar el espacio central disponible.

Fondo:
#FFFFFF

Border:
1px solid #E3E8EE

Border radius:
18-20px.

Altura:
50-56px.

Padding horizontal:
10-14px.

display:flex;
align-items:center;

Cada opción debe contener:

[ ICONO ] Texto

Icono:
lineal / outline
aprox 16px.

Texto:
aprox 13-14px.

Rutas, EN ESTE ORDEN:

Asistente
Inicio
Caja
Pedidos
Ventas
Productos
Inventario
Compras
Clientes
WhatsApp

Pedidos:
badge rojo pequeño:
3

Asistente:
estado activo.

ACTIVO:
background: #0F172A
color: white
border-radius: 12-14px
padding horizontal aprox 12px
height aprox 36px.

Icono también blanco.

NO activo:
fondo transparente.
texto navy o gris oscuro.
hover muy sutil #F3F5F7.

WhatsApp puede tener el icono verde de WhatsApp si ya existe en el proyecto.

NO usar tabs enormes.

Debe sentirse compacto.

--------------------------------------------------
4.3 BLOQUE DERECHO
--------------------------------------------------

Desktop:
a la derecha del header.

Debe incluir:

[ campana ] [ idioma/globo ] [ avatar + usuario ]

Contenedor:
blanco
border 1px
border-radius 18-20px
height igual al resto del header.

Campana:
botón circular.
Si hay notificación:
puntito rojo pequeño.

Idioma:
botón circular con icono de globo.

Perfil:
avatar circular con iniciales:
AR

Texto:
Andrés R.
Propietario

Chevrón para dropdown.

NO hagas el bloque exageradamente ancho.

==================================================
5. TÍTULO DE PÁGINA
==================================================

Debajo del header.

Separación superior:
aprox 20-24px.

display:flex;
justify-content:space-between;
align-items:center;

IZQUIERDA:

ASISTENTE

Debe ser:
uppercase
navy
bold
aprox 28-32px desktop.

No usar un título gigantesco.

DERECHA:

dos contadores pequeños:

4 HECHAS HOY
1 ESPERA

Cada uno dentro de una cápsula/card mínima:
white
border 1px
border-radius 12px.

Número:
más grande y semibold/bold.

Etiqueta:
pequeña y uppercase.

Ejemplo visual:

[ 4 | HECHAS HOY ]  [ 1 | ESPERA ]

==================================================
6. ÁREA PRINCIPAL DEL CHAT DESKTOP
==================================================

El chat NO debe ocupar todo el ancho.

Quiero una columna central:

max-width:
aprox 860px a 900px.

width:
100%.

margin:
0 auto.

Debe existir bastante aire a ambos lados en escritorio.

Separación desde el título:
16-24px.

No encerrar todo el chat dentro de una gran tarjeta.

El fondo general continúa siendo #F3F5F7.

Las tarjetas individuales son las que deben ser blancas.

==================================================
7. MENSAJES DEL USUARIO
==================================================

Alineados a la derecha.

Ancho:
auto
max-width aprox 60-65%.

En mobile puede crecer hasta 85-90%.

Fondo:
#E6F4F7.

Border:
1px solid un cian muy suave.

Border radius:
aprox 14px.

Padding:
10-14px.

Texto:
#0F172A
13-14px.

En la parte derecha/inferior:
hora
doble check.

Hora:
11px
gris.

Checks:
cian.

Ejemplo:

Actualizá el stock de Sauvage a 32 unidades
                          10:24 ✓✓

NO hacer globos gigantes.

==================================================
8. IDENTIDAD DEL ASISTENTE
==================================================

Cada respuesta del asistente puede llevar a su izquierda un pequeño avatar/icono.

Debe ser:
- círculo o rounded square
- fondo cyan muy claro
- pequeño icono de tienda Vendfy en cian oscuro

Tamaño aproximado:
30-34px.

Debe mantener alineación superior con la tarjeta.

En mobile:
24-30px.

==================================================
9. TARJETA DE ACTUALIZAR STOCK
==================================================

Desktop:

Una sola tarjeta horizontal.

Fondo:
white.

Border:
1px solid #E3E8EE.

Border-radius:
14-16px.

Shadow:
MUY sutil.

Padding:
12-16px.

Estructura aproximada:

[ foto + información ] | [ stock actual → stock nuevo ] | [ botones ]

--------------------------------------------------
PRODUCTO
--------------------------------------------------

Imagen:
64x64 aproximadamente.
border-radius 10px.
object-fit cover.

A la derecha:

Sauvage
Perfume 100 ml · Dior
SKU: SAU-100
Bs 240,00

Nombre:
semibold.

Descripción y SKU:
texto secundario.

Precio:
más oscuro.
semibold/bold.
monoespaciado si existe una fuente apropiada.

--------------------------------------------------
STOCK
--------------------------------------------------

Stock actual
12 un

→

Nuevo stock
32 un

32 un:
#0E7490
bold.

Labels:
11-12px.
gris.

Valores:
15-18px.

--------------------------------------------------
ACCIONES
--------------------------------------------------

Actualizar stock
Cancelar

Primary:

background #0E7490
color white
height ~38px
radius ~8-10px.

Secundario:

background white
border #D8DEE6
text navy.

Botones NO demasiado altos.

==================================================
10. TARJETA "LISTO"
==================================================

Tarjeta compacta.

Icono:
círculo verde con check.

A la derecha:

Listo
El stock de Sauvage se actualizó correctamente a 32 unidades.

Título:
semibold.

Descripción:
gris oscuro.

Hora:
alineada a la derecha.

Debe ser bastante más baja que una ProductActionCard.

==================================================
11. TARJETA PUBLICAR PRODUCTO
==================================================

Producto:

Remera Básica
Algodón · Negra · Talle M
SKU: REM-BAS-M
Bs 80,00

Imagen:
remera negra.

Zona central:

Publicar en la web

Toggle:
ON.

Botones:

Publicar ahora
Cancelar

Mismo lenguaje visual del resto.

NO usar switches giganteses.

==================================================
12. TARJETA SIN PERMISO
==================================================

Compacta.

Icono circular amarillo/ámbar con candado.

Texto:

No tenés permiso

Solo los administradores pueden eliminar productos.
Si necesitás hacerlo, pedile a un administrador de la tienda.

Título:
navy
semibold.

Candado:
ámbar.

Nada de un gran alert amarillo.

Debe integrarse al mismo sistema visual.

==================================================
13. TARJETA LINK DEL PRODUCTO
==================================================

Producto a la izquierda:

Sauvage
Perfume 100 ml · Dior
SKU: SAU-100
Bs 240,00

A la derecha:

Link de la tienda online

Campo visual:
https://tienda.vendfy.com/productos/sauvage

Botón pequeño de copiar.

Debajo:

Stock actual
32 un

Estado web
● Publicado

Categoría
Perfumes

"Publicado":
verde suave.

==================================================
14. COMPOSER / INPUT DEL CHAT
==================================================

Debe quedarse visible en la parte inferior.

Desktop:
sticky dentro del viewport/contenedor.

Mobile:
también sticky/fijo visualmente abajo.

NO debe tapar mensajes.

La conversación debe tener padding-bottom suficiente para que el último mensaje no quede detrás del input.

Contenedor:

white
border 1px solid #E3E8EE
border-radius 18-22px.

Altura desktop:
48-52px.

Contenido:

[ adjuntar ] Escribí o dictá lo que necesitás      [ micrófono ][ cámara ]

Placeholder:
gris.

Micrófono y cámara:
botones circulares pequeños.

NO agregues botón de enviar enorme si no existe en el diseño aprobado.

==================================================
15. MOBILE
==================================================

BREAKPOINT PRINCIPAL:
<= 768px

Referencia:
390px de ancho.

ESTA PARTE ES CRÍTICA.

No quiero convertir la navegación en un menú hamburguesa normal.

Una de las cosas que más me gusta de la referencia móvil es que:

EL HEADER Y LAS RUTAS SE MANTIENEN VISIBLES,
Y EL USUARIO PUEDE DESPLAZAR LAS RUTAS CON EL DEDO HORIZONTALMENTE.

==================================================
16. HEADER MOBILE
==================================================

En mobile el header se divide en DOS FILAS.

FILA 1:

[ marca Vendfy ]                       [ campana ] [ menú/perfil ]

La marca debe seguir siendo visible.

NO reemplazar la marca por un simple logo.

Brand block:
aprox 160-170px ancho.
height ~48px.

Debe conservar:
Vendfy
ZENN · TIENDA CENTRAL
festón inferior.

A la derecha:
botones circulares.

Puede ocultarse el nombre completo del usuario para ahorrar espacio.

--------------------------------------------------
FILA 2:
NAV HORIZONTAL DESLIZABLE
--------------------------------------------------

Debajo:

Asistente | Inicio | Caja | Pedidos | Ventas | Productos | Inventario ...

IMPORTANTE:

NO WRAP.

Debe mantenerse en UNA SOLA FILA.

Implementar por ejemplo:

overflow-x: auto;
overflow-y: hidden;
white-space: nowrap;
display: flex;
flex-wrap: nowrap;
-webkit-overflow-scrolling: touch;
scroll-behavior: smooth;

Ocultar scrollbar visual:
scrollbar-width: none;

::-webkit-scrollbar {
  display: none;
}

El usuario debe poder desplazar las opciones con el dedo.

No quiero flechas obligatorias.

No quiero que las opciones bajen a una segunda línea.

No quiero que todas se compriman hasta hacerse ilegibles.

Cada opción debe conservar su ancho natural.

La primera opción:
Asistente
permanece activa con fondo navy.

Debe existir un pequeño padding horizontal del rail.

El badge rojo de Pedidos sigue visible.

Si es posible, al entrar en la pantalla:
asegurate de que la ruta activa esté visible automáticamente usando scrollIntoView si hiciera falta.

==================================================
17. HEADER MOBILE STICKY
==================================================

Quiero que el encabezado se mantenga visible mientras se navega por el chat.

Idealmente:

position: sticky;
top: 0;
z-index alto;

Pero hacelo correctamente para evitar:
- superposiciones
- saltos
- contenido por debajo
- doble scroll extraño

El header completo puede ser sticky.

Fondo sólido:
#F3F5F7

Nada de backdrop-filter.

Al hacer scroll vertical:
el usuario sigue viendo:
- marca
- acceso rápido
- rail horizontal

==================================================
18. MOBILE: TÍTULO
==================================================

Debajo del rail:

ASISTENTE

Con los contadores a su derecha cuando entren.

Ideal:

ASISTENTE            [4 HECHAS HOY] [1 ESPERA]

Si el ancho es insuficiente:

usar una distribución flexible,
pero NO hacer que quede desordenado.

Título:
22-24px.

Counters:
mucho más compactos que desktop.

==================================================
19. MOBILE: CONVERSACIÓN
==================================================

Padding horizontal:
12-14px.

El chat ocupa casi todo el ancho.

Avatar asistente:
pequeño.

User message:
max-width ~88%.

Cards:
width: 100%.

Ya no deben intentar conservar layout horizontal de desktop.

DEBEN REORDENARSE VERTICALMENTE.

Ejemplo tarjeta stock mobile:

[ imagen ] Sauvage
           Bs 240,00

Stock: 12 → 32 un

[ Actualizar stock ]

[ Cancelar ]

El CTA principal puede ocupar:
width:100%.

Secondary:
width:100%.

Gap:
8px.

NO poner botones diminutos uno al lado del otro si perjudica lectura.

==================================================
20. MOBILE: TARJETAS DE PRODUCTO
==================================================

Imagen:
50-56px.

Nombre:
14px.

Precio:
14-15px bold.

Metadata:
11-12px.

Stock:
13px.

La información secundaria puede simplificarse visualmente,
pero NO eliminar información importante.

==================================================
21. MOBILE: INPUT INFERIOR
==================================================

Debe permanecer visible abajo.

Debe respetar safe area si aplica:

padding-bottom:
env(safe-area-inset-bottom);

El fondo de la zona inferior debe ser sólido.

No quiero que parezca un floating glass input.

Debe estar integrado al layout.

El input:
height aprox 46px.

Placeholder:
"Escribí o dictá lo que necesitás"

Puede truncarse correctamente si no entra.

Micrófono y cámara:
siempre visibles.

==================================================
22. RESPONSIVE INTERMEDIO
==================================================

No diseñes únicamente para:
390
y
1440.

Debe funcionar también aproximadamente en:

768
1024
1280
1366
1440
1920.

Entre 1024 y 1200:

si la navegación completa no entra,
permití scroll horizontal también en desktop/tablet antes que:
- reducir fuente demasiado
- ocultar rutas arbitrariamente
- quebrar en dos líneas

==================================================
23. TIPOGRAFÍA
==================================================

Usá la fuente que ya tenga Vendfy si es adecuada.

No agregar una fuente nueva sin necesidad.

Jerarquía aproximada:

Page title:
28-32px desktop
22-24px mobile

Card title:
14-15px semibold.

Body:
13-14px.

Metadata:
11-12px.

Price:
15-17px bold/semibold.

Navigation:
13px aprox.

Counters:
11-12px label.

Mantener buen line-height.

==================================================
24. BORDES Y SOMBRAS
==================================================

Quiero evitar el look "IA / Dribbble exagerado".

BORDES:
#E3E8EE.

SHADOW:

algo parecido a:

0 1px 2px rgba(15, 23, 42, 0.04),
0 6px 16px rgba(15, 23, 42, 0.04);

MUY suave.

No usar:
0 20px 50px rgba(...)

Nada flotando exageradamente.

==================================================
25. BORDER RADIUS
==================================================

Sistema coherente:

Header blocks:
18-20px.

Cards:
14-16px.

Buttons:
8-10px.

Inputs:
14-18px.

Small chips:
8-12px.

No hacer absolutamente TODO con 30px de radius.

==================================================
26. ICONOGRAFÍA
==================================================

Reutilizar la librería de iconos existente.

Preferencia:
outline/line icons.

Stroke consistente.

Tamaño navegación:
16px.

Acciones:
16-18px.

No mezclar:
filled
3D
emoji
line
duotone

Todo debe sentirse del mismo sistema.

==================================================
27. INTERACCIONES
==================================================

Preservar funcionalidad existente.

Añadir estados visuales:

hover
focus-visible
active
disabled

Botones principales:

hover:
oscurecer ligeramente #0E7490.

Nav item:
hover background #F3F5F7.

Cards:
NO levantar 10px en hover.

No quiero animaciones llamativas.

Transiciones:
120-180ms aprox.

==================================================
28. SCROLL DE LA PÁGINA
==================================================

Evitar múltiples scrollbars innecesarios.

Preferencia:

- página normal con scroll vertical
- header sticky
- composer sticky abajo

Si actualmente /omnibox funciona con un contenedor scroll interno,
podés conservarlo si técnicamente es mejor,
pero no debe existir scroll dentro de scroll incómodo.

En mobile debe sentirse natural al deslizar con el dedo.

Scroll horizontal:
SOLAMENTE el rail de navegación.

Scroll vertical:
conversación/página.

==================================================
29. ACCESIBILIDAD
==================================================

Usar botones reales para acciones.

Nav con elementos interactivos correctos.

aria-label cuando el botón solo tenga icono.

Focus visible.

Contraste adecuado.

Área táctil mobile:
mínimo aproximado 40x40px.

No sacrificar accesibilidad por copiar la imagen.

==================================================
30. COMPONENTES RECOMENDADOS
==================================================

Si encaja con la arquitectura actual, crear algo similar a:

components/assistant/
    AssistantHeader.tsx
    BrandBlock.tsx
    NavigationRail.tsx
    HeaderActions.tsx
    AssistantPageHeader.tsx
    Conversation.tsx
    UserMessage.tsx
    AssistantMessage.tsx
    ProductActionCard.tsx
    SuccessCard.tsx
    PermissionCard.tsx
    ProductLinkCard.tsx
    ChatComposer.tsx

No es obligatorio usar estos nombres exactos.

El objetivo es evitar un único archivo inmanejable.

==================================================
31. DATOS / CONFIGURACIÓN DE NAVEGACIÓN
==================================================

No hardcodear diez nav items repetidos manualmente.

Crear una configuración parecida a:

const routes = [
  {
    label: 'Asistente',
    icon: ...,
    href: '/omnibox'
  },
  {
    label: 'Inicio',
    icon: ...,
    href: ...
  },
  ...
];

El estado activo debe depender de la ruta actual.

Pedidos:
badgeCount: 3

==================================================
32. MUY IMPORTANTE: NO CAMBIAR EL RESTO DEL PANEL
==================================================

Estamos trabajando principalmente /omnibox.

No rediseñes:
Productos
Ventas
Inventario
Clientes
etc.

Solo reutilizá su lenguaje visual.

No hagas una migración completa del sistema visual sin pedirlo.

==================================================
33. FIDELIDAD A LA REFERENCIA
==================================================

Priorizá en este orden:

1. Composición general.
2. Header.
3. Navegación.
4. Espaciado.
5. Jerarquía visual.
6. Cards.
7. Mobile.
8. Microdetalles.

No inventes componentes que no aparecen en la referencia.

Si necesitás elegir entre:
“hacer algo más creativo”
o
“parecerse a la referencia”,

elegí SIEMPRE parecerse a la referencia.

==================================================
34. VALIDACIÓN DESKTOP
==================================================

Quiero verificar la vista a:

1440x900 aproximadamente.

Debe verse:

- header completo arriba
- marca a la izquierda
- nav central
- usuario derecha
- ASISTENTE debajo
- stats a la derecha
- conversación centrada
- mucho aire lateral
- input inferior
- sin sidebar
- sin degradados
- sin zonas oscuras grandes
- sin decoraciones innecesarias

==================================================
35. VALIDACIÓN MOBILE
==================================================

Probar específicamente:

390x844 aproximadamente.

Debe verse:

FILA 1:
Vendfy             campana  menú/perfil

FILA 2:
Asistente | Inicio | Caja | Pedidos → deslizable con dedo

Después:

ASISTENTE       4 hechas hoy  1 espera

Chat:

            mensaje usuario

[icon] [ tarjeta asistente ]

            mensaje usuario

[icon] [ tarjeta asistente ]

...

Input siempre accesible abajo.

MUY IMPORTANTE:
al deslizar horizontalmente la navegación,
NO debe desplazarse horizontalmente toda la página.

Solo el carril de navegación.

El body debe mantener:

overflow-x: hidden;

y el rail:

overflow-x: auto;

==================================================
36. DETALLE DE RESPONSIVE QUE NO DEBES ROMPER
==================================================

En desktop:
tarjetas de acciones pueden ser horizontales.

En mobile:
convertirlas a verticales.

Por ejemplo:

DESKTOP:

[PRODUCTO] [CAMBIO DE STOCK] [BOTONES]

MOBILE:

[PRODUCTO]
[CAMBIO DE STOCK]
[BOTÓN PRINCIPAL]
[BOTÓN SECUNDARIO]

No hacer simplemente scale-down del desktop.

Debe existir responsive real.

==================================================
37. RESULTADO QUE QUIERO
==================================================

Al terminar quiero sentir que:

- Productos y Asistente pertenecen al mismo Vendfy.
- Asistente tiene una identidad propia.
- Se entiende que Vendfy es una plataforma para tiendas.
- El header es memorable sin ser extravagante.
- En mobile se siente como una app real.
- El carril superior se puede mover naturalmente con el dedo.
- Todo sigue siendo funcional.
- No parece una landing page.
- No parece un concepto de Dribbble.
- No parece generado por IA.
- Parece software de producción.

==================================================
38. FLUJO DE TRABAJO
==================================================

Trabajá así:

FASE 1
Inspeccioná el código actual de /omnibox y componentes relacionados.

FASE 2
Decime brevemente qué archivos modificarás y qué componentes crearás/reutilizarás.

FASE 3
Implementá el rediseño completo.

FASE 4
Revisá:
- desktop
- tablet
- mobile 390px
- scroll horizontal nav
- header sticky
- composer
- overflow
- rutas
- botones
- estados

FASE 5
Corregí cualquier overflow horizontal accidental.

FASE 6
Entregame un resumen corto con:
- archivos modificados
- componentes creados
- cambios responsive
- cosas que dejaste intactas

NO te detengas después del análisis.
Quiero que después de inspeccionar implementes los cambios.



Asistente | Inicio | Caja | Pedidos | Ventas | Productos | ...
← deslizar con el dedo →


DESKTOP

┌───────────────┐ ┌──────────────────────────────────────────┐ ┌───────────────┐
│ 🏪 Vendfy     │ │ Asistente Inicio Caja Pedidos Ventas... │ │ 🔔 🌐 AR      │
│ ZENN · ...    │ │                                          │ │ Andrés R.     │
╰∪∪∪∪∪∪∪∪∪∪∪∪╯ └──────────────────────────────────────────┘ └───────────────┘


ASISTENTE                                         [4 HECHAS HOY] [1 ESPERA]


                                ┌───────────────────────────────┐
                                │ Actualizá el stock...   10:24 │
                                └───────────────────────────────┘

               ┌────────────────────────────────────────────────────────┐
          🏪   │ Sauvage       Stock actual → Nuevo stock      Acciones │
               │ Bs 240,00        12 un        32 un                    │
               └────────────────────────────────────────────────────────┘

          🏪   ┌────────────────────────────────────────────────────────┐
               │ ✅ Listo                                               │
               │ El stock se actualizó correctamente.                   │
               └────────────────────────────────────────────────────────┘


                    ┌──────────────────────────────────────────────────┐
                    │ Escribí o dictá lo que necesitás       🎙️  📷 │
                    └──────────────────────────────────────────────────┘


                    ┌──────────────────────────────────────────┐
│ 🏪 Vendfy                    🔔      ☰   │
│    ZENN · TIENDA CENTRAL                 │
╰∪∪∪∪∪∪∪∪∪∪∪╯
│ Asistente │ Inicio │ Caja │ Pedidos 3 │ →→→
────────────────────────────────────────────

ASISTENTE                  [4 HOY] [1 ESP.]

                 ┌────────────────────────┐
                 │ Actualizá el stock... │
                 │                 10:24 │
                 └────────────────────────┘

🏪 ┌─────────────────────────────────────┐
   │ [foto] Sauvage                     │
   │        Bs 240,00                    │
   │                                     │
   │ Stock: 12 → 32 un                   │
   │                                     │
   │ [       Actualizar stock          ] │
   │ [            Cancelar             ] │
   └─────────────────────────────────────┘

🏪 ┌─────────────────────────────────────┐
   │ ✅ Listo                            │
   │ Se actualizó correctamente.         │
   └─────────────────────────────────────┘


┌──────────────────────────────────────────┐
│ 📎 Escribí o dictá...          🎙️   📷 │
└──────────────────────────────────────────┘