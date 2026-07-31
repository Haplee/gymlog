"""Analiza un vídeo de levantamiento: trayectoria de barra, repeticiones y velocidad.

Fase 1 del plan de docs/LIFT_ANALYSIS_PLAN.md: prototipo local, sin servicio ni
integración con la app.

    python analyze_lift.py video.mp4 [--plate-px N] [--out DIR]

Qué hace, en orden:

    1. Pasa YOLOv8-pose por cada fotograma y saca los puntos clave.
    2. Usa el punto medio de las dos muñecas como sustituto de la barra.
    3. Suaviza la altura Y(t) y parte la serie en repeticiones.
    4. Mide cada repetición: recorrido, duración y velocidad.
    5. Vuelve a pasar el vídeo dibujando esqueleto, trayectoria y marcador.

Limitaciones conocidas (ver el plan): solo vale con las manos en la barra —no
sirve para mancuernas—, la cámara tiene que estar quieta y de lado, y si hay
varias personas en el plano se queda con la primera detección.

Este script NO es consejo de entrenamiento: mide un vídeo y ya.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

import cv2
import numpy as np
import supervision as sv
from scipy.signal import find_peaks, savgol_filter
from ultralytics import YOLO

# Índices COCO de las muñecas en el modelo de pose de Ultralytics.
WRIST_L, WRIST_R = 9, 10

# Por debajo de esta confianza el fotograma se descarta: una muñeca mal
# localizada mete un salto en la trayectoria que luego parece una repetición.
CONF_MIN = 0.5

# Diámetro de un disco olímpico. Es la referencia para pasar de píxeles a metros.
PLATE_DIAMETER_M = 0.45

# Suavizado Savitzky-Golay. Se queda con la forma del movimiento y se come el
# temblor de la detección, que es justo lo que estropea el conteo.
SAVGOL_WINDOW = 11
SAVGOL_POLYORDER = 2

# Dos repeticiones no pueden empezar a menos de medio segundo una de otra.
MIN_REP_SECONDS = 0.5


@dataclass
class Rep:
    """Una repetición, medida en su fase concéntrica (de abajo a arriba)."""

    index: int
    start_frame: int
    end_frame: int
    rom: float
    duration_s: float
    mean_velocity: float
    peak_velocity: float


def bar_positions(model: YOLO, video_path: str) -> list[tuple[float, float] | None]:
    """Posición de la barra en cada fotograma, o None si no se pudo leer.

    Se devuelve el punto medio de las dos muñecas. No es la barra, pero se mueve
    con ella y no hace falta entrenar un detector propio.
    """
    positions: list[tuple[float, float] | None] = []

    for frame in sv.get_video_frames_generator(video_path):
        result = model(frame, verbose=False)[0]
        keypoints = sv.KeyPoints.from_ultralytics(result)

        if len(keypoints.xy) == 0 or keypoints.confidence is None:
            positions.append(None)
            continue

        xy, conf = keypoints.xy[0], keypoints.confidence[0]
        if len(xy) <= WRIST_R:
            positions.append(None)
            continue

        if conf[WRIST_L] < CONF_MIN or conf[WRIST_R] < CONF_MIN:
            positions.append(None)
            continue

        mid = (xy[WRIST_L] + xy[WRIST_R]) / 2
        positions.append((float(mid[0]), float(mid[1])))

    return positions


def fill_gaps(
    positions: list[tuple[float, float] | None],
) -> tuple[np.ndarray, np.ndarray, int]:
    """Interpola los huecos interiores y RECORTA los extremos sin detección.

    Los huecos de en medio se interpolan: el suavizado y `find_peaks` no admiten
    NaN, y en cualquier vídeo real hay fotogramas donde la muñeca se tapa.

    Los extremos son otra cosa y hay que recortarlos, no rellenarlos. Rellenar
    repitiendo el último valor bueno inventa una meseta plana con la altura que
    tuviera la barra en ese instante. Medido en un vídeo real de sentadilla:
    la detección moría a falta de 5 segundos, justo con la barra abajo, y esos
    5 segundos de meseta falsa dejaban la última repetición sin prominencia por
    la derecha — `find_peaks` no la veía y el conteo salía a la mitad.

    Devuelve (xs, ys, offset), donde `offset` es el fotograma del vídeo en el
    que empiezan los datos, para poder volver a mapear las repeticiones sobre el
    vídeo original.
    """
    n = len(positions)
    xs = np.full(n, np.nan)
    ys = np.full(n, np.nan)
    for i, p in enumerate(positions):
        if p is not None:
            xs[i], ys[i] = p

    known = ~np.isnan(ys)
    if not known.any():
        raise ValueError(
            'No se ha detectado ninguna postura en el vídeo. '
            'Comprueba que se ve a la persona entera y de lado.'
        )

    primero = int(np.argmax(known))
    ultimo = int(len(known) - 1 - np.argmax(known[::-1]))
    xs, ys, known = xs[primero : ultimo + 1], ys[primero : ultimo + 1], known[primero : ultimo + 1]

    idx = np.arange(len(ys))
    xs = np.interp(idx, idx[known], xs[known])
    ys = np.interp(idx, idx[known], ys[known])
    return xs, ys, primero


def smooth(ys: np.ndarray) -> np.ndarray:
    """Aplica Savitzky-Golay ajustando la ventana a vídeos cortos."""
    window = min(SAVGOL_WINDOW, len(ys))
    if window % 2 == 0:
        window -= 1
    if window <= SAVGOL_POLYORDER:
        # Menos fotogramas que el orden del polinomio: no hay nada que suavizar.
        return ys.astype(float)
    return savgol_filter(ys, window_length=window, polyorder=SAVGOL_POLYORDER)


def segment_reps(
    ys: np.ndarray, fps: float, min_prominence: float = 0.3
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Localiza los puntos de barra abajo y barra arriba.

    Ojo con el signo: en una imagen, Y crece hacia abajo. La barra en su punto
    más alto es un MÍNIMO de Y, y en su punto más bajo un MÁXIMO. Por eso lo que
    aquí se llama «abajo» sale de buscar máximos y «arriba» de buscar mínimos.

    La prominencia mínima se calcula sobre el recorrido total: así el umbral se
    adapta solo a un peso muerto y a un press militar sin tocar nada.
    """
    y = smooth(ys)
    rom_total = float(np.max(y) - np.min(y))
    prominence = rom_total * min_prominence
    distance = max(1, int(fps * MIN_REP_SECONDS))

    bottoms, _ = find_peaks(y, prominence=prominence, distance=distance)
    tops, _ = find_peaks(-y, prominence=prominence, distance=distance)
    return y, bottoms, tops


def fix_boundary_extrema(
    y: np.ndarray, bottoms: np.ndarray, tops: np.ndarray, fps: float
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Recupera la repetición que se pierde en el primer o el último fotograma.

    `find_peaks` solo reconoce un máximo o un mínimo si tiene vecinos a los dos
    lados con los que compararlo, así que nunca ve uno que caiga en el borde del
    vídeo. Y ese caso es de lo más normal: se termina la última repetición, se
    deja la barra arriba y se para la grabación. El punto alto final queda en el
    borde, no se detecta, y la última repetición desaparece de la cuenta sin que
    nada avise.

    Para decidir si el borde es un extremo de verdad se mira si la barra está
    QUIETA ahí:

      - Quieta = la persona está parada arriba o abajo. El extremo es real y la
        repetición está entera, así que se añade a mano.
      - En movimiento = la grabación pilló el levantamiento a medias. Esa
        repetición está cortada y no se cuenta: medirla daría un recorrido y una
        velocidad falsos. Se devuelve un aviso en su lugar.

    Devuelve (bottoms, tops, avisos).
    """
    avisos: list[str] = []
    rango = float(np.max(y) - np.min(y))
    if rango == 0 or len(y) < 3:
        return bottoms, tops, avisos

    minimo, maximo = float(np.min(y)), float(np.max(y))
    ventana = max(3, min(int(fps * 0.3), len(y) // 4))
    # Se considera quieta si en ese tramo apenas se mueve comparado con el
    # recorrido completo de la serie.
    umbral_quieto = rango * 0.05
    # Y «en un extremo» si está en el 15% de arriba o de abajo del recorrido.
    umbral_extremo = rango * 0.15

    def fin_de_la_pausa(desde_el_principio: bool) -> int:
        """Índice en el que la barra deja de estar parada (o empieza a estarlo).

        Importa para no meter la pausa dentro de la repetición. En un peso
        muerto uno está quieto sobre la barra un buen rato antes de tirar; si
        ese tiempo cuenta como parte del tirón, la duración se dispara y la
        velocidad media sale por los suelos.
        """
        referencia = float(y[0] if desde_el_principio else y[-1])
        recorrido = range(len(y)) if desde_el_principio else range(len(y) - 1, -1, -1)
        ultimo = 0 if desde_el_principio else len(y) - 1
        for i in recorrido:
            if abs(float(y[i]) - referencia) >= umbral_quieto:
                break
            ultimo = i
        return ultimo

    def revisar(indice: int, tramo: np.ndarray, lado: str) -> None:
        nonlocal bottoms, tops
        valor = float(y[indice])
        quieta = float(tramo.max() - tramo.min()) < umbral_quieto

        en_abajo = abs(valor - maximo) < umbral_extremo  # Y grande = barra abajo
        en_arriba = abs(valor - minimo) < umbral_extremo

        if not (en_abajo or en_arriba):
            return

        if quieta:
            indice = fin_de_la_pausa(desde_el_principio=(indice == 0))
            if en_abajo and indice not in bottoms:
                bottoms = np.sort(np.append(bottoms, indice))
            elif en_arriba and indice not in tops:
                tops = np.sort(np.append(tops, indice))
        else:
            avisos.append(
                f'El vídeo {lado} pilla la barra en movimiento cerca de un '
                'extremo: puede haber una repetición cortada que no se ha '
                'contado. Deja un par de segundos de margen al grabar.'
            )

    revisar(0, y[:ventana], 'empieza y')
    revisar(len(y) - 1, y[-ventana:], 'acaba y')
    return bottoms, tops, avisos


def rep_metrics(
    y: np.ndarray,
    bottoms: np.ndarray,
    tops: np.ndarray,
    fps: float,
    scale: float,
) -> list[Rep]:
    """Mide cada tramo de abajo a arriba, que es la fase que interesa en VBT.

    La velocidad media se calcula como recorrido entre tiempo, no promediando la
    velocidad instantánea. No son lo mismo: promediar el gradiente cuenta también
    las correcciones y los micro-parones, y da un número más alto que la
    velocidad con la que la barra realmente sube. La de pico sí sale del
    gradiente, porque ahí lo que se busca es el instante más rápido.
    """
    reps: list[Rep] = []

    for bottom in bottoms:
        siguientes = tops[tops > bottom]
        if len(siguientes) == 0:
            break
        top = int(siguientes[0])
        bottom = int(bottom)

        segmento = y[bottom : top + 1]
        if len(segmento) < 2:
            continue

        duracion = (top - bottom) / fps
        rom = abs(float(y[top] - y[bottom])) * scale
        if duracion <= 0:
            continue

        instantanea = np.abs(np.gradient(segmento)) * fps * scale

        reps.append(
            Rep(
                index=len(reps) + 1,
                start_frame=bottom,
                end_frame=top,
                rom=rom,
                duration_s=duracion,
                mean_velocity=rom / duracion,
                peak_velocity=float(instantanea.max()),
            )
        )

    return reps


def render(
    model: YOLO,
    video_path: str,
    info: sv.VideoInfo,
    xs: np.ndarray,
    ys: np.ndarray,
    reps: list[Rep],
    unidad: str,
    destino: Path,
    offset: int = 0,
) -> None:
    """Segunda pasada: vuelve a recorrer el vídeo dibujando encima.

    Se hace en dos pasadas y no en una porque el marcador necesita saber cuántas
    repeticiones hay en total, y eso no se sabe hasta haber visto el vídeo entero.
    """
    edge_annotator = sv.EdgeAnnotator(thickness=2)
    vertex_annotator = sv.VertexAnnotator(radius=4)

    # Fotograma en el que termina cada repetición, para saber por cuál vamos.
    finales = [rep.end_frame for rep in reps]

    with sv.VideoSink(target_path=str(destino), video_info=info) as sink:
        for i, frame in enumerate(sv.get_video_frames_generator(video_path)):
            result = model(frame, verbose=False)[0]
            keypoints = sv.KeyPoints.from_ultralytics(result)

            if len(keypoints.xy) > 0:
                frame = edge_annotator.annotate(scene=frame, key_points=keypoints)
                frame = vertex_annotator.annotate(scene=frame, key_points=keypoints)

            # Trayectoria recorrida hasta este fotograma. `xs`/`ys` empiezan en
            # `offset` (los extremos sin detección se recortaron), así que hay
            # que restarlo o la estela se dibujaría adelantada.
            j = i - offset
            if 1 < j < len(xs):
                estela = np.stack([xs[: j + 1], ys[: j + 1]], axis=1).astype(np.int32)
                cv2.polylines(frame, [estela], False, (0, 217, 255), 2)

            rep_actual = sum(1 for f in finales if f <= i)
            texto = f'Rep {rep_actual}/{len(reps)}'
            if 0 < rep_actual <= len(reps):
                r = reps[rep_actual - 1]
                texto += f'  {r.mean_velocity:.2f} {unidad}'

            cv2.putText(
                frame, texto, (16, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 5
            )
            cv2.putText(
                frame, texto, (16, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 217, 255), 2
            )

            sink.write_frame(frame)


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Bar path, conteo de repeticiones y velocidad a partir de un vídeo.'
    )
    parser.add_argument('video', help='Vídeo a analizar (vista lateral, cámara fija).')
    parser.add_argument('--out', default='out', help='Carpeta de resultados.')
    parser.add_argument(
        '--plate-px',
        type=float,
        default=None,
        help='Diámetro del disco en píxeles. Sin esto, las medidas salen en '
        'píxeles en vez de en metros.',
    )
    parser.add_argument('--min-prominence', type=float, default=0.3)
    parser.add_argument('--model', default='yolov8n-pose.pt')
    parser.add_argument(
        '--no-video', action='store_true', help='Solo métricas, sin vídeo anotado.'
    )
    args = parser.parse_args()

    video = Path(args.video)
    if not video.exists():
        print(f'No existe el vídeo: {video}', file=sys.stderr)
        return 1

    destino = Path(args.out)
    destino.mkdir(parents=True, exist_ok=True)

    # Sin calibrar, la escala es 1 y todo queda en píxeles. Se avisa por pantalla
    # y se refleja en la unidad del JSON: un número en px/s presentado como m/s
    # sería mentira.
    if args.plate_px:
        escala = PLATE_DIAMETER_M / args.plate_px
        unidad, unidad_rom = 'm/s', 'm'
    else:
        escala = 1.0
        unidad, unidad_rom = 'px/s', 'px'
        print('Sin --plate-px: las medidas van en píxeles, no en metros.')

    info = sv.VideoInfo.from_video_path(str(video))
    fps = float(info.fps)

    print(f'Analizando {video.name} ({info.total_frames or "?"} fotogramas, {fps:.0f} fps)...')
    model = YOLO(args.model)

    posiciones = bar_positions(model, str(video))
    detectados = sum(1 for p in posiciones if p is not None)
    if detectados == 0:
        print(
            'No se han detectado muñecas con suficiente confianza en ningún '
            'fotograma. Prueba con el vídeo grabado de lado y con la persona '
            'entera en cuadro.',
            file=sys.stderr,
        )
        return 2
    print(f'Muñecas detectadas en {detectados}/{len(posiciones)} fotogramas.')

    xs, ys, offset = fill_gaps(posiciones)
    if offset or len(ys) < len(posiciones):
        recortado = (len(posiciones) - len(ys)) / fps
        print(f'Recortados {recortado:.1f} s sin detección al principio o al final.')

    y_suave, bottoms, tops = segment_reps(ys, fps, args.min_prominence)
    bottoms, tops, avisos = fix_boundary_extrema(y_suave, bottoms, tops, fps)
    reps = rep_metrics(y_suave, bottoms, tops, fps, escala)

    # Los índices vuelven a ser del vídeo, no del tramo recortado: el marcador
    # del render y el JSON tienen que referirse a lo que se ve en pantalla.
    for r in reps:
        r.start_frame += offset
        r.end_frame += offset

    for aviso in avisos:
        print(f'\nAviso: {aviso}')

    # Tabla por consola.
    print(f'\nReps detectadas: {len(reps)}')
    if reps:
        print(f'{"rep":>4} {"ROM":>10} {"dur":>7} {"v.media":>11} {"v.pico":>11}')
        for r in reps:
            print(
                f'{r.index:>4} {r.rom:>8.2f} {unidad_rom:<2} {r.duration_s:>6.1f}s '
                f'{r.mean_velocity:>8.2f} {unidad:<3} {r.peak_velocity:>8.2f} {unidad:<3}'
            )

        perdida = None
        if len(reps) > 1 and reps[0].mean_velocity > 0:
            perdida = (1 - reps[-1].mean_velocity / reps[0].mean_velocity) * 100
            print(f'\nPérdida de velocidad rep 1 → rep {len(reps)}: {perdida:.0f} %')
    else:
        perdida = None
        print(
            'No se ha segmentado ninguna repetición. Si el vídeo tiene varias, '
            'prueba a bajar --min-prominence.'
        )

    metrics_path = destino / f'{video.stem}_metrics.json'
    metrics_path.write_text(
        json.dumps(
            {
                'video': video.name,
                'fps': fps,
                'frames': len(posiciones),
                'frames_con_deteccion': detectados,
                'calibrado': bool(args.plate_px),
                'unidad_velocidad': unidad,
                'unidad_rom': unidad_rom,
                'escala_m_por_px': escala if args.plate_px else None,
                'reps': [asdict(r) for r in reps],
                'perdida_velocidad_pct': perdida,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding='utf-8',
    )
    print(f'\nMétricas: {metrics_path}')

    if not args.no_video:
        video_path = destino / f'{video.stem}_annotated.mp4'
        print('Renderizando vídeo anotado (segunda pasada)...')
        # Se dibuja la trayectoria suavizada, no la cruda: la detección de la
        # muñeca tiembla unos píxeles por fotograma y en bruto sale un garabato
        # del que no se lee nada. Suavizada se ve la línea que hace la barra,
        # que es justo lo que se mira en un bar path.
        render(model, str(video), info, smooth(xs), y_suave, reps, unidad, video_path, offset)
        print(f'Vídeo:     {video_path}')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
