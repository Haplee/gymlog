## ADDED Requirements

### Requirement: Sugerencia idéntica en todas las pantallas

Para un mismo ejercicio y un mismo historial, el sistema SHALL mostrar la misma sugerencia de carga (peso, repeticiones, acción y motivo) en la pantalla de entreno y en la sesión de rutina.

#### Scenario: Mismo ejercicio en inicio y en rutina

- **WHEN** un ejercicio con historial se muestra a la vez en la pantalla de entreno y en la sesión de rutina
- **THEN** ambas pantallas muestran el mismo peso sugerido, las mismas repeticiones y la misma acción

#### Scenario: Ejercicio sin objetivo en ninguna rutina

- **WHEN** el ejercicio no aparece en ninguna rutina y por tanto no tiene rango de reps objetivo
- **THEN** ambas pantallas resuelven el mismo rango indefinido y siguen mostrando la misma sugerencia

#### Scenario: Peso corporal

- **WHEN** el ejercicio es de peso corporal
- **THEN** ambas pantallas lo resuelven igual y ninguna sugiere subir carga

### Requirement: Rango de reps desde una única fuente

El sistema SHALL resolver el rango de repeticiones objetivo de un ejercicio en un único punto compartido, a partir del objetivo declarado en la rutina, emparejando por nombre normalizado.

#### Scenario: Objetivo de un solo número

- **WHEN** la rutina declara un objetivo de `"5"` repeticiones para el ejercicio
- **THEN** el rango resuelto tiene suelo y techo iguales a 5

#### Scenario: Objetivo con rango

- **WHEN** la rutina declara un objetivo de `"8-10"` repeticiones
- **THEN** el rango resuelto tiene suelo 8 y techo 10

#### Scenario: Objetivo con texto adicional

- **WHEN** la rutina declara un objetivo de `"12 por lado"`
- **THEN** el rango resuelto tiene suelo y techo iguales a 12

#### Scenario: Ejercicio ausente de la rutina

- **WHEN** el ejercicio no figura en ninguna rutina
- **THEN** el rango resuelto queda indefinido y no se sustituye por un valor por defecto propio de una pantalla

### Requirement: Una sesión es un día de entreno

El sistema SHALL agrupar el historial de un ejercicio por día natural, de modo que varios entrenos registrados el mismo día cuenten como una sola sesión.

#### Scenario: Dos entrenos el mismo día

- **WHEN** un ejercicio se registra dos veces el mismo día, con 57,5 kg por la mañana y 40 kg más tarde
- **THEN** la sesión de ese día toma la serie más pesada (57,5 kg) como serie tope

#### Scenario: Entrenos duplicados

- **WHEN** el mismo entreno se guarda dos veces con segundos de diferencia
- **THEN** cuenta como una sola sesión y no altera la sugerencia

#### Scenario: Días distintos

- **WHEN** un ejercicio se entrena en días distintos
- **THEN** cada día es una sesión independiente y conserva su orden cronológico

### Requirement: Las etiquetas de historial muestran datos reales

El sistema SHALL mostrar en la etiqueta de sesión anterior el peso y las repeticiones realmente registrados, nunca las repeticiones sugeridas.

#### Scenario: Última sesión con reps distintas a las sugeridas

- **WHEN** la última sesión fue 80 kg × 10 y la sugerencia es 80 kg × 11
- **THEN** la etiqueta de sesión anterior muestra 80 kg × 10

### Requirement: Historial mostrado coherente con el usado

El sistema SHALL usar la misma ventana de entrenos recientes y los mismos filtros de series para el historial que muestra y para el que alimenta al motor de sugerencia.

#### Scenario: Ejercicio con sugerencia

- **WHEN** un ejercicio tiene datos suficientes para generar una sugerencia
- **THEN** su historial de última sesión también está disponible para mostrarse

#### Scenario: Series de calentamiento

- **WHEN** la última sesión incluyó series de calentamiento
- **THEN** el historial mostrado no las presenta mezcladas con las series de trabajo

### Requirement: Sin datos suficientes no se inventa sugerencia

El sistema SHALL abstenerse de sugerir carga cuando no haya historial utilizable.

#### Scenario: Ejercicio sin historial

- **WHEN** el ejercicio no tiene ninguna sesión con series de trabajo
- **THEN** ninguna pantalla muestra sugerencia de carga
