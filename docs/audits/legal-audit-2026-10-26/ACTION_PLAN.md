# GymLog — Plan de acción legal

- **Fecha:** 26/10/2026
- **Base:** hallazgos de `FINDINGS.md` (F-01 a F-18)
- **Regla:** ninguna acción de este plan se ha ejecutado. Es una propuesta priorizada, no un registro de cambios.

## Criterios de prioridad

| Prioridad | Criterio                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **P0**    | Riesgo jurídico alto y evidencia clara; bloquea la validez de otros controles (base jurídica, información, supresión, transferencias) |
| **P1**    | Brecha significativa que se puede cerrar en semanas; reduce exposición o habilita derechos                                            |
| **P2**    | Mejora de cumplimiento, coherencia o documentación; depende de decisiones de negocio                                                  |

**Esfuerzo:** S ≤ 1 día · M = 2–5 días · L = 1–3 semanas · XL > 3 semanas (estimación técnica, no presupuesto).

---

## P0 — Antes de seguir captando usuarios

### A-01 · Decidir la base jurídica y la condición del art. 9.2

- **Hallazgos:** F-02, F-01, F-06
- **Responsable:** responsable + abogado
- **Esfuerzo:** M (decisión) + L (implementación asociada)
- **Depende de:** nada. **Bloquea A-02, A-07 y A-09.**
- **Acción:** documentar, por finalidad, la base del art. 6.1 y la condición del art. 9.2 para peso, composición corporal, pulso, sueño y cualquier inferencia de salud. Si se elige consentimiento explícito, definir su alcance, granularidad y revocación.
- **Criterio de aceptación:** documento firmado con una fila por tratamiento y una condición del art. 9.2 identificada; sin `[PENDIENTE]` en las actividades de salud.
- **Riesgo de no hacerlo:** cualquier consentimiento posterior es inválido; la política no se puede redactar correctamente.

### A-02 · Reescribir política de privacidad y términos

- **Hallazgos:** F-01, F-03, F-10, F-12, F-13, F-14
- **Responsable:** abogado redacta; dev publica
- **Esfuerzo:** M
- **Depende de:** A-01 y A-05.
- **Acción:** política por finalidad y destinatario, con base jurídica, categorías, plazos, transferencias, derechos, retirada del consentimiento, reclamación ante la AEPD y mención expresa del entrenador IA y de los datos de salud. Términos sin promesa de borrado «desde la app» hasta que exista, sin modificación unilateral ilícita y con responsabilidad ajustada a norma imperativa.
- **Criterio de aceptación:** checklist del art. 13/14 completo; cada afirmación contrastada con el código; fecha y versión visibles; revisión jurídica registrada.
- **No hacer:** copiar una plantilla genérica, cambiar solo la fecha o añadir un párrafo sobre IA sin rehacer el resto.

### A-03 · Implementar el borrado de cuenta real

- **Hallazgos:** F-03
- **Responsable:** dev + revisión jurídica del procedimiento
- **Esfuerzo:** M
- **Depende de:** decisión sobre conservación (A-08).
- **Acción:** Edge Function con `service_role` que elimine el usuario de `auth.users` y verifique el arrastre en cascada; confirmación en la UI; correo de confirmación; registro del evento sin conservar datos innecesarios. Mientras no exista, corregir los términos y publicar el procedimiento por correo con plazo de un mes.
- **Criterio de aceptación:** prueba con una cuenta real: el usuario desaparece de `auth.users`, las 26 tablas no conservan filas y el token push se elimina. Sin intervención manual.
- **Riesgo de no hacerlo:** infracción del art. 17 y publicidad engañosa.

### A-04 · Resolver el proveedor de IA

- **Hallazgos:** F-04, F-05, F-09
- **Responsable:** responsable + abogado; dev ejecuta
- **Esfuerzo:** M (contrato) + S (cambio de proveedor)
- **Depende de:** A-01 y A-05.
- **Acción:** contratar un proveedor con DPA y SCC/TIA, o con decisión de adecuación; documentar la evaluación de la transferencia. Si no es posible a corto plazo, **desactivar el entrenador** o limitarlo a un proveedor con garantías. Añadir TTL para conversaciones y memoria.
- **Criterio de aceptación:** DPA firmado y archivado; proveedor y región documentados; TIA con fecha; política con la transferencia descrita; TTL ejecutándose.
- **Riesgo de no hacerlo:** transferencia internacional sin base y encargado sin contrato; es el hallazgo con mayor exposición junto con F-02.

### A-05 · Inventario de proveedores, regiones y contratos

- **Hallazgos:** F-05, F-01, F-06
- **Responsable:** dev + responsable
- **Esfuerzo:** M
- **Depende de:** acceso a paneles.
- **Acción:** tabla con Supabase, Vercel, Cloudflare, Sentry, Google (OAuth y Fonts), Groq, NVIDIA, FCM, APNs y ExerciseDB/AscendAPI. Para cada uno: rol, región, DPA, subencargados, mecanismo de transferencia, retención y fecha de revisión.
- **Criterio de aceptación:** tabla completa, sin `[PENDIENTE]`, con enlaces a los contratos.
- **Nota:** es la entrada para A-02, A-04 y el RAT.

### A-06 · Publicar los enlaces legales dentro de la app

- **Hallazgos:** F-12
- **Responsable:** dev
- **Esfuerzo:** S
- **Depende de:** A-02 para el contenido; el enlace se puede poner antes.
- **Acción:** enlace permanente a privacidad y términos en ajustes, en el alta y en el pie de la landing; versión y fecha visibles.
- **Criterio de aceptación:** accesible en dos toques desde la pantalla principal; sin enlaces rotos.
- **Nota:** es la acción más barata del plan.

### A-07 · Consentimiento explícito y separado para datos de salud

- **Hallazgos:** F-02, F-10
- **Responsable:** abogado redacta; dev implementa
- **Esfuerzo:** M
- **Depende de:** A-01.
- **Acción:** si la condición elegida es el art. 9.2.a, pantalla propia (no enterrada en el alta), texto que identifique categorías y finalidad, revocación tan fácil como la aceptación, versión y auditoría. Separar el consentimiento de salud del consentimiento del entrenador IA y del alta.
- **Criterio de aceptación:** el usuario puede usar la app sin conectar wearables ni registrar medidas; la revocación detiene el tratamiento y ofrece borrado; el evento queda registrado.
- **Riesgo de no hacerlo:** el consentimiento actual del entrenador no cubre la recogida de salud del núcleo, y el permiso del sistema operativo no es consentimiento RGPD.

---

## P1 — Primeros 60 días

### A-08 · Validar el RAT y aprobar la política de conservación

- **Hallazgos:** F-06, F-09
- **Responsable:** responsable + abogado
- **Esfuerzo:** S (validar) + M (implementar TTL)
- **Depende de:** A-01, A-05.
- **Acción:** revisar `DATA_PROCESSING_REGISTER.md`, completar campos, firmar y versionar. Definir plazos por categoría y hacerlos ejecutables: TTL de conversaciones, limpieza de auditoría, política de logs.
- **Criterio de aceptación:** RAT aprobado; tabla de retención publicada; trabajos de limpieza verificados.

### A-09 · Decidir y, si procede, hacer la EIPD

- **Hallazgos:** F-07
- **Responsable:** abogado + dev (datos)
- **Esfuerzo:** L
- **Depende de:** A-01, A-05, datos de escala.
- **Acción:** decisión documentada sobre necesidad; si procede, EIPD con metodología AEPD, consulta previa si el riesgo residual es alto.
- **Criterio de aceptación:** decisión firmada; si hay EIPD, con medidas y responsable de seguimiento.

### A-10 · Exportación completa y procedimiento de derechos

- **Hallazgos:** F-08, F-03
- **Responsable:** dev + abogado (procedimiento)
- **Esfuerzo:** M
- **Depende de:** A-08 (qué se conserva).
- **Acción:** ampliar la exportación a perfil, medidas, wearables, cardio, entrenador (memoria/mensajes/sugerencias), consentimientos y push; documentar el canal de correo con verificación de identidad y plazo de un mes.
- **Criterio de aceptación:** una exportación contiene todas las categorías del RAT; el procedimiento está publicado y probado.

### A-11 · Alinear la edad mínima a 14 años

- **Hallazgos:** F-10
- **Responsable:** abogado + dev
- **Esfuerzo:** M
- **Depende de:** A-01.
- **Acción:** cambiar el umbral, decidir verificación (autodeclaración con bloqueo o confirmación parental) y documentar el tratamiento de menores.
- **Criterio de aceptación:** no se puede completar el alta por debajo de 14 sin el mecanismo previsto; la política lo refleja.

### A-12 · Limpiar token push y caché al cerrar sesión

- **Hallazgos:** F-15, F-16
- **Responsable:** dev
- **Esfuerzo:** S
- **Depende de:** nada.
- **Acción:** borrar el token en `pre-signout`, desregistrar el dispositivo, llamar a `removeClient` y borrar cachés del service worker en web.
- **Criterio de aceptación:** prueba con dos cuentas en el mismo dispositivo: no llegan notificaciones del usuario anterior y no quedan datos en IndexedDB ni en Cache Storage.

### A-13 · Avisos de terceros y licencias

- **Hallazgos:** OS-01 a OS-07
- **Responsable:** dev
- **Esfuerzo:** M
- **Depende de:** escaneo del bundle.
- **Acción:** generar `THIRD_PARTY_NOTICES.txt` desde `dist/`; resolver `buffers@0.1.1`; dejar constancia de MIT para `jszip`; verificar términos de ExerciseDB; autoalojar fuentes.
- **Criterio de aceptación:** avisos incluidos en web y app; ningún paquete distribuido sin licencia documentada.

### A-14 · Inventario real de almacenamiento en el navegador

- **Hallazgos:** F-11
- **Responsable:** dev
- **Esfuerzo:** S
- **Depende de:** despliegue de producción.
- **Acción:** auditar con DevTools cookies, localStorage, IndexedDB y Cache Storage; decidir si basta un aviso informativo o hace falta consentimiento.
- **Criterio de aceptación:** inventario con nombre, finalidad, duración y base; aviso publicado si procede.

### A-15 · Decisión sobre el Reglamento de IA

- **Hallazgos:** F-18
- **Responsable:** abogado + dev
- **Esfuerzo:** S
- **Depende de:** fecha de puesta en servicio del entrenador.
- **Acción:** documentar la calificación de riesgo; confirmar si el art. 50.2 aplica y, en su caso, implementar marcado antes del 2/12/2026.
- **Criterio de aceptación:** decisión escrita con norma, artículo y fecha.

---

## P2 — Mejora continua

### A-16 · Aviso legal LSSI (si aplica)

- **Hallazgos:** F-13
- **Responsable:** responsable + abogado
- **Esfuerzo:** S
- **Depende de:** decisión sobre el carácter comercial del servicio.
- **Acción:** si GymLog es prestador, publicar nombre, domicilio, correo y NIF; si no, documentar por qué no aplica.

### A-17 · Cadenas de HealthKit en iOS

- **Hallazgos:** F-17
- **Responsable:** dev
- **Esfuerzo:** S
- **Acción:** añadir `NSHealthShareUsageDescription` y, si procede, `NSHealthUpdateUsageDescription`; revisar el README para que no anuncie lo que el binario no hace.

### A-18 · Accesibilidad y versiones de los textos legales

- **Responsable:** dev
- **Esfuerzo:** M
- **Acción:** contraste, navegación por teclado, versiones en los idiomas soportados por la app y archivo de versiones anteriores.

### A-19 · Decisión sobre DPO

- **Responsable:** abogado
- **Esfuerzo:** S
- **Acción:** documentar si procede designar DPO; si no, dejar constancia de la evaluación.

### A-20 · Declaraciones de tiendas

- **Responsable:** dev + responsable
- **Esfuerzo:** S
- **Acción:** alinear Data Safety (Google Play) y App Privacy (App Store) con el RAT y con la política; revisar tras cada cambio de tratamiento.

---

## Calendario sugerido

| Ventana        | Acciones                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| **0–30 días**  | A-01, A-05, A-06, A-03 (o corrección inmediata de términos), desactivar o asegurar el proveedor de IA (A-04) |
| **30–60 días** | A-02, A-07, A-08, A-10, A-12                                                                                 |
| **60–90 días** | A-09, A-11, A-13, A-14, A-15                                                                                 |
| **Continuo**   | A-16 a A-20, revisión trimestral del RAT y de proveedores                                                    |

---

## Dependencias

```
A-01 (base jurídica)
 ├── A-02 (política/términos)
 ├── A-07 (consentimiento salud)
 ├── A-09 (EIPD)
 └── A-11 (edad)

A-05 (proveedores)
 ├── A-02
 ├── A-04 (IA)
 └── A-08 (RAT/retención)
      └── A-03 (borrado)
      └── A-10 (export)
```

---

## Qué no hacer

1. **No copiar una política de privacidad de otra app.** El texto debe describir este producto, estas tablas y estos proveedores.
2. **No añadir un banner de cookies como sustituto de la información.** Vercel y Cloudflare son cookieless; el problema es la información y el almacenamiento propio.
3. **No declarar cumplimiento** tras cambiar los textos. La conformidad exige base jurídica, contratos, retención y procedimientos, no solo documentos.
4. **No enviar datos de salud a un proveedor sin DPA** «porque el usuario consiente». El consentimiento no sustituye al encargado ni a la base de transferencia.
5. **No implementar el borrado solo en la UI** sin borrar `auth.users` y verificar las cascadas.
6. **No usar datos reales de salud en pruebas** sin anonimizar.

---

## Indicadores de que el plan avanza

- [ ] Existe un documento firmado de base jurídica y art. 9.2.
- [ ] La política cubre el 100 % de las actividades del RAT.
- [ ] Un usuario puede borrar su cuenta y desaparece de todas las tablas.
- [ ] Existe un DPA por cada proveedor con acceso a datos.
- [ ] La exportación incluye todas las categorías.
- [ ] No quedan `[PENDIENTE]` en el RAT.
- [ ] Hay un inventario de almacenamiento en navegador.
- [ ] Los avisos de terceros están incluidos en la distribución.

> Este plan no acredita cumplimiento. Su ejecución debe validarla un abogado.
