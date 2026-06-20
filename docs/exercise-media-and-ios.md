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

- El pipeline `.github/workflows/ios-build.yml` (runner macOS) compila sin firmar.
- **Pendiente (requiere Mac real):** abrir el proyecto en Xcode, ejecutar en
  simulador/dispositivo y verificar:
  - safe-area (notch / Dynamic Island) con el header inmersivo.
  - status bar y splash con el fondo base `#080808`.
  - login Google OAuth vía deep link.
- Sin Mac no es posible generar IPA firmada ni validar el render nativo iOS.
