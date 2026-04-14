## [2026-04-14] — Arquitectura v2.0 y Seguridad PWA

- Implementada nueva arquitectura orientada a features en `src/features/` y `src/shared/`.
- Actualizados y simplificados todos los imports usando aliases de TypeScript (`@features`, `@shared`, `@app`).
- Refactorizado componente de Historial (`HistoryPage`) usando la librería `sonner` para toasts nativos y un Modal reutilizable, eliminando lógica CSS hardcodeada.
- Añadido gráfico `RadarChart` para la distribución del volumen muscular en la vista de estadísticas.
- Añadidas capas de seguridad final para login: `useRateLimit` y CSP estricto vía `vercel.json` para evitar ataques de fuerza bruta y XSS.
- Configurado entorno de TDD (Vitest para validación de la fórmula Brzycki: 1RM, y Playwright para test de E2E sobre el flujo de autenticación).
- Estado actual de GymLog v2.0: Build exitosa y validada sin errores de TypeScript tras solventar discrepancias del linter con nulls/anys genéricos. Pendiente despliegue real en ambiente Vercel.
