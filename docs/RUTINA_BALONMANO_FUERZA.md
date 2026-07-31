# Rutina Balonmano + Fuerza — análisis y diseño

> Bloque 4 del plan de mejora integral. El análisis sale de los datos reales
> registrados en la app entre el **8 de abril y el 31 de julio de 2026**
> (17 semanas). No se incluyen aquí identificadores de cuenta: el repositorio es
> público y las cifras van agregadas.

---

## 1. Qué dicen los datos

### 1.1 Una aclaración que cambia la lectura

En la base de datos hay **284 filas en `workouts`**, que a primera vista parecen
284 sesiones: 16,7 por semana, un disparate. No lo son. Cada fila tiene **3
series de media**, porque la app crea un registro por ejercicio guardado, no por
sesión completa.

La unidad buena es el **día distinto con actividad**:

| Métrica             | Valor    |
| ------------------- | -------- |
| Días entrenados     | 62       |
| Semanas cubiertas   | 17       |
| **Días por semana** | **3,65** |
| Series totales      | 759      |
| Series por semana   | 44,6     |

Cualquier análisis que cuente filas de `workouts` como sesiones dará números
inflados. Conviene tenerlo presente también para las estadísticas de la app.

### 1.2 Cuándo entrena de verdad

| Día       | Veces en 17 semanas |
| --------- | ------------------- |
| Lunes     | 14                  |
| Viernes   | 12                  |
| Jueves    | 11                  |
| Martes    | 10                  |
| Miércoles | 10                  |
| Sábado    | 3                   |
| Domingo   | 2                   |

Entre semana el reparto es plano; el fin de semana está prácticamente vacío. La
rutina se construye sobre eso en lugar de pelearse con ello: **cuatro días de
lunes a viernes y sábado/domingo libres** para partido y descanso.

Nota: el perfil declara «5 días por semana» y objetivo «fuerza». La realidad son
3,65. El plan se ajusta a lo que se cumple, no a lo que se dijo.

### 1.3 Reparto del volumen por grupo

| Grupo     | Series/semana | Volumen total (kg) |
| --------- | ------------- | ------------------ |
| Pecho     | 9,3           | 72.870             |
| Espalda   | 7,8           | 91.014             |
| Pierna    | 7,6           | 68.880             |
| Bíceps    | 7,5           | 30.695             |
| Hombro    | 5,0           | 23.540             |
| Tríceps   | 4,4           | 32.915             |
| Antebrazo | 1,9           | 10.625             |
| Glúteo    | 0,5           | 6.190              |
| **Core**  | **0,1**       | 240                |

### 1.4 Nivel actual en los básicos

Estimación de 1RM por Epley sobre las series efectivas:

| Ejercicio                     | Mejor serie    | 1RM estimado |
| ----------------------------- | -------------- | ------------ |
| Sentadilla                    | 135 kg         | ~144 kg      |
| Press banca                   | 103 kg         | ~113 kg      |
| Jalón al pecho                | 120 kg         | ~148 kg      |
| Power Clean                   | 70 kg          | ~82 kg       |
| Power Snatch                  | 60 kg          | ~68 kg       |
| Dominada cerrada (con lastre) | 101 kg totales | ~121 kg      |

Dos cosas destacan:

- **Ya hay base de levantamientos olímpicos.** Power Clean y Power Snatch
  aparecen con regularidad. Eso es oro para el balonmano: no hay que enseñar el
  gesto desde cero, se puede programar potencia directamente.
- **Un dato es basura.** «Curl bíceps mancuerna» aparece con 125 kg y un 1RM
  estimado de 175 kg. Eso no es un curl; es un error de registro o una máquina
  registrada con ese nombre. Conviene corregirlo o el historial y las marcas
  personales quedan contaminados.

### 1.5 Los huecos (esto es lo importante)

Buscando explícitamente el trabajo que el balonmano exige:

| Qué falta                                                | Series en 17 semanas       |
| -------------------------------------------------------- | -------------------------- |
| Peso muerto                                              | **0**                      |
| Trabajo unilateral de pierna (zancada, búlgara, step-up) | **0**                      |
| Isquios excéntrico (femoral, nórdico)                    | **0**                      |
| Core antirrotación o rotacional                          | **2 en total**             |
| Gemelo / tobillo                                         | 6                          |
| Hip thrust                                               | 9 (último hace ~6 semanas) |

Ese cuadro explica el diseño entero de la rutina. Se entrena mucho empuje y
mucho brazo, y casi nada de lo que sostiene un salto, una frenada y un
lanzamiento: cadena posterior, una sola pierna, y core que transmite fuerza.

Para dimensionarlo: **7,5 series de bíceps por semana frente a 0,1 de core.**

---

## 2. La rutina

Disponible en la app como plantilla **«Balonmano + Fuerza»**
(`PREDEFINED_ROUTINES`, id `balonmano-fuerza`).

### Estructura

| Día       | Sesión                           | Por qué                                             |
| --------- | -------------------------------- | --------------------------------------------------- |
| Lunes     | Inferior — Fuerza (rodilla)      | El día más consistente lleva la sesión más exigente |
| Martes    | Superior — Fuerza y hombro sano  |                                                     |
| Miércoles | Descanso                         |                                                     |
| Jueves    | Potencia — Salto y cadera        | Peso muerto y sentadilla en días separados          |
| Viernes   | Superior — Volumen y lanzamiento |                                                     |
| Sábado    | Partido o descanso               | Sábado/domingo apenas se usan                       |
| Domingo   | Descanso                         |                                                     |

### Decisiones y su motivo

- **La pierna se parte en rodilla (lunes) y cadera (jueves).** Sentadilla pesada
  y peso muerto el mismo día se roban energía; separados, los dos llegan
  frescos.
- **La potencia va primero en la sesión.** Power Clean el lunes y Power Snatch
  el jueves, antes de nada. La potencia se entrena descansado o no se entrena.
- **Los saltos van antes del peso muerto,** no después: se salta para saltar
  alto, no para acabar cansado.
- **Entra el peso muerto,** que llevaba cuatro meses sin aparecer, y es el motor
  del salto y del sprint.
- **Entra el trabajo a una pierna** (zancada caminando, peso muerto rumano a una
  pierna, saltos skater). El balonmano se juega apoyando una pierna cada vez, y
  la rodilla que frena en un cambio de dirección es la que se lesiona.
- **El core sube de 0,1 a ~9 series por semana,** y sobre todo cambia de tipo:
  plancha lateral (antirrotación) y rotación con carga. El core no genera el
  lanzamiento, lo transmite; si cede, la fuerza de la pierna no llega al brazo.
- **El hombro que lanza tiene trabajo propio:** face pull y rotación externa con
  goma, todas las semanas. Es prevención, no accesorio.
- **El volumen de bíceps baja** a lo razonable. Estaba por delante del core, del
  glúteo y de la cadena posterior juntos.

### Sobre los nombres de los ejercicios

La plantilla usa nombres genéricos para que sirva a cualquiera. Varios coinciden
ya con ejercicios del historial (Power Clean, Power Snatch, Press banca,
Sentadilla, Jalón al pecho, Face pull, Oblicuos), así que el seguimiento
continúa sin cortes. Los que habrá que crear la primera vez:

- Peso muerto
- Zancada caminando _(está en el catálogo público)_
- Peso muerto rumano a una pierna _(en el catálogo público)_
- Salto al cajón, Saltos skater _(en el catálogo público)_
- Plancha lateral
- Rotación externa con goma
- Lanzamiento de balón medicinal

Existen ya «Lanzamiento con goma y peso» y «Lanzamiento balón» en la biblioteca
personal: valen igual, basta con usarlos en lugar de crear duplicados.

---

## 3. Cómo progresar

- **Básicos (sentadilla, press banca, peso muerto):** subir cuando salgan todas
  las repeticiones dejando 2 en recámara. Incrementos pequeños — 2,5 kg en tren
  superior, 5 kg en inferior.
- **Días de potencia (clean, snatch, saltos):** la carga se queda ligera a
  propósito. El criterio es la velocidad: si la barra se frena, se para la
  serie. No se busca el fallo nunca.
- **Cada 4–6 semanas, una semana suave:** mismos ejercicios, la mitad de series.
  Con partidos de por medio la recuperación no es opcional.
- **En temporada,** si la semana trae dos partidos, se recorta el jueves antes
  que el lunes: la potencia ya se está entrenando jugando.

---

## 4. Advertencia

Esto es un plan de entrenamiento hecho a partir de datos de registro, no una
valoración médica ni una evaluación presencial. No sustituye a un preparador
físico que te vea entrenar. Ante dolor —sobre todo de hombro o rodilla—, el paso
siguiente es un profesional, no una tabla.
