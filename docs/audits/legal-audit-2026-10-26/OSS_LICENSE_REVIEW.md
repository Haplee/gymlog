# GymLog — Revisión de licencias de software y contenido de terceros

- **Fecha:** 26/10/2026
- **Base:** `package.json`, `package-lock.json`, árbol instalado en `node_modules`, `LICENSE` del repositorio
- **Método:** `npm ls --omit=dev --parseable --all`, lectura del campo `license` de cada `package.json`, comprobación puntual de archivos `LICENSE`/`NOTICE`
- **Naturaleza:** revisión técnica de inventario. **No es un dictamen jurídico** ni sustituye a un abogado de propiedad intelectual.

---

## 1. Inventario

| Métrica                                              | Valor                                                 |
| ---------------------------------------------------- | ----------------------------------------------------- |
| Rutas únicas en el árbol de producción               | **564**                                               |
| Pares `nombre@versión` únicos                        | **536**                                               |
| Nombres únicos                                       | **520**                                               |
| Dependencias directas de producción (`package.json`) | 40                                                    |
| Licencia del proyecto                                | MIT (`LICENSE:1-3`, © 2026 Fran Vidal Mateo / Haplee) |

### Distribución por licencia declarada

| Licencia                    | Paquetes |
| --------------------------- | -------- |
| MIT                         | 475      |
| ISC                         | 46       |
| Apache-2.0                  | 9        |
| BSD-3-Clause                | 8        |
| BlueOak-1.0.0               | 8        |
| BSD-2-Clause                | 5        |
| MPL-2.0                     | 2        |
| MIT/X11                     | 2        |
| Sin declarar (`UNKNOWN`)    | 2        |
| `(MIT OR CC0-1.0)`          | 1        |
| `0BSD`                      | 1        |
| `MIT AND ISC`               | 1        |
| `(MIT AND Zlib)`            | 1        |
| `Unlicense`                 | 1        |
| `(MIT OR GPL-3.0-or-later)` | 1        |
| `CC-BY-4.0`                 | 1        |
| **Total**                   | **564**  |

**No se ha detectado ningún paquete con licencia AGPL o GPL-only en el árbol de producción.** El único GPL es una alternativa dual de `jszip`, que se puede usar bajo MIT.

### Advertencia metodológica

`npm ls --omit=dev` incluye herramientas de build que están declaradas en `dependencies` (por ejemplo `vite-plugin-pwa`, `typescript`, `ejs`, `jake`). Por tanto, **este inventario es más amplio que el código realmente empaquetado** en la web, el APK y el IPA. Un análisis definitivo requiere escanear el bundle de `dist/` y los binarios nativos. Lo que sigue distingue, cuando es posible, entre dependencia de build y código distribuido.

---

## 2. Obligaciones por familia de licencia

| Familia                                    | Obligación principal                                                                                     | ¿Afecta a GymLog?                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| MIT / ISC / BSD-2 / BSD-3 / 0BSD / MIT/X11 | Incluir el aviso de copyright y el texto de la licencia en las copias o partes sustanciales distribuidas | **Sí**, en la app web y móvil                                    |
| Apache-2.0                                 | Incluir copia de la licencia, conservar avisos, indicar cambios y reproducir `NOTICE` si existe          | **Sí**; no se han encontrado archivos `NOTICE` en los 9 paquetes |
| MPL-2.0                                    | Conservar avisos; si se modifica un archivo cubierto, publicar el código de ese archivo                  | **Potencial**; `lightningcss` es principalmente build-time       |
| CC-BY-4.0                                  | Atribución al autor                                                                                      | **Potencial**; `caniuse-lite` es dato de build                   |
| Dual MIT/GPL                               | Elegir una                                                                                               | **Sí**; elegir MIT para `jszip`                                  |
| Sin licencia declarada                     | Sin permiso de uso por defecto (todo derecho reservado)                                                  | **Sí**; `buffers@0.1.1`                                          |
| AGPL / GPL-only                            | Copyleft fuerte; obligaciones de fuente si se distribuye                                                 | **No detectado** en el árbol npm                                 |

---

## 3. Hallazgos

### OS-01 — `buffers@0.1.1` sin licencia declarada, en la cadena de exportación XLSX

- **Gravedad:** MEDIUM
- **Confianza:** PROVEN
- **Estado:** riesgo de propiedad intelectual; no es una infracción confirmada (puede existir permiso implícito del autor, pero no está documentado)

**Evidencia**

- Cadena: `exceljs@4.4.0 → unzipper@0.10.14 → binary@0.3.0 → buffers@0.1.1` (`npm ls buffers`).
- `node_modules/buffers/package.json` no contiene campo `license`.
- El directorio solo tiene `index.js`, `package.json` y `README.markdown`; **no hay `LICENSE`**.
- `exceljs` se importa dinámicamente al exportar XLSX (`src/features/stats/utils/excelExport.ts:149-150`), por lo que su código acaba en un chunk distribuido.

**Por qué importa**

Sin licencia, el régimen por defecto es «todos los derechos reservados». Distribuir el código en el bundle sin permiso es un riesgo, aunque el paquete sea antiguo y de un autor conocido. No se ha encontrado una declaración de licencia en el README.

**Qué lo cerraría**

Sustituir `exceljs` por una alternativa mantenida, o actualizar `unzipper` a una versión cuyo árbol no arrastre `buffers@0.1.1`, o documentar el permiso del autor. Verificar el bundle final antes de decidir.

### OS-02 — No hay archivo de avisos de terceros en las distribuciones

- **Gravedad:** MEDIUM
- **Confianza:** PROVEN
- **Estado:** incumplimiento potencial de MIT/ISC/BSD/Apache al distribuir

**Evidencia**

- No existe `THIRD_PARTY_NOTICES`, `NOTICE`, `licenses.txt` ni equivalente en la raíz ni en `public/`.
- El repositorio solo contiene `LICENSE` (MIT del proyecto).
- La app se distribuye como web, APK e IPA; el bundle incluye código MIT/ISC/BSD/Apache.

**Por qué importa**

MIT, ISC y BSD exigen que el aviso de copyright y la licencia acompañen a las copias o partes sustanciales. Apache-2.0 exige copia de la licencia y conservación de avisos. Un `LICENSE` propio no cubre el software de terceros.

**Qué lo cerraría**

Generar un archivo de avisos a partir del bundle real (no del árbol npm completo), incluirlo en `public/` y en los recursos de la app, y enlazarlo desde «Acerca de» o ajustes.

### OS-03 — `lightningcss` bajo MPL-2.0

- **Gravedad:** LOW
- **Confianza:** PROVEN
- **Estado:** obligación potencial, probablemente limitada al build

**Evidencia**

- `lightningcss@1.32.0` y `lightningcss-win32-x64-msvc@1.32.0` declaran `MPL-2.0`.
- Es una dependencia de procesamiento de CSS (build), no código de aplicación que se ejecute en el cliente.

**Por qué importa**

MPL-2.0 es copyleft a nivel de archivo: no contamina el resto del proyecto, pero exige conservar avisos y, si se modifica un archivo cubierto, publicar ese archivo. No se ha modificado.

**Qué lo cerraría**

Conservar la licencia en el inventario; si se parchea el paquete, publicar el parche. No requiere acción en el producto si no se distribuye el binario.

### OS-04 — `caniuse-lite` bajo CC-BY-4.0

- **Gravedad:** LOW
- **Confianza:** PROVEN
- **Estado:** obligación de atribución si se redistribuye el dato

**Evidencia**

- `caniuse-lite@1.0.30001810` declara `CC-BY-4.0`.
- Se usa en el pipeline de build (autoprefixer/browserslist), no en el runtime.

**Qué lo cerraría**

Atribución en el archivo de avisos si el dato se redistribuye; si solo se usa para compilar, basta con conservar la licencia en el inventario.

### OS-05 — `jszip` dual MIT/GPL: elegir MIT

- **Gravedad:** INFO
- **Confianza:** PROVEN
- **Estado:** resuelto por elección de licencia

**Evidencia**

- `jszip@3.10.1` declara `(MIT OR GPL-3.0-or-later)`.
- `node_modules/jszip/LICENSE.markdown:1-3` confirma la doble licencia y permite elegir MIT.

**Acción:** dejar constancia escrita de que se usa bajo MIT. No hay obligación de liberar el código de GymLog.

### OS-06 — Contenido de ExerciseDB: licencia y términos no documentados

- **Gravedad:** MEDIUM
- **Confianza:** PROVEN en la ausencia de documentación; UNVERIFIABLE (`NV_TOOL`/externo) en los términos aplicables
- **Estado:** obligación potencial; requiere verificación con el proveedor

**Evidencia**

- La app consume `https://oss.exercisedb.dev/api/v1` por defecto (`.env.example`; `VITE_EXERCISEDB_BASE_URL`).
- El repositorio del API (`https://github.com/exercisedb/exercisedb-api`, consultado 26/10/2026) declara **AGPL-3.0** para el software del servidor.
- El sitio del servicio (`https://oss.exercisedb.dev`, consultado 26/10/2026) se presenta como **AscendAPI** y muestra «© 2026 AscendAPI. All rights reserved.» para el contenido.
- GymLog **no redistribuye** el software del API: lo consume por HTTP. La AGPL del servidor no se propaga al cliente por ese uso.
- Lo que **no** está documentado es el derecho de uso y atribución de los GIFs, imágenes, vídeos e instrucciones.

**Por qué importa**

Una licencia de software AGPL no equivale a una licencia del contenido multimedia. El aviso «all rights reserved» del sitio impide asumir que el contenido es libre. Si GymLog muestra GIFs servidos por ExerciseDB, necesita ampararse en los términos del servicio; si los almacenara o modificara, necesitaría permiso expreso.

**Qué lo cerraría**

Revisar los términos del plan gratuito de AscendAPI/ExerciseDB, conservar la referencia y, si no permiten el uso comercial o exigen atribución, añadirla o sustituir la fuente. No se ha verificado si el endpoint gratuito tiene condiciones específicas.

### OS-07 — Fuentes de Google: OFL y petición a terceros

- **Gravedad:** LOW
- **Confianza:** PROVEN
- **Estado:** obligación de atribución si se autoalojan

**Evidencia**

- `index.html:17-20`, `public/landing.html:39-41`, `public/tutorial.html:26-28` cargan Space Grotesk e Inter desde `fonts.googleapis.com`.
- Las fuentes de Google Fonts se distribuyen bajo SIL Open Font License (OFL) `[PENDIENTE — confirmar licencia de cada familia en su repositorio]`.

**Por qué importa**

La OFL permite uso comercial y autoalojamiento, pero exige conservar la licencia y no vender las fuentes por separado. Si se autoalojan (recomendado por privacidad, ver F-01/RAT-10), hay que incluir el aviso OFL.

**Qué lo cerraría**

Autoalojar las fuentes, incluir sus licencias y eliminar la petición a Google. Esto además reduce una transferencia de IP.

---

## 4. Dependencias relevantes y su licencia

| Paquete                              | Licencia                | Uso                             | Nota                                                             |
| ------------------------------------ | ----------------------- | ------------------------------- | ---------------------------------------------------------------- |
| `react`, `react-dom`                 | MIT                     | Runtime                         | Aviso requerido                                                  |
| `@supabase/supabase-js`              | MIT                     | Runtime                         | Aviso requerido                                                  |
| `@tanstack/react-query`              | MIT                     | Runtime                         | Aviso requerido                                                  |
| `exceljs`                            | MIT                     | Runtime (dinámico)              | Arrastra `buffers` sin licencia                                  |
| `jszip`                              | MIT OR GPL-3.0-or-later | Runtime (transitivo de exceljs) | Elegir MIT                                                       |
| `@sentry/react`, `@sentry/capacitor` | MIT                     | Runtime                         | Aviso requerido                                                  |
| `framer-motion`                      | MIT                     | Runtime                         | Aviso requerido                                                  |
| `recharts`                           | MIT                     | Runtime                         | Aviso requerido                                                  |
| `reicon-react`                       | MIT                     | Runtime                         | Sin archivo `LICENSE`; solo el campo `license` de `package.json` |
| `lightningcss`                       | MPL-2.0                 | Build                           | Sin modificar                                                    |
| `caniuse-lite`                       | CC-BY-4.0               | Build                           | Atribución si se redistribuye                                    |
| `typescript`                         | Apache-2.0              | Build                           | No se distribuye                                                 |
| `vite-plugin-pwa`                    | MIT                     | Build                           | No se distribuye                                                 |

---

## 5. Recomendaciones

1. **Escanear el bundle real** (`dist/`) con una herramienta de licencias y generar un `THIRD_PARTY_NOTICES.txt` con los avisos que realmente se distribuyen.
2. **Resolver `buffers@0.1.1`**: actualizar `unzipper` o sustituir `exceljs`; es el único paquete sin permiso documentado.
3. **Dejar constancia de la elección MIT** para `jszip`.
4. **Verificar los términos de ExerciseDB/AscendAPI** y documentar si se permite el uso de GIFs e instrucciones; añadir atribución si procede.
5. **Autoalojar las fuentes** y conservar sus licencias OFL.
6. **Enlazar los avisos** desde la app y la web.
7. **Conservar el aviso MIT de `reicon-react`**: no incluye archivo `LICENSE`, solo el campo `license` del `package.json`; hay que reproducir el texto MIT estándar con el titular que indique el paquete.

---

## 6. Lo que no se ha verificado

- El contenido exacto del bundle de producción (solo el árbol npm).
- Las licencias de los binarios nativos de Capacitor y de los SDK de Android/iOS.
- Los términos contractuales de ExerciseDB/AscendAPI.
- Si el proyecto se distribuye en tiendas con requisitos adicionales de atribución.

> Esta revisión no es asesoramiento jurídico. La ausencia de un hallazgo no equivale a ausencia de obligación.
