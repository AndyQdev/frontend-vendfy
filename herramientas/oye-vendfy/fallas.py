"""
¿Qué casos de reserva no se oyen? Reconstruye de qué voz, estilo y texto salió
cada audio (los nombres son un hash de esos datos) y cuenta los fallos en flujo.

    python fallas.py modelo/x.onnx [umbral]
"""
import sys
from collections import Counter

import numpy as np
import onnxruntime as ort

from audio import SR, leer_tts
from evaluar import CAR, activaciones, puntajes
from generar_tts import ESTILOS, POSITIVOS, RESERVA_CLOUD, RESERVA_GEMINI, nombre

DATOS_TTS = CAR.parent / "tts" / "reserva"


def origen() -> dict:
    """hash → descripción, para todas las combinaciones de reserva."""
    o = {}
    for voz in RESERVA_CLOUD:
        for texto in POSITIVOS:
            for v in (0.9, 1.0, 1.15):
                o[nombre("c", voz, texto, v)] = (voz, f"vel {v}", texto)
            for t in (-5.0, -2.5, 2.5, 5.0):
                o[nombre("t", voz, texto, t)] = (voz, f"tono {t:+}", texto)
    for voz in RESERVA_GEMINI:
        for estilo in ESTILOS:
            for texto in POSITIVOS:
                o[nombre("g", voz, estilo, texto)] = (f"Gemini {voz}", estilo.strip(": ") or "normal", texto)
    return o


def main():
    s = ort.InferenceSession(sys.argv[1])
    u = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
    rutas = sorted(DATOS_TTS.glob("*.wav"))
    # El mismo filtro que caracteristicas.py (en el mismo orden).
    clips = leer_tts("reserva")
    usados = [r.name for r, c in zip(rutas, clips) if 0.35 * SR < len(c) < 2.2 * SR]
    o = origen()
    flujo = np.load(CAR / "flujo_reserva.npy", mmap_mode="r")
    largos = np.load(CAR / "flujo_reserva_largos.npy")
    seqs = np.split(puntajes(s, flujo), np.cumsum(largos)[:-1])
    por_voz, por_estilo, por_texto, total = Counter(), Counter(), Counter(), Counter()
    for i, nombre_archivo in enumerate(usados):
        voz, estilo, texto = o.get(nombre_archivo, ("?", "?", "?"))
        for k in range(8):
            oida = activaciones(seqs[i * 8 + k], u) >= 1
            total[voz] += 1
            if not oida:
                por_voz[voz] += 1
                por_estilo[estilo] += 1
                por_texto[texto] += 1
    print(f"umbral {u} · fallos {sum(por_voz.values())} de {sum(total.values())}")
    print("por voz:", {v: f"{por_voz[v]}/{total[v]}" for v in total})
    print("por estilo/velocidad:", dict(por_estilo.most_common()))
    print("por texto:", dict(por_texto.most_common()))


if __name__ == "__main__":
    main()
