> Depende de `fix-weight-suggestion-consistency` y de `improve-save-confirmation`.
> El diseño detallado (`design.md`) se redacta tras aprobar la propuesta.

## 1. Inventario y diseño

- [ ] 1.1 Inventariar los 18 bloques que monta `WorkoutPage.tsx` y asignar a cada uno su nivel (1 entre series / 2 a un toque / 3 solo en reposo)
- [ ] 1.2 Revisar si existe `DESIGN.md` en la raíz; si no, crearlo o dejar constancia de la decisión
- [ ] 1.3 Redactar `design.md` con la jerarquía acordada y bocetos de los dos estados (reposo y sesión en curso)
- [ ] 1.4 Validar la propuesta visual con el usuario antes de tocar código

## 2. Nivel 1 — lo que se usa entre series

- [ ] 2.1 Bloque de registro: ejercicio, kg, reps, marcar serie, series ya hechas
- [ ] 2.2 Peso sugerido como único valor de carga destacado
- [ ] 2.3 Barra de acciones sin cambios de comportamiento respecto a `improve-save-confirmation`

## 3. Nivel 2 — contexto a un toque

- [ ] 3.1 Agrupar calculadora de discos, 1RM estimado, récords por banda y última sesión en un bloque de referencia desplegable
- [ ] 3.2 Mover la modalidad de carga al nivel 2, salvo la primera vez que se usa un ejercicio
- [ ] 3.3 Comprobar que nada deja de ser accesible

## 4. Nivel 3 — solo en reposo

- [ ] 4.1 Salud del wearable, entrenador y recordatorio de peso semanal fuera del flujo con sesión en curso
- [ ] 4.2 Revisar banners (sesión recuperada, sugerencia del entrenador) y su prioridad

## 5. Verificación

- [ ] 5.1 Comprobación a ~390 px de ancho y con `safe-area` en el dispositivo real
- [ ] 5.2 Comprobación en tema claro y oscuro
- [ ] 5.3 Sin hex literales en componentes; escala tipográfica con nombre; touch ≥44 px
- [ ] 5.4 `npm run lint && npm run type-check && npm run test` en verde
- [ ] 5.5 Anotar la decisión de diseño en `diary.md`
