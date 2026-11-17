"""
Puntajes de "Oye Vendfy" sobre un WAV, de a 80 ms, como en el panel
(openWakeWord en modo streaming + el clasificador ONNX). Sirve para:

  - comparar 1 a 1 con el detector del navegador (paridad);
  - ver dónde dispara en los audios de prueba.

    python puntajes_stream.py datos/prueba/positiva.wav [--json salida.json]
"""
import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from openwakeword.utils import AudioFeatures

from audio import DATOS, a_int16, leer_wav

RAIZ = Path(__file__).resolve().parent.parent


def puntajes(ruta: str) -> list:
    feat = AudioFeatures(
        melspec_model_path=str(DATOS / "oww" / "melspectrogram.onnx"),
        embedding_model_path=str(DATOS / "oww" / "embedding_model.onnx"),
        ncpu=1,
    )
    # Como el navegador: arranca con el espectrograma en unos y sin embeddings previos.
    feat.reset()
    feat.feature_buffer = np.zeros((0, 96), np.float32)
    cls = ort.InferenceSession(str(RAIZ / "modelo" / "oye_vendfy.onnx"))
    x = a_int16(leer_wav(ruta))
    salida = []
    for i in range(0, len(x) - 1279, 1280):
        feat(x[i: i + 1280])
        if feat.feature_buffer.shape[0] < 16:
            salida.append(None)
            continue
        f = feat.get_features(16)
        salida.append(float(cls.run(None, {"x": f})[0][0, 0]))
    return salida


if __name__ == "__main__":
    p = puntajes(sys.argv[1])
    if "--json" in sys.argv:
        Path(sys.argv[sys.argv.index("--json") + 1]).write_text(json.dumps(p))
    validos = [(i, v) for i, v in enumerate(p) if v is not None]
    pico = max(validos, key=lambda t: t[1])
    print(f"{len(p)} pasos · máximo {pico[1]:.3f} en {pico[0] * 0.08:.2f} s · sobre 0.5: {[round(i * 0.08, 2) for i, v in validos if v >= 0.5][:12]}")
