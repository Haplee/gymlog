# GymLog v2.9.0 - Release Notes

Esta actualización se centra en mejorar la estabilidad de la experiencia en dispositivos móviles (Android) y añadir controles de entrenamiento más accesibles.

## ✨ Nuevas Funcionalidades

- **Botón de Cancelar Sesión rápido:** Se ha añadido un nuevo botón sutil de "CANCELAR" directamente en la cabecera del entrenamiento activo (junto a los contadores de tiempo, volumen y series). Permite descartar rápidamente un entrenamiento erróneo sin necesidad de borrar las series una a una, limpiando totalmente la pantalla.

## 🐛 Correcciones de Errores (Bugs Fixes)

- **Bloqueo en la creación de ejercicios:** Resuelto un fallo crítico en dispositivos táctiles Android donde la pantalla no permitía escribir ni interactuar con los campos "Nombre del ejercicio" o el selector de "Grupo muscular" al intentar crear un ejercicio personalizado.
- **Cierres inesperados del panel de búsqueda:** Se ha mejorado la lógica del "backdrop" (el fondo oscuro) y el manejo del foco de los inputs para evitar que el modal de búsqueda de ejercicios se cerrase solo mientras el usuario intentaba escribir.
- **Estabilidad de la compilación y de AudioContext:** Se ha creado una declaración de tipos global en el entorno (`webkitAudioContext`) eliminando casteos inseguros que provocaban advertencias graves de TypeScript al momento de compilar.
- **Accesibilidad:** Se añadieron atributos de accesibilidad técnica (`aria-label`) al selector de ejercicios para garantizar mejor interacción de pantalla.

## 🧹 Mantenimiento

- **Limpieza de Repositorio:** Purga profunda de archivos residuales, reportes de tests antiguos, scripts huérfanos y APKs obsoletas pesadas para mantener un repositorio ágil y limpio.
