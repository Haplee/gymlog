# GymLog v1.8

PWA para registrar entrenamientos de gimnasio. Desplegado en **https://pesos-wine.vercel.app**

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Estilos**: Tailwind CSS v4
- **Estado**: Zustand
- **Datos**: TanStack Query + Supabase
- **Charts**: Recharts
- **Auth**: Supabase Auth (email + Google)

## Estructura

```
src/
├── components/     # Componentes reutilizables
├── pages/          # Páginas de la app
├── stores/         # Estado global (Zustand)
├── lib/            # Config Supabase y tipos
├── db/             # Schema de la DB
└── assets/         # Imágenes y recursos
```

## Scripts

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Preview
npm run preview
```

## Despliegue

```bash
# Deploy a Vercel
npx vercel

# Deploy a producción
npx vercel --prod
```

## Supabase

- **Proyecto**: eoltmipoklizewxdpzfa
- **URL**: https://eoltmipoklizewxdpzfa.supabase.co

### Tablas

- `profiles` → Usuarios
- `exercises` → Ejercicios disponibles
- `workouts` → Sesiones de entrenamiento
- `workout_sets` → Series registradas
- `personal_records` → Récords personales

## Funcionalidades

- 🔐 Autenticación con Supabase Auth (email + Google)
- 🏋️ Registro de ejercicios y series
- 📋 Rutina semanal (asigna ejercicios por día)
- ⏱️ Timer de descanso personalizable
- 📊 Estadísticas y gráfico semanal
- 📜 Historial de entrenamientos
- 📥 Exportar a CSV
- 🔢 Calculadora 1RM (Brzycki)
- ⚙️ Configuración (vibración, sonido)
- 📱 PWA instalable
- 💾 Sesión persistente

## PWA

Archivos en `public/`:
- `manifest.json` → Configuración PWA
- `sw.js` → Service Worker offline
- `gimnasia.png` → Icono de la app