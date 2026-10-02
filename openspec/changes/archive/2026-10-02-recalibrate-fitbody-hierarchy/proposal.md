## Why

El reskin «FitBody» no está mal aplicado: está mal calibrado. La deuda de estilo es casi
inexistente (7 `text-[]` arbitrarios, 4 hex y 1 `rounded-[]` en toda la app), y sin
embargo el resultado se lee plano y sin terminar. La causa es medible:

| Separación                           | Ratio       | Lectura        |
| ------------------------------------ | ----------- | -------------- |
| canvas → superficie (tarjeta)        | 1,076:1     | invisible      |
| superficie → superficie-2            | 1,073:1     | invisible      |
| borde `--border-subtle` sobre canvas | 1,263:1     | casi invisible |
| **texto primario sobre canvas**      | **15,38:1** | máximo         |

Toda la estructura del tema oscuro vive entre L=0,0031 y L=0,0232 — **el 2,3 % inferior
de la escala de luminancia**. Las sombras son negras sobre negro (`--glass-shadow-1: none`,
la 2 es `rgba(0,0,0,0.3)`), así que no existen. Y no hay `backdrop-filter`, correctamente.
Lo único que separa una tarjeta de su fondo es el canto de 1 px al 6 % de blanco
(`--glass-edge`). Con brillo bajo o luz ambiente, eso desaparece.

El resultado: contraste máximo en el texto y nulo en la estructura. Textos flotando sobre
un vacío negro.

**Cómo se llegó aquí** importa, porque explica por qué no se arregla subiendo el velo:
cada decisión del cambio anterior se midió contra el peor caso de los 24 acentos de
`accents.ts` y se resolvió _bajando la luz_ — el velo se recortó a 0,02 con techo medido
en 0,027 para salvar el AA de `--text-tertiary`. Todo el presupuesto de luz se gastó
defendiendo el contraste del texto terciario y no quedó nada para la jerarquía. Cada
decisión es correcta por separado; la suma es plana.

**Por qué ahora y por qué se puede:** hay margen medido. `--text-tertiary` da 5,40:1 sobre
`--bg-surface-2` con un suelo AA de 4,5:1. Ese margen se puede gastar en separar
superficies, que es donde debía haber ido desde el principio.

## What Changes

- **Redistribuir el presupuesto de contraste.** Subir `--bg-surface`, `--bg-surface-2` y
  `--bg-surface-3` hasta consumir el margen disponible de `--text-tertiary`, en vez de
  dejarlo sin usar. El objetivo es una separación canvas→superficie perceptible
  (≥1,25:1, hoy 1,076:1) manteniendo ≥4,5:1 para el texto terciario **en el peor de los
  24 acentos** (lime `#cbf24c`), no solo en el amarillo por defecto.
- **Sombras que existan sobre negro.** Una sombra negra sobre un canvas casi negro no
  aporta nada. Se sustituye la señal de elevación por la combinación de superficie +
  canto, y donde haga falta profundidad real (capa 3 flotante) se define una sombra con
  extensión suficiente para ser visible sobre `#0a0a0b`.
- **La regla del canto se mantiene, pero deja de ser el único portador.** «La luz se gasta
  en el canto» sigue siendo cierto y sigue vigente; lo que cambia es que el canto deja de
  ser lo _único_ que distingue una capa de otra.
- **Rehacer la composición de las pantallas clave.** El diagnóstico visual del login ya
  muestra un tercio inferior vacío con el contenido apelotonado arriba. Se revisa
  disposición, densidad, espacios muertos y ritmo tipográfico de: login, entreno (`/`),
  rutinas, estadísticas, historial y ajustes.
- **Verificación en los dos temas y en los 24 acentos**, con capturas antes/después a
  390 px y comprobación en el emulador Android.
- No cambia la dirección visual: FitBody, oscuro por defecto, acento elegible por el
  usuario. **No** es un reskin nuevo.

## Capabilities

### New Capabilities

- `visual-hierarchy-budget`: Reparto explícito y medible del contraste disponible entre
  texto y estructura, con un suelo AA verificable en los dos temas y en los 24 acentos, y
  un método reproducible para recalcularlo cuando se toque un token.

### Modified Capabilities

- `liquid-glass-material`: cambian dos requisitos del material. (1) La separación entre
  capas deja de depender exclusivamente del canto y pasa a tener un mínimo de contraste
  de superficie exigible. (2) La elevación de la capa 3 exige una sombra perceptible
  sobre el canvas oscuro, que hoy la especificación no garantiza.

## Impact

- `src/shared/styles/tokens.css` — superficies, bordes y sombras de los dos temas. Fuente
  única; todo lo demás hereda.
- `src/index.css` — bloque `@theme inline` (`--shadow-card`, `--shadow-fab`,
  `--shadow-glow`) y utilidades `.glass-*`.
- Composición de páginas: `AuthPage`, `WorkoutPage`, `RoutinePage`, `StatsPage`,
  `HistoryPage`, `SettingsPage` y el chrome de `app/components/Layout.tsx`.
- `capacitor.config.ts`, `index.html` y el manifest PWA de `vite.config.ts` **solo si**
  cambia `--bg-canvas` (que no está previsto: el canvas se queda donde está y lo que sube
  son las superficies).
- `CLAUDE.md` y `openspec/changes/liquid-glass-design-system/design.md`: la nota «la luz
  se gasta en el canto» necesita el matiz de este cambio para no leerse como prohibición
  de separar superficies.
- Sin dependencias nuevas. Sin cambios de esquema en la base de datos.
- Requiere `E2E_EMAIL` / `E2E_PASSWORD` en `.env.local` para poder auditar las pantallas
  protegidas: sin sesión solo es auditable `/login`.
