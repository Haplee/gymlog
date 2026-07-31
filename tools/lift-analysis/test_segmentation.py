"""Comprobaciones del núcleo de análisis, sin necesidad de un vídeo.

Se prueban las funciones que hacen las cuentas —rellenar huecos, suavizar,
partir en repeticiones y medirlas— con series inventadas de las que ya se sabe
la respuesta. Es la parte que puede fallar en silencio: si cuenta 4
repeticiones donde hay 5, nadie lo nota mirando el vídeo anotado.

Las funciones que tocan YOLO y OpenCV no se prueban aquí; para eso hace falta un
vídeo real y el modelo descargado.

    .venv/Scripts/python test_segmentation.py
"""

from __future__ import annotations

import sys
import types

import numpy as np

# El módulo importa arriba del todo ultralytics, supervision y cv2, que pesan
# gigas por culpa de torch. Para probar las matemáticas no hacen falta: se
# sustituyen por módulos vacíos antes de importar.
for nombre in ('cv2', 'supervision', 'ultralytics'):
    modulo = types.ModuleType(nombre)
    if nombre == 'ultralytics':
        modulo.YOLO = object
    sys.modules.setdefault(nombre, modulo)

from analyze_lift import (  # noqa: E402
    fill_gaps,
    fix_boundary_extrema,
    rep_metrics,
    segment_reps,
)

FPS = 30.0


def contar(ys: np.ndarray, fps: float = FPS) -> tuple[int, list[str]]:
    """Pasa la serie por el mismo camino que el script y cuenta repeticiones."""
    y, bottoms, tops = segment_reps(ys, fps)
    bottoms, tops, avisos = fix_boundary_extrema(y, bottoms, tops, fps)
    return len(rep_metrics(y, bottoms, tops, fps, 1.0)), avisos


def serie_de_reps(
    n_reps: int, fps: float = FPS, rom_px: float = 300.0, margen_s: float = 1.0
) -> np.ndarray:
    """Y(t) de n repeticiones limpias, con margen antes y después.

    Recuerda que Y crece hacia abajo: la barra arriba es Y pequeña. Se parte de
    la barra abajo, así que un coseno da la forma correcta —empieza en el máximo
    de Y y sube.

    El margen no es decorativo. Sin él la primera y la última repetición
    terminan justo en el borde del array, donde `find_peaks` no puede verlas
    porque le faltan vecinos con los que comparar, y el test contaría n-1
    creyendo que el fallo está en el algoritmo. Un vídeo real siempre trae esos
    segundos de preparación; una señal sintética hay que dárselos a mano.
    """
    muestras_por_rep = int(fps * 2)  # 2 segundos por repetición
    t = np.linspace(0, n_reps * 2 * np.pi, n_reps * muestras_por_rep)
    movimiento = 500 + (rom_px / 2) * np.cos(t)

    quieto = np.full(int(fps * margen_s), movimiento[0])
    return np.concatenate([quieto, movimiento, quieto])


def check(condicion: bool, mensaje: str) -> bool:
    print(f'{"OK  " if condicion else "FALLA"}  {mensaje}')
    return condicion


def main() -> int:
    ok = True

    # --- Contar repeticiones ---------------------------------------------
    # Con margen parado al principio y al final, que es como sale un video real:
    # la persona se coloca, levanta y se queda quieta antes de parar de grabar.
    for n in (1, 3, 5, 8):
        detectadas, _ = contar(serie_de_reps(n))
        ok &= check(detectadas == n, f'{n} reps con margen parado -> cuenta {detectadas}')

    # --- El ruido no debe inventarse repeticiones ------------------------
    rng = np.random.default_rng(42)
    base = serie_de_reps(5)
    detectadas, _ = contar(base + rng.normal(0, 4, len(base)))
    ok &= check(detectadas == 5, f'5 reps con temblor de deteccion -> cuenta {detectadas}')

    # --- Video cortado a mitad de movimiento ------------------------------
    # Aqui la repeticion del borde esta incompleta: contarla daria un recorrido
    # y una velocidad falsos, asi que se cuenta de menos y se avisa.
    ys = serie_de_reps(5, margen_s=0)
    detectadas, avisos = contar(ys)
    ok &= check(len(avisos) > 0, 'video cortado a mitad de movimiento -> avisa')
    ok &= check(detectadas < 5, f'video cortado -> no inventa reps (cuenta {detectadas})')

    _, avisos_limpios = contar(serie_de_reps(5))
    ok &= check(len(avisos_limpios) == 0, 'video con margen -> no avisa')

    # --- Huecos de deteccion ---------------------------------------------
    posiciones: list[tuple[float, float] | None] = [(100.0, float(y)) for y in serie_de_reps(3)]
    # Se tapan las muñecas medio segundo en mitad del movimiento.
    for i in range(60, 75):
        posiciones[i] = None
    xs, ys_rellenos = fill_gaps(posiciones)
    ok &= check(not np.isnan(ys_rellenos).any(), 'los huecos se rellenan sin dejar NaN')
    detectadas, _ = contar(ys_rellenos)
    ok &= check(detectadas == 3, f'3 reps con un hueco de 0,5 s -> cuenta {detectadas}')

    # --- Metricas ---------------------------------------------------------
    ys = serie_de_reps(4, rom_px=300.0)
    y_suave, bottoms, tops = segment_reps(ys, FPS)
    bottoms, tops, _ = fix_boundary_extrema(y_suave, bottoms, tops, FPS)
    # Calibracion inventada: 100 px = 0,45 m -> 0,0045 m/px
    escala = 0.45 / 100
    reps = rep_metrics(y_suave, bottoms, tops, FPS, escala)

    ok &= check(len(reps) == 4, f'mide 4 repeticiones -> {len(reps)}')
    if reps:
        r = reps[0]
        # 300 px de recorrido a 0,0045 m/px = 1,35 m. El suavizado recorta un
        # poco los extremos, asi que se admite margen.
        ok &= check(1.25 < r.rom < 1.40, f'ROM ~1,35 m -> {r.rom:.2f} m')
        # Media rep del coseno = 1 segundo de subida.
        ok &= check(0.85 < r.duration_s < 1.15, f'duracion ~1 s -> {r.duration_s:.2f} s')
        # Velocidad media = recorrido / tiempo.
        esperada = r.rom / r.duration_s
        ok &= check(
            abs(r.mean_velocity - esperada) < 1e-6,
            f'v.media = ROM/duracion -> {r.mean_velocity:.2f} m/s',
        )
        # La de pico sale del instante mas rapido: tiene que ser mayor.
        ok &= check(
            r.peak_velocity > r.mean_velocity,
            f'v.pico ({r.peak_velocity:.2f}) > v.media ({r.mean_velocity:.2f})',
        )

    # --- La pausa previa no entra en la repeticion ------------------------
    # Caso peso muerto: se esta quieto sobre la barra un buen rato antes de
    # tirar. Si esa espera contase como parte del tiron, la duracion crecerian
    # con ella y la velocidad media saldria por los suelos.
    duraciones = []
    for pausa in (1.0, 3.0, 6.0):
        ys = serie_de_reps(3, margen_s=pausa)
        y_suave, bottoms, tops = segment_reps(ys, FPS)
        bottoms, tops, _ = fix_boundary_extrema(y_suave, bottoms, tops, FPS)
        primera = rep_metrics(y_suave, bottoms, tops, FPS, 1.0)[0]
        duraciones.append(primera.duration_s)

    ok &= check(
        max(duraciones) - min(duraciones) < 0.15,
        'la duracion no crece con la pausa previa '
        f'({", ".join(f"{d:.2f}s" for d in duraciones)})',
    )

    # --- Sin ninguna deteccion, error claro -------------------------------
    try:
        fill_gaps([None, None, None])
        ok &= check(False, 'sin detecciones deberia dar error')
    except ValueError:
        ok &= check(True, 'sin detecciones da un error entendible')

    print('\n' + ('Todo correcto.' if ok else 'HAY FALLOS.'))
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
