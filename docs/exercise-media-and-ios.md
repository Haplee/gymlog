# Media de ejercicios (GIFs) e iOS — guía operativa

## D1. Subir GIFs/imágenes a `exercises.media_url`

La biblioteca de ejercicios (`ExerciseLibraryPage`, ruta `/exercises`) ya muestra
`media_url` cuando existe. Falta el contenido. Proceso recomendado:

### Opción A — Supabase Storage (recomendada)

1. En el dashboard de Supabase → **Storage** → crear bucket público
   `exercise-media` (o reutilizar uno existente).
2. Subir los GIF/WebP con un nombre estable, p.ej. `press-banca.webp`.
3. Copiar la URL pública:
   `https://<project>.supabase.co/storage/v1/object/public/exercise-media/press-banca.webp`
4. Asignarla a los ejercicios públicos por nombre (SQL en el SQL Editor):

```sql
update public.exercises
set media_url = 'https://<project>.supabase.co/storage/v1/object/public/exercise-media/press-banca.webp'
where is_public = true and lower(name) = lower('Press banca');
```

> Repite por ejercicio, o prepara un `update ... from (values ...)` con pares
> `(nombre, url)` para hacerlo en lote.

### Opción B — URLs externas

Si los GIF están alojados fuera (CDN propio, etc.), basta con poner la URL en
`media_url`; no hace falta Storage. Asegúrate de que permita hotlinking y HTTPS.

### Notas

- Formato preferido: **WebP animado** o **MP4** corto sobre GIF (mucho más ligero
  en el WebView de Android). El componente acepta URL directa.
- No hay migración asociada: `media_url` ya existe (fase 2). Es tarea de contenido.
- Mantén los archivos pequeños (<1 MB) para no penalizar la carga móvil.

## D2. Verificación iOS

El nativo iOS se reutiliza del bundle web (Capacitor). El proyecto `ios/` no se
versiona; el código nativo custom vive en `ios-custom/` (ver su `README.md`) y el
CI lo inyecta en un `ios/` efímero generado en macOS.

- El pipeline `.github/workflows/ios-build.yml` (runner macOS, sin firma) compila:
  bundle web + Capacitor iOS + `ios-custom/BiometricPlugin.swift` + parche
  `Info.plist` (URL scheme `com.franvi.gymlog` + `NSFaceIDUsageDescription`).

### Alcance

| Estado                         | Qué cubre                                                                                                                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ Verificado por CI (sin Mac) | Compilación del proyecto iOS sin firma, incluido el plugin de biometría Swift y la config de deep links/URL scheme.                                                                                                                                                        |
| ⏳ Requiere Mac físico         | Ejecutar en simulador/dispositivo; validar Face ID en vivo, OAuth Google vía deep link, safe-area (notch/Dynamic Island), status bar/splash `#080808`, IndexedDB en WKWebView, haptics; generar `AppIcon`; overlay biométrico al lanzar (SceneDelegate); widget WidgetKit. |
| 💳 Fuera de alcance (de pago)  | Firma + IPA + TestFlight/App Store, push remoto APNs, Universal Links.                                                                                                                                                                                                     |

### Checklist Supabase (OAuth nativo)

- En el dashboard → **Authentication → URL Configuration → Redirect URLs**,
  confirmar que `com.franvi.gymlog://auth/callback` está permitido (ya lo usa
  Android; probablemente ya esté). Sin ello, el login Google en iOS no cierra el ciclo.

### Secrets de CI

- Repo secrets `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` (anon key, pública/segura)
  alimentan el `npm run build` de los workflows iOS y Android. Sin ellos el CI
  compila pero la app no autentica.
