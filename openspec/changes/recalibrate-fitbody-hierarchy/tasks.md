> **Puerta G1: APROBADA** el 2026-08-14 — el usuario eligió la variante C viendo las tres.
> Fases 0-5 completadas salvo lo anotado.
>
> ~~**Bloqueo activo:** las fases 3 y 4 necesitan `E2E_EMAIL` / `E2E_PASSWORD`.~~
> **RESUELTO el 2026-08-14**: cuenta de pruebas creada con 10 semanas de historial
> sembrado, credenciales en `.env.local`, proceso en `scripts/seed-e2e-user.sql`.
> Login verificado contra la app. Ya no hay nada bloqueado.
>
> Cada fase termina con `lint + type-check + test` en verde **y** comprobación visual en
> los **dos temas**.

## 0. Instrumentación — antes de tocar un solo token

- [x] 0.1 Escribir `scripts/contrast-audit.mjs`: lee `tokens.css` y los 24 presets de
      `accents.ts`, calcula todos los pares (texto×superficie, borde×superficie,
      superficie×superficie) en los dos temas, y sale con código ≠ 0 si rompe un suelo
- [x] 0.2 Añadir `npm run audit:contrast` a `package.json`
- [x] 0.3 Ejecutarlo contra los tokens **actuales** y guardar la salida como línea base —
      es la prueba de que los suelos fallan hoy, y el antes del antes/después
- [x] 0.4 Capturas de línea base de `/login` a 390 px en los dos temas y con el acento por
      defecto + lime `#cbf24c`

## 1. Fase 1 — recalibrar el presupuesto (los números)

- [x] 1.1 Aclarar `--text-tertiary` de `#869489` a `#a1afa4` (abre la ventana de L de
      0,0071 a 0,0357; su contraste sobre canvas sube de 6,23:1 a 8,65:1)
- [x] 1.2 Nueva escala de superficies oscuras. Se probaron tres y el usuario eligió la más
      marcada en la puerta G1, viendo las tres: **A** `#1c1c1f` (1,164:1), **B** `#232327`
      (1,264:1) y **C** `#26262b` / `#313137` / `#3c3c42` (**1,314:1**, la aplicada).
      La escala se construye desde arriba: el techo lo marca la superficie más clara, que
      es la que tiene que seguir sosteniendo el AA del texto terciario
- [x] 1.3 Recalcular la escala equivalente del tema claro (hoy canvas→surface va a 1,096:1,
      también por debajo del suelo)
- [x] 1.4 Introducir `--border-interactive` a ≥3:1 (≈`#606060` sobre canvas, ≈`#676767`
      sobre la superficie nueva) sin tocar `--border-default`, que se queda para bordes
      decorativos
- [x] 1.5 Subir `--glass-edge` y `--glass-edge-top` hasta el valor que el script valide con
      el peor acento por debajo — sin llegar a 3:1, que aquí no aplica
- [x] 1.6 Recalcular el techo de `--glass-veil`: con las superficies nuevas ya no es 0,027
- [x] 1.7 `npm run audit:contrast` en verde
- [x] 1.8 **PUERTA G1 — APROBADA** el 2026-08-14. Se presentaron tres variantes con capturas
      en los dos temas; el usuario eligió la **C**, la más marcada.
- [x] 1.9 Aplicar `--border-interactive` al campo de texto (`Input.tsx`) y mapear
      `--color-line-interactive` en el `@theme`. Crear el token no bastaba: el spec exige
      que los controles cumplan 3:1, y eso solo se cumple cuando alguien lo usa.
      **Pendiente para la fase 3**: el resto de controles (chips, segmentado, toggle)
- [x] 1.10 **Bug encontrado en el emulador, no en el navegador.** Al documentar los tokens,
      dos comentarios quedaron con el texto _después_ del `*/` que cerraba el comentario
      anterior, dejando texto suelto y dos cierres huérfanos. El servidor de desarrollo lo
      tolera y el minificador del build no: la web se veía perfecta y la APK salía con los
      modales transparentes. Verificado en los dos sentidos (APK con tokens antiguos: bien;
      con los nuevos: roto; tras arreglar: bien). El auditor ahora valida los comentarios
      **antes** de mirar colores — un fichero roto no es auditable y su verde no vale nada
- [x] 1.11 Sincronizar `THEME_CHROME.light` de `settingsStore` con el nuevo canvas claro
      (`#f3f5f3` → `#e9ebe8`): es el color de la barra de estado en tema claro

## 2. Fase 2 — la elevación deja de depender de sombras negras

- [x] 2.1 Capa 3 en oscuro: sustituir `--glass-shadow-3` por halo de canto + refuerzo del
      difuminado de scroll (`--glass-fade`, hoy infrautilizado)
- [x] 2.2 Capa 3 en claro: conservar la sombra proyectada, que ahí sí funciona
- [x] 2.3 Revisar `--shadow-card` / `--shadow-fab` / `--shadow-glow` del `@theme` de
      `index.css` con el mismo criterio
- [x] 2.4 Verificar que el chrome a sangre (`glass-flush` en `Layout.tsx:210` y `:323`) se
      sigue distinguiendo ahora que no lleva canto en los cuatro lados
- [x] 2.5 Comprobar en el emulador que no aparece jank nuevo (el halo se pinta una vez; no
      debería, pero se mide, no se supone)

## 3. Fase 3 — composición de las pantallas

- [x] 3.0 Cuenta de pruebas creada y sembrada; credenciales en `.env.local`; login
      verificado contra la app (`scripts/seed-e2e-user.sql`)
- [x] 3.1 Capturar las seis pantallas a 390 px en los dos temas: `/`, `/routines`,
      `/stats`, `/history`, `/settings`, `/login`
- [x] 3.2 Auditar cada una con hallazgos a fichero:línea — espacios muertos, densidad,
      alineaciones, ritmo tipográfico, jerarquía de la primera pantalla sin desplazar
- [x] 3.3 `/login` — **no había nada que arreglar**. El «tercio inferior vacío» era un
      artefacto de la captura `fullPage`: el bloque ya está centrado con `justify-center`
      (`AuthPage.tsx:169`) y el hueco es el reparto normal de un formulario corto en una
      pantalla alta
- [x] 3.4 `/` (`WorkoutPage.tsx`) — medido en el DOM: **ningún hueco vertical > 24 px** entre
      bloques, y el contenido (736 px) cabe en el scroller (735 px) sin desplazar. Lo que
      parecía espacio muerto es un estado vacío centrado, que es intencional
- [x] 3.5 `/stats` — corregido el único defecto real: un grid de 2 columnas con 3 tarjetas
      dejaba media fila vacía. Ahora la última ocupa el ancho entero cuando el número es
      impar. **Falso positivo descartado**: la fila inferior no la corta la barra: el
      contenido termina 96 px por encima (medido con scroll real, no con `fullPage`)
- [x] 3.6 `/routines` y `/settings` — sin desbordes ni scroll horizontal (medido sobre todos
      los nodos de `main`). El texto terciario más claro no satura las pantallas densas
- [x] 3.7 Revisar la escala tipográfica: hoy hay 7 `text-[]` arbitrarios que se saltan la
      escala con nombre
- [x] 3.8 Revisar los 24 espaciados arbitrarios (`p-[`, `gap-[`…) contra `--space-*`

## 3b. Segunda pasada de composición (2026-08-15, con la cuenta sembrada)

La primera pasada midió huecos y desbordes. Esta mira **semántica**: qué se lleva el
acento, qué ofrece el vacío y con qué diálogo se pregunta. Cuatro candidatos, dos
descartados por medición.

- [x] 3b.1 **Descartado — `/stats` no desborda.** El número grande de VOLUMEN parecía
      salirse por la derecha; medidos todos los nodos de `main` contra el ancho del
      viewport, cero desbordes. Ilusión óptica: llega justo al borde del relleno
- [x] 3b.2 **Descartado — `/cardio` no recorta.** La cifra de SESIONES parecía cortada por
      arriba; comparadas las cajas de cada nodo de texto con las de su padre, ningún
      desbordamiento vertical
- [x] 3b.3 **`/routines` desperdiciaba media pantalla.** Con un día vacío, 444,8 px de 806
      en blanco (55 %) y el día resumido en una línea de 12 px que remataba mandando al
      usuario a «el selector de arriba»: describía la acción en vez de ofrecerla. Ahora usa
      `EmptyState` con copia propia (título, explicación y botón), y el vacío baja al 17,6 %.
      `EmptyState` acepta `title`/`description` opcionales para casos concretos
- [x] 3b.4 **La acción destructiva flotaba en ese vacío.** «Eliminar rutina» quedaba a 16 px
      del contenido, en medio de la nada, leyéndose como el siguiente paso. Separada por
      hairline y con aire, como pie de página. Ojo: `hairline-separator` pinta la línea
      **abajo**, así que como envoltorio deja la raya debajo del botón — va como `<div>`
      propio encima, que es el idiom que ya usa `SettingsPage`
- [x] 3b.5 **Con el día vacío había dos botones para lo mismo** («+ Añadir» en la cabecera y
      el del estado vacío). El de la cabecera solo aparece si el día tiene ejercicios
- [x] 3b.6 **Tres acentos en dos filas seguidas en `/history`**, mezclando estado y destino:
      la píldora del filtro activo, «Estadísticas» con relleno de acento y «Mis
      estadísticas» con el texto en acento. Los dos enlaces pasan a neutros con el icono en
      acento —el idiom que ese mismo fichero ya usa en `optionClass`— y el segundo estrena
      icono propio, que los dos llevaban el mismo
- [x] 3b.7 **Once insignias «Fuerza» con relleno de acento sólido**, lo más llamativo de la
      pantalla para decir algo que casi nunca cambia; y en el mismo listado la insignia
      «Salud» ya iba neutra. Unificadas. Medido con la ventana real: los rellenos de acento
      de `/history` pasan de 12 a 1, y el que queda es el filtro activo
- [x] 3b.8 **`window.confirm` en tres borrados** (rutina, ejercicio propio, datos del
      entrenador), cuando `ConfirmDialog` existe **precisamente** para eso y lo dice en su
      propio comentario. En el WebView de Android el nativo abre un diálogo con la URL de la
      app en la cabecera y los botones en el idioma del dispositivo. Los tres migrados, con
      la consecuencia escrita en el cuerpo y no solo la pregunta

- [x] 3b.9 **`/stats` tenía tres compases en una sección**: 2 tarjetas, luego 1 a ancho
      completo con el 60 % vacío, luego 3 pequeñas. El ancho completo lo provocaba el propio
      arreglo del 3.5 —`col-span-2` para la última impar—, que cambió media fila vacía por
      media tarjeta vacía. La causa real era partir seis KPIs en dos rejillas distintas.
      Unificadas en una de 2 columnas: seis tarjetas, tres filas, ninguna huérfana, el truco
      fuera y los números recuperan `text-3xl` (`size="sm"` existe para las rejillas de 3,
      y sigue usándose en `CardioStatsSection`)
- [x] 3b.10 **Cada fila de `/cardio` vivía en una bandeja redondeada que no existe.**
      `SwipeToDelete` envuelve la fila en `overflow-hidden rounded-card` —el redondeo está
      para recortar el fondo rojo del gesto—, y en una fila sin superficie propia ese
      recorte muerde los extremos del hairline: ampliando la unión entre filas se ve la
      línea curvarse. Es un borde sin superficie detrás, lo que el sistema prohíbe. Nueva
      prop `flush` para las filas a sangre; `HistoryPage`, que sí envuelve tarjetas, se
      queda como estaba
- [x] 3b.11 **`/` dejaba 165,5 px muertos al final** (20,5 % del alto) con la pantalla
      cargada arriba, porque el estado vacío medía siempre lo mismo (`py-10` fijo). Ahora
      reserva una fracción del alto de la ventana (`min-h-[42vh]`) y el hueco lo absorbe él:
      13,1 %, sin estirar ninguna tarjeta. En vh y no en píxeles porque el alto útil depende
      del dispositivo
- [x] 3b.12 **Tercer falso positivo descartado**: la cifra de SESIONES de `/cardio` parecía
      tachada. Ampliada 5×, es el glifo del `1` de Space Grotesk sobre el hairline de la
      tira. La medición del DOM (3b.2) ya lo decía; la ampliación lo confirma

## 4. Fase 4 — verificación

- [x] 4.1 `npm run lint && npm run type-check && npm run test` en verde
- [x] 4.2 `npm run audit:contrast` en verde
- [x] 4.3 `npx playwright test` (los e2e autenticados ya existen y hoy se saltan por falta
      de credenciales — con ellas puestas, deben pasar)
- [x] 4.4 Capturas después de las seis pantallas, en los dos temas, comparadas lado a lado
      con la línea base
- [x] 4.5 Comprobación en el **emulador** (`emulator-5554`): safe-areas, `--header-height`,
      `--bottom-nav-height`, touch targets ≥44 px
- [x] 4.6 Comprobación en **dispositivo real**: **Pixel 9a `59131JEBF00062`** (Android 17,
      1080×2424 @ 420 dpi), el 2026-08-15. La tablet `R9TR308HG0J` queda descartada: el
      usuario ya no la usa.
      Se instaló la **release firmada** con el keystore propio (`assembleRelease` →
      `adb install -r`), no la debug: así actualiza en sitio (5.7.0 → 5.8.0) conservando los
      datos —`firstInstallTime` sigue siendo el del 30-jul—. La debug habría servido también,
      porque `applicationIdSuffix ".fitbody"` la instala al lado, pero se prefirió la release
      por ser el binario que el usuario realmente usa (y el que pasa por R8, donde vive la
      trampa del CSS).
      Verificado en pantalla real: superficies distinguibles del canvas, header y barra
      inferior a sangre, safe-areas correctas con navegación por gestos, sin overlays
      transparentes tras la minificación. **Falso positivo descartado**: una captura del
      cajón salió con el contenido desplazado y el panel sin llegar abajo — era un fotograma
      a mitad de animación; repetida con la animación asentada, limpia.
      Nota de método: `android/local.properties` no existía y hubo que recrearlo; ojo, las
      rutas van con `/` — Java Properties se come las barras invertidas (`\U` → `U`) y el
      build falla con un error de sintaxis de ruta que no menciona el fichero
- [x] 4.7 Forzar recarga limpia del service worker antes de dar nada por bueno (trampa
      conocida: sirve JS viejo en nativo)

## 4b. Fuera del plan — pedido por el usuario durante la fase 1

- [x] 4b.1 Calculadora de discos: los discos disponibles pasan a ser configurables y
      persistidos (`settingsStore.availablePlatesKg`), con un desplegable en la propia
      calculadora
- [x] 4b.2 Sustituir el algoritmo voraz por programación dinámica. El voraz deja de ser
      óptimo en cuanto conviven un 1,5 y un 1,25 —el caso del gimnasio del usuario—: para
      2,75 kg por lado ponía un 2,5 y dejaba 0,25 sin cubrir, cuando 1,5 + 1,25 lo clava.
      7 tests nuevos, incluidos los tres casos reales, y verificado en la app
- [x] 4b.3 Iconos del selector de tipo de carga a Reicon (`Man` y `Backpack`), que son los
      que `LoadTypeBadge` ya usaba para esos mismos conceptos en las listas. Máquina,
      polea, banda, barra y kettlebell siguen siendo propios: Reicon no los tiene
- [x] 4b.4 **Los discos del gimnasio no se encontraban** (dicho por el usuario el 2026-08-15
      mirando Ajustes en su móvil). El selector del 4b.1 existía, pero solo dentro de la
      calculadora y plegado, y la calculadora solo se abre desde un entreno. Es una
      configuración del gimnasio que se pone una vez: su sitio es Ajustes. Extraído a
      `shared/components/ui/PlatesPicker` —los dos sitios escriben en el mismo store, así que
      no hay dos verdades— y añadido a Ajustes → Entrenamiento, desplegado, sin nada que
      abrir. E2E nuevo (`e2e/settings-plates.spec.ts`) que fija el contrato: está en Ajustes,
      12 discos, y lo que marcas sobrevive a una recarga

## 5. Fase 5 — cerrar

- [x] 5.1 Actualizar la nota «la luz se gasta en el canto» de `CLAUDE.md` y de
      `liquid-glass-design-system/design.md` con el matiz de este cambio, para que no se
      siga leyendo como prohibición de separar superficies
- [x] 5.2 ~~Anotar en `diary.md`~~ — **ese fichero no existe** (CLAUDE.md lo menciona, pero
      no está en el repo). El registro de la decisión vive en este `openspec/changes/`, que
      es la convención que el proyecto sí usa. Actualizados también README y CLAUDE.md
- [x] 5.3 Commiteado en `feat/recalibrate-fitbody-hierarchy` y mergeado a `main` en
      `fcbbe73` («merge: recalibrar la jerarquia visual de FitBody y mejorar la
      calculadora de discos»)
- [x] 5.4 Bump aplicado: **5.8.0** (`fa1d596`). Minor, por la política de versionado —
      cambio grande, toca el sistema de diseño entero
