import { expect, test } from "@playwright/test";

import { Comando, PisoDeRuido, aWav, rms } from "../../src/features/piloto/oido/comando";
import { DetectorPalabra, Disparador, type Ejecutor } from "../../src/features/piloto/oido/detector";

/**
 * El oído de "Oye Vendfy" sin navegador: cuándo se da por dicha la palabra,
 * cuándo termina lo que se dice después y el audio que se manda.
 */

const PASO = 1280;
const voz = (amp = 0.2) => Float32Array.from({ length: PASO }, (_, i) => amp * Math.sin((2 * Math.PI * 220 * i) / 16000));
const silencio = (amp = 0.0005) => Float32Array.from({ length: PASO }, () => (Math.random() * 2 - 1) * amp);

test.describe("disparador", () => {
  test("dispara con dos pasos seguidos sobre el umbral, una sola vez por palabra", () => {
    const d = new Disparador(0.5, 2, 25);
    expect([0.2, 0.6, 0.4, 0.7].map((p) => d.empujar(p))).toEqual([false, false, false, false]);
    expect(d.empujar(0.9)).toBe(true); // 0.7 y 0.9 seguidos
    // Durante el descanso (2 s) no vuelve a disparar aunque siga alto.
    expect(Array.from({ length: 25 }, () => d.empujar(0.95)).some(Boolean)).toBe(false);
    expect([d.empujar(0.9), d.empujar(0.9)]).toEqual([false, true]);
  });

  test("sin historia (null) no cuenta", () => {
    const d = new Disparador(0.5, 1);
    expect(d.empujar(null)).toBe(false);
    expect(d.empujar(0.6)).toBe(true);
  });
});

test.describe("lo que se dice después", () => {
  test("termina tras 1 s de silencio después de hablar, y se queda con lo dicho", () => {
    const c = new Comando(0.0005);
    for (let i = 0; i < 10; i++) expect(c.empujar(voz())).toBe(false);
    let pasos = 0;
    while (!c.empujar(silencio())) pasos++;
    expect(pasos).toBeGreaterThanOrEqual(10); // ~1 s = 12-13 pasos
    expect(c.hablo).toBe(true);
    // Lo dicho más un respiro, sin todo el silencio del final.
    expect(c.audio().length).toBeLessThan(10 + 13);
    expect(c.audio().length).toBeGreaterThanOrEqual(10);
  });

  test("si no habla en 6 s, termina sin nada (se manda solo la palabra)", () => {
    const c = new Comando(0.0005);
    let pasos = 0;
    while (!c.empujar(silencio())) pasos++;
    expect(pasos + 1).toBe(75);
    expect(c.hablo).toBe(false);
    expect(c.audio()).toEqual([]);
  });

  test("con música de fondo el silencio no es cero: cuenta contra el piso del lugar", () => {
    const piso = new PisoDeRuido();
    for (let i = 0; i < 40; i++) piso.empujar(rms(silencio(0.02)));
    const c = new Comando(piso.valor());
    for (let i = 0; i < 8; i++) c.empujar(voz(0.3));
    let pasos = 0;
    while (!c.empujar(silencio(0.02))) pasos++;
    expect(c.hablo).toBe(true);
    expect(pasos).toBeLessThan(20);
  });

  test("tope de 10 s aunque no se calle", () => {
    const c = new Comando(0.0005);
    let pasos = 0;
    while (!c.empujar(voz())) pasos++;
    expect(pasos + 1).toBe(125);
  });
});

test("WAV de 16 bits a 16 kHz", () => {
  const wav = new DataView(aWav([voz(), voz()]));
  const texto = (o: number, n: number) => String.fromCharCode(...Array.from({ length: n }, (_, i) => wav.getUint8(o + i)));
  expect(texto(0, 4)).toBe("RIFF");
  expect(texto(8, 4)).toBe("WAVE");
  expect(wav.getUint32(24, true)).toBe(16000);
  expect(wav.getUint16(34, true)).toBe(16);
  expect(wav.getUint32(40, true)).toBe(2 * PASO * 2);
});

test("el detector arma las ventanas como openWakeWord (76 cuadros, 16 embeddings)", async () => {
  const pedidos: { mel: number[]; emb: number; cls: number } = { mel: [], emb: 0, cls: 0 };
  const ejecutor: Ejecutor = {
    async mel(m) {
      pedidos.mel.push(m.length);
      return new Float32Array(8 * 32).fill(0); // 8 cuadros
    },
    async embedding(v) {
      expect(v.length).toBe(76 * 32);
      pedidos.emb++;
      return new Float32Array(96).fill(pedidos.emb);
    },
    async clasificar(x) {
      expect(x.length).toBe(16 * 96);
      pedidos.cls++;
      return x[x.length - 1]; // el último embedding
    },
  };
  const d = new DetectorPalabra(ejecutor);
  const salidas: (number | null)[] = [];
  for (let i = 0; i < 18; i++) salidas.push(await d.procesar(voz()));
  // El primer paso ve 1280 muestras; desde el segundo, 1280 + 480 de contexto.
  expect(pedidos.mel.slice(0, 3)).toEqual([1280, 1760, 1760]);
  // Recién con 16 embeddings (1,28 s) hay probabilidad.
  expect(salidas.slice(0, 15).every((s) => s === null)).toBe(true);
  expect(salidas[15]).toBe(16);
  expect(salidas[17]).toBe(18);
});
