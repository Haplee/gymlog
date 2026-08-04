# GymLog — Sync dual-boot Windows ⇄ Ubuntu

Mantiene el repositorio y sus ficheros privados sincronizados entre Windows y
Ubuntu 26. Como es **doble arranque** (nunca están encendidos a la vez), el sync
usa dos canales:

| Qué se sincroniza | Canal | Mecanismo |
|---|---|---|
| Código (lo versionado) | GitHub (`Haplee/gymlog`) | `git commit --no-verify` + `pull --rebase` + `push` |
| Ficheros privados (gitignored): `.env`, `.env.local`, `.env.example`, `supabase/usuario_prueba.txt` | Carpeta compartida entre OS | copia del más reciente (`newest wins`) |

Cada sistema corre su propio script **al iniciar sesión** y registra lo que hace
en `.git/sync.log` (dentro del repo, nunca se sube).

```
┌─ Windows ──────────────┐        ┌─ Ubuntu 26 ─────────────┐
│ Startup\gymlog-sync.vbs│        │ systemd --user          │
│   └─ sync-git.ps1      │        │   └─ sync-git.sh        │
│        ├─ git ⇄ GitHub ┼────────┼── git ⇄ GitHub          │
│        └─ .env ⇄ C:\gymlog-sync ┼── .env ⇄ /mnt/win/gymlog-sync
└────────────────────────┘        └─────────────────────────┘
```

## Instalación — Windows (ya hecha)
1. Los scripts viven en `scripts/sync/` y se actualizan solos con el git.
2. El lanzador `gymlog-sync.vbs` está en la carpeta **Startup**; ejecuta el `.ps1`
   oculto al iniciar sesión.
3. `git push` usa el Git Credential Manager de Windows (ya configurado).

## Instalación — Ubuntu (hazlo tú)
1. **Clona el repo** (si aún no lo tienes):
   ```bash
   mkdir -p ~/proyectos && git clone https://github.com/Haplee/gymlog.git ~/proyectos/gymlog
   cd ~/proyectos/gymlog && npm ci
   ```
2. **Credenciales de GitHub** (obligatorio para el push): genera un PAT en
   `github.com/settings/tokens` (scope `repo`) y
   ```bash
   git config --global credential.helper store
   # el primer `git push` te pedirá el PAT y lo guardará
   ```
   (o SSH: `ssh-keygen` + clave en GitHub y `git remote set-url origin git@github.com:Haplee/gymlog.git`.)
3. **Carpeta compartida**: Ubuntu debe montar la partición de Windows en
   `/mnt/win` (lecto-escritura):
   ```bash
   lsblk -f                          # localiza la partición NTFS de Windows
   sudo mkdir -p /mnt/win
   # Añade a /etc/fstab (ajusta /dev/nvme0n1pX y el uid):
   /dev/nvme0n1pX  /mnt/win  ntfs3  rw,uid=1000,gid=1000,noatime,nodev,nosuid  0  0
   sudo mount /mnt/win
   ```
   ⚠️ En Windows, **desactiva "Inicio rápido"** (Panel de control → Opciones de
   energía → Comportamiento de los botones de inicio/apagado): si no, Windows
   hiberna el NTFS y Ubuntu lo montará en solo lectura.
4. **Registra el sync al iniciar sesión** (recomendado: systemd):
   ```bash
   mkdir -p ~/.config/systemd/user
   cp scripts/sync/ubuntu/gymlog-sync.service ~/.config/systemd/user/
   systemctl --user daemon-reload
   systemctl --user enable --now gymlog-sync.service
   journalctl --user -u gymlog-sync.service -e   # ver el resultado
   ```
   Alternativa GNOME: `cp scripts/sync/ubuntu/gymlog-sync.desktop ~/.config/autostart/`.

## Configuración
- **Carpeta compartida**: `C:\gymlog-sync` (Windows) y `/mnt/win/gymlog-sync`
  (Ubuntu) por defecto. Cambia con `GYMLOG_SHARED` (env) o editando la parte
  superior de cada script. Puede ser cualquier ruta que vean ambos (un exFAT
  externo, otra partición…).
- **Repo en Ubuntu**: `~/proyectos/gymlog` por defecto; cambia con `GYMLOG_REPO`.
- **Ficheros privados**: lista `$PrivateFiles` (ps1) / `PRIVATE_FILES` (sh).
  Nota: `openspec/IAS.md` está excluida a propósito (contiene API keys en claro;
  si la añades, al menos gíralas primero).

## Cómo funciona el commit automático
El script solo hace commit si hay cambios (`git status --porcelain`), con
mensaje `chore: sync (<host>) - <fecha>` y `--no-verify` (el pre-commit
lint-staged bloquearía un commit mecánico). Luego `pull --rebase --autostash` y
`push`. Si el pull topa con un conflicto o el push falla, **no sigue**: escribe
el error en `.git/sync.log` y termina; arréglalo a mano (`git status`, rebase…).

## Solución de problemas
- **"pull --rebase fallo"**: conflicto entre ambos sistemas. Entra al repo y
  resuélvelo (`git status`, edita, `git rebase --continue`, `git push`).
- **"push fallo"**: sin red o sin credenciales en Ubuntu (ver paso 2).
- **Shared en solo lectura**: Fast Startup activo en Windows (ver paso 3).
- **Ver qué hizo cada arranque**: `Get-Content .git\sync.log` en Windows,
  `tail .git/sync.log` en Ubuntu.
