#!/usr/bin/env bash
# v3: con las voces de Gemini y las de tono. Espera a que terminen Gemini y la v2d.
set -u
cd "$(dirname "$0")"
D=../datos
export PYTHONIOENCODING=utf-8
until grep -q "^fin" $D/tts_gemini.log 2>/dev/null; do sleep 20; done
until grep -qE "exportado|Traceback" $D/entrenar_v2d.log 2>/dev/null; do sleep 20; done
for p in positivos contexto flujo tts; do
  python caracteristicas.py $p > $D/car_v3_$p.log 2>&1 || echo "falló $p" >> $D/v3_fallas.log
done
OCULTAS=256 APAGADO=0.2 PESO_NEG=40 SALIDA=oye_vendfy_v3a.onnx python entrenar.py 40000 > $D/entrenar_v3a.log 2>&1
OCULTAS=512 APAGADO=0.25 PESO_NEG=40 SALIDA=oye_vendfy_v3b.onnx python entrenar.py 40000 > $D/entrenar_v3b.log 2>&1
for m in v3a v3b; do python evaluar.py ../modelo/oye_vendfy_$m.onnx > $D/evaluar_$m.log 2>&1; done
echo fin > $D/v3_fin.log
