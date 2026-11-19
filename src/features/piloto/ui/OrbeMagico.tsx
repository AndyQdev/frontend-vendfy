import { useEffect, useLayoutEffect, useRef, type CSSProperties, type MutableRefObject } from "react";

import { cn } from "@/shared/lib/cn";
import { nivelVoz } from "@/shared/voz";

import type { FasePiloto } from "../lib/estado";

/**
 * La bola de Vendfy: una esfera oscura con luces de colores que giran por
 * dentro. Se dibuja en vivo (CSS + un cuadro de animación), sin imágenes:
 *
 *   - escuchando: late con tu voz (el nivel del micrófono);
 *   - hablando:   late con la voz de Vendfy (el volumen real de lo que suena);
 *   - pensando:   gira rápido y un anillo de luz le da la vuelta;
 *   - esperando:  respira despacio;
 *   - error:      se tiñe de rojo.
 *
 * Cuanto más fuerte se habla, más crece, más brilla el centro y más rápido
 * se mueven las luces. Todo sale de tres variables CSS (--orbe-a, el ángulo;
 * --orbe-nivel; --orbe-escala) que se escriben directo en el elemento, sin
 * pasar por React, 60 veces por segundo.
 */

/** Grados por segundo en cada momento: más ocupado, más rápido. */
const GIRO: Record<FasePiloto, number> = {
  apagado: 18,
  escuchando: 55,
  pensando: 240,
  trabajando: 190,
  hablando: 60,
  esperando: 22,
  listo: 36,
  error: 28,
};

/** El ángulo da la vuelta en 7200° (todas las luces vuelven a su lugar a la vez: sin saltos). */
const VUELTA = 7200;
/** En reposo (el botón de la esquina) gira solo con CSS: una vuelta completa en 400 s. */
const GIRO_REPOSO = GIRO.apagado;

/**
 * Dónde quedó el ángulo la última vez, para que la bola de la esquina y la
 * grande sigan girando desde el mismo lugar al abrirse o cerrarse.
 */
const ultimo = { angulo: Math.random() * 360, en: 0 };

function anguloAhora(): number {
  const ahora = typeof performance !== "undefined" ? performance.now() : 0;
  if (!ultimo.en) ultimo.en = ahora;
  return (ultimo.angulo + ((ahora - ultimo.en) / 1000) * GIRO_REPOSO) % VUELTA;
}

type Animo = "reposo" | "escucha" | "piensa" | "habla" | "espera" | "listo" | "error";

const ANIMO: Record<FasePiloto, Animo> = {
  apagado: "reposo",
  escuchando: "escucha",
  pensando: "piensa",
  trabajando: "piensa",
  hablando: "habla",
  esperando: "espera",
  listo: "listo",
  error: "error",
};

export interface OrbeMagicoProps {
  fase: FasePiloto;
  /** Diámetro en px. Todo lo de adentro (desenfoques, brillos) escala con esto. */
  tam: number;
  /** Nivel del micrófono (0 a 1) mientras escucha. */
  nivel?: MutableRefObject<number>;
  /**
   * "css": gira sola con una animación CSS, sin cuadros de JS (el botón de la
   * esquina, que está en todas las pantallas). "vivo": reacciona a la voz.
   */
  motor?: "css" | "vivo";
  /** Manos libres esperando «Oye Vendfy»: el halo respira. */
  atento?: boolean;
  className?: string;
}

export function OrbeMagico({ fase, tam, nivel, motor = "vivo", atento = false, className }: OrbeMagicoProps) {
  const raiz = useRef<HTMLSpanElement>(null);
  const faseActual = useRef(fase);
  faseActual.current = fase;

  // En reposo: la animación CSS arranca en el ángulo donde quedó la bola grande.
  useLayoutEffect(() => {
    if (motor !== "css" || !raiz.current) return;
    raiz.current.style.animationDelay = `${-(anguloAhora() / GIRO_REPOSO)}s`;
    return () => {
      ultimo.angulo = anguloAhora();
      ultimo.en = performance.now();
    };
  }, [motor]);

  useEffect(() => {
    if (motor !== "vivo") return;
    const el = raiz.current;
    if (!el) return;
    const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let angulo = anguloAhora();
    let vel = GIRO[faseActual.current];
    let suave = 0;
    let t = 0;
    let antes = performance.now();
    let cuadro = 0;

    const paso = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - antes) / 1000);
      antes = ahora;
      t += dt;
      const f = faseActual.current;
      // Lo que suena ahora: tu voz al escuchar, la de Vendfy al hablar.
      const crudo = f === "escuchando" ? (nivel?.current ?? 0) : f === "hablando" ? Math.max(nivelVoz(), 0.05) : 0;
      const n = Math.min(1, Math.max(0, crudo));
      // Sube rápido (se nota el golpe de voz) y baja despacio (sin temblar).
      suave += (n - suave) * (n > suave ? 0.45 : 0.08);
      const meta = GIRO[f] * (1 + suave * 1.8) * (quieto ? 0.15 : 1);
      vel += (meta - vel) * Math.min(1, dt * 3);
      angulo = (angulo + vel * dt) % VUELTA;
      const respira =
        f === "pensando" || f === "trabajando" ? Math.sin(t * 5) * 0.03 : f === "esperando" ? Math.sin(t * 2.2) * 0.025 : 0;
      el.style.setProperty("--orbe-a", `${angulo.toFixed(2)}deg`);
      el.style.setProperty("--orbe-nivel", suave.toFixed(3));
      el.style.setProperty("--orbe-escala", quieto ? "1" : (1 + suave * 0.17 + respira).toFixed(3));
      ultimo.angulo = angulo;
      ultimo.en = ahora;
      cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [motor, nivel]);

  return (
    <span
      ref={raiz}
      aria-hidden
      className={cn("orbe", className)}
      data-animo={ANIMO[fase]}
      data-motor={motor}
      data-atento={atento ? "true" : undefined}
      style={{ width: tam, height: tam, fontSize: tam / 10 } as CSSProperties}
    >
      <span className="orbe-halo" />
      <span className="orbe-cuerpo">
        <span className="orbe-mancha orbe-mancha-1" />
        <span className="orbe-mancha orbe-mancha-2" />
        <span className="orbe-mancha orbe-mancha-3" />
        <span className="orbe-mancha orbe-mancha-4" />
        <span className="orbe-nucleo" />
        <span className="orbe-brillo" />
      </span>
      <span className="orbe-anillo" />
    </span>
  );
}
