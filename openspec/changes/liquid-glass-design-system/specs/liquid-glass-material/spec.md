## ADDED Requirements

### Requirement: Tres capas asignadas por función

El sistema SHALL definir exactamente tres capas de superficie —contenido, elevado y
flotante— y cada superficie de la app SHALL usar la capa que corresponde a su **función**,
no a su aspecto actual.

#### Scenario: Superficie que agrupa sin elevar

- **WHEN** una superficie solo agrupa contenido (fondo de sección, contenedor de lista)
- **THEN** usa la capa de contenido y no lleva sombra

#### Scenario: Superficie que es una unidad tocable

- **WHEN** una superficie representa una unidad con la que se interactúa (tarjeta, fila)
- **THEN** usa la capa elevada con sombra mínima

#### Scenario: Superficie por encima del contenido

- **WHEN** una superficie va por encima del contenido que se desplaza (header, bottom nav,
  FAB, modal, bottom sheet)
- **THEN** usa la capa flotante con sombra marcada

#### Scenario: Anidamiento de la misma capa

- **WHEN** una superficie de una capa contendría otra de la misma capa
- **THEN** la separación interior se resuelve con borde o espaciado, no con otra capa

### Requirement: El material no usa `backdrop-filter`

El material SHALL construirse sin `backdrop-filter` en cualquier superficie que lleve
texto encima o que sea chrome permanente.

#### Scenario: Chrome permanente

- **WHEN** se define el header, la barra inferior, un FAB o una tarjeta
- **THEN** no se aplica `backdrop-filter`

#### Scenario: Superficie efímera sin texto

- **WHEN** se trata de un velo efímero sin texto encima (el fondo oscuro de un modal)
- **THEN** se permite `backdrop-filter` como mejora progresiva vía `@supports`

#### Scenario: Señal de profundidad

- **WHEN** hace falta comunicar que hay contenido pasando por debajo del chrome flotante
- **THEN** se usa el difuminado de borde de scroll, no el desenfoque del fondo

### Requirement: Contraste AA con cualquier acento

El material SHALL cumplir WCAG AA (4,5:1) para todos los colores de texto, en los dos
temas, con **cualquiera** de los acentos seleccionables, incluido el caso de que el acento
pase por debajo de una superficie flotante.

#### Scenario: Acento claro bajo una capa flotante

- **WHEN** el acento seleccionado es el más claro del catálogo y pasa por debajo de una
  superficie flotante con texto
- **THEN** todos los colores de texto mantienen al menos 4,5:1

#### Scenario: Se añade un acento nuevo

- **WHEN** se añade un acento a la paleta seleccionable
- **THEN** se recalcula el peor caso del material antes de darlo por válido

#### Scenario: Reparto de la luz

- **WHEN** haya que aumentar la sensación de luz del material
- **THEN** se aumenta en el canto y no en el área, porque aclarar el área reduce el
  contraste del texto y aclarar 1 px de borde no

### Requirement: Un único punto de import de iconos

Los componentes SHALL importar iconos exclusivamente desde la capa compartida de iconos, y
NO SHALL importar directamente de ninguna librería de iconos.

#### Scenario: Componente que necesita un icono

- **WHEN** un componente necesita un icono
- **THEN** lo importa de la capa compartida

#### Scenario: Cambio de librería de iconos

- **WHEN** se decide cambiar de librería o vendorizar los SVG
- **THEN** el cambio afecta a la capa compartida y no a los componentes que la consumen

#### Scenario: Icono de dominio sin equivalente

- **WHEN** un concepto de dominio (máquina, equipamiento) no existe en la librería
- **THEN** se usa un SVG propio dibujado al mismo grid y grosor de trazo que la librería

### Requirement: El material se sostiene en el dispositivo objetivo

El material SHALL mantener el desplazamiento fluido en el hardware Android de gama
media-baja al que va dirigida la app.

#### Scenario: Desplazamiento con el material en pantalla

- **WHEN** se desplaza una pantalla con superficies del material visibles en un dispositivo
  Android de gama media-baja
- **THEN** el porcentaje de frames con jank se mantiene por debajo del 5 %

#### Scenario: Rendimiento antes de dar por buena una fase

- **WHEN** se completa un bloque de migración
- **THEN** se comprueba en dispositivo real y en los dos temas antes de darlo por hecho

### Requirement: El modo claro se mantiene completo

El sistema SHALL tratar el modo claro como equivalente al oscuro, y cada cambio de
material SHALL verificarse en ambos.

#### Scenario: Cambio en el material

- **WHEN** se modifica cualquier token o utilidad del material
- **THEN** se verifica el resultado en tema claro y en tema oscuro

#### Scenario: Tema del sistema

- **WHEN** el usuario elige tema en la app
- **THEN** esa elección es independiente del modo claro/oscuro del sistema operativo
