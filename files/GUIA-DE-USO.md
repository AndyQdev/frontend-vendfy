# Vendfy Logo - Guía de Uso

## Archivos incluidos

| Archivo | Uso |
|---------|-----|
| `vendfy-icon.svg` | Ícono solo (tienda + sparkle IA) |
| `vendfy-logo-full.svg` | Logo completo: ícono + texto "Vendfy" |
| `vendfy-logo-white.svg` | Versión blanca para fondos oscuros |
| `favicon.svg` | Favicon optimizado para 16-48px |
| `VendfyLogo.jsx` | Componente React con todas las variantes |
| `export-pngs.html` | Abre este HTML para exportar PNGs a cualquier tamaño |

## Colores de marca

```
Esmeralda (cuerpo):     #10B981
Esmeralda oscuro:       #059669
Esmeralda claro:        #34D399  (sparkles)
Esmeralda muy claro:    #ECFDF5  (puerta)
Navy (toldo/marcos):    #0F172A
Navy medio:             #1E293B
```

## Cómo usar en React

### 1. Copiar el componente
Copia `VendfyLogo.jsx` a tu carpeta de componentes:
```
src/components/VendfyLogo.jsx
```

### 2. Importar y usar
```jsx
import { VendfyLogo, VendfyIcon } from './components/VendfyLogo';

// Logo completo (ícono + texto) - para header/navbar
<VendfyLogo variant="full" size={40} />

// Logo blanco - para footer oscuro
<VendfyLogo variant="full-white" size={40} />

// Solo ícono - para favicon, tabs, badges
<VendfyIcon size={32} />

// Con clases de Tailwind
<VendfyLogo variant="full" size={36} className="hover:opacity-80 transition" />
```

### 3. Ejemplo en Navbar
```jsx
<nav className="flex items-center justify-between px-6 py-4">
  <VendfyLogo variant="full" size={36} />
  {/* ... resto del nav */}
</nav>
```

### 4. Ejemplo en Footer oscuro
```jsx
<footer className="bg-slate-900 px-6 py-8">
  <VendfyLogo variant="full-white" size={32} />
</footer>
```

## Cómo usar como imagen SVG (sin React)

### En HTML directo
```html
<!-- Logo en el header -->
<img src="/images/vendfy-logo-full.svg" alt="Vendfy" height="40">

<!-- Ícono solo -->
<img src="/images/vendfy-icon.svg" alt="Vendfy" width="32" height="32">
```

### Como favicon
```html
<head>
  <!-- SVG favicon (navegadores modernos) -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  
  <!-- Apple touch icon (genera PNG de 180px con export-pngs.html) -->
  <link rel="apple-touch-icon" sizes="180x180" href="/vendfy-icon-180.png">
  
  <!-- PWA manifest icons -->
  <link rel="manifest" href="/manifest.json">
</head>
```

### manifest.json para PWA
```json
{
  "name": "Vendfy",
  "short_name": "Vendfy",
  "icons": [
    { "src": "/vendfy-icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/vendfy-icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#10B981",
  "background_color": "#ECFDF5"
}
```

## Cómo exportar PNGs

1. Abre `export-pngs.html` en tu navegador
2. Haz clic en "Descargar PNG" en cada tamaño que necesites
3. Tamaños incluidos: 512, 192, 180 (Apple), 128, 64, 32 (favicon)

## Inline SVG (copiar y pegar)

Si prefieres poner el SVG directamente en tu HTML/JSX:

```html
<!-- Ícono de la tienda Vendfy -->
<svg viewBox="0 0 120 120" fill="none" width="32" height="32">
  <rect x="13" y="48" width="82" height="58" rx="5" fill="#10B981"/>
  <rect x="8" y="34" width="92" height="16" rx="4" fill="#0F172A"/>
  <path d="M8 50 Q18 60,28 50 Q38 60,48 50 Q58 60,68 50 Q78 60,88 50 Q96 60,100 50" fill="#0F172A"/>
  <rect x="38" y="62" width="32" height="44" rx="5" fill="#0F172A"/>
  <rect x="41" y="65" width="26" height="41" rx="3.5" fill="#ECFDF5"/>
  <circle cx="61" cy="86" r="2.2" fill="#0F172A"/>
  <path d="M98 12 L101 22 L111 25 L101 28 L98 38 L95 28 L85 25 L95 22Z" fill="#34D399"/>
  <path d="M112 4 L114 9 L119 11 L114 13 L112 18 L110 13 L105 11 L110 9Z" fill="#34D399" opacity="0.5"/>
  <circle cx="84" cy="16" r="2" fill="#34D399" opacity="0.3"/>
</svg>
```

## Reglas de uso

- **Espacio mínimo**: Dejar al menos el 25% del ancho del ícono como espacio libre alrededor
- **Tamaño mínimo**: 16px para ícono, 24px de alto para logo completo
- **No distorsionar**: Mantener siempre la proporción original
- **Fondos claros**: Usar `vendfy-logo-full.svg` (texto navy)
- **Fondos oscuros**: Usar `vendfy-logo-white.svg` (texto blanco)
