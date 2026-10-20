## ADDED Requirements

### Requirement: Un solo dato de carga destacado

La pantalla de entreno SHALL destacar visualmente un único valor de carga —el peso sugerido para la serie en curso— y SHALL presentar el resto de cifras de referencia sin competir con él.

#### Scenario: Ejercicio con sugerencia

- **WHEN** el ejercicio activo tiene sugerencia de carga
- **THEN** el peso sugerido es el único valor de carga con jerarquía tipográfica destacada

#### Scenario: Cifras de referencia

- **WHEN** existen 1RM estimado, récords por banda de reps e historial de la última sesión
- **THEN** se presentan agrupados y subordinados, no como valores destacados sueltos

#### Scenario: Ejercicio sin sugerencia

- **WHEN** el ejercicio no tiene historial suficiente
- **THEN** no se muestra ningún peso destacado y se indica que aún no hay recomendación

### Requirement: La sesión en curso concentra la pantalla

Con una sesión de entreno en marcha, la pantalla SHALL priorizar registrar series y SHALL replegar o retirar los bloques que solo tienen sentido antes de empezar.

#### Scenario: Sesión iniciada

- **WHEN** hay al menos una serie registrada en la sesión
- **THEN** los bloques de reposo (salud del wearable, entrenador, recordatorio de peso semanal) no ocupan el flujo principal

#### Scenario: En reposo

- **WHEN** no hay sesión en curso
- **THEN** esos bloques vuelven a estar disponibles en la pantalla

#### Scenario: Registro siempre accesible

- **WHEN** la sesión está en curso
- **THEN** los campos de peso y repeticiones, el marcado de serie y la acción de guardar son alcanzables sin desplegar nada

### Requirement: El contexto secundario está a un toque

La pantalla SHALL mantener accesible toda la información que hoy muestra, agrupada tras una acción explícita cuando no pertenezca al nivel de uso entre series.

#### Scenario: Herramientas de apoyo

- **WHEN** el usuario necesita la calculadora de discos, el 1RM estimado, los récords o la última sesión
- **THEN** puede llegar a ellos desde la pantalla de entreno con una sola interacción

#### Scenario: Nada se pierde

- **WHEN** se compara con la versión anterior de la pantalla
- **THEN** ninguna información deja de estar disponible: solo cambia su prioridad

### Requirement: Se conservan las reglas móviles y de tema

El rediseño SHALL cumplir las reglas de la app en móvil y en ambos temas.

#### Scenario: Objetivos táctiles

- **WHEN** se muestra cualquier control interactivo
- **THEN** su área táctil es de al menos 44 px

#### Scenario: Ancho reducido

- **WHEN** la pantalla se muestra a unos 390 px de ancho
- **THEN** el contenido no se recorta ni desborda horizontalmente

#### Scenario: Tema claro y oscuro

- **WHEN** se alterna entre el tema claro y el oscuro
- **THEN** todos los bloques mantienen contraste WCAG AA y usan tokens del sistema, sin colores literales en componentes
