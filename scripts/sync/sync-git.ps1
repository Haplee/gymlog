<#
  GymLog sync — Windows.

  Corre al iniciar sesión (carpeta Startup). Hace dos cosas:

  1. Ficheros privados (gitignored: .env*, credenciales locales): copia el más
     reciente entre el repo y la carpeta compartida que también ve Ubuntu.
  2. Git: commit local (si hay cambios) → pull --rebase → push.

  Configuración (variable de entorno o edita aquí):
    GYMLOG_SHARED  carpeta compartida con Ubuntu (defecto: C:\gymlog-sync)
#>

$ErrorActionPreference = 'Continue'

$Repo = (Resolve-Path "$PSScriptRoot\..\..").Path
$SharedDir = if ($env:GYMLOG_SHARED) { $env:GYMLOG_SHARED } else { 'C:\gymlog-sync' }
$PrivateFiles = @(
  '.env',
  '.env.local',
  '.env.example',
  'supabase/usuario_prueba.txt'
  # 'openspec/IAS.md'  # ⚠️ contiene API keys en claro; NO lo sincronices por defecto
)
$LogFile = Join-Path $Repo '.git\sync.log'

function Log([string]$msg) {
  try { Add-Content -Path $LogFile -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg) } catch { }
}

Log '== GymLog sync (Windows) ================================'

if (-not (Test-Path $Repo)) { Log "ERROR: repo no existe: $Repo"; exit 1 }
if (-not (Test-Path $SharedDir)) {
  New-Item -ItemType Directory -Path $SharedDir -Force | Out-Null
  Log "carpeta compartida creada: $SharedDir"
}

# 1) Ficheros privados: gana el más reciente.
foreach ($f in $PrivateFiles) {
  $local = Join-Path $Repo ($f -replace '/', '\')
  $shared = Join-Path $SharedDir ($f -replace '[/\\]', '__')
  try {
    if (Test-Path $local -PathType Leaf) {
      $tLocal = (Get-Item $local).LastWriteTime
      if (Test-Path $shared -PathType Leaf) {
        $tShared = (Get-Item $shared).LastWriteTime
        if ($tShared -gt $tLocal) { Copy-Item $shared $local -Force; Log "shared -> local : $f" }
        elseif ($tLocal -gt $tShared) { Copy-Item $local $shared -Force; Log "local -> shared : $f" }
      }
      else { Copy-Item $local $shared -Force; Log "local -> shared (nuevo): $f" }
    }
    elseif (Test-Path $shared -PathType Leaf) {
      Copy-Item $shared $local -Force; Log "shared -> local (nuevo): $f"
    }
  }
  catch { Log "WARN: $f -> $($_.Exception.Message)" }
}

# 2) Git: commit → pull --rebase → push.
Set-Location $Repo
try {
  $changed = git status --porcelain 2>$null
  if ($LASTEXITCODE -ne 0) { Log 'ERROR: git status fallo'; exit 1 }
  if ($changed) {
    git add -A
    # --no-verify: el pre-commit (lint-staged) bloquearía un commit mecánico del sync.
    git commit --no-verify -m "chore: sync ($env:COMPUTERNAME) - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    if ($LASTEXITCODE -ne 0) { Log 'ERROR: commit fallo'; exit 1 }
    Log "commit creado ($($changed.Count) ficheros)"
  }

  $null = git pull --rebase --autostash 2>&1
  if ($LASTEXITCODE -ne 0) { Log 'ERROR: pull --rebase fallo (¿conflicto?) -> resolvelo a mano'; exit 1 }

  $null = git push 2>&1
  if ($LASTEXITCODE -ne 0) { Log 'ERROR: push fallo (¿red/credenciales?) -> git push a mano'; exit 1 }
  Log 'OK: repo sincronizado'
}
catch {
  Log "ERROR: $($_.Exception.Message)"
  exit 1
}
