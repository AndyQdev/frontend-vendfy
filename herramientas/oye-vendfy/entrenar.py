"""
Entrena el detector de "Oye Vendfy" sobre las características de openWakeWord
y lo exporta a ONNX (entrada [n, 16, 96] → probabilidad [n, 1]).

    python entrenar.py [pasos]   # entrena, mide y exporta a modelo/oye_vendfy.onnx

Mide con lo que el modelo nunca vio:
  - aciertos con voces de reserva (con fondo de tienda, SNR 0–20 dB);
  - falsas alarmas por hora en habla y audio que no entró (FLEURS test, MLS,
    y el set de validación de openWakeWord: música, tele, ruido de casa, inglés).
Se queda con el punto del entrenamiento que más acierta con menos de
OBJETIVO_FA falsas alarmas por hora, y con el umbral que lo logra.
"""
import copy
import json
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

RAIZ = Path(__file__).resolve().parent.parent
CAR = RAIZ / "datos" / "caracteristicas"
MODELO = RAIZ / "modelo"
DEV = "cuda" if torch.cuda.is_available() else "cpu"
SEG_POR_VENTANA = 0.08
REFRACTARIO = 19  # ~1,5 s: una activación no se cuenta dos veces
import os

PESO_NEG = float(os.environ.get("PESO_NEG", 60))  # el castigo a una falsa alarma al final del entrenamiento
OCULTAS = int(os.environ.get("OCULTAS", 128))
APAGADO = float(os.environ.get("APAGADO", 0.3))
OBJETIVO_FA = 1.0  # falsas alarmas por hora (antes de la verificación del servidor)
UMBRALES = np.round(np.concatenate([np.arange(0.30, 0.99, 0.01), [0.99, 0.995, 0.998, 0.999]]), 4)

# Negativos y cuánto pesa cada uno en un lote.
NEGATIVOS = {
    "neg_tts": 0.14, "neg_parcial": 0.12, "neg_ruido": 0.06, "neg_fleurs": 0.14, "neg_mls": 0.18,
    "neg_musica": 0.16, "neg_ruido_real": 0.08, "neg_ingles": 0.12,
}


class Detector(nn.Module):
    def __init__(self, ocultas=128, apagado=0.3):
        super().__init__()
        self.red = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(0.1),
            nn.Linear(16 * 96, ocultas), nn.LayerNorm(ocultas), nn.ReLU(), nn.Dropout(apagado),
            nn.Linear(ocultas, ocultas), nn.LayerNorm(ocultas), nn.ReLU(), nn.Dropout(apagado),
            nn.Linear(ocultas, 1),
        )

    def forward(self, x):
        return torch.sigmoid(self.red(x))


def cargar(nombre: str) -> np.ndarray:
    ruta = CAR / f"{nombre}.npy"
    if not ruta.exists():
        print(f"  (falta {nombre})")
        return np.zeros((0, 16, 96), np.float16)
    return np.load(ruta, mmap_mode="r")


@torch.no_grad()
def puntajes(modelo, x: np.ndarray, lote=8192) -> np.ndarray:
    modelo.eval()
    salida = []
    for i in range(0, len(x), lote):
        t = torch.from_numpy(np.asarray(x[i: i + lote], dtype=np.float32)).to(DEV)
        salida.append(modelo(t).squeeze(1).cpu().numpy())
    modelo.train()
    return np.concatenate(salida) if salida else np.zeros(0)


def activaciones(p: np.ndarray, umbral: float) -> int:
    """Cuántas veces dispara en una secuencia continua (ventanas cada 80 ms), con paciencia 2 como el panel."""
    sobre = p >= umbral
    n, i, largo = 0, 0, len(p)
    while i < largo - 1:
        if sobre[i] and sobre[i + 1]:
            n += 1
            i += REFRACTARIO + 2
        else:
            i += 1
    return n


# El conjunto en flujo (voces de reserva dentro de 3,5 s, ventanas cada 80 ms).
FLUJO = None


def cargar_flujo():
    global FLUJO
    x, largos = CAR / "flujo_reserva.npy", CAR / "flujo_reserva_largos.npy"
    if x.exists() and largos.exists():
        FLUJO = (np.load(x, mmap_mode="r"), np.load(largos))


def aciertos_flujo(modelo, u: float) -> float | None:
    """Como en el navegador: oída si dispara (2 ventanas seguidas sobre el umbral) en su secuencia."""
    if FLUJO is None:
        return None
    p = puntajes(modelo, FLUJO[0])
    cortes = np.cumsum(FLUJO[1])[:-1]
    return float(np.mean([activaciones(s, u) >= 1 for s in np.split(p, cortes)]))


def medir(modelo, pos, secuencias: dict, parecidas):
    sp = puntajes(modelo, pos)
    pf = puntajes(modelo, FLUJO[0]) if FLUJO is not None else None
    cortes = np.cumsum(FLUJO[1])[:-1] if FLUJO is not None else None
    ps = {k: puntajes(modelo, v) for k, v in secuencias.items()}
    horas = {k: len(v) * SEG_POR_VENTANA / 3600 for k, v in secuencias.items()}
    pz = puntajes(modelo, parecidas) if len(parecidas) else np.zeros(0)
    filas = []
    for u in UMBRALES:
        fa = {k: activaciones(p, u) / max(horas[k], 1e-9) for k, p in ps.items()}
        total = sum(activaciones(p, u) for p in ps.values()) / max(sum(horas.values()), 1e-9)
        filas.append({
            "umbral": float(u),
            # Lo que importa: oída en flujo, como en el panel. "ventana" es la medida dura de una sola ventana.
            "aciertos": float(np.mean([activaciones(s, u) >= 1 for s in np.split(pf, cortes)])) if pf is not None else float((sp >= u).mean()),
            "aciertos_ventana": float((sp >= u).mean()) if len(sp) else 0.0,
            "falsas_por_hora": total,
            "por_fuente": {k: round(v, 2) for k, v in fa.items()},
            "parecidas_disparan": float((pz >= u).mean()) if len(pz) else 0.0,
        })
    return filas, sum(horas.values())


def mejor(filas):
    buenas = [f for f in filas if f["falsas_por_hora"] <= OBJETIVO_FA]
    return max(buenas, key=lambda f: (f["aciertos"], -f["falsas_por_hora"])) if buenas else None


def main():
    torch.manual_seed(5)
    rng = np.random.default_rng(5)
    t0 = time.time()
    pasos = int(sys.argv[1]) if len(sys.argv) > 1 else 30000

    # La palabra sola y la palabra en medio de una conversación.
    pos = np.concatenate([np.asarray(cargar(n), dtype=np.float16) for n in ("pos_train", "pos_contexto")])
    negs = {n: cargar(n) for n in NEGATIVOS}
    negs = {k: v for k, v in negs.items() if len(v)}
    pesos = {k: NEGATIVOS[k] for k in negs}
    print(f"positivos {pos.shape} · " + " · ".join(f"{k} {len(v)}" for k, v in negs.items()), flush=True)

    pos_res = np.concatenate([np.asarray(cargar(n), dtype=np.float16) for n in ("pos_reserva", "pos_reserva_contexto")])
    eval_seq = {"fleurs": cargar("eval_fleurs"), "mls": cargar("eval_mls")}
    oww_val = RAIZ / "datos" / "oww" / "validation_set_features.npy"
    if oww_val.exists():
        v = np.load(oww_val, mmap_mode="r")
        eval_seq["oww"] = v if v.ndim == 3 else np.lib.stride_tricks.sliding_window_view(v, (16, 96))[:, 0]
    eval_seq = {k: s for k, s in eval_seq.items() if len(s)}
    eval_parecidas = cargar("eval_tts")
    cargar_flujo()

    modelo = Detector(OCULTAS, APAGADO).to(DEV)
    print(f"red: ocultas {OCULTAS} · dropout {APAGADO} · peso de las falsas alarmas hasta {PESO_NEG}", flush=True)
    opt = torch.optim.AdamW(modelo.parameters(), lr=1e-3, weight_decay=1e-3)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=1.5e-3, total_steps=pasos)
    bce = nn.BCELoss(reduction="none")
    lote = 1024
    dificiles = np.zeros((0, 16, 96), np.float16)
    elegido, estado_elegido, paso_elegido = None, None, 0

    for paso in range(1, pasos + 1):
        n_pos = lote // 8
        ip = rng.integers(0, len(pos), n_pos)
        partes, etiquetas = [pos[ip]], [np.ones(n_pos)]
        resto = lote - n_pos
        if len(dificiles):
            k = resto // 4
            partes.append(dificiles[rng.integers(0, len(dificiles), k)])
            etiquetas.append(np.zeros(k))
            resto -= k
        suma = sum(pesos.values())
        for nombre, conjunto in negs.items():
            k = max(1, int(resto * pesos[nombre] / suma))
            partes.append(np.asarray(conjunto[np.sort(rng.integers(0, len(conjunto), k))], dtype=np.float16))
            etiquetas.append(np.zeros(k))
        x = torch.from_numpy(np.concatenate(partes).astype(np.float32)).to(DEV)
        y = torch.from_numpy(np.concatenate(etiquetas).astype(np.float32)).to(DEV)
        # Ruido en las características: generaliza mejor (el modelo no memoriza grabaciones).
        x = x + torch.randn_like(x) * 0.5
        p = modelo(x).squeeze(1).clamp(1e-6, 1 - 1e-6)
        # Una falsa alarma pesa cada vez más (como openWakeWord): de 1 a PESO_NEG.
        peso_neg = 1 + (PESO_NEG - 1) * min(1.0, paso / (0.6 * pasos))
        w = torch.where(y > 0.5, torch.ones_like(y), torch.full_like(y, peso_neg))
        perdida = (bce(p, y) * w).mean()
        opt.zero_grad()
        perdida.backward()
        opt.step()
        sched.step()

        if paso % 2000 == 0 or paso == pasos:
            muestra = np.concatenate([np.asarray(c[np.sort(rng.integers(0, len(c), min(len(c), 50000)))], dtype=np.float16) for c in negs.values()])
            s = puntajes(modelo, muestra)
            dificiles = muestra[s > 0.05][:80000]
            filas, horas = medir(modelo, pos_res, eval_seq, eval_parecidas)
            m = mejor(filas)
            u5 = next(f for f in filas if abs(f["umbral"] - 0.5) < 1e-6)
            info = f"u0.5: aciertos {u5['aciertos']:.3f} FA/h {u5['falsas_por_hora']:.1f} {u5['por_fuente']}"
            if m:
                info += f" | mejor u{m['umbral']}: aciertos {m['aciertos']:.3f} FA/h {m['falsas_por_hora']:.2f} {m['por_fuente']}"
                if elegido is None or m["aciertos"] > elegido["aciertos"]:
                    elegido, estado_elegido, paso_elegido = m, copy.deepcopy(modelo.state_dict()), paso
            print(f"paso {paso} pérdida {perdida.item():.4f} peso_neg {peso_neg:.0f} difíciles {len(dificiles)} [{horas:.1f} h] {info} ({time.time() - t0:.0f} s)", flush=True)

    if estado_elegido is None:
        filas, horas = medir(modelo, pos_res, eval_seq, eval_parecidas)
        elegido = min(filas, key=lambda f: f["falsas_por_hora"])
        paso_elegido = pasos
        print("ningún punto llegó al objetivo: se usa el de menos falsas alarmas")
    else:
        modelo.load_state_dict(estado_elegido)
        filas, horas = medir(modelo, pos_res, eval_seq, eval_parecidas)
    print(f"\nhoras de evaluación: {horas:.1f} · paso elegido {paso_elegido}")
    print(f"umbral elegido: {json.dumps(elegido, ensure_ascii=False)}")

    MODELO.mkdir(exist_ok=True)
    modelo.eval().cpu()
    salida = MODELO / os.environ.get("SALIDA", "oye_vendfy.onnx")
    torch.onnx.export(
        modelo, torch.zeros(1, 16, 96), str(salida),
        input_names=["x"], output_names=["p"], opset_version=13, dynamic_axes={"x": {0: "n"}, "p": {0: "n"}}, dynamo=False,
    )
    (MODELO / salida.name.replace(".onnx", ".json")).write_text(
        json.dumps({"elegido": elegido, "paso": paso_elegido, "horas_evaluacion": horas, "curva": filas}, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    print(f"exportado: {salida} ({salida.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
