# GymLog v2.8.4 - Registro de cambios

## 📱 APK

**Ubicación:** `versiones/GymLog-2.8.4.apk` (7.1 MB)

---

## ✅ Nuevas funcionalidades

### 1. Sistema kg ↔ lb

- Cambio de unidad en **Ajustes** → Sistema de unidades (kg/lb)
- Entrenamiento muestra el peso en la unidad seleccionada
- Conversión automática al cambiar configuración
- Historial y estadísticas muestran pesos convertidos

### 2. ConfirmDialog

Reemplazo de `confirm()` nativos por modales propios:

- **WorkoutPage:** Eliminar series, notas, ejercicios
- **RoutinePage:** Eliminar rutinas
- **ExerciseSelector:** Eliminar ejercicios personalizados

### 3. UI/UX improvements

- Botón **W** (warmup) y número de serie alineados
- Labels de inputs ahora内侧 del container
- Altura consistente (h-8) para todos los elementos
- Header de columnas muestra unidad correcta

---

## 📋 Bugs corregidos

- Duplicación `setSaveSuccess(true)` en WorkoutPage
- Errores TypeScript varios

---

## 📦 Archivos nuevos

- `src/shared/lib/weight.ts` - Funciones de conversión
- `src/shared/hooks/useWeight.ts` - Hook reutilizable
- `src/shared/components/ui/ConfirmDialog.tsx` - Modal de confirmación

## 📝 Archivos modificados

- `WorkoutPage.tsx` - useWeight integration, UI fixes
- `HistoryPage.tsx` - Conversión de pesos
- `StatsPage.tsx` - Gráficos y calculadora
- `SettingsPage.tsx` - Traducciones
- `es.json` - Nuevas traducciones

---

## 🔧 Tecnologías

- React + TypeScript + Vite
- Capacitor (Android)
- TanStack Query
- Zustand (state)
- Framer Motion

---

## 📲 Cómo instalar

1. Descarga el APK
2. Enable "Instalar apps de orígenes desconocidos"
3. Abre el archivo APK
4. Sigue las instrucciones de instalación
