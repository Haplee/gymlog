## MODIFIED Requirements

### Requirement: Tres capas asignadas por función

El sistema SHALL definir exactamente tres capas de superficie —contenido, elevado y
flotante— y cada superficie de la app SHALL usar la capa que corresponde a su **función**,
no a su aspecto actual. Además, cada capa SHALL distinguirse de la anterior por el
contraste de su propia superficie, y no solo por su canto.

#### Scenario: Superficie que agrupa sin elevar

- **WHEN** una superficie solo agrupa contenido (fondo de sección, contenedor de lista)
- **THEN** usa la capa de contenido y no lleva sombra

#### Scenario: Superficie que es una unidad tocable

- **WHEN** una superficie representa una unidad con la que se interactúa (tarjeta, fila)
- **THEN** usa la capa elevada con sombra mínima

#### Scenario: Superficie por encima del contenido

- **WHEN** una superficie va por encima del contenido que se desplaza (header, bottom nav,
  FAB, modal, bottom sheet)
- **THEN** usa la capa flotante y se separa del contenido por elevación perceptible

#### Scenario: Anidamiento de la misma capa

- **WHEN** una superficie de una capa contendría otra de la misma capa
- **THEN** la separación interior se resuelve con borde o espaciado, no con otra capa

#### Scenario: Una capa apagada el canto

- **WHEN** se pinta una capa sin su canto (por ejemplo `glass-flush` a sangre)
- **THEN** sigue distinguiéndose de lo que tiene detrás por el contraste de su superficie

### Requirement: La elevación se construye con la luz disponible

La capa flotante SHALL producir una señal de elevación perceptible sobre el canvas del
tema activo. En el tema oscuro esa señal NO SHALL depender de una sombra negra, que sobre
un canvas casi negro no produce diferencia.

#### Scenario: Capa flotante en tema oscuro

- **WHEN** se pinta la capa flotante sobre el canvas oscuro
- **THEN** la elevación se transmite por el canto superior claro y por el oscurecimiento
  del contenido que pasa por debajo, no por una sombra proyectada

#### Scenario: Capa flotante en tema claro

- **WHEN** se pinta la capa flotante sobre el canvas claro
- **THEN** conserva la sombra proyectada, que en ese tema sí produce diferencia

#### Scenario: Contenido entrando bajo el chrome

- **WHEN** el contenido se desplaza por debajo de una superficie flotante
- **THEN** se disuelve mediante el difuminado de borde de scroll antes de quedar tapado
