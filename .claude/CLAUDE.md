# ResolveCore — CLAUDE.md

> Plataforma de mantenimiento y optimización remota para equipos Windows, Linux y Android.
> Eslogan: "Solución a tus problemas informáticos." — Francisco Vidal Mateo

---

> Commits: Todos los commits los realiza el usuario ninguno tu.

## Descripción del proyecto

ResolveCore es un sistema de soporte técnico remoto estructurado en 7 fases:
solicitud del usuario → ticket (MantisBT) → conexión remota (AnyDesk) → diagnóstico
(PowerShell / Bash) → resolución → informe (.txt rellenado a mano por el técnico)
→ facturación.

El proyecto se implementa sobre WordPress (frontend de soporte) + MantisBT (gestión
de incidencias) + scripts de diagnóstico multiplataforma + generación de plantillas
de informe y factura en texto plano (.txt). El informe y la factura los rellena el
técnico a mano y los entrega/sube él mismo; el sistema no genera PDF (decisión del
autor, 2026-06-02).

---

## Stack técnico

- **CMS / Frontend:** WordPress (PHP)
- **Tickets:** MantisBT (Docker local + VPS)
- **Acceso remoto:** AnyDesk
- **Scripts diagnóstico:** PowerShell (Windows), Bash (Linux / macOS / Android)
- **Scripts de reconocimiento:** Python 3 — Nmap, CVE (capas dominio/ports/adapters, sin clases)
- **Generación de informes/facturas:** plantillas en texto plano (.txt) que el técnico rellena a mano (sin PDF)
- **Base de datos de vulnerabilidades:** MySQL / MariaDB
- **Android (futuro):** Kotlin + Jetpack Compose + Material 3

Para la parte web usa PHP moderno. No mezcles jQuery con vanilla JS sin motivo.
Para los scripts, usa PowerShell 5.1+ en Windows y Bash compatible con sh en Linux.
Para los scripts Python (`scripts/common/`), separa en capas domain → ports → adapters, pero **sin clases**: las entidades son diccionarios creados por funciones (`nueva_vulnerabilidad()`, `nuevo_host()`…), los ports son contratos escritos en docstrings y los adapters son funciones de módulo (`nvd_rest.get_vulns()`, `nmap_local.get_host_info()`). Tampoco uses type hints — el autor no programa con clases ni anotaciones.

---

## Comandos esenciales

```bash
# WordPress local (si usas DevKinsta / wp-cli)
wp server --host=0.0.0.0 --port=8080

# MantisBT local (Docker)
docker compose -f mantisbt/docker-compose.yml up -d

# Ejecutar script de diagnóstico Windows (PowerShell)
pwsh ./scripts/windows/diagnostico.ps1

# Ejecutar script de diagnóstico Linux
bash ./scripts/linux/diagnostico.sh

# Ejecutar script de diagnóstico macOS  (ROADMAP — script no presente en el repo;
# borrado en 12890ac, recuperable de histórico. Ver auditoría A11/D5.)
# bash ./scripts/macos/diagnostico.sh

# Optimización + acta de acciones (.txt cliente + .json técnico/flota en
# diagnosticos/tickets/<NNNNN>/<plataforma>/). --confirm obligatorio; --stop-hogs (Bash) / -StopHogs
# (PS) ademas detiene los top consumidores no críticos. Ver docs/scripting/schema-optimizacion.md
bash ./scripts/linux/optimizacion.sh --confirm [--ticket N] [--stop-hogs]
bash ./scripts/android/optimizacion.sh --confirm [--ticket N] [--stop-hogs]
pwsh ./scripts/windows/optimizacion.ps1 -Confirm [-Ticket N] [-StopHogs]

# Buscar vulnerabilidades
python scripts/common/buscar_vulnerabilidades.py

# Generar plantilla de informe (.txt para rellenar a mano; --json opcional pre-rellena cabecera)
python scripts/common/generar_informe.py [--json diagnostico.json]

# (ARCHIVADO — en _archivo/common/, no en el árbol activo. La facturación se gestiona desde MantisBT.)
# python scripts/common/generar_factura.py

# (ARCHIVADO — en _archivo/common/, no en el árbol activo. Restaurar con git mv si se necesita.)
# python scripts/common/escaner_nmap.py --ip 192.168.1.0/24       # escaneo Nmap

# Setup servidor VPS (Linux)
bash ./scripts/server/linux/post-install.sh

# Setup entorno técnico (Windows)  (ROADMAP — scripts/setup/ borrado en 12890ac,
# recuperable de histórico. Ver auditoría A11/D5.)
# pwsh ./scripts/setup/setup-tecnico-windows.ps1

# NOTA (legacy): el plugin web rc-tech aún expone RC_Tech_Report::generate(
# $issue_id, $client_email ) (HTML → PDF wkhtmltopdf, adjunto al ticket vía
# endpoint REST /action/pdf). NO forma parte del flujo actual: el informe que
# recibe el cliente es la plantilla .txt rellenada a mano por el técnico, que él
# mismo sube a MantisBT. Mantener este código web no implica reactivar el PDF.
```

---

## Arquitectura del proyecto

```
ResolveCore
├── .claude
│   ├── skills
│   │   ├── entrevistador-procesos.skill
│   │   ├── humanizador.skill
│   │   ├── optimizador-prompts.skill
│   │   ├── presentaciones-visuales.skill
│   │   ├── superpowers.skill
│   │   └── verificador-datos.skill
│   ├── CLAUDE.md
│   ├── settings.json
│   └── settings.local.json
├── .github
│   └── workflows
│       └── lint.yml
├── _archivo
│   ├── common
│   │   ├── escaner_nmap.py
│   │   └── generar_factura.py
│   ├── preview
│   │   ├── _home-inline.css
│   │   ├── _nav.css
│   │   ├── dashboard.html
│   │   ├── home.html
│   │   ├── index.html
│   │   ├── mantis.html
│   │   ├── registro.html
│   │   └── tech.html
│   └── README.md
├── assets
│   └── logo
│       ├── resolvcore-icon.png
│       ├── resolvcore-icon.svg
│       ├── resolvcore-logo-dark.png
│       ├── resolvcore-logo-dark.svg
│       ├── resolvcore-logo-light.png
│       └── resolvcore-logo-light.svg
├── docs
│   ├── capturas
│   │   ├── lun19-entornos-backup
│   │   │   ├── 01_localwp-web-descarga.png
│   │   │   ├── 02_localwp-formulario-descarga.png
│   │   │   ├── 03_localwp-instalacion-dpkg.png
│   │   │   ├── 04_localwp-lanzar-app.png
│   │   │   ├── 05_localwp-terminos-servicio.png
│   │   │   ├── 06_localwp-app-vacia.png
│   │   │   ├── 07_localwp-nombre-sitio-resolvecore.png
│   │   │   ├── 08_localwp-entorno-custom-php82-nginx-mysql.png
│   │   │   ├── 09_localwp-setup-wordpress-credenciales.png
│   │   │   ├── 10_localwp-error-libaio.png
│   │   │   ├── 11_localwp-fix-apt-install-libaio.png
│   │   │   ├── 12_wordpress-sitio-activo-resolvecore-local.png
│   │   │   ├── 13_wordpress-login.png
│   │   │   ├── 14_wordpress-dashboard-admin.png
│   │   │   ├── 15_tema-directorio-creado-terminal.png
│   │   │   └── 16_wordpress-temas-instalados.png
│   │   ├── mar20-mantisbt-web
│   │   │   ├── 01_web-resolvecore-homepage-hero.png
│   │   │   ├── 02_mantisbt-instalacion-error-bd.png
│   │   │   ├── 03_mantisbt-credenciales-firefox.png
│   │   │   ├── 04_mantisbt-dashboard-vacio.png
│   │   │   ├── 05_mantisbt-api-token-generado.png
│   │   │   ├── 06_mantisbt-primer-ticket-test-terminal.png
│   │   │   ├── 07_wordpress-formulario-contacto-test.png
│   │   │   ├── 08_mantisbt-ticket-creado-desde-formulario.png
│   │   │   └── 09_backup-sql-wpcontent-tar.png
│   │   └── README.md
│   ├── defensa
│   │   ├── analisis-procesos-flujo.md
│   │   ├── anotaciones-tutor.md
│   │   ├── auditoria-mejoras.md
│   │   ├── cambios _desde_25_05.md
│   │   ├── defensa-scripts-mantis.md
│   │   ├── defensa-tfg.md
│   │   ├── estudio-tribunal-scripts.md
│   │   ├── informe-tutor-estado-proyecto.md
│   │   ├── mantisbt-api-integracion.md
│   │   ├── origen-componentes.md
│   │   └── punto-de-partida-ante-proyecto.md
│   ├── scripting
│   │   ├── arquitectura-scripting.md
│   │   ├── diseno-alto-nivel.md
│   │   ├── regex-y-json-diagnostico.md
│   │   ├── schema-diagnostico.md
│   │   ├── schema-diagnostico.schema.json
│   │   ├── schema-optimizacion.md
│   │   ├── schema-servicios-adicionales.md
│   │   └── schema-vulnerabilidades.md
│   ├── tareas
│   │   ├── handoff.md
│   │   ├── implementar-servicios-adicionales.md
│   │   └── pendiente-2026-05-26.md
│   ├── tecnica
│   │   ├── ResolveCore_Documentacion_Tecnica.md
│   │   ├── backup-entorno-web.md
│   │   ├── comparativa-componentes.md
│   │   ├── correo-dkim.md
│   │   ├── despliegue-ionos.md
│   │   ├── entornos.md
│   │   ├── equipo-tecnicos.md
│   │   ├── flujo-sistema.md
│   │   ├── mantis-integration.md
│   │   ├── mantis-permisos.md
│   │   ├── manual-usuario-mantis.md
│   │   ├── servicios-adicionales.md
│   │   ├── so-especializado.md
│   │   ├── stack-tecnologico.md
│   │   ├── tutorial-wordpress-manual.md
│   │   └── versionado.md
│   ├── INDEX.md
│   └── PENDIENTES.md
├── mantisbt
│   ├── config
│   │   └── config_inc.php
│   ├── plugins
│   │   ├── ResolveCoreBranding
│   │   │   └── ResolveCoreBranding.php
│   │   └── install.sh
│   ├── sql
│   │   ├── mantisbt-db.sql
│   │   └── resolvecore-setup.sql
│   ├── .env.example
│   └── docker-compose.yml
├── preview
│   ├── _home-inline.css
│   ├── _nav.css
│   ├── dashboard.html
│   ├── home.html
│   ├── index.html
│   ├── mantis.html
│   ├── registro.html
│   └── tech.html
├── scripts
│   ├── android
│   │   ├── ResolveCore.sh
│   │   ├── diagnostico.sh
│   │   └── optimizacion.sh
│   ├── common
│   │   ├── adapters
│   │   │   ├── __init__.py
│   │   │   ├── inventario_local.py
│   │   │   ├── kev_rest.py
│   │   │   ├── mantis_rest.py
│   │   │   ├── nmap_local.py
│   │   │   ├── nvd_rest.py
│   │   │   └── osv_rest.py
│   │   ├── domain
│   │   │   ├── __init__.py
│   │   │   └── models.py
│   │   ├── ports
│   │   │   ├── __init__.py
│   │   │   ├── host_intel_source.py
│   │   │   ├── inventory_source.py
│   │   │   ├── mantis_attachment_sink.py
│   │   │   └── vuln_source.py
│   │   ├── __init__.py
│   │   ├── adjuntar_informe_mantis.py
│   │   ├── buscar_vulnerabilidades.py
│   │   └── generar_informe.py
│   ├── linux
│   │   ├── ResolveCore.sh
│   │   ├── diagnostico.sh
│   │   └── optimizacion.sh
│   ├── server
│   │   ├── linux
│   │   │   ├── autoinstall.yaml
│   │   │   └── post-install.sh
│   │   ├── nginx-snippets
│   │   │   └── rc-install.conf
│   │   ├── ops
│   │   │   ├── backup.sh
│   │   │   ├── cron-resolvecore
│   │   │   ├── deploy.sh
│   │   │   ├── healthcheck.sh
│   │   │   ├── logrotate-resolvecore
│   │   │   ├── mantis-branding.sh
│   │   │   ├── nginx-reload-safe.sh
│   │   │   ├── restore.sh
│   │   │   ├── setup-mail-ionos.sh
│   │   │   └── sync-wp.sh
│   │   ├── bootstrap-mantis.sh
│   │   ├── deploy-ionos.sh
│   │   ├── setup-downloads-dir.sh
│   │   └── upload-to-vps.ps1
│   ├── servicios
│   │   ├── clonacion
│   │   │   ├── registrar-imagen.sh
│   │   │   └── verificar-imagen.sh
│   │   ├── congelacion
│   │   │   ├── congelacion-linux.sh
│   │   │   └── congelacion-windows.ps1
│   │   ├── kit
│   │   │   └── construir-kit.ps1
│   │   ├── README.md
│   │   ├── install.ps1
│   │   └── install.sh
│   └── windows
│       ├── ResolveCore.ps1
│       ├── diagnostico.ps1
│       └── optimizacion.ps1
├── vulnerabilities
│   └── migrations
│       └── 0001_init.sql
├── wordpress
│   ├── plugins
│   │   ├── rc-core
│   │   │   └── rc-core.php
│   │   ├── rc-fleet
│   │   │   └── rc-fleet.php
│   │   ├── rc-mantisbt
│   │   │   ├── includes
│   │   │   │   └── class-mantis-api.php
│   │   │   └── rc-mantisbt.php
│   │   └── rc-tech
│   │       ├── admin
│   │       │   ├── partials
│   │       │   │   └── row.php
│   │       │   └── page-tech.php
│   │       ├── assets
│   │       │   ├── tech-panel.css
│   │       │   └── tech-panel.js
│   │       ├── includes
│   │       │   ├── addon-telegram.example.php
│   │       │   ├── class-rc-tech-alerts.php
│   │       │   ├── class-rc-tech-api-ext.php
│   │       │   ├── class-rc-tech-queue.php
│   │       │   ├── class-rc-tech-report.php
│   │       │   ├── class-rc-tech-sla.php
│   │       │   ├── class-rc-tech-timeline.php
│   │       │   └── helpers.php
│   │       ├── rest
│   │       │   └── class-rc-tech-rest.php
│   │       ├── README.md
│   │       ├── rc-tech.php
│   │       └── uninstall.php
│   └── resolvecore-theme
│       ├── assets
│       │   ├── js
│       │   │   └── main.js
│       │   └── logo
│       │       ├── resolvcore-icon.png
│       │       ├── resolvcore-icon.svg
│       │       ├── resolvcore-logo-dark.png
│       │       ├── resolvcore-logo-dark.svg
│       │       ├── resolvcore-logo-light.png
│       │       └── resolvcore-logo-light.svg
│       ├── footer.php
│       ├── front-page.php
│       ├── functions.php
│       ├── header.php
│       ├── index.php
│       ├── og-image.png
│       ├── page-aviso-legal.php
│       ├── page-changelog.php
│       ├── page-contacto.php
│       ├── page-cookies.php
│       ├── page-dashboard.php
│       ├── page-docs.php
│       ├── page-fleet-status.php
│       ├── page-privacidad.php
│       ├── page-registro.php
│       ├── page-tecnicos.php
│       ├── page.php
│       └── style.css
├── .editorconfig
├── .env.example
├── .gitattributes
├── .gitignore
├── .pre-commit-config.yaml
├── LICENSE
├── PSScriptAnalyzerSettings.psd1
├── README.md
└── phpcs.xml.dist
```

---

## Convenciones de código

### PHP / WordPress

- Sigue los estándares de WordPress Coding Standards (WPCS).
- Usa prefijo `rc_` en todas las funciones y opciones del plugin.
- Sanitiza siempre los inputs con `sanitize_text_field()` / `intval()`.
- Escapa siempre los outputs con `esc_html()` / `esc_attr()`.
- YOU MUST never store sensitive data (contraseñas, tokens) en opciones de WordPress sin cifrar.

### PowerShell

- Usa `#Requires -Version 5.1` al inicio de cada script (sin espacio entre `#` y `Requires` — `# Requires` es un comentario inerte). El target real es Windows 10/11, que ship con 5.1; pedir PS7 obliga al técnico a instalarlo y suma fricción.
- Si un script necesita una capacidad PS7 concreta (`ForEach-Object -Parallel`, ternario, `??`), añade ese script a una excepción con `#Requires -Version 7.0` y documenta el por qué en cabecera.
- Maneja errores con `try/catch` y escribe al log con `Write-EventLog` o fichero.
- Los scripts de diagnóstico deben devolver un objeto `[PSCustomObject]` estructurado.
- IMPORTANT: nunca ejecutes comandos destructivos sin confirmación explícita del técnico.

### Bash

- `#!/usr/bin/env bash` en todos los scripts (nunca `#!/bin/bash` — rompe portabilidad en macOS y BSD).
- **`set -uo pipefail` por defecto** en scripts de diagnóstico/optimización. Se omite `-e` deliberadamente: estos scripts capturan fallos comando a comando (`|| echo ...`, `|| true`, validaciones regex) y `-e` los aborta antes de poder rellenar el JSON. Si añades `-e` a un script existente, rompes la captura granular y vuelves al bug del 2026-05-09 con `apt-get -s upgrade | grep -c '^Inst'`.
- Para scripts auxiliares cortos sin captura granular sí se usa `set -euo pipefail` (p.ej. `scripts/server/bootstrap-mantis.sh`).
- Variables en UPPER_CASE. Funciones en snake_case.
- Comprueba dependencias al inicio con `command -v <tool> || exit 1`.

### SQL

- Tablas con prefijo `rc_`. Ej.: `rc_tickets`, `rc_vulnerabilities`.
- Usa migraciones idempotentes (IF NOT EXISTS, IF EXISTS).

---

## Módulos principales

### 1. Diagnóstico multiplataforma

- Windows: rendimiento (CPU/RAM/disco), servicios críticos, logs de eventos, Windows Update.
- Linux: top/htop, journalctl, df, apt/dnf, cron, puertos abiertos.
- macOS: equivalente Linux via `scripts/macos/` (ROADMAP — script no presente; ver A11/D5).
- Android: diagnóstico básico via ADB en `scripts/android/`.
- Reconocimiento de red: Nmap + Shodan via Python (`scripts/common/`) con arquitectura Hexagonal.
- Salida estructurada JSON (+ HTML) en `scripts/diagnosticos/`.

### 2. Base de datos de vulnerabilidades

- Tabla `rc_vulnerabilities`: CVE, gravedad, SO afectado, descripción, fix.
- Script de sincronización con NVD/NIST (cron semanal).
- Los scripts de diagnóstico consultan esta tabla para alertar al técnico.

### 3. Informe técnico (.txt rellenado a mano)

- `scripts/common/generar_informe.py` genera una plantilla `.txt` con apartados
  predefinidos en blanco; el técnico la rellena a mano. Sin PDF ni HTML.
- Secciones fijas (obligatorias por diseño, no se acortan): resumen ejecutivo,
  incidencias detectadas, problemas solucionados, estado actual del sistema,
  recomendaciones, proyección de vida útil del equipo.
- El técnico sube el informe a MantisBT **manualmente** (no hay adjunto automático).

### 4. Modelo de facturación

- La facturación se gestiona desde MantisBT. `generar_factura.py` queda archivado
  en `_archivo/common/` (ya no forma parte del árbol activo).
- **Pago por servicio:** factura por intervención al cerrar ticket.
- **Suscripción:** revisiones programadas vía cron + notificación automática al usuario.

---

## Reglas de comportamiento para Claude Code

- Cuando modifiques un script de diagnóstico, SIEMPRE actualiza el esquema JSON de salida en `docs/scripting/schema-diagnostico.md`.
- Antes de crear una nueva tabla SQL, comprueba si ya existe en `vulnerabilities/migrations/`.
- Los scripts destructivos (limpiar disco, desinstalar, eliminar) requieren flag `--confirm` explícito.
- No generes datos de prueba con IPs, MACs o emails reales. Usa fixtures ficticios.
- Al añadir una nueva fase al flujo del sistema, actualiza el diagrama en `docs/flujo-sistema.md`.
- YOU MUST seguir el patrón de informe existente al añadir apartados a la plantilla .txt (mismas secciones obligatorias).

---

## Delegación a subagentes (optimización de costes)

Hay 3 subagentes en `.claude/agents/`, uno por nivel de modelo. Regla base: **usa el modelo más barato que resuelva la tarea**; escala solo si hace falta.

### `haiku-explorer` (Haiku — barato) — por defecto para LECTURA

Delega aquí cuando la tarea sea buscar, leer o entender, sin modificar nada:

- Buscar ficheros, grep/glob, "¿dónde está X?", "¿qué scripts tocan Y?".
- Leer y resumir ficheros o docs.
- Listar, inspeccionar estado (`git status`, `git log`, `ls`).
- Comprobaciones rápidas de hecho.
- NO escribe ni edita código.

### `sonnet-builder` (Sonnet — estándar) — por defecto para ESCRIBIR

El caballo de batalla. Delega aquí para todo el código del día a día:

- Implementar funciones, corregir bugs, refactors locales.
- Editar scripts Bash/PowerShell/PHP/Python siguiendo las convenciones del repo.
- Actualizar docs, schemas, plantillas.
- Cualquier cambio que NO sea una decisión de arquitectura crítica.

### `opus-architect` (Opus — caro) — SOLO si es imprescindible

Reservado. Antes de usarlo, pregúntate: "¿esto lo resuelve sonnet-builder?". Si la respuesta es sí, NO uses Opus. Justifica el uso. Solo para:

- Diseño de arquitectura (capas domain→ports→adapters, flujo de 7 fases, límites entre módulos).
- Decisiones irreversibles o de alto riesgo y trade-offs difíciles.
- Planificar refactors estructurales grandes (luego los ejecuta sonnet-builder).
- Revisión crítica donde equivocarse sale caro.

### Tabla rápida

| Tarea                                                  | Agente           | Modelo |
| ------------------------------------------------------ | ---------------- | ------ |
| Buscar / leer / listar / resumir                       | `haiku-explorer` | Haiku  |
| Escribir / editar / corregir código (normal)           | `sonnet-builder` | Sonnet |
| Arquitectura / decisión crítica / refactor estructural | `opus-architect` | Opus   |

Patrón típico: `haiku-explorer` localiza → `opus-architect` decide (solo si crítico) → `sonnet-builder` implementa. La mayoría de tareas ni tocan Opus.

---

## Contexto de desarrollo

- Autor: Francisco Vidal Mateo (GitHub: Haplee)
- Entorno: Windows 11 + Ubuntu (dual boot), IDE Antigravity (VS Code-based)
- Despliegue objetivo: servidor VPS Linux (nginx + PHP-FPM + MariaDB)
- TFG ASIR — curso 2024/25

---

## Lo que Claude NO debe hacer

- No instalar dependencias globales sin avisar.
- No hacer commits directamente a `main`. Usa ramas con prefijo `feat/`, `fix/`, `docs/`.
- No modificar `wp-config.php` con credenciales reales.
- No generar código que asuma privilegios root sin comprobarlo antes.
- No acortar la plantilla de informe .txt: las secciones son obligatorias por diseño del servicio.

---

## Referencias útiles

- Diagrama del sistema: `docs/tecnica/flujo-sistema.md`
- Esquema JSON de diagnóstico: `docs/scripting/schema-diagnostico.md`
- Estructura de tickets MantisBT: `docs/tecnica/mantis-integration.md`
- Índice completo de documentación: `docs/INDEX.md`
- Ver `@README.md` para instrucciones de instalación del entorno local.
