## ADDED Requirements

### Requirement: Modo de registro por ejercicio

El sistema DEBE permitir que cada ejercicio de una rutina declare cómo se
registra: por repeticiones o por tiempo. La ausencia del campo DEBE leerse como
«por repeticiones», de forma que ninguna rutina ni entrenamiento existente
requiera migración de datos.

#### Scenario: Una rutina anterior al cambio se lee igual

- **WHEN** se carga una rutina guardada antes de que existieran los modos
- **THEN** todos sus ejercicios se comportan como «por repeticiones» sin avisos ni errores

#### Scenario: El modo lo manda el plan, no el catálogo

- **WHEN** un ejercicio del catálogo está marcado como unilateral pero en el plan se ha desmarcado
- **THEN** se registra como bilateral, porque el plan es la fuente de verdad

### Requirement: Series por tiempo

El sistema DEBE permitir registrar una serie por su duración en segundos, con
peso opcional, y DEBE conservar esa duración en el historial.

#### Scenario: Una plancha se registra sin repeticiones

- **WHEN** se completa una serie de un ejercicio en modo tiempo
- **THEN** se guarda la duración medida y la serie no declara repeticiones

#### Scenario: Un ejercicio por tiempo puede llevar carga

- **WHEN** se registra un paseo del granjero con 40 kg durante 30 segundos
- **THEN** se conservan tanto la carga como la duración

#### Scenario: El cronómetro de trabajo es independiente del de descanso

- **WHEN** corre el cronómetro de una serie por tiempo
- **THEN** el temporizador de descanso no se ve afectado, y viceversa

### Requirement: Las series por tiempo no contaminan las métricas de fuerza

Una serie sin repeticiones NO DEBE participar en el volumen de fuerza, en la
estimación de 1RM ni en las decisiones del motor de autorregulación.

#### Scenario: El volumen ignora las series por tiempo

- **WHEN** una sesión mezcla series por repeticiones y por tiempo
- **THEN** el volumen de fuerza cuenta solo las primeras, sin tratar la duración como repeticiones ni como cero

#### Scenario: El 1RM no se estima desde una duración

- **WHEN** se pide el 1RM estimado de un ejercicio registrado por tiempo
- **THEN** no se devuelve estimación, en lugar de un número calculado sobre datos que no la soportan

#### Scenario: Una plancha no dispara una descarga

- **WHEN** el motor de autorregulación evalúa el historial de un ejercicio de fuerza
- **THEN** las series por tiempo de otros ejercicios no influyen en la carga sugerida

### Requirement: Repeticiones por lado

El sistema DEBE permitir marcar un ejercicio como unilateral. El usuario registra
el **total** de repeticiones; el reparto por lado se deriva para mostrarlo y
nunca se introduce a mano.

#### Scenario: El total se muestra repartido

- **WHEN** se registran 16 repeticiones de un ejercicio por lado
- **THEN** se muestra que corresponden a 8 por lado

#### Scenario: Un total impar se muestra tal cual

- **WHEN** se registran 17 repeticiones de un ejercicio por lado
- **THEN** se muestran 8,5 por lado, porque significa que los lados no fueron iguales

#### Scenario: El objetivo avanza de dos en dos

- **WHEN** el motor sugiere subir repeticiones en un ejercicio por lado
- **THEN** el objetivo pasa de 16 a 18, nunca a 17

### Requirement: Superseries

El sistema DEBE permitir encadenar ejercicios en un grupo y registrarlos de forma
alterna, con un único descanso al cerrar el grupo.

#### Scenario: El descanso llega al final del grupo

- **WHEN** se completa la serie del último ejercicio de una superserie
- **THEN** se lanza el temporizador de descanso una sola vez, no tras cada ejercicio

#### Scenario: Un grupo a medias no impide guardar

- **WHEN** se termina el entrenamiento con una superserie incompleta
- **THEN** se guarda lo registrado sin exigir completar el grupo
