# GymLog v2.0

PWA para registrar entrenamientos de gimnasio con enfoque en rendimiento, seguridad y experiencia de usuario premium.

Desplegado en: **https://pesos-wine.vercel.app**

## 🚀 Novedades v2.0

- **Arquitectura Feature-based**: Código organizado por funcionalidades (`auth`, `workout`, `routine`, `stats`) para mayor escalabilidad.
- **TanStack Query v5**: Gestión de estado asíncrono, caché inteligente y optimizaciones de red.
- **Design System Premium**: Tokens de diseño, componentes accesibles (WCAG 2.1) y animaciones fluidas.
- **Seguridad Reforzada**: Rate limiting en autenticación y políticas de seguridad (CSP) estrictas.
- **Gráficos Avanzados**: Incorporación de `RadarChart` para análisis de volumen por grupo muscular.

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript (Strict Mode) + Vite
- **Estilos**: Tailwind CSS v4 + Custom Design Tokens (HSL)
- **Estado**: Zustand (Global) + TanStack Query (Server State)
- **Base de Datos**: Supabase (PostgreSQL)
- **PWA**: Vite PWA Plugin + Custom Update Banner
- **Testing**: Vitest (Unit) + Playwright (E2E)

## 📁 Estructura del Proyecto

```text
src/
├── app/              # Configuración global, providers y layout
├── features/         # Módulos de negocio (auth, workout, routine, stats)
│   ├── [feature]/
│   │   ├── pages/    # Vistas de la funcionalidad
│   │   └── stores/   # Estado específico del módulo
├── shared/           # Recursos comunes
│   ├── api/          # Queries y mutaciones unificadas
│   ├── components/   # UI Kit y componentes comunes
│   ├── hooks/        # Hooks reutilizables
│   ├── lib/          # Utilidades, tipos y esquemas (Zod)
│   └── styles/       # Tokens de diseño y CSS global
```

## 📦 Instalación y Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Ejecutar tests unitarios
npm run test

# Ejecutar tests E2E
npx playwright test

# Build de producción
npm run build
```

## 🔒 Seguridad y Rendimiento

- **CSP**: Cabeceras de seguridad configuradas en `vercel.json`.
- **Rate Limit**: Protección contra fuerza bruta en formularios de acceso.
- **PWA Update**: Sistema de actualización controlada para evitar pérdida de datos.
- **Optimization**: Code splitting, lazy loading y bundle analysis integrado.

## 📊 Base de Datos

El esquema se encuentra en `supabase/migrations/v2.sql`. Incluye tablas para:

- `profiles` (Usuarios)
- `exercises` (Catálogo extendido v2)
- `workouts` (Sesiones)
- `workout_sets` (Datos técnicos de series)
- `personal_records` (Brzycki formula)
- `user_routines` (Planificación semanal)

---

Desarrollado con ❤️ por [Haplee](https://github.com/Haplee)
