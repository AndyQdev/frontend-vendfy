import { expect, test } from "@playwright/test";

import { Acelerador, acelerarMuestras } from "../../src/shared/voz/acelerar";

/**
 * La voz más rápida (WSOLA): dura menos, pero el tono no cambia. El tono se
 * mide contando cruces por cero: subir el playbackRate los multiplicaría.
 */

const F = 24_000;

/** Una "voz" de prueba: 180 Hz con armónicos y un poco de vibrato. */
function voz(segundos: number, hz = 180): Float32Array {
  const m = new Float32Array(Math.round(F * segundos));
  let fase = 0;
  for (let i = 0; i < m.length; i++) {
    const f = hz * (1 + 0.02 * Math.sin((2 * Math.PI * 4 * i) / F));
    fase += (2 * Math.PI * f) / F;
    m[i] = 0.5 * Math.sin(fase) + 0.25 * Math.sin(2 * fase) + 0.1 * Math.sin(3 * fase);
  }
  return m;
}

function crucesPorSegundo(m: Float32Array): number {
  let n = 0;
  for (let i = 1; i < m.length; i++) if (m[i - 1] < 0 && m[i] >= 0) n++;
  return n / (m.length / F);
}

test("dura lo que tiene que durar y conserva el tono", () => {
  const entrada = voz(2);
  for (const factor of [1.2, 1.4]) {
    const salida = acelerarMuestras(entrada, F, factor);
    expect(Math.abs(salida.length - entrada.length / factor) / (entrada.length / factor)).toBeLessThan(0.03);
    // Mismo tono: los cruces por segundo no cambian (±3 %).
    expect(Math.abs(crucesPorSegundo(salida) - crucesPorSegundo(entrada)) / crucesPorSegundo(entrada)).toBeLessThan(0.03);
  }
});

test("sin saltos: las ventanas calzan", () => {
  const salida = acelerarMuestras(voz(1), F, 1.25);
  let peor = 0;
  for (let i = 1 + 200; i < salida.length - 200; i++) peor = Math.max(peor, Math.abs(salida[i] - salida[i - 1]));
  // Una onda de 180 Hz con armónicos sube como mucho ~0,07 por muestra.
  expect(peor).toBeLessThan(0.12);
});

test("por trozos da lo mismo que de una vez", () => {
  const entrada = voz(1.5);
  const entera = acelerarMuestras(entrada, F, 1.2);
  const a = new Acelerador(F, 1.2);
  const partes: Float32Array[] = [];
  for (let i = 0; i < entrada.length; i += 1777) partes.push(a.push(entrada.slice(i, i + 1777)));
  partes.push(a.flush());
  const largo = partes.reduce((s, p) => s + p.length, 0);
  expect(largo).toBe(entera.length);
  const unida = new Float32Array(largo);
  let d = 0;
  for (const p of partes) {
    unida.set(p, d);
    d += p.length;
  }
  let dif = 0;
  for (let i = 0; i < largo; i++) dif = Math.max(dif, Math.abs(unida[i] - entera[i]));
  expect(dif).toBeLessThan(1e-6);
});

test("rápido: 3 s de voz a 48 kHz en menos de 150 ms", () => {
  const F48 = 48_000;
  const m = new Float32Array(F48 * 3).map((_, i) => Math.sin((2 * Math.PI * 200 * i) / F48));
  const t = performance.now();
  acelerarMuestras(m, F48, 1.2);
  expect(performance.now() - t).toBeLessThan(150);
});

test("factor 1 no toca nada", () => {
  const m = voz(0.5);
  expect(acelerarMuestras(m, F, 1)).toBe(m);
});
