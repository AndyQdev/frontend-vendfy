import * as ort from "onnxruntime-web";

import type { Ejecutor } from "./detector";

/**
 * Los tres modelos del detector con onnxruntime-web (WASM, un hilo: los hilos
 * piden aislamiento de origen y no hace falta para modelos tan chicos).
 *
 * Los .onnx se sirven con el panel (public/oido/); el WASM de onnxruntime, del
 * mismo CDN y versión que ya usa el detector de voz del escáner.
 */
const VERSION_ORT = "1.30.0";

export async function crearEjecutor(base: string): Promise<Ejecutor> {
  ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${VERSION_ORT}/dist/`;
  ort.env.wasm.numThreads = 1;
  const opciones: ort.InferenceSession.SessionOptions = { executionProviders: ["wasm"], graphOptimizationLevel: "all" };
  const [mel, emb, cls] = await Promise.all([
    ort.InferenceSession.create(`${base}melspectrogram.onnx`, opciones),
    ort.InferenceSession.create(`${base}embedding_model.onnx`, opciones),
    ort.InferenceSession.create(`${base}oye_vendfy.onnx`, opciones),
  ]);
  return {
    async mel(muestras) {
      const r = await mel.run({ input: new ort.Tensor("float32", muestras, [1, muestras.length]) });
      return r.output.data as Float32Array;
    },
    async embedding(ventana) {
      const r = await emb.run({ input_1: new ort.Tensor("float32", ventana, [1, 76, 32, 1]) });
      return Float32Array.from(r.conv2d_19.data as Float32Array);
    },
    async clasificar(x) {
      const r = await cls.run({ x: new ort.Tensor("float32", x, [1, 16, 96]) });
      return (r.p.data as Float32Array)[0];
    },
  };
}
