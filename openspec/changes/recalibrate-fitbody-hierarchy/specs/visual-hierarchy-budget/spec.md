## ADDED Requirements

### Requirement: La jerarquía tiene un suelo de contraste medible

El sistema SHALL garantizar que cada nivel de superficie se distingue del nivel que lo
contiene por una diferencia de contraste medible, y no únicamente por su borde.

#### Scenario: Tarjeta sobre el fondo de la página

- **WHEN** una superficie de la capa elevada se pinta sobre el canvas
- **THEN** el contraste entre ambas es ≥1,15:1 en el tema oscuro y ≥1,10:1 en el claro

#### Scenario: Niveles consecutivos de superficie

- **WHEN** dos niveles de superficie aparecen uno dentro del otro
- **THEN** el contraste entre ellos es ≥1,10:1

#### Scenario: Verificación en el peor acento

- **WHEN** se comprueba cualquier suelo de este documento
- **THEN** se comprueba con el acento más claro de `accents.ts` (lime `#cbf24c`), no con
  el acento por defecto

### Requirement: Los límites de los controles cumplen WCAG 1.4.11

Todo borde que delimite un componente de interfaz —campo de formulario, botón, chip,
selector, interruptor— SHALL alcanzar 3:1 contra la superficie sobre la que se pinta y
contra la superficie que encierra.

#### Scenario: Campo de formulario sobre una tarjeta

- **WHEN** un input se pinta sobre una superficie elevada
- **THEN** su borde alcanza 3:1 contra esa superficie

#### Scenario: Borde puramente decorativo

- **WHEN** un borde solo remata una superficie que ya se distingue por su propio contraste
- **THEN** queda exento del suelo de 3:1, y su valor se justifica como acabado, no como
  señal

### Requirement: El presupuesto de contraste se reparte, no se acapara

El sistema SHALL tratar el margen de contraste del texto por encima de su suelo AA como
presupuesto disponible para la estructura, en lugar de dejarlo sin usar.

#### Scenario: Un token de texto limita la escala de superficies

- **WHEN** el suelo AA de un token de texto impide definir los niveles de superficie que
  el sistema necesita
- **THEN** se aclara ese token de texto antes de renunciar a un nivel de superficie

#### Scenario: Margen sobrante

- **WHEN** un token de texto supera su suelo AA con holgura y las superficies bajo él no
  cumplen su propio suelo
- **THEN** esa holgura se considera presupuesto sin asignar y se documenta como tal

### Requirement: Los suelos se verifican de forma automática y reproducible

El repositorio SHALL incluir una comprobación ejecutable que lea los tokens reales y falle
cuando cualquier suelo de este documento se rompa.

#### Scenario: Cambio de un token de color

- **WHEN** alguien modifica un token de color de `tokens.css`
- **THEN** la comprobación recalcula todos los suelos en los dos temas y sobre los 24
  acentos, y termina con código de salida distinto de cero si alguno falla

#### Scenario: Informe legible

- **WHEN** la comprobación falla
- **THEN** indica qué par de colores falló, con qué ratio y cuál era el suelo exigido
