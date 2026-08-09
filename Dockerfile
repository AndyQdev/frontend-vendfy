# --- build -------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Vite hornea las variables VITE_* EN EL BUNDLE: tienen que estar presentes
# durante el build, no en runtime. Por eso llegan como build args.
ARG VITE_API_URL
ARG VITE_URL_PUBLIC
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_API_URL=$VITE_API_URL \
    VITE_URL_PUBLIC=$VITE_URL_PUBLIC \
    VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

COPY . .
# El servidor tiene 1 GB: sin este techo, el build de Vite se lo come entero
# y el kernel mata el proceso a mitad de camino.
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN npm run build

# --- runtime: solo archivos estáticos ----------------------------------
FROM caddy:2-alpine AS runtime
COPY --from=build /app/dist /srv

# SPA: cualquier ruta que no sea un archivo cae en index.html, si no
# /orders o /whatsapp darían 404 al recargar la página.
RUN printf ':80 {\n\troot * /srv\n\tencode gzip zstd\n\ttry_files {path} /index.html\n\tfile_server\n}\n' > /etc/caddy/Caddyfile

EXPOSE 80
