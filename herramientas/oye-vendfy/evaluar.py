"""
Mide un modelo exportado (ONNX) igual que en el panel: aciertos en flujo con
voces de reserva y falsas alarmas por hora en audio que no entró.

    python evaluar.py [modelo.onnx]
"""
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort

RAIZ = Path(__file__).resolve().parent.parent
CAR = RAIZ / "datos" / "caracteristicas"
REFRACTARIO = 19


def puntajes(s, x, lote=8192):
    return np.concatenate([s.run(None, {"x": np.asarray(x[i: i + lote], dtype=np.float32)})[0][:, 0] for i in range(0, len(x), lote)])


def activaciones(p, u):
    sobre = p >= u
    n, i = 0, 0
    while i < len(p) - 1:
        if sobre[i] and sobre[i + 1]:
            n += 1
            i += REFRACTARIO + 2
        else:
            i += 1
    return n


def main():
    ruta = sys.argv[1] if len(sys.argv) > 1 else str(RAIZ / "modelo" / "oye_vendfy.onnx")
    s = ort.InferenceSession(ruta)
    flujo = np.load(CAR / "flujo_reserva.npy", mmap_mode="r")
    largos = np.load(CAR / "flujo_reserva_largos.npy")
    seqs = np.split(puntajes(s, flujo), np.cumsum(largos)[:-1])
    solas, conversacion = seqs[0::2], seqs[1::2]
    fuentes = {"fleurs": np.load(CAR / "eval_fleurs.npy", mmap_mode="r"), "mls": np.load(CAR / "eval_mls.npy", mmap_mode="r")}
    v = np.load(RAIZ / "datos" / "oww" / "validation_set_features.npy", mmap_mode="r")
    fuentes["oww (música, tele, casa)"] = np.lib.stride_tricks.sliding_window_view(v, (16, 96))[:, 0]
    pf = {k: puntajes(s, x) for k, x in fuentes.items()}
    horas = {k: len(x) * 0.08 / 3600 for k, x in fuentes.items()}
    print(f"{Path(ruta).name} · {sum(horas.values()):.1f} h de audio sin la palabra")
    print("umbral | oída sola | oída en conversación | falsas/h total | " + " | ".join(horas))
    for u in (0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9):
        fa = {k: activaciones(p, u) / horas[k] for k, p in pf.items()}
        total = sum(activaciones(p, u) for p in pf.values()) / sum(horas.values())
        a1 = np.mean([activaciones(x, u) >= 1 for x in solas])
        a2 = np.mean([activaciones(x, u) >= 1 for x in conversacion])
        print(f"  {u:.1f}  |   {a1 * 100:5.1f} %  |      {a2 * 100:5.1f} %        |   {total:5.2f}   | " + " | ".join(f"{fa[k]:.2f}" for k in horas))


if __name__ == "__main__":
    main()
