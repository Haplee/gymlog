#!/usr/bin/env bash
# GymLog sync — Ubuntu 26.
#
# Corre al iniciar sesión (systemd --user o autostart). Hace dos cosas:
#
#  1. Ficheros privados (gitignored: .env*, credenciales locales): copia el más
#     reciente entre el repo y la carpeta compartida que también ve Windows.
#  2. Git: commit local (si hay cambios) → pull --rebase → push.
#
# Configuración (variable de entorno o edita aquí):
#   GYMLOG_REPO    ruta del repo en Ubuntu     (defecto: ~/proyectos/gymlog)
#   GYMLOG_SHARED  carpeta compartida con Windows: partición NTFS de Windows
#                  montada en /mnt/win         (defecto: /mnt/win/gymlog-sync)
set -u

REPO="${GYMLOG_REPO:-$HOME/proyectos/gymlog}"
SHARED_DIR="${GYMLOG_SHARED:-/mnt/win/gymlog-sync}"
PRIVATE_FILES=(
  .env
  .env.local
  .env.example
  supabase/usuario_prueba.txt
  # openspec/IAS.md  # ⚠️ contiene API keys en claro; NO lo sincronices por defecto
)

LOG="$REPO/.git/sync.log"
log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG" 2>/dev/null || true; }

log '== GymLog sync (Ubuntu) ================================'

[ -d "$REPO/.git" ] || { log "ERROR: repo no existe: $REPO"; exit 1; }
mkdir -p "$SHARED_DIR" 2>/dev/null || log "WARN: no se pudo crear $SHARED_DIR"

# 1) Ficheros privados: gana el más reciente.
for f in "${PRIVATE_FILES[@]}"; do
  local_file="$REPO/$f"
  shared_file="$SHARED_DIR/${f//\//__}"
  if [ -f "$local_file" ]; then
    if [ -f "$shared_file" ]; then
      if [ "$shared_file" -nt "$local_file" ]; then cp -f "$shared_file" "$local_file" && log "shared -> local : $f"; fi
      if [ "$local_file" -nt "$shared_file" ]; then cp -f "$local_file" "$shared_file" && log "local -> shared : $f"; fi
    else
      cp -f "$local_file" "$shared_file" && log "local -> shared (nuevo): $f"
    fi
  elif [ -f "$shared_file" ]; then
    cp -f "$shared_file" "$local_file" && log "shared -> local (nuevo): $f"
  fi
done

# 2) Git: commit → pull --rebase → push.
cd "$REPO" || exit 1

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  # --no-verify: el pre-commit (lint-staged) bloquearía un commit mecánico del sync.
  git commit --no-verify -m "chore: sync ($(hostname)) - $(date '+%Y-%m-%d %H:%M')" \
    || { log 'ERROR: commit fallo'; exit 1; }
  log 'commit creado'
fi

if ! git pull --rebase --autostash >/dev/null 2>&1; then
  log "ERROR: pull --rebase fallo (¿conflicto?) -> cd $REPO y arréglalo a mano"
  exit 1
fi
if ! git push >/dev/null 2>&1; then
  log 'ERROR: push fallo (¿red/credenciales?) -> git push a mano'
  exit 1
fi
log 'OK: repo sincronizado'
