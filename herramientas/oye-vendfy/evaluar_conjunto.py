"""
¿Combinar modelos (promediar sus probabilidades) mejora? Misma medida que evaluar.py.

    python evaluar_conjunto.py modelo/a.onnx modelo/b.onnx ...
"""
import sys

import numpy as np
import onnxruntime as ort

from evaluar import CAR, RAIZ, activaciones, puntajes


def main():
    sesiones = [ort.InferenceSession(r) for r in sys.argv[1:]]
    flujo = np.load(CAR / "flujo_reserva.npy", mmap_mode="r")
    largos = np.load(CAR / "flujo_reserva_largos.npy")
    prom = lambda x: np.mean([puntajes(s, x) for s in sesiones], axis=0)
    seqs = np.split(prom(flujo), np.cumsum(largos)[:-1])
    solas, conversacion = seqs[0::2], seqs[1::2]
    fuentes = {"fleurs": np.load(CAR / "eval_fleurs.npy", mmap_mode="r"), "mls": np.load(CAR / "eval_mls.npy", mmap_mode="r")}
    v = np.load(RAIZ / "datos" / "oww" / "validation_set_features.npy", mmap_mode="r")
    fuentes["oww"] = np.lib.stride_tricks.sliding_window_view(v, (16, 96))[:, 0]
    pf = {k: prom(x) for k, x in fuentes.items()}
    horas = {k: len(x) * 0.08 / 3600 for k, x in fuentes.items()}
    print(f"conjunto de {len(sesiones)} · {sum(horas.values()):.1f} h")
    print("umbral | sola | conversación | falsas/h | " + " | ".join(horas))
    for u in (0.3, 0.4, 0.5, 0.6, 0.7, 0.8):
        fa = {k: activaciones(p, u) / horas[k] for k, p in pf.items()}
        total = sum(activaciones(p, u) for p in pf.values()) / sum(horas.values())
        a1 = np.mean([activaciones(x, u) >= 1 for x in solas])
        a2 = np.mean([activaciones(x, u) >= 1 for x in conversacion])
        print(f"  {u:.1f}  | {a1 * 100:5.1f} % | {a2 * 100:5.1f} % | {total:5.2f} | " + " | ".join(f"{fa[k]:.2f}" for k in horas))


if __name__ == "__main__":
    main()
