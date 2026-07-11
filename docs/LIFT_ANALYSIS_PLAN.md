# Análisis de levantamientos con Roboflow Supervision — Plan de implementación

> **Estado:** propuesta documentada, sin implementar. Preparado el 2026-07-11.
> **Entorno ya preparado:** Python 3.12.10 instalado (winget) y venv creado en
> `tools/lift-analysis/.venv` (vacío, sin dependencias instaladas todavía).

---

## 1. Objetivo

Analizar vídeos de levantamientos (press banca, sentadilla, peso muerto, press
militar) y extraer automáticamente:

- **Bar path** (trayectoria de la barra): la línea que dibuja la barra durante
  el levantamiento. Un bar path vertical y consistente = buena técnica.
- **Conteo de repeticiones** automático.
- **Métricas por repetición**: ROM (rango de movimiento), duración, velocidad
  media y pico de la fase concéntrica (base del entrenamiento por velocidad, VBT).
- **Vídeo anotado**: el vídeo original con la trayectoria, el esqueleto y un
  HUD con rep actual y velocidad superpuestos.

Encaja con GymLog porque las métricas (reps, velocidad media, pérdida de
velocidad entre reps) podrían en el futuro guardarse junto a la serie en la app.

---

## 2. Qué es cada pieza del stack

| Pieza                                           | Rol                                                                                                                  | Por qué                                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Python 3.12**                                 | Runtime del prototipo                                                                                                | `supervision` es una librería Python; no corre en navegador ni en Capacitor                                  |
| **Ultralytics YOLOv8-pose** (`yolov8n-pose.pt`) | Estimación de pose humana (17 keypoints COCO) por frame                                                              | Las muñecas (keypoints 9 y 10) son un proxy fiable de la posición de la barra cuando las manos están en ella |
| **Roboflow Supervision** (`supervision`)        | Tracking, anotadores (trazas, esqueleto, etiquetas), utilidades de vídeo (`VideoSink`, `get_video_frames_generator`) | Evita escribir a mano el pipeline de anotación y el manejo de vídeo con OpenCV                               |
| **OpenCV** (`opencv-python`)                    | Lectura/escritura de frames, dibujado del HUD                                                                        | Dependencia de ambas anteriores                                                                              |
| **NumPy / SciPy**                               | Suavizado de la señal y detección de picos (`scipy.signal.find_peaks`)                                               | Segmentar reps de forma robusta                                                                              |

**Nota importante:** la primera ejecución de Ultralytics descarga el modelo
(`yolov8n-pose.pt`, ~6 MB) y `pip install ultralytics` arrastra PyTorch
(~200 MB, build CPU en Windows). En CPU se procesa a ~5-15 fps con el modelo
nano — suficiente para análisis offline de un vídeo grabado.

---

## 3. Arquitectura del prototipo (fase 1 — script local)

```
tools/lift-analysis/
├── .venv/                  # entorno aislado (YA CREADO, no versionar)
├── requirements.txt        # ultralytics, supervision, scipy
├── analyze_lift.py         # CLI principal
├── README.md               # uso y ejemplos
└── out/                    # resultados (no versionar)
    ├── <video>_annotated.mp4
    └── <video>_metrics.json
```

Añadir a `.gitignore`: `tools/lift-analysis/.venv/` y `tools/lift-analysis/out/`.

### 3.1. Pipeline de procesado

```
vídeo.mp4
  → [1] YOLOv8-pose por frame → keypoints (muñecas L/R, con confianza)
  → [2] Proxy de barra = punto medio de ambas muñecas (si conf ≥ 0.5)
  → [3] Serie temporal Y(t) de la barra + suavizado (media móvil ~5 frames
        o Savitzky-Golay) para eliminar jitter del modelo
  → [4] Segmentación de reps: find_peaks sobre Y(t) suavizada con
        `prominence` mínima (fracción del ROM total, p.ej. 30%) y
        `distance` mínima entre picos (p.ej. 0.5 s) → valles/picos
        = transiciones excéntrica/concéntrica
  → [5] Métricas por rep: ROM (px), duración (s), velocidad media y pico
        de la concéntrica (px/s; × escala → m/s si hay calibración)
  → [6] Render: supervision EdgeAnnotator/VertexAnnotator (esqueleto) +
        traza del bar path (polyline acumulada) + HUD (rep n, velocidad)
        → VideoSink → mp4 anotado
  → [7] JSON con el resumen + tabla por consola
```

### 3.2. Calibración píxeles → metros (opcional pero recomendable)

Sin referencia física las velocidades salen en px/s (sirven para comparar reps
del mismo vídeo, no entre vídeos). Dos opciones:

- **Manual (MVP):** flag `--plate-px <n>`: el usuario mide en un frame cuántos
  píxeles ocupa el diámetro del disco. Un disco olímpico de 45 lb/20 kg mide
  **450 mm** → `escala = 0.45 / plate_px` m/px.
- **Automática (futuro):** detectar el disco con HoughCircles (OpenCV) o un
  modelo de detección de barra/discos de Roboflow Universe y calibrar solo.

### 3.3. Interfaz CLI propuesta

```bash
# activar el venv ya creado
tools/lift-analysis/.venv/Scripts/activate      # (Windows)

python analyze_lift.py video_sentadilla.mp4 \
  --out out/ \
  --plate-px 120 \          # opcional: calibración (px del diámetro del disco)
  --min-prominence 0.3 \    # opcional: sensibilidad del conteo de reps
  --model yolov8n-pose.pt   # opcional: s/m para más precisión (más lento)
```

Salida por consola (además del mp4 y el json):

```
Reps detectadas: 5
 rep   ROM     dur    v.media   v.pico
  1    0.62 m  1.8 s  0.45 m/s  0.71 m/s
  2    0.61 m  1.9 s  0.42 m/s  0.66 m/s
  ...
Pérdida de velocidad rep 1 → rep 5: 22 %   (VBT: >20 % ≈ acercándose al fallo)
```

### 3.4. Esqueleto de referencia de `analyze_lift.py`

```python
"""Analiza un vídeo de levantamiento: bar path, reps y velocidad.

Uso: python analyze_lift.py video.mp4 [--plate-px N] [--out DIR]
"""
import argparse, json
from pathlib import Path

import cv2
import numpy as np
import supervision as sv
from scipy.signal import find_peaks, savgol_filter
from ultralytics import YOLO

WRIST_L, WRIST_R = 9, 10          # índices COCO de muñecas
CONF_MIN = 0.5
PLATE_DIAMETER_M = 0.45           # disco olímpico estándar


def bar_positions(model, video_path):
    """Devuelve [(frame_idx, x, y) ...] del punto medio de las muñecas."""
    positions = []
    for i, frame in enumerate(sv.get_video_frames_generator(video_path)):
        result = model(frame, verbose=False)[0]
        kp = sv.KeyPoints.from_ultralytics(result)
        if len(kp.xy) == 0:
            positions.append(None); continue
        xy, conf = kp.xy[0], kp.confidence[0]
        if conf[WRIST_L] < CONF_MIN or conf[WRIST_R] < CONF_MIN:
            positions.append(None); continue
        mid = (xy[WRIST_L] + xy[WRIST_R]) / 2
        positions.append((i, float(mid[0]), float(mid[1])))
    return positions


def segment_reps(ys, fps, min_prominence=0.3):
    """Valles (barra abajo) y picos (barra arriba) sobre la Y suavizada."""
    y = savgol_filter(ys, window_length=min(11, len(ys) // 2 * 2 + 1), polyorder=2)
    rom = float(np.nanmax(y) - np.nanmin(y))
    prom = rom * min_prominence
    dist = int(fps * 0.5)
    valleys, _ = find_peaks(y, prominence=prom, distance=dist)    # y crece hacia abajo
    peaks, _ = find_peaks(-y, prominence=prom, distance=dist)
    return y, valleys, peaks


def rep_metrics(y, valleys, peaks, fps, scale_m_per_px):
    """Por cada valle→pico siguiente (concéntrica): ROM, duración, velocidades."""
    reps = []
    for v in valleys:
        nxt = peaks[peaks > v]
        if len(nxt) == 0: break
        p = nxt[0]
        seg = y[v:p + 1]
        vel = np.abs(np.gradient(seg)) * fps * scale_m_per_px
        reps.append({
            "rom": float(abs(y[p] - y[v])) * scale_m_per_px,
            "duration_s": (p - v) / fps,
            "mean_velocity": float(vel.mean()),
            "peak_velocity": float(vel.max()),
        })
    return reps


# main: parsear args → YOLO(model) → bar_positions → segment_reps →
# rep_metrics → segundo pase con VideoSink dibujando esqueleto
# (sv.EdgeAnnotator / sv.VertexAnnotator), polyline del bar path acumulado
# (cv2.polylines) y HUD (cv2.putText: rep actual + velocidad) → JSON + tabla.
```

_(El script completo se escribe al implementar; este esqueleto fija las
decisiones: proxy por muñecas, Savitzky-Golay, find_peaks con prominencia
relativa, gradiente para velocidad, dos pasadas — una de análisis y otra de
render.)_

---

## 4. Dependencias (`requirements.txt`)

```
ultralytics>=8.3
supervision>=0.25
scipy>=1.14
```

(`opencv-python`, `numpy` y `torch` vienen arrastradas por las dos primeras.)

Instalación (el venv ya existe):

```bash
tools/lift-analysis/.venv/Scripts/pip install -r tools/lift-analysis/requirements.txt
```

---

## 5. Limitaciones conocidas del enfoque

- **Proxy por muñecas**: válido cuando las manos están en la barra (banca,
  militar, peso muerto, sentadilla low/high-bar). No sirve para mancuernas
  independientes ni ejercicios sin barra. Alternativa futura: modelo de
  detección de barra/discos (Roboflow Universe) + `sv.ByteTrack`.
- **Cámara**: debe estar razonablemente estática y perpendicular al plano del
  levantamiento (vista lateral ideal). Grabaciones en ángulo distorsionan el
  bar path y la escala.
- **Una persona en plano**: si hay más gente, hay que quedarse con la detección
  de mayor confianza/área (o trackear con ByteTrack). El esqueleto del MVP coge
  la primera.
- **Velocidad en CPU**: ~5-15 fps con `yolov8n-pose` — un vídeo de 30 s tarda
  1-3 min. Aceptable para análisis offline; para tiempo real haría falta GPU.
- **Sin calibración** las velocidades son relativas (px/s).

---

## 6. Roadmap de integración con GymLog

| Fase                                    | Qué                                                                                                                                                                                                    | Esfuerzo                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **1. Prototipo local** (esta propuesta) | Script CLI en `tools/lift-analysis/`; validar precisión de conteo y bar path con vídeos reales propios                                                                                                 | ~medio día                                                         |
| **2. Endurecimiento**                   | Calibración automática por disco, selección de persona por tracking, tests con vídeos de los 4 levantamientos, export CSV                                                                              | 1-2 días                                                           |
| **3. Servicio**                         | FastAPI + cola de trabajos; la app sube el vídeo (Supabase Storage) y una edge function encola el análisis; resultados a una tabla `lift_analyses` (user_id, workout_set_id, metrics jsonb, video_url) | 3-5 días + hosting con GPU o CPU potente (Modal/Replicate/Railway) |
| **4. Integración app**                  | Pantalla en GymLog: grabar/subir vídeo desde la serie, ver bar path y velocidad junto al historial; VBT (autoregulación por pérdida de velocidad)                                                      | 3-5 días                                                           |

Decisiones pendientes para la fase 3: coste del hosting GPU, privacidad de los
vídeos (¿se borran tras analizar?), y límite de tamaño/duración de subida.

---

## 7. Estado actual del entorno (para retomar)

- ✅ Python 3.12.10 instalado en `%LOCALAPPDATA%\Programs\Python\Python312`
  (via `winget install Python.Python.3.12`).
- ✅ venv creado: `tools/lift-analysis/.venv` (vacío — falta `pip install -r requirements.txt`).
- ⬜ `requirements.txt`, `analyze_lift.py` y `README.md` sin crear (secciones 3-4 de este doc).
- ⬜ Añadir `tools/lift-analysis/.venv/` y `tools/lift-analysis/out/` a `.gitignore`.
- ⬜ Vídeos de prueba propios (vista lateral, cámara fija) para validar.

Para retomar: "implementa la fase 1 del plan de `docs/LIFT_ANALYSIS_PLAN.md`".
