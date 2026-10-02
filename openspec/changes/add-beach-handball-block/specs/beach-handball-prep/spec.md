## ADDED Requirements

### Requirement: El bloque de preparación se planifica contra datos reales

Un bloque de preparación específico para un deporte DEVE construirse sobre el
historial de entrenamiento registrado del atleta, no sobre una plantilla
genérica. El análisis DEVE declarar el número de bloques, series, semanas y
tonelaje sobre los que se ha hecho, y ese total SHALL cuadrar con una agregación
independiente de la misma fuente.

#### Scenario: El total de volumen es verificable

- **WHEN** se recalcula el volumen total por SQL sobre `workout_sets` unidas a `workouts` del usuario
- **THEN** coincide con el total declarado en el informe, con una diferencia de 1 kg atribuible al redondeo

#### Scenario: El origen de los datos es reproducible

- **WHEN** alguien quiera rehacer el análisis
- **THEN** encuentra el script que lo genera y el informe completo versionado junto al bloque

### Requirement: Toda recomendación tiene fuente

Cada recomendación de carga, selección de ejercicio o progresión del bloque
SHALL citar la fuente que la sostiene. Una recomendación sin fuente SHALL
identificarse como tal y justificar por qué se incluye igualmente.

#### Scenario: Una recomendación sin evidencia directa se marca como tal

- **WHEN** el bloque incluye el curl nórdico y la evidencia solo es sólida para atletas con historial de lesión
- **THEN** el bloque dice explícitamente que se incluye por coste de oportunidad bajo, no porque esté probado para ese caso

### Requirement: Los límites de carga se verifican antes de empezar

El bloque SHALL respetar un incremento máximo del 10 % de volumen semanal, y
ningún escalón de carga SHALL durar más de dos semanas consecutivas sin
justificación explícita. El bloque SHALL contener un taper de 10 a 14 días antes
de la competición.

#### Scenario: Ninguna semana supera el incremento máximo

- **WHEN** se recorre la tabla de volumen de las doce semanas
- **THEN** ninguna semana supone más de un 10 % de aumento sobre la anterior, y los tramos de decremento llevan su motivo

#### Scenario: El taper es un taper y no una semana más

- **WHEN** se llega a la semana previa al torneo
- **THEN** el volumen cae al menos un 40 % y la intensidad de las series que quedan se mantiene por encima del 80 %

### Requirement: Ningún estímulo nuevo en la fase final

El bloque SHALL declarar la última semana en la que se admite un estímulo no
preexistente, y todas las semanas posteriores SHALL quedar limitadas a stimuli ya
introducidos. Esta regla SHALL aplicarse a la fase final, y su excepción ("una sola
vez") queda prohibida de forma explícita.

#### Scenario: La última semana de novedad está identificada

- **WHEN** se planifica la semana 11 de 12
- **THEN** el bloque declara esa semana como límite y no ofrece ningún ejercicio,
  material o método que no aparezca antes

### Requirement: El trabajo que ya funciona no se toca sin evidencia

Cuando el análisis de datos detecte un estímulo bien ejecutado, con volumen
sostenido y respaldo en la literatura, el bloque SHALL conservarlo explícitamente
en lugar de sustituirlo por algo más reciente.

#### Scenario: Un estímulo protector se protege por nombre

- **WHEN** el trabajo de rotador externo aparece como el mejor ejercicio del
  historial del atleta y con respaldo en la prevención de lesiones de hombro
- **THEN** el bloque lo marca como día protegido y le asigna volumen sin cambios

### Requirement: El bloque no altera el código de la aplicación

Un bloque de preparación consisting en entrenamiento SHALL documentarse sin
modificar `src/` ni el esquema de la base de datos. Los defectos de datos
detectados durante el análisis SHALL quedar anotados como deuda documentada, no
como cambios de código.

#### Scenario: Un defecto del esquema no arrastra cambios

- **WHEN** el análisis descubre que el bodyweight se registra como kilos y que
  no existe campo de superficie
- **THEN** el bloque documenta la limitación y no añade columnas ni altera
  consultas de la aplicación

### Requirement: Un estímulo de riesgo activo bloquea la progresión

Si el atleta declara una lesión o contractura activa, el bloque SHALL incluir una
fase inicial de gestión de salud y DEVE condicionar el inicio de los estímulos de
alto impacto a criterios de disposición explícitos y verificables sin aparato
opcional. Ninguna fase de salud SHALL introducir pliometría, trabajo explosivo de
trono bajo carga ni sprint repetido.

#### Scenario: La fase inicial no empieza a saltar

- **WHEN** el atleta informa de una contractura en la espalda antes de la semana 1
- **THEN** la primera fase del bloque limita el trabajo a isométricos, movilidad y
  trabajo de superficie sin impacto, y no incluye drop jumps ni shuttle

#### Scenario: El avance tiene un criterio, no una fecha

- **WHEN** el atleta se encuentra en la semana en la que correspondería iniciar
  pliometría
- **THEN** el bloque comprueba primero los criterios de disposición de tronco,
  hombro y muñeca, y la fase se retrasa si no se cumplen

#### Scenario: El recorte tiene un orden declarado

- **WHEN** el tiempo disponible no permite completar todas las capas
- **THEN** el bloque declara qué estímulos se sacrifican y en qué orden, y ese
  orden protege la carga de fuerza ya acumulada

#### Scenario: Cada zona afectada tiene su propia puerta

- **WHEN** el atleta declara molestias en más de una articulación
- **THEN** el bloque define un criterio de disposición por zona, con su propio
  plan B, en vez de una única puerta que bloquea o desbloquea todo

#### Scenario: El orden de sacrificio no incluye lo que ejecuta el torneo

- **WHEN** el bloque recorta estímulos por falta de tiempo o por lesión
- **THEN** la articulación que ejecuta la competición queda explícitamente
  excluida del recorte, y la carga de fuerza ya acumulada queda excluida

#### Scenario: La decisión de competir se toma antes del viaje

- **WHEN** el bloque contempla retirada del torneo por lesión
- **THEN** define criterios de entrada objetivos, una fecha de decisión anterior
  al desplazamiento, y los registra antes de la semana de taper, no durante

### Requirement: El bloque no diagnostica ni sustituye a un profesional

Un bloque de preparación que trate con una lesión activa SHALL declarar que no
realiza diagnóstico ni prescripción, DEVE remitir a la valoración profesional
como paso previo, y DEVE listar las señales que obligan a detener el plan en
lugar de modificarlo.

#### Scenario: La valoración profesional es el primer paso

- **WHEN** el bloque documenta una lesión o contractura activa
- **THEN** la primera tarea es una valoración profesional, anterior a cualquier
  tarea de entrenamiento

#### Scenario: Las señales de alarma están escritas

- **WHEN** el bloque trata con una lesión activa
- **THEN** enumera los síntomas que mandan detener el plan y no solo los que
  mandan ajustarlo

#### Scenario: El plan sigue siendo utilizable sin la valoración descartada

- **WHEN** el atleta decide no buscar valoración profesional y el
  bloque continúa vigente
- **THEN** el plan declara explícitamente qué queda fuera de su alcance, mantiene
  la progresión conservadora y los criterios de parada, y no presenta la
  ausencia de exploración como si el plan la sustituyera

#### Scenario: El recorte por lesión baja la carga del gesto afectado

- **WHEN** una articulación del gesto deportivo aparece afectada
- **THEN** el bloque cuantifica el volumen histórico que carga esa articulación y
  define la dosis de mantenimiento que la sustituye, en vez de eliminarla
  sin alternativas

### Requirement: Las reservas del plan se declaran

Un bloque de preparación que dependa de información no disponible — fecha del
torneo contradictoria en la documentación, calendario del equipo, lesiones
actuales — SHALL declarar cada supuesto en el punto donde afecta a la
planificación, junto con la consecuencia de que sea falso.

#### Scenario: Una fecha contradictoria se expone con su consecuencia

- **WHEN** la documentación del torneo indica dos fechas distintas para las mismas jornadas
- **THEN** el bloque señala la discrepancia, explica cómo cambia la recuperación
  según cuál sea correcta, y diseña el taper para aguantar ambos casos
