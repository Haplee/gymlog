# LIFT ANALYSIS — Plan de implementación (fase de prototipo)

> Propuesta documentada, sin implementar. Preparado el 2026-07-11.
> Entorno: Python 3.12.10 (winget), venv en `tools/lift-analysis/.venv` (vacío).

---

## 1. OBJETIVO

Analizar vídeos de levantamientos (press banca, sentadilla, peso muerto, press militar) y extraer:

- **Bar path**: trayectoria de la barra (proxy = punto medio de muñecas)
- **Conteo de reps** automático
- **Métricas por rep**: ROM, duración, velocidad media y pico de la concéntrica
- **Vídeo anotado**: trayectoria + esqueleto + HUD (rep, velocidad)

Futuro: guardar métricas junto a la serie en GymLog (VBT, autoregulación por pérdida de velocidad).

---

## 2. STACK TÉCNICO

| Componente              | Rol                                 | Notas                                       |
| ----------------------- | ----------------------------------- | ------------------------------------------- |
| Python 3.12             | Runtime                             | supervision no corre en navegador/Capacitor |
| Ultralytics YOLOv8-pose | Pose estimation (17 keypoints COCO) | Muñecas (kp 9, 10) = proxy de barra         |
| Roboflow Supervision    | Tracking, anotadores, VideoSink     | Evita escribir pipeline OpenCV              |
| opencv-python           | Lectura/escritura frames, HUD       | Dependencia transitiva                      |
| scipy.signal.find_peaks | Suavizado + segmentación de reps    | Savitzky-Golay + find_peaks con prominencia |

**Rendimiento**: CPU ~5-15 fps (yolov8n-pose). Primer arranque descarga modelo ~6 MB.
`pip install ultralytics` arrastra PyTorch CPU ~200 MB.

---

## 3. ARQUITECTURA (FASE 1 — script local)

### 3.1 Estructura de directorios

```
tools/lift-analysis/
├── .venv/                              # YA CREADO (no versionar)
├── requirements.txt                    # ⬜ por crear
├── analyze_lift.py                     # ⬜ CLI principal
├── README.md                           # ⬜ uso y ejemplos
└── out/                                # ⬜ resultados (no versionar)
    ├── <video>_annotated.mp4
    └── <video>_metrics.json
```

### 3.2 Pipeline de procesado

```
[1] YOLOv8-pose por frame → keypoints (muñecas L/R + confianza)
[2] Proxy barra = punto medio de ambas muñecas (si conf ≥ 0.5)
[3] Serie temporal Y(t) + suavizado (Savitzky-Golay, window=11, polyorder=2)
[4] Segmentación reps: find_peaks sobre Y(t). Valles = abajo, picos = arriba.
    Config: prominence ≥ 30% del ROM total, distance ≥ 0.5 s
[5] Métricas por rep: ROM (px), duración (s), velocidad media/pico concéntrica
[6] Render: esqueleto (EdgeAnnotator/VertexAnnotator) + polyline bar path +
    HUD (rep n, velocidad) → VideoSink → mp4
[7] JSON + tabla por consola
```

### 3.3 Decisiones técnicas fijas

```
Proxy de barra:        muñecas COCO (L=9, R=10), punto medio
Confianza mínima:      0.5
Suavizado:             Savitzky-Golay, window_length=11, polyorder=2
Segmentación:          scipy.signal.find_peaks
  prominence:          30% del ROM total (configurable --min-prominence 0.3)
  distance:            0.5 s entre picos (int(fps * 0.5))
Velocidad:             gradiente de Y(t) * fps * escala m/px
ROM:                   |Y(pico) - Y(valle)| * escala m/px
Calibración px→m:      flag --plate-px <n>. Disco olímpico = 450 mm.
                       escala = 0.45 / plate_px m/px
Dos pasadas:           1ª análisis (bar_positions → segment_reps → rep_metrics)
                       2ª render (VideoSink dibujando)
```

### 3.4 CLI

```bash
.venv/Scripts/activate
python analyze_lift.py video.mp4 \
  --out out/ \
  --plate-px 120 \          # opcional
  --min-prominence 0.3 \    # opcional
  --model yolov8n-pose.pt   # opcional
```

### 3.5 Output

```
Reps detectadas: 5
 rep   ROM     dur    v.media   v.pico
  1    0.62 m  1.8 s  0.45 m/s  0.71 m/s
  2    0.61 m  1.9 s  0.42 m/s  0.66 m/s
  ...
Pérdida de velocidad rep 1 → rep 5: 22 %
```

Archivos: `out/<video>_annotated.mp4`, `out/<video>_metrics.json`

---

## 4. ESQUELETO DEL CÓDIGO (analyze_lift.py)

```python
"""Analiza un vídeo de levantamiento: bar path, reps y velocidad.
Uso: python analyze_lift.py video.mp4 [--plate-px N] [--out DIR]
"""
import argparse, json
from pathlib import Path
import cv2, numpy as np
import supervision as sv
from scipy.signal import find_peaks, savgol_filter
from ultralytics import YOLO

WRIST_L, WRIST_R = 9, 10
CONF_MIN = 0.5
PLATE_DIAMETER_M = 0.45

def bar_positions(model, video_path):
    """[(frame_idx, x, y) ...] del punto medio de las muñecas."""
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
    """Valles (barra abajo) y picos (barra arriba) sobre Y suavizada."""
    y = savgol_filter(ys, window_length=min(11, len(ys)//2*2+1), polyorder=2)
    rom = float(np.nanmax(y) - np.nanmin(y))
    prom = rom * min_prominence
    dist = int(fps * 0.5)
    valleys, _ = find_peaks(y, prominence=prom, distance=dist)
    peaks, _ = find_peaks(-y, prominence=prom, distance=dist)
    return y, valleys, peaks

def rep_metrics(y, valleys, peaks, fps, scale_m_per_px):
    """Por cada valle→pico (concéntrica): ROM, duración, velocidades."""
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

# main: argparse → YOLO(model) → bar_positions → segment_reps →
# rep_metrics → 2º pase con VideoSink: EdgeAnnotator + VertexAnnotator
#   (esqueleto), cv2.polylines (bar path), cv2.putText (HUD) → JSON + tabla.
```

---

## 5. DEPENDENCIAS (requirements.txt)

```
ultralytics>=8.3
supervision>=0.25
scipy>=1.14
```

Instalar con:

```bash
.venv/Scripts/pip install -r requirements.txt
```

`opencv-python`, `numpy`, `torch` vienen arrastradas.

---

## 6. LIMITACIONES CONOCIDAS

| Limitación         | Detalle                                        | Alternativa futura                                     |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------ |
| Proxy muñecas      | Solo válido con manos en barra (no mancuernas) | Modelo detección barra (Roboflow Universe) + ByteTrack |
| Ángulo cámara      | Vista lateral ideal; otro ángulo distorsiona   | —                                                      |
| Múltiples personas | MVP coge la primera detección                  | ByteTrack + selección por área/confianza               |
| Velocidad CPU      | 5-15 fps; vídeo 30s → 1-3 min análisis         | GPU en fases posteriores                               |
| Sin calibración    | Velocidades en px/s si no se usa --plate-px    | Calibración automática con HoughCircles                |

---

## 7. ROADMAP DE INTEGRACIÓN CON GYMLOG

| Fase                   | Qué                                                                                                                                                           | Esfuerzo               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **1. Prototipo local** | Script CLI en tools/lift-analysis/; validar con vídeos reales                                                                                                 | ~medio día             |
| **2. Endurecimiento**  | Calibración auto (HoughCircles), tracking (ByteTrack), CSV, tests                                                                                             | 1-2 días               |
| **3. Servicio**        | FastAPI + cola. App sube vídeo a Supabase Storage, edge function encola. Resultados a tabla lift_analyses (user_id, workout_set_id, metrics jsonb, video_url) | 3-5 días + GPU hosting |
| **4. Integración app** | Pantalla GymLog: grabar/subir desde la serie, ver bar path + velocidad en historial, VBT                                                                      | 3-5 días               |

**Pendientes fase 3**: coste hosting GPU, privacidad vídeos, límite tamaño/duración.

---

## 8. ESTADO ACTUAL (para retomar)

| Estado | Elemento                                                                       |
| ------ | ------------------------------------------------------------------------------ |
| ✅     | Python 3.12.10 instalado en `%LOCALAPPDATA%\Programs\Python\Python312`         |
| ✅     | venv creado: `tools/lift-analysis/.venv` (vacío)                               |
| ⬜     | `requirements.txt`, `analyze_lift.py`, `README.md`                             |
| ⬜     | `.gitignore` entries: `tools/lift-analysis/.venv/`, `tools/lift-analysis/out/` |
| ⬜     | Vídeos de prueba (vista lateral, cámara fija)                                  |

Para retomar: _"implementa la fase 1 del plan de docs/LIFT_ANALYSIS_PLAN.md"_.
