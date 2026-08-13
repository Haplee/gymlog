## ADDED Requirements

### Requirement: Guardar todas guarda todas

Cuando el usuario elija guardar todas las series, el sistema SHALL guardar el entreno con todas las series válidas y SHALL NOT volver a pedir confirmación por el mismo motivo.

#### Scenario: Elección de guardar todas

- **WHEN** hay series completadas y series con datos sin marcar, y el usuario elige guardar todas
- **THEN** el entreno se guarda con todas las series válidas y el diálogo no reaparece

#### Scenario: Elección de solo completadas

- **WHEN** hay series completadas y series con datos sin marcar, y el usuario elige solo las completadas
- **THEN** el entreno se guarda únicamente con las series marcadas y el diálogo no reaparece

### Requirement: Se pregunta solo la primera vez

El sistema SHALL pedir confirmación del alcance de guardado únicamente cuando no exista una preferencia guardada, y SHALL aplicar la preferencia guardada sin diálogo en las veces siguientes.

#### Scenario: Primera vez

- **WHEN** hay series completadas y sin marcar a la vez y no hay preferencia guardada
- **THEN** se muestra el diálogo de confirmación

#### Scenario: Veces siguientes

- **WHEN** hay series completadas y sin marcar a la vez y existe una preferencia guardada
- **THEN** se aplica esa preferencia directamente y no se muestra ningún diálogo

#### Scenario: La elección se recuerda

- **WHEN** el usuario responde al diálogo
- **THEN** su elección queda guardada de forma persistente entre sesiones de la app

### Requirement: Sin mezcla no se pregunta

El sistema SHALL guardar todas las series válidas sin preguntar cuando no exista ambigüedad.

#### Scenario: Ninguna serie marcada

- **WHEN** el usuario guarda y no ha marcado ninguna serie como completada
- **THEN** se guardan todas las series válidas sin mostrar diálogo

#### Scenario: Todas las series marcadas

- **WHEN** todas las series con datos están marcadas como completadas
- **THEN** se guardan todas sin mostrar diálogo

### Requirement: La preferencia se puede cambiar

El sistema SHALL permitir al usuario consultar y cambiar la preferencia de guardado desde los ajustes de la app, incluyendo volver a que se le pregunte.

#### Scenario: Cambiar la preferencia

- **WHEN** el usuario elige otra opción de guardado en los ajustes
- **THEN** el siguiente guardado con series mezcladas aplica la nueva preferencia

#### Scenario: Volver a preguntar

- **WHEN** el usuario selecciona la opción de que se le pregunte
- **THEN** el siguiente guardado con series mezcladas vuelve a mostrar el diálogo

### Requirement: Cancelar no pierde datos

El sistema SHALL permitir salir del diálogo sin guardar ni fijar preferencia, conservando la sesión en curso.

#### Scenario: Gesto de atrás

- **WHEN** el diálogo está abierto y el usuario usa el gesto de atrás
- **THEN** el diálogo se cierra, no se guarda nada, no se fija preferencia y la sesión sigue en curso

#### Scenario: Preferencia ilegible

- **WHEN** la preferencia guardada no se puede leer o tiene un valor no reconocido
- **THEN** el sistema vuelve a preguntar en lugar de asumir un alcance
