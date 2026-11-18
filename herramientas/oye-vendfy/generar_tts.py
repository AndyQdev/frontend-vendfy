"""
Genera los audios sintéticos para entrenar "Oye Vendfy" (16 kHz, mono, WAV).

- positivos/: "Oye Vendfy" con las voces en español de Cloud TTS (97) y las 30
  de Gemini TTS por Vertex, a distintas velocidades y escrito de varias formas
  (para cubrir "vend-fai" y "vend-fi").
- negativos/: frases que se le parecen ("vendí", "véndeme", "oye, ven…") y
  conversación normal de una tienda.
- reserva/: voces que NO entran al entrenamiento, para medir con voces que el
  modelo nunca escuchó (y para la prueba de punta a punta en el navegador).

Se puede cortar y volver a correr: lo que ya está en disco no se pide otra vez.
"""
import base64
import concurrent.futures as cf
import hashlib
import json
import random
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

import numpy as np
from scipy.signal import resample_poly

from claves import cloud_tts, vertex

RAIZ = Path(__file__).resolve().parent.parent / "datos" / "tts"
TTS = "https://texttospeech.googleapis.com/v1"
VERTEX = "https://aiplatform.googleapis.com/v1/publishers/google/models"

POSITIVOS = ["Oye Vendfy", "Oye, Vendfy.", "Oye Vendfái", "Oye Vendfi", "¡Oye Vendfy!", "Oye, Venfai."]
# Lo que se dice después de llamarlo: también es "positivo" (la palabra al principio).
CON_PEDIDO = [
    "Oye Vendfy, vende dos sprite.",
    "Oye Vendfy, ¿a cuánto está el dólar?",
    "Oye Vendfy, cóbrale con QR.",
    "Oye Vendfy, arregla el stock de la pepsi.",
]

NEGATIVOS = [
    # parecidas
    "Oye", "Oye, ven", "Oye, ven acá", "Vendí", "Vendí dos", "Oye, vendí tres cocas", "Véndeme una", "Vende fideos",
    "Oye, vendedor", "Vendedora", "Bendito sea", "Oye, Wendy", "Oye, Benji", "Oye Fifi", "Oye Siri", "Ok Google",
    "Alexa", "Oye, Ben", "Ven, fíjate", "Ven fijo", "Ven y fíjate", "Vendemos de todo", "Vender fiado", "Vende fiado",
    "Oye, véndele", "Hoy vendí", "Hoy vendimos poco", "Oye, fíjate", "Oye, Fanny", "Vendíamos", "Envíame", "En fila",
    "Oye, ven, fíjate esto", "Venta fija", "Vendo fichas", "Oye vende", "Oye vendes", "Oye, vendiste", "Oye, Brenda",
    "Oye, Fernando", "Oye, Wilfredo", "Bien, fino", "Ven, fina", "Vende Fanta", "Oye, mi vida", "Fijate", "Oiga",
    # la tienda
    "¿Cuánto cuesta?", "Dame dos cocas, por favor", "¿Tiene cambio de cien?", "Casera, ¿a cuánto la leche?",
    "Una Pepsi de dos litros", "¿Me lo puede poner en bolsa?", "Gracias, que le vaya bien", "¿Aceptan QR?",
    "Le doy veinte bolivianos", "No tengo sencillo", "Ya, ahí está su vuelto", "Buenas tardes", "Buenos días, vecina",
    "¿Hay pan?", "Se acabó el azúcar", "Mañana llega el proveedor", "Anótalo en el cuaderno", "¿Cuánto es todo?",
    "Son treinta y cinco bolivianos", "¿Me fía hasta el viernes?", "Pásame la caja de galletas", "Está caro",
    "Hazme una rebaja", "Llévate dos y te hago precio", "¿Tiene Coca Cola sin azúcar?", "Ya no hay Sprite",
    "La de un litro está a ocho", "Cierro a las diez", "¿Dónde queda el mercado?", "Mi hijo viene a recoger",
    "Ponle en la cuenta", "Te transfiero ahorita", "Mándame el QR", "Llegó el pedido de la PIL", "Contá cuántas quedan",
    "Hoy hubo harta gente", "Prende la tele", "Pon música", "Apaga la luz del fondo", "¿Ya comiste?",
    "Llamá a tu papá", "Cuidado que se cae", "Ahí viene el micro", "Hace mucho frío", "Está lloviendo",
    "Voy al banco y vuelvo", "Cerrá la puerta", "¿Viste el partido?", "El Bolívar ganó", "¿Cuánto está el dólar hoy?",
    "En Binance está a once", "Dame una bolsa", "Una docena de huevos", "Medio kilo de arroz", "Un pan y una leche",
    "Se me olvidó la billetera", "¿Puedo pagar con tarjeta?", "No funciona el POS", "Se cortó la luz",
]

# Voces que no entran al entrenamiento (para medir y para la prueba del navegador).
RESERVA_CLOUD = {"es-US-Chirp3-HD-Charon", "es-US-Chirp3-HD-Kore", "es-ES-Chirp3-HD-Puck", "es-US-Neural2-A"}
RESERVA_GEMINI = {"Iapetus", "Laomedeia"}
GEMINI_VOCES = [
    "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe", "Enceladus",
    "Iapetus", "Umbriel", "Algieba", "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
    "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia",
    "Sadaltager", "Sulafat",
]
ESTILOS = [
    "", "Dilo rápido: ", "Dilo despacio y claro: ", "Dilo bajito, casi susurrando: ",
    "Dilo fuerte, como llamando desde lejos: ", "Dilo con voz cansada: ",
]
GEMINI_MODELOS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview"]


def guardar(ruta: Path, muestras: np.ndarray):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(muestras, -1, 1)
    with wave.open(str(ruta), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes((pcm * 32767).astype("<i2").tobytes())


def pcm16(datos: bytes) -> np.ndarray:
    if datos[:4] == b"RIFF":
        i = datos.find(b"data", 12)
        datos = datos[i + 8:] if i >= 0 else datos[44:]
    datos = datos[: len(datos) - len(datos) % 2]
    return np.frombuffer(datos, dtype="<i2").astype(np.float32) / 32768


def nombre(*partes) -> str:
    return hashlib.sha1("|".join(map(str, partes)).encode()).hexdigest()[:16] + ".wav"


def post(url: str, cuerpo: dict, clave: str, intentos=6):
    for i in range(intentos):
        req = urllib.request.Request(url, data=json.dumps(cuerpo).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": clave})
        try:
            return json.load(urllib.request.urlopen(req, timeout=60))
        except urllib.error.HTTPError as e:
            texto = e.read().decode(errors="ignore")[:200]
            if e.code in (429, 500, 502, 503) and i < intentos - 1:
                time.sleep(min(60, 4 * (i + 1)))
                continue
            raise RuntimeError(f"{e.code} {texto}")
    raise RuntimeError("sin respuesta")


def voces_cloud():
    req = urllib.request.Request(f"{TTS}/voices", headers={"x-goog-api-key": cloud_tts()})
    voces = json.load(urllib.request.urlopen(req))["voices"]
    return [(v["name"], v["languageCodes"][0]) for v in voces if any(l.startswith("es-") for l in v["languageCodes"])]


def cloud(texto: str, voz: str, idioma: str, velocidad: float, destino: Path, clave: str, tono: float = 0.0):
    if destino.exists():
        return "ya"
    audio = {"audioEncoding": "LINEAR16", "sampleRateHertz": 16000}
    if velocidad != 1.0:
        audio["speakingRate"] = velocidad
    if tono:
        audio["pitch"] = tono
    try:
        r = post(f"{TTS}/text:synthesize", {"input": {"text": texto}, "voice": {"languageCode": idioma, "name": voz}, "audioConfig": audio}, clave)
    except RuntimeError as e:
        if ("speakingRate" in audio or "pitch" in audio) and "400" in str(e):
            return "sin-velocidad"
        raise
    guardar(destino, pcm16(base64.b64decode(r["audioContent"])))
    return "ok"


def gemini(texto: str, voz: str, modelo: str, destino: Path, clave: str):
    if destino.exists():
        return "ya"
    r = post(f"{VERTEX}/{modelo}:generateContent", {
        "contents": [{"role": "user", "parts": [{"text": texto}]}],
        "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voz}}}},
    }, clave)
    parte = r["candidates"][0]["content"]["parts"][0]["inlineData"]
    datos = base64.b64decode(parte["data"])
    # La frecuencia: del encabezado WAV si viene, si no del tipo ("rate=24000").
    if datos[:4] == b"RIFF":
        frecuencia = int.from_bytes(datos[24:28], "little")
    else:
        m = __import__("re").search(r"rate=(\d+)", parte.get("mimeType", ""))
        frecuencia = int(m.group(1)) if m else 24000
    muestras = resample_poly(pcm16(datos), 16000, frecuencia)
    guardar(destino, muestras)
    return "ok"


def main():
    que = sys.argv[1] if len(sys.argv) > 1 else "todo"
    random.seed(7)
    trabajos = []
    clave_cloud, clave_vertex = cloud_tts(), vertex()
    voces = voces_cloud()

    if que in ("todo", "cloud"):
        for voz, idioma in voces:
            carpeta = "reserva" if voz in RESERVA_CLOUD else "positivos"
            for texto in POSITIVOS:
                for v in (0.9, 1.0, 1.15):
                    trabajos.append(("cloud", texto, voz, idioma, v, RAIZ / carpeta / nombre("c", voz, texto, v)))
            for texto in random.sample(CON_PEDIDO, 2):
                trabajos.append(("cloud", texto, voz, idioma, 1.0, RAIZ / carpeta / "pedido" / nombre("c", voz, texto)))
            neg = NEGATIVOS if voz in RESERVA_CLOUD else random.sample(NEGATIVOS, 30)
            for texto in neg:
                trabajos.append(("cloud", texto, voz, idioma, random.choice((0.95, 1.0, 1.1)), RAIZ / ("reserva_neg" if voz in RESERVA_CLOUD else "negativos") / nombre("c", voz, texto)))
        hechos = {"ok": 0, "ya": 0, "sin-velocidad": 0, "error": 0}
        with cf.ThreadPoolExecutor(8) as pool:
            futuros = [pool.submit(cloud, t[1], t[2], t[3], t[4], t[5], clave_cloud) for t in trabajos]
            for i, f in enumerate(cf.as_completed(futuros), 1):
                try:
                    hechos[f.result()] += 1
                except Exception as e:  # noqa: BLE001
                    hechos["error"] += 1
                    if hechos["error"] <= 5:
                        print("  error:", e)
                if i % 500 == 0:
                    print(f"  cloud {i}/{len(futuros)} {hechos}", flush=True)
        print("cloud listo:", hechos, flush=True)

    if que in ("todo", "tono"):
        # Otra persona: el mismo texto más grave o más agudo (las voces que lo permiten).
        con_tono = [(v, i) for v, i in voces if "Chirp" not in v and "Studio" not in v]
        trabajos = []
        for voz, idioma in con_tono:
            carpeta = "reserva" if voz in RESERVA_CLOUD else "positivos"
            for texto in POSITIVOS:
                for t in (-5.0, -2.5, 2.5, 5.0):
                    trabajos.append((texto, voz, idioma, 1.0, RAIZ / carpeta / nombre("t", voz, texto, t), t))
        hechos = {"ok": 0, "ya": 0, "sin-velocidad": 0, "error": 0}
        with cf.ThreadPoolExecutor(8) as pool:
            futuros = [pool.submit(cloud, t[0], t[1], t[2], t[3], t[4], clave_cloud, t[5]) for t in trabajos]
            for f in cf.as_completed(futuros):
                try:
                    hechos[f.result()] += 1
                except Exception as e:  # noqa: BLE001
                    hechos["error"] += 1
                    if hechos["error"] <= 5:
                        print("  error:", e, flush=True)
        print(f"tono listo ({len(con_tono)} voces):", hechos, flush=True)

    if que in ("todo", "gemini"):
        pedidos = []
        for voz in GEMINI_VOCES:
            carpeta = "reserva" if voz in RESERVA_GEMINI else "positivos"
            for estilo in ESTILOS:
                for texto in random.sample(POSITIVOS, 2):
                    pedidos.append((estilo + texto, voz, RAIZ / carpeta / nombre("g", voz, estilo, texto)))
            pedidos.append((random.choice(CON_PEDIDO), voz, RAIZ / carpeta / "pedido" / nombre("g", voz, "pedido")))
            for texto in random.sample(NEGATIVOS, 8):
                pedidos.append((texto, voz, RAIZ / ("reserva_neg" if voz in RESERVA_GEMINI else "negativos") / nombre("g", voz, texto)))
        pendientes = [p for p in pedidos if not p[2].exists()]
        print(f"gemini: {len(pendientes)} por generar de {len(pedidos)}", flush=True)
        # Cada modelo tiene su cupo por minuto: se reparten en ronda, uno por modelo a la vez.
        hechos = {"ok": 0, "error": 0}
        with cf.ThreadPoolExecutor(len(GEMINI_MODELOS)) as pool:
            for i in range(0, len(pendientes), len(GEMINI_MODELOS)):
                lote = pendientes[i:i + len(GEMINI_MODELOS)]
                futuros = [pool.submit(gemini, t, v, GEMINI_MODELOS[j], d, clave_vertex) for j, (t, v, d) in enumerate(lote)]
                for f in futuros:
                    try:
                        f.result()
                        hechos["ok"] += 1
                    except Exception as e:  # noqa: BLE001
                        hechos["error"] += 1
                        if hechos["error"] <= 5:
                            print("  error:", e, flush=True)
                if (i // len(GEMINI_MODELOS)) % 20 == 0:
                    print(f"  gemini {i + len(lote)}/{len(pendientes)} {hechos}", flush=True)
        print("gemini listo:", hechos, flush=True)


if __name__ == "__main__":
    main()
