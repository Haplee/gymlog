# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [5.9.0](https://github.com/Haplee/gymlog/compare/v5.8.0...v5.9.0) (2026-08-15)

### Bug Fixes

- **ajustes:** los discos del gimnasio se configuran desde Ajustes ([fd52eeb](https://github.com/Haplee/gymlog/commit/fd52eeb8b2a3eb3da13a66c5f61752a53948943b))
- **ui:** que el acento signifique algo y que los vacios ofrezcan la accion ([4a0f887](https://github.com/Haplee/gymlog/commit/4a0f8879d227bc1b8759e5c9a360e0ac94ce78ea))
- **ui:** un ritmo por seccion, filas sin bandejas y vacios que reparten ([72cd22a](https://github.com/Haplee/gymlog/commit/72cd22a79d651721e939beefd6ad94daefb73b9c))

## [5.8.0](https://github.com/Haplee/gymlog/compare/v5.6.0...v5.8.0) (2026-08-14)

### Features

- add automated git sync and private file synchronization script for Windows ([db07305](https://github.com/Haplee/gymlog/commit/db073057fa5e9a48f75b7baee0ad0c67242f4da1))
- add privacy policy page and landing site assets including favicon and metadata. ([6d90421](https://github.com/Haplee/gymlog/commit/6d90421d51b3db4ca69bfa202047aa3c4085585f))
- **auth:** vestir el login con el material de la app ([3d78f7f](https://github.com/Haplee/gymlog/commit/3d78f7fa1d44750ecdeafc639ad1a0d4d354e040))
- **design:** aplicar el material a las tarjetas de pantalla (bloques D y E) ([a7b4f86](https://github.com/Haplee/gymlog/commit/a7b4f86cf7c2e246712a8aa6be3f8d332f680689)), closes [#141416](https://github.com/Haplee/gymlog/issues/141416)
- **design:** aplicar el material a primitivas y chrome (bloques B y C) ([cedf571](https://github.com/Haplee/gymlog/commit/cedf5717ab4236157d740d3b84922925690c8075))
- **design:** recalibrar el reparto de contraste del sistema FitBody ([98c8768](https://github.com/Haplee/gymlog/commit/98c876881e1065d31c9e28b44894847983dc07aa))
- **discos:** discos configurables y reparto exacto en la calculadora ([c6179f0](https://github.com/Haplee/gymlog/commit/c6179f0e5c9a18f38d42a838745f3092700d855b))
- **icons:** migrar los 82 iconos a Reicon y desinstalar lucide-react (bloque F) ([64bfa71](https://github.com/Haplee/gymlog/commit/64bfa71a02482ac2d9c76db5e7a70eb773af9a63))
- implement routine store with persistence, DB sync, and predefined workout plans ([0b8200e](https://github.com/Haplee/gymlog/commit/0b8200e6254cded33d3118aa4543d0ad5c38da9f))
- **rutinas:** fix de 3 bugs, autorregulación sin RIR, pill 4x5 y descripciones de ejercicios ([6ffa693](https://github.com/Haplee/gymlog/commit/6ffa693f74886a021650bca5eb1ebdacd0cbf861))
- **scripts:** auditor de contraste, capturas de UI y siembra de la cuenta de pruebas ([fee66c1](https://github.com/Haplee/gymlog/commit/fee66c1e4dd43aac50b86bbf89f6bc2d7e072559))

### Bug Fixes

- **design:** bajar el velo del vidrio para no romper el AA con acentos claros ([faeef9b](https://github.com/Haplee/gymlog/commit/faeef9b07eea0452f2b1f745f9ec77eae154219d)), closes [#ffd93](https://github.com/Haplee/gymlog/issues/ffd93) [#cbf24](https://github.com/Haplee/gymlog/issues/cbf24)
- **design:** subir la franja de difuminado de scroll a 48px ([9d2f64a](https://github.com/Haplee/gymlog/commit/9d2f64ae41d3f077c5958ca1c1caf8c414b0a4a7))
- **nav:** el cajón repetía cardio, y los e2e que lo habrían cazado no se ejecutaban ([4ecd164](https://github.com/Haplee/gymlog/commit/4ecd16493ce1b65319edb047fe91c27bc6681042))
- **outbox:** evitar entrenos duplicados al reenviar tras perder la respuesta ([7b23908](https://github.com/Haplee/gymlog/commit/7b239087c02e3d3f2c0d49d738be4d353fe63e2f))
- **rutinas:** sincronizar la rutina activa entre dispositivos ([4d9fd4d](https://github.com/Haplee/gymlog/commit/4d9fd4d8e9344bc71f4da221f264d0878d7d9bff))
- **workout:** la tarjeta de ultima sesion muestra el dia, no el ultimo entreno ([d184f5a](https://github.com/Haplee/gymlog/commit/d184f5abb94a7b1f2c502ab97fdb0ee4d0b37d5a))
- **workout:** pedir el peso corporal solo los lunes ([2fbb174](https://github.com/Haplee/gymlog/commit/2fbb174afba1f863e86d48fdbaa922ab1b70836c))
- **workout:** unificar la sugerencia de carga y arreglar el guardado ([d35638d](https://github.com/Haplee/gymlog/commit/d35638d5a893982ed33acc1b1c1dc313854cd9a9))

## [5.4.0](https://github.com/Haplee/gymlog/compare/v5.3.0...v5.4.0) (2026-07-31)

### Features

- **routine:** añadir la plantilla "Rutina de FranVi" ([9b9c036](https://github.com/Haplee/gymlog/commit/9b9c0364526af05f2f6ba250f11f5f7d3a8d3848))

### Bug Fixes

- **deps:** cerrar las 4 vulnerabilidades sin degradar exceljs ([54224df](https://github.com/Haplee/gymlog/commit/54224df0924cdbd12c31425cf9476cd10a7f14e2))
- **rutinas,ui:** evitar el borrado del respaldo y pulir varias pantallas ([974680c](https://github.com/Haplee/gymlog/commit/974680c8c637cc2f62fb126230decb50d8fb1afd))
- **vercel:** que el enlace de descarga de la APK deje de servir HTML ([d735f1d](https://github.com/Haplee/gymlog/commit/d735f1d835ecacb8fcf2b2c72a50e50a2e1ca0a0))

## [5.3.0](https://github.com/Haplee/gymlog/compare/v5.2.0...v5.3.0) (2026-07-31)

Rediseño de Entrenar, Cardio y Stats para que la app coincida con las capturas
del README: prometían una interfaz que no existía.

### Features

- **ui:** cabecera con hamburguesa y wordmark centrado, y barra inferior plana con rótulos
- **ui:** cajón de navegación (`AppDrawer`) con búsqueda, notificaciones, historial, biblioteca, medidas, entrenador, wearables y guía
- **workout:** editor de serie a tamaño grande (KG/REPS con subrayado y botón de confirmar) y series anotadas como filas de una línea
- **workout:** el selector de ejercicio se pliega a una línea cuando ya hay uno elegido
- **workout:** temporizador de descanso como píldora flotante con barra de progreso
- **cardio:** tipos en fila con scroll, visibles durante la sesión, y cronómetro con décimas
- **stats:** portada RENDIMIENTO con racha, volumen y tira de volumen diario de la semana
- **stats:** pestaña propia en la barra inferior, en el sitio que ocupaba Historial
- **workout:** distintivo del tipo de carga (externa / peso corporal / lastre) en la biblioteca
- **coach:** acceso al entrenador desde Inicio, solo con el entrenador encendido
- **routine:** plantilla «Balonmano + Fuerza», cuatro días construidos sobre el histórico real (ver `docs/RUTINA_BALONMANO_FUERZA.md`)
- **tools:** analizador de vídeo `tools/lift-analysis` — trayectoria de barra, conteo de repeticiones y velocidad (VBT), en fase de prototipo local

### Bug Fixes

- **workout:** el titular desaparecía sin ejercicio elegido y «SERIE n» se quedaba solo a la izquierda
- **workout:** la valoración de sesión ocupaba la pantalla en todos los entrenos; ahora se abre a petición
- **cardio:** los rótulos largos de tipo se tocaban entre sí bajo las baldosas de 56 px
- **stats:** la tira de volumen semanal dejaba un hueco de 112 px cuando no había datos
- **stats:** racha y volumen salían dos veces, en la portada y como tarjetas
- **ui:** el velo del menú teñía el fondo con el color del lienzo y en tema claro parecía que la app se decoloraba
- **routine:** las plantillas nuevas no llegaban a quien ya tenía la app instalada — el almacenamiento local sustituía la lista del código por la del día de la instalación
- **settings:** las filas de la sección de IA no llevaban icono y arrancaban a distinta altura que las de su alrededor
- **cardio:** las sesiones del historial eran las únicas filas de la app sin icono a la izquierda

### Refactors

- ninguna página pasa ya de las 800 líneas: se extraen `ExercisePicker`, `WorkoutActionBar`, `CardioStatsSection`, `ProgressionSection`, `ExerciseComparison`, `OneRmCalculator`, `EditWorkoutModal`, `HistoryFilters` y `PreferencesSection`
- **i18n:** los literales que quedaban en JSX de `RestTimer` y `StatsPage` pasan a i18next

### Tests

- **e2e:** flujo con sesión iniciada (barra, cajón, anotar y guardar una serie), que se salta sin `E2E_EMAIL`/`E2E_PASSWORD`

## [5.2.0](https://github.com/Haplee/gymlog/compare/v5.1.1...v5.2.0) (2026-07-30)

### Features

- **deps:** subir a react-router 8 y cubrir la tabla de rutas entera ([76a8ed2](https://github.com/Haplee/gymlog/commit/76a8ed2))

### Bug Fixes

- **android:** el APK de release ya no sale con el sufijo .fitbody ([9d0e243](https://github.com/Haplee/gymlog/commit/9d0e243))
- **ci:** la suite se caía sin variables de entorno y el historial de migraciones no cuadraba ([77bd0e9](https://github.com/Haplee/gymlog/commit/77bd0e9))

### Performance

- reducir CPU, memoria y batería en el WebView ([c223889](https://github.com/Haplee/gymlog/commit/c223889))

### Chores

- cerrar tres vulnerabilidades altas: postcss, fast-uri y sharp ([74ceacf](https://github.com/Haplee/gymlog/commit/74ceacf))

### [5.1.1](https://github.com/Haplee/gymlog/compare/v5.1.0...v5.1.1) (2026-07-29)

### Bug Fixes

- **ui:** la barra inferior flotaba 232px por encima del borde de pantalla ([bf44701](https://github.com/Haplee/gymlog/commit/bf44701667fda121e2742825c327c5e15bff899a))

## [5.1.0](https://github.com/Haplee/gymlog/compare/v5.0.2...v5.1.0) (2026-07-29)

### Features

- **coach:** banco de pruebas para elegir modelo con datos ([ca81c4e](https://github.com/Haplee/gymlog/commit/ca81c4e2e4b0ec061a45f47cc0e602fe93e96ef3))
- **coach:** chat y flujo Aplicar sin que el coach toque nada ([d23fe4a](https://github.com/Haplee/gymlog/commit/d23fe4a6eb9864c62f887fda5fbb1be93ed50882))
- **coach:** memoria escribible, respaldo de proveedor y reparacion de JSON ([f057b6d](https://github.com/Haplee/gymlog/commit/f057b6d1a43a7718329b2067ae3ac65acb6f582e))
- **coach:** migracion y Edge Function del entrenador IA ([77b2fd2](https://github.com/Haplee/gymlog/commit/77b2fd2798c5a5e66aa3a1f6614adf7cac4f383a))
- **coach:** motor determinista de autorregulación por RIR/RPE ([6b332be](https://github.com/Haplee/gymlog/commit/6b332beddb43ea0447571d3cf8076f615fa8bdb0))
- **coach:** motor determinista en pantalla + docs y estado real ([150a907](https://github.com/Haplee/gymlog/commit/150a90768e1712265efb3760d260fa95e19085b1))
- **coach:** opt-in, pantalla del entrenador y memoria visible ([dfb1233](https://github.com/Haplee/gymlog/commit/dfb1233135316e960b7cde52357707c2391df35b))
- implement iOS ad-hoc signing workflow and update Android Capacitor configurations ([ac7df6f](https://github.com/Haplee/gymlog/commit/ac7df6f3fc167fef929b507c44f364918023fecf))
- **wearables:** separar andar de correr por pulso, no solo por ritmo ([3c7b752](https://github.com/Haplee/gymlog/commit/3c7b752843acf5e0467295abbf3221ec2c3ec968))
- **workout:** sugerencia de carga en la pantalla de entreno + plan al dia ([1958f03](https://github.com/Haplee/gymlog/commit/1958f03a56434c65851751b890ff8d3860fa66c2))

### Bug Fixes

- **cardio:** dejar de resucitar sesiones borradas en el servidor ([b7213a1](https://github.com/Haplee/gymlog/commit/b7213a18cfc1e5813ed89b7fa148b6d3ea71621f))
- **ci:** type-check no comprobaba nada y gen:types vaciaba el fichero al fallar ([a97c309](https://github.com/Haplee/gymlog/commit/a97c309fe5611e90dfac055244a2201a820af938))
- **coach:** normalizar el origen en CORS y poder diagnosticar el preflight ([d9bfa90](https://github.com/Haplee/gymlog/commit/d9bfa90e3f5e8fc56cada84549030151ad4b82c4))
- **db:** alinear el historial de migraciones con produccion ([aa3e11b](https://github.com/Haplee/gymlog/commit/aa3e11b1be7f1eac50d2851a5e9d1e6e2808ee72))
- **db:** las funciones del coach eran ejecutables por cualquiera ([f4d52ba](https://github.com/Haplee/gymlog/commit/f4d52ba84d8192acd56bbc10a14501fcecf3d71b))
- **wearables:** FC real en la tarjeta de salud y trazas visibles en release ([b9302dd](https://github.com/Haplee/gymlog/commit/b9302dd73405bfcf199d04bf67ea60025d0e7b1d))
- **wearables:** sesiones de salud con su tipo real y sin perder el sync ([9e62431](https://github.com/Haplee/gymlog/commit/9e624313090dc93b3dc8af8ab7fd4bb18059a953))

### [2.9.1](https://github.com/Haplee/gymlog/compare/2.8.4...2.9.1) (2026-06-12)

### Features

- **a11y/i18n:** tokens, aria attributes, touch targets, string extraction ([9d885db](https://github.com/Haplee/gymlog/commit/9d885dbb81598e05753a4310cf9bce18b75df3bf)), closes [#6b6b6](https://github.com/Haplee/gymlog/issues/6b6b6) [#878787](https://github.com/Haplee/gymlog/issues/878787) [#fbbf24](https://github.com/Haplee/gymlog/issues/fbbf24) [#c8ff00](https://github.com/Haplee/gymlog/issues/c8ff00)
- add Android build configuration and development environment setup for project ([7caa614](https://github.com/Haplee/gymlog/commit/7caa614467f7ded267aa93b65bea5d98451f6968))
- add kg/lb conversion and ConfirmDialog ([9b21253](https://github.com/Haplee/gymlog/commit/9b21253f832b92c19a196b64ebfbc6104a689e4a))
- configure Android build environment and initialize project documentation and metadata ([c29ca2d](https://github.com/Haplee/gymlog/commit/c29ca2d4546d46be35ad93ef8b67690c1e39b91d))
- implement cardio tracking system including timer, session management, and weekly summary notifications ([60fcafc](https://github.com/Haplee/gymlog/commit/60fcafcdf5b6ad08eef141a4431adf12096adb33))
- implement cardio tracking, exercise search, and rest timer features with state management and persistent storage ([58f0d21](https://github.com/Haplee/gymlog/commit/58f0d2122f4dcfbaf9394b1033574ae3d064f128))
- implement cardio tracking, workout session management, and timer functionality ([9a39431](https://github.com/Haplee/gymlog/commit/9a394319491b3af8191b44a7d0bc474dec7d5baf))
- implement workout history, stats, cardio tracking, and dashboard features ([b153a0a](https://github.com/Haplee/gymlog/commit/b153a0a0afb54b13e5c9361c8885332847afd8a1))
- implement workout tracking features and UI components ([7c09e34](https://github.com/Haplee/gymlog/commit/7c09e3449cc47c90c13b8e898606f27f97eb42d3))

### Bug Fixes

- add custom favicon SVG ([fcb8e8c](https://github.com/Haplee/gymlog/commit/fcb8e8c0d1a89d1ae6e505d6ff6277128658a303))
- add favicon links and improve metadata ([1b94418](https://github.com/Haplee/gymlog/commit/1b94418882beb4eefacc474b862bdfb5d56c06b7))
- add missing StatsPage imports and tighten eslint ignores ([9ed5b8f](https://github.com/Haplee/gymlog/commit/9ed5b8f951b5529658ef0346d4e92d291b04e16c))
- disable submodule checkout in CI ([36c6a0a](https://github.com/Haplee/gymlog/commit/36c6a0ac128e7199f2dc191768b3726c1f5568c8))
- logic bugs in volume, streak, sync and timer calculations ([6fd9eb7](https://github.com/Haplee/gymlog/commit/6fd9eb718146a1dda75303a69361302ac4ebf1cf))
- move MUSCLE_COLORS to separate constants file to satisfy react-refresh ESLint rule ([7b6e255](https://github.com/Haplee/gymlog/commit/7b6e255e36062a532f35afc07a22bcce55a1fd61))
- **security:** validate notification URLs and mutation inputs ([5c635b4](https://github.com/Haplee/gymlog/commit/5c635b43bea97f7f105761b50bbd978d67d43270))
