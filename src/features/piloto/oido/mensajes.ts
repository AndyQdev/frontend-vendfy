/** Lo que se dicen la pantalla y el worker del oído. */

export type AlOido =
  | { tipo: "iniciar"; base: string; umbral: number; paciencia: number }
  | { tipo: "audio"; paso: Float32Array }
  | { tipo: "pausa"; valor: boolean }
  | { tipo: "umbral"; valor: number };

export type DelOido =
  | { tipo: "listo" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "puntaje"; p: number }
  | { tipo: "palabra"; p: number }
  /** Lo dicho desde 2 s antes de la palabra hasta que se calló (WAV 16 kHz). */
  | { tipo: "comando"; wav: ArrayBuffer; hablo: boolean };
