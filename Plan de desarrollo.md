# GymLog — Plan de Desarrollo

## Estado Actual del Proyecto

### Vista General
- **Proyecto:** GymLog v2.5.2 (PWA de entrenamiento de gimnasio)
- **Stack:** React 19 + TypeScript 5.7 + Vite 6 + Supabase + Capacitor 8
- **Último commit:** 2026-04-17 — Consolidación Visual Definitiva v2.6.8

### Estado de Módulos

| Módulo | Estado | Notas |
|--------|--------|-------|
| Auth (Supabase) | ✅ Funcional | OAuth Google + email/pass |
| Workout Recording | ✅ Funcional | Persistencia Zoltan Store |
| Stats/Analytics | ✅ Funcional | RPC server-side + Recharts |
| Historial | ✅ Funcional | Export/Import CSV |
| Notificaciones | ⚠️ Híbrido | Web + nativo Capacitor |
| Biometría | ✅ Funcional | Fallback PIN/Patrón |
| PWA Offline | ✅ Funcional | Workbox caching |
| Build Android | ⚠️ Manual | Requiere sync + rebuild |

---

## Fixes Prioritarios

### 🔴 Críticos

| # | Problema | Solución | Esfuerzo |
|---|----------|----------|----------|
| C1 | Claves en `.env` comprometidas | Rewritear historial git | M |
| C2 | RLS incompleta en tablas | Verificar políticas activas | S |
| C3 | Código duplicado | Eliminar `/lib/lib/` y `/hooks/hooks/` | S |

### 🟠 Alta Prioridad

| # | Problema | Solución | Esfuerzo |
|---|----------|----------|----------|
| H1 | Tipos desincronizados | Ejecutar `gen:types` en prebuild | S |
| H2 | Schema SQL duplicado | Consolidar en migrations/ | M |
| H3 | Migraciones sin timestamp | Renombrar con prefijo de fecha | S |

---

## Mejoras Programadas

### Refactorizaciones

| # | Área | Descripción | Complejidad |
|----|------|------------|-------------|
| R1 | Tipos | Migrar a `supabase gen types` automático | M |
| R2 | Queries | Paginación infinita en historial | L |
| R3 | Stores | Extraer lógica de negocio a hooks puros | M |
| R4 | Components | Fragmentar componentes >300 líneas | S |

### Nuevas Funcionalidades

| # | Feature | Justificación | Complejidad |
|---|---------|---------------|--------------|
| N1 | Workout Templates | Rutinas predefinidas para principiantes | M |
| N2 | Rest Timer | Cronómetro entre series con notificaciones | S |
| N3 | Dark/Light Theme | Preferencias de tema del sistema | S |
| N4 | Social Sharing | Compartir logros en redes | M |

### Automatización

| # | Tool | Implementar |
|----|------|-------------|
| A1 | CI/CD | GitHub Actions para lint + build |
| A2 | Pre-commit | Husky + lint-staged (ya configurado) |
| A3 | Types | GitHub Action para `gen:types` |
| A4 | Bundle | Análisis automática con rollup-plugin-visualizer |

---

## Roadmap por Fases

### Fase 0 — Estabilización (Actual)
- [ ] Rewritear historial git para eliminar `.env`
- [ ] Eliminar código duplicado (`/lib/lib/`, `/hooks/hooks/`)
- [ ] Verificar RLS en todas las tablas
- [ ] Pillar tipos con `gen:types`

**Objetivo:** Base limpia antes de expandir.

### Fase 1 — Calidad (v2.6)
- [ ] Paginación en historial de workouts
- [ ] Refactorizar stores a hooks puros
- [ ] Implementar theme claro/oscuro
- [ ] Actualizar migraciones con timestamps

**Entrega:** v2.6.0 estable

### Fase 2 — Funcionalidad (v2.7)
- [ ] Workout templates (PPL, Full Body)
- [ ] Rest timer con haptics
- [ ] Mejora en analytics (progresión 1RM histórica)

**Entrega:** v2.7.0 con más features

### Fase 3 — Social (v2.8)
- [ ] Achievements/Badges
- [ ]share de workouts en redes
- [ ] Leaderboards locales (gamificación)

**Entrega:** v2.8.0 viral

---

## Notas Técnicas

### Tech Debt Recognized
1. **Duplicación de código** — arquitectura por features no aplicada consistentemente
2. **Tipos manuales** — database.types.ts no se regenera automáticamente
3. **Queries sin paginación** — limit hardcodeado a 200
4. **Migraciones desorganizadas** — sin convención de nombres

### Dependencias a Actualizar
- `@supabase/supabase-js`: 2.102.1 → revisar última estable
- `react-router-dom`: 7.14.0 → mantener hasta v7 estable
- `zustand`: 5.0.12 → OK, última versión

### Testing Coverage
- **Unit:** Brzycki formula ✅
- **E2E:** Auth flow ✅ (Playwright)
- **Falta:** Workout Store, Queries, RLS policies

---

## Horizont
- [ ] Migrar a Server Components (React 19)
- [ ] Añadir WebSocket para sincronización real-time
- [ ] Implementar push notifications nativas (FCM)
- [ ] Expansión a iOS completo (currently Android-only APK)