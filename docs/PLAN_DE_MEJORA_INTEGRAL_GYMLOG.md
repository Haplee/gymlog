# 🚀 PLAN DE MEJORA INTEGRAL Y REFACTORIZACIÓN TÉCNICA: GYMLOG

Actúa como un Desarrollador Full-Stack Senior especializado en aplicaciones de Fitness con **React, TypeScript, Supabase, Capacitor** y **Computer Vision (Python / MediaPipe / YOLO)**. Tu tarea es ejecutar una refactorización profunda de la interfaz de usuario, optimizar la UX durante el ejercicio activo, implementar el acceso al Entrenador IA, construir un algoritmo de rutina personalizada optimizado para Balonmano y Fuerza, auditar la persistencia en Supabase e integrar el motor de análisis de vídeo para repeticiones y VBT.

---

## 📌 CONTEXTO DE LA ARQUITECTURA DEL PROYECTO

- **Frontend:** React, TypeScript, Vite, CSS/Tailwind, Capacitor (Mobile iOS/Android).
- **Estructura por Features:** Ubicada en `src/features/` (`auth`, `cardio`, `coach`, `routine`, `stats`, `wearables`, `workout`).
- **Estado Global:** Stores (Zustand/Context) en cada feature (ej. `src/features/workout/stores/`).
- **Backend & Base de Datos:** Supabase (`supabase/migrations`, cliente en `src/shared/` o `src/features/`).
- **Herramientas de Análisis de Vídeo:** Scripts y pipelines en `tools/lift-analysis/`.

---

## 🛠️ ESPECIFICACIONES TÉCNICAS POR BLOQUE

---

### 🟢 BLOQUE 1: Rediseño, Limpieza y UX de la Pestaña de Inicio (Home Tab)

#### 1.1 Ocultar elementos en Modo Ejercicio Activo

- **Requisito:** Cuando el usuario inicie una sesión de ejercicio (ya sea desde la rutina diaria o desde la biblioteca de ejercicios), la pantalla principal debe entrar en estado `active_workout_mode`.
- **Acción:**
  - Consulta el estado de sesión activa en `workoutStore` / `useWorkout()`.
  - Oculta dinámicamente banners promocionales, tarjetas de resumen semanales y widgets secundarios que saturen la pantalla mientras el entrenamiento esté en curso.
  - Prioriza únicamente el timer de descanso, el registro de series/repeticiones y el widget compacto de control de la sesión actual.

#### 1.2 Métricas de Salud / Wearables (Google Health Connect / Google Fit)

- **Requisito:** Revisar el componente dentro de `src/features/wearables/`.
- **Acción:**
  - Si las métricas de dispositivos (pasos, calorías quemadas, frecuencia cardíaca, sueño) no se visualizan o entorpecen la UI, reorganízalas en un widget compacto tipo carrusel o tarjeta colapsable en la parte superior del Home.
  - Asegura que el fallback (cuando el dispositivo no esté conectado) no ocupe espacio innecesario y muestre un diseño elegante.

#### 1.3 Modificación del Sistema de Valoración por Estrellas (RPE / Feedback)

- **Requisito:** Eliminar la tarjeta/box fija de valoración con estrellas que actualmente aparece de forma permanente en la pestaña de inicio.
- **Acción:**
  - Remueve el contenedor estático de estrellas del Home (`src/features/workout/components/` o `src/features/stats/`).
  - Sustitúyelo por una acción dinámica: un botón sutil `"Añadir Nota / Valorar Sesión"` o integrándolo en el modal/pantalla de **Finalización del Entrenamiento** (`FinishWorkoutModal`).
  - La valoración solo debe desplegarse como un modal colapsable o Bottom Sheet cuando el usuario decida ingresar una nota o finalizar una sesión.

#### 1.4 Rediseño e Iconografía para Tipos de Carga/Ejercicio

- **Requisito:** El usuario debe identificar de un vistazo el tipo de resistencia de cada ejercicio mediante iconos claros y detallados.
- **Acción:**
  - Revisa el sistema de iconos (Lucide-react / SVG custom) en la lista de ejercicios.
  - Implementa 3 categorías con iconos bien definidos y badges distintivos:
    1. 🏋️ **Peso Externo (Barra / Mancuernas / Polea):** Icono detallado de barra/mancuerna.
    2. 🤸 **Peso Corporal (Calistenia / Bodyweight):** Icono de figura realizando ejercicio de peso corporal.
    3. 🎒 **Lastre (Weighted Bodyweight):** Icono específico (figura con chaleco de lastre / disco colgado).

---

### 🟦 BLOQUE 2: Integración del Entrenador IA (Coach) y Corrección de Layout

#### 2.1 Acceso Directo al Entrenador IA en el Home

- **Requisito:** El entrenador con IA debe ser accesible desde la vista principal de la app.
- **Acción:**
  - Crea un botón/tarjeta destacada en la pestaña principal de inicio (o un Floating Action Button - FAB interactivo en la esquina inferior derecha) con el icono de IA/Coach.
  - Al hacer clic, debe navegar directamente a `src/features/coach/pages/CoachChatPage.tsx` o abrir el drawer interactivo del chat de IA.

#### 2.2 Corrección de Maquetación en Ajustes (Opciones de IA)

- **Requisito:** En la pantalla de Ajustes (`Settings`), la sección de configuración de IA (3 opciones de parámetros de la IA) se muestra descuadrada.
- **Acción:**
  - Revisa la vista de Ajustes.
  - Aplica un layout `flex flex-col gap-3` o `grid grid-cols-1 md:grid-cols-3` con alineación vertical centrada (`items-center`), paddings simétricos y bordes suavizados para igualar las 3 tarjetas de opciones de la IA.

---

### 🟧 BLOQUE 3: Rediseño y Centrado del Módulo Cardio

#### 3.1 Alineación y Formato Inline de Tarjeta de Cardio

- **Requisito:** El botón/tarjeta del módulo de Cardio está mal centrado o descuadrado en relación con el resto de la lista.
- **Acción:**
  - Revisa los componentes dentro de `src/features/cardio/components/`.
  - Reestructura la tarjeta de ejercicio de Cardio para que utilice un diseño en línea (Row List Item) simétrico, tomando como referencia de diseño el elemento de **Elíptica** (icono a la izquierda, título y subtexto al centro, flecha/acción a la derecha).

---

### 🟨 BLOQUE 4: Algoritmo y Generación de Rutina Personalizada (Balonmano + Fuerza)

#### 4.1 Análisis del Histórico de Entrenamientos

- **Requisito:** Analizar los registros almacenados en la app (tablas de entrenamientos pasados, días registrados, ejercicios ejecutados y frecuencia semanal).
- **Acción:**
  - Crea o ejecuta un script/función que consulte los datos en `workout_logs` / `exercises` para determinar el nivel actual, volumen medio por grupo muscular y días de mayor consistencia del usuario.

#### 4.2 Diseño del Plan Personalizado

- **Requisito:** Generar una rutina estructurada y científicamente optimizada para dos metas paralelas:
  1. **Rendimiento en Balonmano:**
     - Potencia de lanzadores (manguito rotador, fuerza rotacional de core, press inclinado explosivo).
     - Saltos y cambios de dirección (fuerza reactiva, estabilizadores de rodilla/LCA, tobillos).
  2. **Ganancia de Fuerza en Gimnasio:**
     - Progresión de cargas en Básicos (Sentadilla, Peso Muerto, Press Banca, Dominadas con lastre).
     - Estructura sugerida: Torso / Pierna o Push-Pull-Legs adaptado a la frecuencia detectada.

---

### 🟪 BLOQUE 5: Auditoría y Persistencia Nube/Caché en Supabase

#### 5.1 Auditoría del Esquema de Persistencia

- **Requisito:** Comprobar si las rutinas del usuario se almacenan solo localmente (LocalStorage / IndexedDB / Zustand persist) o si se sincronizan con Supabase.
- **Acción:**
  - Inspecciona `src/features/routine/api/` y las migraciones en `supabase/migrations/`.
  - Verifica si existen las tablas `routines` y `routine_exercises` vinculadas al `user_id`.

#### 5.2 Implementación de Persistencia Bidireccional

- **Requisito:** Garantizar que ninguna rutina se pierda y esté asignada explícitamente al perfil del usuario.
- **Acción:**
  - Si falta la sincronización remota:
    1. Asegura la estructura en Supabase:
       ```sql
       CREATE TABLE IF NOT EXISTS public.routines (
           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
           name TEXT NOT NULL,
           description TEXT,
           is_active BOOLEAN DEFAULT true,
           created_at TIMESTAMPTZ DEFAULT now()
       );
       ```
    2. Aplica políticas RLS (`Row Level Security`) para que cada usuario solo lea/escriba sus propias rutinas.
    3. Implementa una estrategia de sincronización (`Caché Local First` + `Supabase Sync`) para que la app funcione offline pero persista en la cuenta del usuario en cuanto recupere conexión.

---

### 🟫 BLOQUE 6: Análisis de Repeticiones y Trayectoria de Carga con Video (Lift Analysis & VBT)

#### 6.1 Arquitectura y Pipeline de Procesamiento de Video (Prototipo Local)

- **Requisito:** Analizar vídeos de ejercicios básicos (Press Banca, Sentadilla, Peso Muerto, Press Militar) para extraer de forma automática el bar path (trayectoria de la barra), el conteo de repeticiones y métricas de velocidad concéntrica (Velocity-Based Training - VBT).
- **Acción:**
  - Estructurar el script CLI en `tools/lift-analysis/analyze_lift.py` utilizando **Python 3.12**, **Ultralytics YOLOv8-pose** y **Roboflow Supervision**.
  - **Detección y Proxy:** Extraer los keypoints de las muñecas (COCO 9 y 10, confianza ≥ 0.5) para calcular el punto medio como proxy de posición de la barra frame a frame.
  - **Suavizado y Segmentación:** Aplicar filtro **Savitzky-Golay** (`window_length=11`, `polyorder=2`) sobre la serie temporal Y(t) y segmentar repeticiones (valles/picos) mediante `scipy.signal.find_peaks` (prominencia ≥ 30% del ROM, distancia mínima de 0.5s entre picos).
  - **Extracción de Métricas:** Calcular por cada repetición: ROM (m), Duración (s), Velocidad Media y Pico ($m/s$), y % de pérdida de velocidad.

#### 6.2 Calibración Espacial, Renderizado y Exportación

- **Requisito:** Obtener medidas reales en metros/segundo y generar una salida visual anotada con métricas overlay.
- **Acción:**
  - **Calibración:** Implementar el flag `--plate-px <N>` para calibrar la escala $m/px$ basándose en el diámetro estándar del disco olímpico (450 mm).
  - **Renderizado (VideoSink):** Dibujar el esqueleto del atleta (`EdgeAnnotator` / `VertexAnnotator`), la trayectoria trazada de la barra (`cv2.polylines`) y un HUD en tiempo real con repetición actual y velocidad.
  - **Exportación:** Salida en vídeo anotado (`out/<video>_annotated.mp4`) y archivo de métricas estructuradas JSON (`out/<video>_metrics.json`).

#### 6.3 Roadmap de Servicio Backend e Integración en GymLog

- **Requisito:** Conectar el motor de análisis en Python con la app frontend (React/Capacitor) y Supabase.
- **Acción:**
  - **Servicio Backend:** API en FastAPI donde la app sube el vídeo a Supabase Storage y activa el procesamiento.
  - **Esquema de Base de Datos:** Crear la tabla `lift_analyses`:
    ```sql
    CREATE TABLE IF NOT EXISTS public.lift_analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
        workout_set_id UUID REFERENCES public.workout_sets(id) ON DELETE SET NULL,
        metrics JSONB NOT NULL,
        video_url TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    ```
  - **Integración UI App:** Permitir al usuario grabar/adjuntar vídeo desde el registro de una serie en GymLog, mostrando la gráfica de velocidad y trayectoria de barra en el historial.

---

## 📋 ENTREGABLES ESPERADOS:

1. **Resumen de cambios por feature:** Archivos identificados y modificados en `src/features/`.
2. **Código Refactorizado:** TypeScript estricto respetando la arquitectura del proyecto.
3. **Plan de Rutina Personalizado:** Formato JSON / estructura para Balonmano + Fuerza.
4. **Verificación de Base de Datos:** Estado de las migraciones en Supabase y políticas RLS activas.
5. **Motor Lift Analysis:** Script de análisis de vídeo y verificación de exportación de métricas.
