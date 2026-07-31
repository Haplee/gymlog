# Lift Analysis — análisis de vídeo (prototipo)

Mide un vídeo de un levantamiento y saca la trayectoria de la barra, cuántas
repeticiones hay y a qué velocidad sube cada una (VBT).

Es un **prototipo local**: se ejecuta a mano en el ordenador y no está conectado
con la app. El plan completo, incluido el camino hasta integrarlo, está en
[`docs/LIFT_ANALYSIS_PLAN.md`](../../docs/LIFT_ANALYSIS_PLAN.md).

## Instalación

Necesita Python 3.12.

```bash
cd tools/lift-analysis
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # Linux/macOS: .venv/bin/pip
```

La primera ejecución descarga sola el modelo `yolov8n-pose.pt` (~7 MB).

## Uso

```bash
.venv/Scripts/python analyze_lift.py sentadilla.mp4 --plate-px 120
```

| Opción                    | Para qué                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `--plate-px N`            | Diámetro del disco medido en píxeles. **Sin esto todo sale en píxeles**, no en metros.                                                |
| `--out DIR`               | Dónde dejar los resultados (por defecto `out/`).                                                                                      |
| `--min-prominence 0.3`    | Cuánto tiene que subir la barra para contar como repetición, como fracción del recorrido total. Bájalo si se le escapan repeticiones. |
| `--model yolov8n-pose.pt` | Otro modelo de pose. Los grandes afinan más y tardan bastante más.                                                                    |
| `--no-video`              | Solo las métricas, sin renderizar. Es mucho más rápido.                                                                               |

### Cómo medir `--plate-px`

Abre un fotograma del vídeo en cualquier visor, mide el disco de lado a lado en
píxeles y pasa ese número. El disco olímpico mide 450 mm, y de ahí sale la
escala. Sin calibrar, el script sigue funcionando y las velocidades salen en
px/s: valen para comparar repeticiones del **mismo** vídeo, no entre vídeos.

## Salida

```
out/<video>_metrics.json     ROM, duración y velocidades por repetición
out/<video>_annotated.mp4    esqueleto, trayectoria y marcador dibujados
```

Por consola sale además una tabla y la pérdida de velocidad de la primera
repetición a la última, que es el indicador que se usa para decidir cuándo
cortar una serie.

## Cómo grabar para que funcione

- **De lado** y con la cámara quieta (un trípode o el móvil apoyado).
- **Persona entera en cuadro**, sin que se salgan las manos.
- **Una sola persona** en el plano: si hay más, se queda con la primera.
- Buena luz. Con poca luz la detección va a saltos y se inventa repeticiones.

## Comprobaciones

El conteo de repeticiones y las métricas tienen pruebas propias que no necesitan
ni vídeo ni modelo: se les dan señales inventadas de las que ya se sabe la
respuesta. Solo hacen falta numpy y scipy.

```bash
.venv/Scripts/python test_segmentation.py
```

Cubren el conteo con y sin ruido, los huecos de detección, que la pausa antes de
tirar no infle la duración de la repetición, y que un vídeo cortado a mitad de
movimiento avise en lugar de inventarse una repetición incompleta.

Lo que tocan YOLO y OpenCV no está cubierto: para eso hace falta un vídeo real.

## Lo que no hace

- **Solo con las manos en la barra.** La posición de la barra se deduce del punto
  medio de las muñecas, así que con mancuernas no sirve.
- **La cámara no puede moverse.** Un travelling desplaza la trayectoria entera.
- **Va lento en CPU:** entre 5 y 15 fotogramas por segundo. Un vídeo de 30
  segundos tarda de uno a tres minutos, y el doble si además se renderiza.
- **Lo que hagas DESPUÉS de la última repetición contamina la medida.** Es la
  limitación más seria, vista en un vídeo real: al terminar la serie sigues
  moviéndote para enracar la barra, y el punto más alto que encuentra el
  algoritmo cae dentro de ese gesto, no en el bloqueo de la repetición. El
  resultado es una duración inflada y una velocidad media hundida — en la prueba
  midió 3,5 s y 0,18 m/s donde lo real rondaba 2 s y 0,3 m/s. El recorrido no se
  ve afectado y sale bien. Mientras no haya una detección del final de la serie,
  fíate del ROM y de la velocidad de pico más que de la media.
- **Una pausa EN MEDIO de la serie se cuela en la medida.** La pausa de antes de
  la primera repetición sí se descuenta, pero si paras arriba entre
  repeticiones, ese tiempo se reparte en la duración. Afecta sobre todo a
  sentadillas con parada y a press con pausa.
- **No corrige la técnica.** Mide un movimiento; interpretarlo es cosa tuya o de
  quien te entrene.

## Probado con vídeo real

Sentadilla con barra, móvil en vertical (474×850), 58 fps, 35 segundos, vista
lateral y cuerpo entero.

| Qué                        | Resultado                                           |
| -------------------------- | --------------------------------------------------- |
| Muñecas detectadas         | 1661 de 2038 fotogramas (82 %)                      |
| Repeticiones               | 1, que es lo que había                              |
| Recorrido de la barra      | 0,62 m, calibrado con `--plate-px 140`              |
| Duración y velocidad media | infladas por el gesto de enracar (ver limitaciones) |
| Tiempo de proceso          | ~2 min de análisis + ~2 min de render, en CPU       |

Que detectase el 82 % pese a llevar la barra a la espalda —con una muñeca medio
tapada casi todo el rato— es la respuesta a la duda de si el truco de las
muñecas aguantaba un caso real. Aguanta.

## Estado

Nada de esto está conectado con la app todavía. La tabla donde vivirán los
resultados existe ya en Supabase
(`supabase/migrations/20260731130000_lift_analyses.sql`), pero está vacía y no la
escribe nadie: falta el servicio que procese los vídeos. El camino completo está
en el plan.
