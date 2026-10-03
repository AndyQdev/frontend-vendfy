import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./router";
import AppProviders from "./providers";
import { iniciarServiceWorker } from "@/features/pwa";
import "@/index.css";

// Solo registra en producción; en desarrollo desregistra lo que haya quedado,
// porque el service worker cachea /assets y pelea con el HMR de Vite.
iniciarServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  </React.StrictMode>
);
