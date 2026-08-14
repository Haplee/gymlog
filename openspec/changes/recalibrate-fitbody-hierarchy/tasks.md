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

## 4. Fase 4 — verificación

- [x] 4.1 `npm run lint && npm run type-check && npm run test` en verde
- [x] 4.2 `npm run audit:contrast` en verde
- [x] 4.3 `npx playwright test` (los e2e autenticados ya existen y hoy se saltan por falta
      de credenciales — con ellas puestas, deben pasar)
- [x] 4.4 Capturas después de las seis pantallas, en los dos temas, comparadas lado a lado
      con la línea base
- [x] 4.5 Comprobación en el **emulador** (`emulator-5554`): safe-areas, `--header-height`,
      `--bottom-nav-height`, touch targets ≥44 px
- [ ] 4.6 Comprobación en **dispositivo real** (`R9TR308HG0J`) — **no hecha a propósito**:
      es la tablet personal del usuario y tiene la app instalada con la firma de release.
      Instalar la debug obligaría a desinstalar la suya y perdería sus datos locales. Queda
      a decisión del usuario
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

## 5. Fase 5 — cerrar

- [x] 5.1 Actualizar la nota «la luz se gasta en el canto» de `CLAUDE.md` y de
      `liquid-glass-design-system/design.md` con el matiz de este cambio, para que no se
      siga leyendo como prohibición de separar superficies
- [x] 5.2 ~~Anotar en `diary.md`~~ — **ese fichero no existe** (CLAUDE.md lo menciona, pero
      no está en el repo). El registro de la decisión vive en este `openspec/changes/`, que
      es la convención que el proyecto sí usa. Actualizados también README y CLAUDE.md
- [ ] 5.3 Commit en rama `feat/recalibrate-fitbody-hierarchy` (sin push: lo pide el usuario)
- [ ] 5.4 Decidir con el usuario si esto merece bump de versión (política: mediano →
      patch, grande → minor)
