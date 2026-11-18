# Entrenamiento de «Oye Vendfy»

El detector de la palabra que corre en el panel (`src/features/piloto/oido/`).
Es la receta de openWakeWord: sus dos modelos fijos (espectrograma mel y
embedding de Google, Apache 2.0) y un clasificador chico entrenado por nosotros
(`public/oido/oye_vendfy.onnx`).

Los datos NO van al repo (≈30 GB). Se arman en `C:\Trabajos\Ecommerce\oye-vendfy\datos\`:

| Qué | De dónde | Licencia |
|---|---|---|
| «Oye Vendfy» y frases parecidas | `generar_tts.py`: 97 voces de Cloud TTS en español + 30 de Gemini TTS (Vertex) | propias |
| Habla en español (negativos) | FLEURS es_419 y Multilingual LibriSpeech (español) | CC BY 4.0 |
| Música, ruido y habla en inglés | MUSAN | CC BY 4.0 |

Los negativos que trae openWakeWord (ACAV100M) son de uso **no comercial**: se usan solo para medir, nunca para entrenar.

## Pasos

```bash
pip install openwakeword==0.6.0 onnx pyarrow soundfile librosa torch
python generar_tts.py            # voces (Cloud TTS con VOZ_TTS_API_KEY, Gemini con VERTEX_API_KEY)
python caracteristicas.py        # embeddings de todo (6 procesos, ~40 min)
python entrenar.py 30000         # GPU; exporta modelo/oye_vendfy.onnx y metricas.json
python audios_prueba.py          # audios para las pruebas de punta a punta
python puntajes_stream.py prueba/positiva.wav   # dónde dispara, paso a paso (igual que el navegador)
```

`claves.py` lee las claves de los `.env` locales sin imprimirlas.

## Estado (18/11/2026) — modelo en uso: v3

Medido como en el panel (dispara con 2 pasos seguidos sobre el umbral 0,5), con
voces que el modelo nunca escuchó (Chirp, Neural2 con otros tonos y Gemini
susurrando, cansado, gritando) y fondo de tienda entre 0 y 20 dB:

| | v1 | v3 (en uso) |
|---|---|---|
| Oye la palabra sola | — | 91,8 % |
| La oye en medio de una conversación | — | 86,0 % |
| Falsas alarmas por hora (22 h de charla, música, tele) | ~50 | 1,7 (0 con charla en español; 3,5 con música y tele) |

Las falsas alarmas que quedan las descarta el servidor (Whisper no encuentra la
palabra) y la tarjeta se cierra sola. Lo que más falla: hablar muy rápido y
algunas voces de Gemini. **Lo que más mejoraría ahora: grabaciones reales** de
personas diciendo «Oye Vendfy» (todo lo de hoy es sintético).

`evaluar.py` mide un modelo, `fallas.py` dice qué voces/estilos fallan y
`v3.sh` arma todo de punta a punta.
