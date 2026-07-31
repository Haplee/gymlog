# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
