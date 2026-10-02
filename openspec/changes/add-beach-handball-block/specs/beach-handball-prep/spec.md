## ADDED Requirements

### Requirement: El bloque de preparación se planifica contra datos reales

Un bloque de preparación específico para un deporte DEVE construirse sobre el
historial de entrenamiento registrado del atleta, no sobre una plantilla
genérica. El análisis DEVE declarar el número de bloques, series, semanas y
tonelaje sobre los que se ha hecho, y ese total DEBE cuadrar con una agregación
independiente de la misma fuente.

#### Scenario: El total de volumen es verificable

- **WHEN** se recalcula el volumen total por SQL sobre `workout_sets` unidas a `workouts` del usuario
- **THEN** coincide con el total declarado en el informe, con una diferencia de 1 kg atribuible al redondeo

#### Scenario: El origen de los datos es reproducible

- **WHEN** alguien quiera rehacer el análisis
- **THEN** encuentra el script que lo genera y el informe completo versionado junto al bloque

### Requirement: Toda recomendación tiene fuente

Cada recomendación de carga, selección de ejercicio o progresión del bloque
DEBE citar la fuente que la sostiene. Una recomendación sin fuente DEBE
identificarse como tal y justificar por qué se incluye igualmente.

#### Scenario: Una recomendación sin evidencia directa se marca como tal

- **WHEN** el bloque incluye el curl nórdico y la evidencia solo es sólida para atletas con historial de lesión
- **THEN** el bloque dice explícitamente que se incluye por coste de oportunidad bajo, no porque esté probado para ese caso

### Requirement: Los límites de carga se verifican antes de empezar

El bloque DEBE respetar un incremento máximo del 10 % de volumen semanal, y
ningún escalón de carga DEBE durar más de dos semanas consecutivas sin
justificación explícita. El bloque DEBE contener un taper de 10 a 14 días antes
de la competición.

#### Scenario: Ninguna semana supera el incremento máximo

- **WHEN** se recorre la tabla de volumen de las doce semanas
- **THEN** ninguna semana supone más de un 10 % de aumento sobre la anterior, y los tramos de decremento llevan su motivo

#### Scenario: El taper es un taper y no una semana más

- **WHEN** se llega a la semana previa al torneo
- **THEN** el volumen cae al menos un 40 % y la intensidad de las series que quedan se mantiene por encima del 80 %

### Requirement: Ningún estímulo nuevo en la fase final

El bloque DEBE declarar la última semana en la que se admite un estímulo no
preexistente, y todas las semanas posteriores DEBE quedar limitadas a stimuli ya
introducidos. Esta regla DEBE aplicarse a la fase final, y su excepción ("una sola
vez") queda prohibida de forma explícita.

#### Scenario: La última semana de novedad está identificada

- **WHEN** se planifica la semana 11 de 12
- **THEN** el bloque declara esa semana como límite y no ofrece ningún ejercicio,
      material o método que no aparezca antes

### Requirement: El trabajo que ya funciona no se toca sin evidencia

Cuando el análisis de datos detecte un estímulo bien ejecutado, con volumen
sostenido y respaldo en la literatura, el bloque DEBE conservarlo explícitamente
en lugar de sustituirlo por algo más reciente.

#### Scenario: Un estímulo protector se protege por nombre

- **WHEN** el trabajo de rotador externo aparece como el mejor ejercicio del
      historial del atleta y con respaldo en la prevención de lesiones de hombro
- **THEN** el bloque lo marca como día protegido y le asigna volumen sin cambios

### Requirement: El bloque no altera el código de la aplicación

Un bloque de preparación consisting en entrenamiento DEBE documentarse sin
modificar `src/` ni el esquema de la base de datos. Los defectos de datos
detectados durante el análisis DEBE quedar anotados como deuda documentada, no
como cambios de código.

#### Scenario: Un defecto del esquema no arrastra cambios

- **WHEN** el análisis descubre que el bodyweight se registra como kilos y que
      no existe campo de superficie
- **THEN** el bloque documenta la limitación y no añade columnas ni altera
      consultas de la aplicación

### Requirement: Las reservas del plan se declaran

Un bloque de preparación que dependa de información no disponible — fecha del
torneo contradictoria en la documentación, calendario del equipo, lesiones
actuales — DEBE declarar cada supuesto en el punto donde afecta a la
planificación, junto con la consecuencia de que sea falso.

#### Scenario: Una fecha contradictoria se expone con su consecuencia

- **WHEN** la documentación del torneo indica dos fechas distintas para las mismas jornadas
- **THEN** el bloque señala la discrepancia, explica cómo cambia la recuperación
      según cuál sea correcta, y diseña el taper para aguantar ambos casos
