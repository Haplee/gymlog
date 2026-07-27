# Firma ad-hoc del IPA (instalar en tu iPhone) — desde Windows

Este documento cubre el workflow `.github/workflows/ios-signed.yml`, que compila y
**firma** un IPA ad-hoc en el runner macOS de GitHub. Tú no necesitas un Mac: la
compilación la hace CI y el certificado se crea con `openssl` en Windows.

> Ad-hoc = instalable solo en iPhones cuyo **UDID** esté en el perfil. Hasta 100
> dispositivos por año y tipo. El IPA caduca cuando caduca el certificado (~1 año).

---

## Resumen de lo que hay que aportar (5 secretos de repositorio)

| Secreto                                  | Qué es                                                            |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `IOS_TEAM_ID`                            | Tu Team ID (10 caracteres). developer.apple.com → **Membership**. |
| `IOS_DIST_CERT_P12_BASE64`               | Certificado _Apple Distribution_ (`.p12`) en base64.              |
| `IOS_DIST_CERT_PASSWORD`                 | Contraseña que le pusiste al `.p12`.                              |
| `IOS_ADHOC_PROFILE_BASE64`               | Perfil ad-hoc (`.mobileprovision`) en base64.                     |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` | Ya deberían existir (los usa el resto de builds).                 |

Añádelos en **Settings → Secrets and variables → Actions → New repository secret**.

---

## Paso 1 — UDID de tu iPhone

Con el iPhone conectado por USB:

- **Apple Devices** (o iTunes) en Windows → pulsa en el número de serie hasta que
  muestre el **UDID** → clic derecho → Copiar. **O**
- **iMazing** (app de Windows) → selecciona el dispositivo → el UDID aparece en la
  ficha del dispositivo.

## Paso 2 — Registrar el dispositivo

developer.apple.com → **Certificates, Identifiers & Profiles → Devices → +** →
pega el UDID, ponle un nombre.

## Paso 3 — App ID con HealthKit

**Identifiers → +** → _App IDs_ → _App_ → Bundle ID **explícito**
`com.franvi.gymlog` → en _Capabilities_ marca **HealthKit** (la app lo requiere en
`App.entitlements`). Si el App ID ya existe, edítalo y activa HealthKit.

## Paso 4 — Certificado Apple Distribution (openssl, en Windows)

```bash
# 1) Clave privada + CSR (rellena email/CN/país a tu gusto)
openssl genrsa -out ios_dist.key 2048
openssl req -new -key ios_dist.key -out ios_dist.csr \
  -subj "/emailAddress=fvidalmateo@gmail.com/CN=GymLog Distribution/C=ES"
```

developer.apple.com → **Certificates → +** → **Apple Distribution** → sube
`ios_dist.csr` → descarga `distribution.cer`. Luego:

```bash
# 2) .cer (DER) -> PEM y combina con la clave en un .p12 con contraseña
openssl x509 -inform DER -in distribution.cer -out distribution.pem
openssl pkcs12 -export \
  -inkey ios_dist.key -in distribution.pem \
  -out ios_dist.p12 -name "GymLog Distribution"
#   -> te pide la contraseña: esa va en IOS_DIST_CERT_PASSWORD
```

## Paso 5 — Perfil de aprovisionamiento ad-hoc

developer.apple.com → **Profiles → +** → **Ad Hoc** (bajo _Distribution_) →
App ID `com.franvi.gymlog` → el certificado Distribution del paso 4 →
**selecciona tu dispositivo** (paso 2) → nómbralo (p. ej. `GymLog AdHoc`) →
descarga `GymLog_AdHoc.mobileprovision`.

## Paso 6 — Codificar a base64 y crear los secretos

En **PowerShell**:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("ios_dist.p12"))          | Set-Clipboard  # -> IOS_DIST_CERT_P12_BASE64
[Convert]::ToBase64String([IO.File]::ReadAllBytes("GymLog_AdHoc.mobileprovision")) | Set-Clipboard  # -> IOS_ADHOC_PROFILE_BASE64
```

Pega cada uno en su secreto. Añade también `IOS_TEAM_ID` y
`IOS_DIST_CERT_PASSWORD`.

---

## Paso 7 — Ejecutar y firmar

GitHub → **Actions → iOS Signed (ad-hoc) → Run workflow**. Al terminar, descarga
el artefacto **`GymLog-ipa-adhoc`** (`GymLog-adhoc-vX.Y.Z.ipa`).

## Paso 8 — Instalar en el iPhone (desde Windows)

- **iMazing** (Windows): _Apps → Instalar app desde archivo_ → elige el IPA. **O**
- **Diawi**: sube el IPA a diawi.com, abre el enlace en **Safari del iPhone** →
  Instalar. (Solo funciona porque el IPA está firmado ad-hoc con tu UDID.)

---

## Notas

- El certificado y el perfil **caducan** (~1 año / cuando revoques el cert). Al
  caducar, repite pasos 4-6 y actualiza los secretos.
- Para añadir otro iPhone: regístralo (paso 2), **edita el perfil** para incluirlo,
  vuelve a descargarlo y actualiza `IOS_ADHOC_PROFILE_BASE64`.
- Si Xcode retira `method: ad-hoc`, cambia ese valor por `release-testing` en
  `ios-custom/ExportOptions-adhoc.plist`.
- El workflow **no toca** `ios-build.yml` (el IPA sin firmar para sideload sigue
  disponible).
