# VendfyLoader — Guía de uso

## Instalación

Copia `VendfyLoader.jsx` a tu proyecto:
```
src/components/VendfyLoader.jsx
```

## Props

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `theme` | `'light'` \| `'dark'` | `'dark'` | Tema del fondo |
| `size` | `number` | `56` | Tamaño del ícono en px |
| `message` | `string` | `''` | Texto opcional (ej: "Cargando productos...") |
| `fullscreen` | `boolean` | `true` | `true` = pantalla completa, `false` = inline |
| `className` | `string` | `''` | Clases CSS adicionales |

## Ejemplos de uso

### 1. Loader de página completa (transición entre páginas)
```jsx
import VendfyLoader from './components/VendfyLoader';

// En tu layout principal o router
function App() {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return <VendfyLoader theme="dark" message="Cargando..." />;
  }

  return <YourApp />;
}
```

### 2. Loader claro para páginas con fondo blanco
```jsx
<VendfyLoader theme="light" message="Preparando tu tienda..." />
```

### 3. Loader inline (dentro de una sección, no fullscreen)
```jsx
<div style={{ height: 400 }}>
  <VendfyLoader
    theme="light"
    fullscreen={false}
    size={40}
    message="Cargando productos..."
  />
</div>
```

### 4. Con React Router (transición entre páginas)
```jsx
import { useNavigation } from 'react-router-dom';
import VendfyLoader from './components/VendfyLoader';

function Layout() {
  const navigation = useNavigation();
  const isLoading = navigation.state === 'loading';

  return (
    <>
      {isLoading && <VendfyLoader theme="dark" />}
      <Outlet />
    </>
  );
}
```

### 5. Con Next.js (loading.tsx)
```tsx
// app/loading.tsx
import VendfyLoader from '@/components/VendfyLoader';

export default function Loading() {
  return <VendfyLoader theme="dark" message="Cargando..." />;
}
```

### 6. Con Suspense de React
```jsx
import { Suspense } from 'react';
import VendfyLoader from './components/VendfyLoader';

function App() {
  return (
    <Suspense fallback={<VendfyLoader theme="dark" />}>
      <Dashboard />
    </Suspense>
  );
}
```

### 7. Mensajes dinámicos
```jsx
const messages = [
  'Preparando tu tienda...',
  'Conectando con la IA...',
  'Cargando productos...',
  'Casi listo...',
];

function SmartLoader() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return <VendfyLoader theme="dark" message={messages[msgIndex]} />;
}
```

## Accesibilidad

- El loader respeta `prefers-reduced-motion` automáticamente
- Las animaciones se desactivan para usuarios que prefieren menos movimiento
- El z-index en fullscreen es 9999 para cubrir toda la UI
