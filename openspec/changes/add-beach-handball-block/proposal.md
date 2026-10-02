# Propuesta · Bloque de preparación para balonmano playa

> **Torneo:** Diego Carrasco Beach Handball Cup, **sábado 26 y domingo 27 de
> diciembre de 2026** (2 jornadas, confirmado el 2-oct; el PDF se contradecía y la
> portada era la correcta). Playa de la Ferrara, Torrox Costa (Málaga).
> Torneo oficial del circuito europeo E.H.F. (EBT). Categoría sénior, 36 equipos.
> **Hoy:** 2026-10-02 → **12 semanas** hasta el torneo.
> **Perfil del jugador:** defensa en el ala y en el centro, también de pivote.
> **Estado físico:** contractura en la espalda y molestia de hombro o muñeca sin
> precisar. La Fase 0 del plan es de salud, no de preparación. Ver `design.md` §10.

---

## Why

### Lo que el torneo exige, con fuente

No es "el mismo balonmano pero en la playa". Tres reglas cambian el problema
físico, y están verificadas contra el reglamento oficial de la IHF:

| Regla | Valor | Por qué importa |
|---|---|---|
| Pista | **27 × 12 m**, no 40 × 20 | Un tercio del ancho. Cambios de dirección constantes |
| Arena | **≥ 40 cm de profundidad** | Mayor coste energético y **menor impacto** ([Binnie 2013](https://pubmed.ncbi.nlm.nih.gov/23968257/)) |
| Formato | **2 × 10 min, descanso 5 min** | Cada periodo se puntúa aparte; a igualdad, **gol de oro**. No hay empate |
| Jugadores | 3 de campo + portero | 훨씬 poco espacio por jugador |
| Contacto | **Ninguno** | Menor riesgo de colisión que el indoor |
| Calzado | **Descalzo obligatorio** | Pie y tobillo cargan todo el trabajo |
| Puntos | Normal 1; **de volea, con efecto, del portero y a 6 m son 2** | El acrobático puntúa el doble. Salta y gira |

*(Reglamento IHF de Balonmano Playa, ed. 3-oct-2021 y cambios en vigor desde el
1-abr-2026; reglamento EHF Beach EURO 7.30.)*

### Lo que tus datos dicen

Analizado sobre **528 bloques, 1558 series, 25 semanas** (8-abr → 1-oct), con un
volumen total de **714.776 kg** que cuadra exactamente con la agregación por SQL.
El informe reproducible está en `informe-2026-10-02.txt`.

**Tu periodización de fuerza está bien hecha.** Abr–jul: 20,2 t/semana con 10-18
reps (media maratón). Agosto: 54,2 t con 7-8 reps (fuerza), con pico de 77 t y
**deload correcto** a 32,8 t la semana siguiente (−57 %). Eso es exactamente lo
que toca. No hay que tocarlo.

**Lo que falta es la capa específica.** Reparto por patrón de movimiento:

| Patrón | Series | Últ. 4 sem | Volumen | e1RM máx |
|---|---|---|---|---|
| Sin clasificar | 491 | **0** | 217.474 kg | 169,6 |
| **Tirón** | 382 | 57 | 184.782 kg | 247,2 |
| **Empuje** | 208 | 32 | 87.826 kg | 126,6 |
| **Bisagra** | 95 | 31 | 70.017 kg | 153,4 |
| Aislamiento | 104 | 13 | 65.343 kg | 163,6 |
| Sentadilla | 132 | 23 | 56.793 kg | 146,3 |
| Core | 64 | 12 | 24.366 kg | 253,4 |
| **Pliometría** | **13** | **0** | 8.175 kg | 230,6 |

Y por grupo muscular ponderado:

| Grupo | Volumen | % |
|---|---|---|
| Espalda | 195.463 kg | 27,3 % |
| Pierna | 170.484 kg | 23,9 % |
| Pecho | 105.205 kg | 14,7 % |
| Hombro | 70.322 kg | 9,8 % |
| Bíceps | 48.267 kg | 6,8 % |
| Glúteo | 39.859 kg | 5,6 % |
| Tríceps | 36.635 kg | 5,1 % |
| **Core** | **35.221 kg** | **4,9 %** |

**Tres ausencias que no salen en el volumen:**

1. **Pliometría: 13 series en todo el historial, las últimas el 4-sep.** Trece
   series de salto al cajón. Para un pivote que compite sobre arena de 40 cm con
   acrobacias que puntúan el doble, eso es prácticamente nada. La evidencia es
   directa: 7 semanas de pliometría en arena dio **mejores ganancias en cambio de
   dirección** que en suelo firme — T-test Δ8,9 % frente a Δ5,8 %
   ([Martín 2020](https://link.springer.com/article/10.1186/s13102-020-00176-x)).
2. **Core 4,9 % y casi todo flexión.** Rueda abdominal, crunch en polea y crunch
   abdominal. El único anti-rotación es Press Pallof, 24 series, sin usar desde
   el 31-ago. Para estabilizar al pivote en los giros del lanzamiento no vale.
3. **Cardio: 6 salidas de carrera en 6 meses.** 50 sesiones, 17 h, y 38 de las 50
   son andar (HR media 92-108). En un partido de 2×10 con gol de oro y acciones
   de alta velocidad decisivas, no hay ninguna preparación de sprint repetido.

**Lo que ya está bien y no hay que tocar:**

- **Face pull, 65 series**, el ejercicio con más respaldo como prevención de
  hombro en balonmano. La debilidad del **rotador externo** es el factor de
  riesgo con evidencia fuerte, y tú lo estás trabajando
  ([revisión sistemática 2022](https://pubmed.ncbi.nlm.nih.gov/36461053/)).
- Sentadilla 87 series (e1RM 146,3), peso muerto 39, hip thrust 45, dominadas
  66 con bodyweight registrado. Transferen bien a salto y contacto.
- **4-5 días/semana** durante 25 semanas. Constancia real.

### Los cuatro riesgos concretos, con su epidemiology

| Zona | Dato | Fuente |
|---|---|---|
| **Isquiotibiales** | 45 % de las lesiones musculares. Causa: aceleraciones, pivotes y fintas | [Martín-Guzón 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8751175/) |
| **Tobillo** | 34 % en hombres de nivel internacional; 50 % de los ligamentos afectados son peroneos | ídem |
| **Hombro** | 15 % de lesiones, y **tercera en tiempo de recuperación** | [Aspetar](https://journal.aspetar.com/en/journals/volume-13-targeted-topic-sports-medicine-in-handball/injuries-in-handball) |
| **Global playa** | Incidencia **baja**: 651 atletas, mayoría vuelve en 2 meses, rara vez cirugía | [Degenhardt 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12323119/) |

Tu isquiotibial trabajo actual: peso muerto rumiano (11 series), curl femoral
tumbado (18), curl femoral sentado (9). **No hay ni un Nordic curl.** Es el
estándar de prevención de la lesión que más te va a afectar.

---

## What this change does

Añade **una capa específica** encima de lo que ya funciona, sin demoler el
bloque de fuerza:

1. **Pliometría y aterrizaje**, 2×/semana, mayoritariamente unilateral. Es el
   hueco más grande y el mejor rentable.
2. **Isquiotibial excéntrico** (Nordic / Copenhagen) añadido al día de bisagra que
   ya haces.
3. **Core rotacional y anti-rotación**, sustituyendo parte del volumen de crunch
   que ya no aporta a este deporte.
4. **Sprint repetido** sobre arena, 1-2×/semana, construyéndose en 12 semanas.
5. **Adaptación a la arena**, que hoy no existe en ningún registro.

Y **retira** el volumen de flexión pura y de aislamiento que no tiene retorno
específico, para financiar lo anterior sin subir carga total.

## Lo que NO cambia

- Las sentadillas, el peso muerto, el hip thrust y las dominadas.
- El Face pull. Es el mejor trabajo de hombro que tienes.
- Los 4-5 días/semana de frecuencia.
- La estructura de deload que ya funciona.

## Non-goals

- No se toca `src/` ni el esquema. Esto es un plan de entrenamiento, no código.
- No serecipes adaptaciones individualizadas a lesión: si hay dolor, va a
  profesional, no a una tabla.
- No se sustituye alPreparation física del equipo a partir de noviembre; este
  bloque se complementa, no compite.
- No se proposes subir más de un 10 % la carga semanal en bloques de más de dos
  semanas.

## El dato que falta y no se puede inventar

**No hay ninguna serie registrada en arena.** El esquema no tiene campo de
superficie: no se puede saber si has pisado arena en tu vida de entrenamiento.
Si es que no, esa es la recomendación más importante del documento y no sale de
los datos: **empieza ya, no en noviembre.** La evidencia dice que la adaptación a
arena se construye con **>6 semanas, 3 sesiones/semana de <40 min**
([meta-análisis Frontiers 2025](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2025.1737074/full)).
En diciembre solo quedan 12.
