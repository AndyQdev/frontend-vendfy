/** @type {import('tailwindcss').Config} */

/*
 * SISTEMA VISUAL DE VENDFY — la parte que vive en Tailwind.
 *
 * Los VALORES están en src/index.css (tokens HSL). Acá solo se nombran y se
 * fijan tres escalas que toda la app hereda sin tocar cada pantalla:
 *
 *   · RADIOS    md 10 (botones) · lg 12 (campos) · xl 16 (tarjetas)
 *               2xl 20 (burbujas del header) · 3xl 24 (modales)
 *   · SOMBRAS   sm/DEFAULT/md son la sombra de tarjeta, muy suave.
 *               lg/xl/2xl son las de lo que flota (menús, modales).
 *               Así cualquier `shadow-xl` suelto de una pantalla vieja queda
 *               sobrio sin ir a buscarlo.
 *   · FUENTES   sans = Plus Jakarta Sans (interfaz) · display = Sora (títulos
 *               y cifras) · mono = JetBrains Mono (precios, códigos, stock).
 *
 * Se redefinen las claves ESTÁNDAR (rounded-xl, shadow-lg) y no se inventan
 * nombres nuevos a propósito: tailwind-merge solo sabe resolver conflictos
 * entre clases que conoce. Con `rounded-tarjeta` inventado, un
 * `className="rounded-full"` pasado a un Button quedaba peleando con el radio
 * base y ganaba el que el CSS declarara último.
 */
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        display: ["Sora", '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        /*
         * La escala `emerald` es un ALIAS de la marca cian: 366 usos en 47
         * archivos la escriben a mano y así cambian todos juntos.
         *
         * No es la paleta cyan de Tailwind tal cual: está corrida un paso
         * hacia lo oscuro. `emerald-500` es #0E7490 (5,4:1 contra blanco) y no
         * #06B6D4 (2,4:1), porque esos 500/600 se usan como relleno de botón y
         * como texto. El cian brillante de marca vive en `emerald-400` y en
         * `acento`, que es para lo que alcanza: puntos, barras, bordes.
         */
        emerald: {
          50: "#F0F9FB",
          100: "#E6F4F7",
          200: "#BFE6EE",
          300: "#7DD3E3",
          400: "#06B6D4",
          500: "#0E7490",
          600: "#155E75",
          700: "#164E63",
          800: "#123F50",
          900: "#0C2F3C",
          950: "#072029",
        },
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        /* Azul marino de la marca: identidad, navegación activa, píldoras
           oscuras. Nunca de adorno. */
        tinta: {
          DEFAULT: "hsl(var(--tinta))",
          foreground: "hsl(var(--tinta-foreground))",
          muted: "hsl(var(--tinta-muted))",
        },
        /* El cian brillante: foco suave, puntos de estado, series de gráfico.
           Con texto blanco encima no se lee — no va de relleno. */
        acento: "hsl(var(--acento))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          strong: "hsl(var(--primary-strong))",
          soft: "hsl(var(--primary-soft))",
          "soft-foreground": "hsl(var(--primary-soft-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft: "hsl(var(--success-soft))",
          "soft-foreground": "hsl(var(--success-soft-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft: "hsl(var(--warning-soft))",
          "soft-foreground": "hsl(var(--warning-soft-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          soft: "hsl(var(--info-soft))",
          "soft-foreground": "hsl(var(--info-soft-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
          "soft-foreground": "hsl(var(--destructive-soft-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        sm: "0.375rem" /*  6px — marcas chicas, checkbox          */,
        DEFAULT: "0.5rem" /*  8px                                    */,
        md: "0.625rem" /* 10px — botones                          */,
        lg: "0.75rem" /* 12px — campos, selects, bloques internos */,
        xl: "1rem" /* 16px — TARJETAS                          */,
        "2xl": "1.25rem" /* 20px — burbujas del header, composer    */,
        "3xl": "1.5rem" /* 24px — modales                          */,
      },
      boxShadow: {
        /* Tarjeta: contacto + una difusa apenas visible. */
        sm: "var(--shadow-card)",
        DEFAULT: "var(--shadow-card)",
        md: "var(--shadow-card)",
        /* Lo que flota por encima del contenido. */
        lg: "var(--shadow-float)",
        xl: "var(--shadow-float)",
        "2xl": "var(--shadow-modal)",
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
        modal: "var(--shadow-modal)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
