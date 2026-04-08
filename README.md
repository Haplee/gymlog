# GymLog v1.8

PWA para registrar entrenamientos de gimnasio. Desplegado en **https://pesos-wine.vercel.app**

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Estilos**: Tailwind CSS v4
- **Estado**: Zustand
- **Datos**: Supabase
- **Charts**: Recharts
- **Auth**: Supabase Auth (email + Google)

## Estructura

```
src/
├── components/     # Componentes reutilizables (Layout, RestTimer, PermissionRequests)
├── pages/          # Páginas de la app (WorkoutPage, StatsPage, HistoryPage, etc.)
├── stores/         # Estado global (Zustand: auth, workout, settings, routine)
├── lib/            # Config Supabase, tipos TypeScript, utilidades
├── hooks/          # Custom hooks (useWakeLock)
└── public/         # PWA (manifest.json, sw.js, iconos)
```

## Scripts

```bash
# Desarrollo
npm run dev

# Build producción
npm run build

# Preview
npm run preview

# Deploy a producción
npx vercel deploy --prod
```

## Funcionalidades

- 🔐 Autenticación con Supabase Auth (email + Google)
- 🏋️ Registro de ejercicios y series con validación
- 📋 Rutina semanal (asigna ejercicios por día)
- ⏱️ Timer de descanso con notificaciones
- 📊 Estadísticas, gráficos semanales y progresión por ejercicio
- 📜 Historial de entrenamientos con filtros
- 📥 Importar/Exportar CSV (formato compatible)
- 🔢 Calculadora 1RM (Fórmula Brzycki)
- 🔊 Sonido configurable (Web Audio API)
- 📳 Vibración configurable (Navigator Vibration API)
- ⚙️ Configuración persistente (vibración, sonido, timer)
- 📱 PWA instalable con offline
- 💾 Sesión persistente

## Supabase

- **Proyecto**: eoltmipoklizewxdpzfa
- **URL**: https://eoltmipoklizewxdpzfa.supabase.co

### Tablas

- `profiles` → Usuarios (username, full_name)
- `exercises` → Ejercicios disponibles (user_id, muscle_group)
- `workouts` → Sesiones de entrenamiento (user_id, started_at)
- `workout_sets` → Series registradas (weight, reps, set_num)
- `personal_records` → Récords personales (weight, reps)
- `user_routines` → Rutina semanal por usuario

## PWA

La app funciona offline mediante Service Worker:

- `manifest.json` → Configuración (nombre, iconos, theme)
- `sw.js` → Cacheo stale-while-revalidate

Para instalación:
- Chrome/Android: "Añadir a pantalla de inicio"
- iOS: Compartir → "Añadir a pantalla de inicio"

## Build Optimizado

- Code splitting automático por página
- Lazy loading de componentes
- CSS mínimo con Tailwind v4
- Bundle ~500KB (gzipped ~150KB)

## Contributing

1. Fork del repositorio
2. Crear branch `feature/xxx`
3. Commit con cambios
4. Push y abrir PR