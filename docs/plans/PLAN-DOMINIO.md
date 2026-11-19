# Plan: dominio gratuito para GymLog (landing + app)

> Creado el 2026-07-12. Ejecutable a partir del **2026-07-19** (hay que esperar 7 días
> tras eliminar `gymlog.qd.je` en DigitalPlat para registrar el dominio nuevo).
>
> Objetivo: un dominio gratuito de DigitalPlat con dos usos:
>
> - **`gymlog.dpdns.org`** → landing estática (GitHub Pages, carpeta `docs/`)
> - **`app.gymlog.dpdns.org`** → app React (Vercel)
>
> Si `gymlog.dpdns.org` está cogido, alternativas válidas: `gymlog.qzz.io`,
> `gymlog.us.kg`, `gymlog.xx.kg` (todas están en la Public Suffix List).
> En ese caso, sustituir el dominio en TODO el documento.

---

## Decisiones ya tomadas (no repetir errores)

- ❌ **`gymlog.qd.je` descartado**: `qd.je` NO está en la Public Suffix List, lo que provoca:
  1. Google Cloud no acepta `gymlog.qd.je` como dominio autorizado ("Debe ser un
     dominio privado de nivel superior") — solo aceptaría `qd.je`, que es de DigitalPlat.
  2. Cloudflare rechaza crear la zona ("provide the root domain, not subdomain").
  3. Los certificados Let's Encrypt compartirían cuota (50/semana) con todos los
     usuarios de `qd.je`.
- ✅ `dpdns.org`, `qzz.io`, `us.kg`, `xx.kg` SÍ están en la PSL (verificado 2026-07-12).
- DigitalPlat limita a **1 dominio por cuenta** → un dominio raíz para la landing
  y el subdominio `app.` para Vercel.
- El código de la app NO hardcodea el dominio para OAuth (usa `window.location.origin`
  en `src/features/auth/stores/authStore.ts`) → solo hay que tocar allowlists de
  Supabase, no código.

---

## Paso 1 — Registrar el dominio en DigitalPlat (a partir del 2026-07-19)

- [ ] Entrar en https://dash.domain.digitalplat.org/ (cuenta ya creada y con KYC hecho).
- [ ] Comprobar que `gymlog.qd.je` ya no aparece (eliminado el 2026-07-12).
- [ ] Buscar `gymlog.dpdns.org` y registrarlo.
- [ ] Cuando pida **nameservers**, poner los 2 de Cloudflare del Paso 2.
      (Hacer el Paso 2 ANTES de completar el registro si el formulario los exige.)

## Paso 2 — Crear la zona en Cloudflare

- [ ] https://dash.cloudflare.com → **+ Add → Connect a domain** → `gymlog.dpdns.org`.
      (Esta vez lo aceptará: `dpdns.org` está en la PSL.)
- [ ] Pantalla de bots de IA: **Búsqueda = permitir** (SEO), Agente = permitir,
      Entrenamiento = indiferente. Importar DNS = Automático.
- [ ] Elegir plan **Free** (abajo del todo).
- [ ] Copiar los **2 nameservers** asignados (`*.ns.cloudflare.com`) → ponerlos en
      DigitalPlat (Paso 1).
- [ ] Esperar estado **Active** (email de Cloudflare; acelerar con
      "Check nameservers now" en Overview).
- [ ] SSL/TLS → Overview → comprobar modo **Full** (no "Flexible").

## Paso 3 — Registros DNS en Cloudflare

Ambos con el proxy **desactivado** (nube gris, "DNS only") — obligatorio para que
GitHub y Vercel verifiquen el dominio y emitan HTTPS:

| Tipo  | Nombre | Contenido              |
| ----- | ------ | ---------------------- |
| CNAME | `@`    | `haplee.github.io`     |
| CNAME | `app`  | `cname.vercel-dns.com` |

- [ ] CNAME raíz creado
- [ ] CNAME `app` creado

## Paso 4 — GitHub Pages (landing)

- [ ] Repo `Haplee/gymlog` → **Settings → Pages** → Custom domain: `gymlog.dpdns.org` → Save.
- [ ] Esperar a que pase la comprobación DNS (reintentar si acaba de crearse el CNAME).
- [ ] GitHub commitea automáticamente `docs/CNAME` → hacer **`git pull`** en local.
      (El workflow `sync-landing.yml` no pisa ese archivo: solo copia index/tutorial/screens.)
- [ ] Marcar **Enforce HTTPS** (el certificado tarda ~15 min).
- [ ] Opcional: GitHub → Settings personales → Pages → **Verified domains** →
      verificar `gymlog.dpdns.org` (anti-secuestro).

## Paso 5 — Vercel (app)

- [ ] Proyecto gymlog → **Settings → Domains** → Add → `app.gymlog.dpdns.org`.
- [ ] Verificación y certificado automáticos (el CNAME ya existe del Paso 3).
- [ ] Opcional: configurar `gymlog-haplees-projects.vercel.app` como **Redirect 308**
      al dominio nuevo.

## Paso 6 — Supabase (crítico: si no, el login de Google falla)

Dashboard Supabase → Authentication → **URL Configuration**:

- [ ] Añadir `https://app.gymlog.dpdns.org/auth/callback` a **Redirect URLs**
      (sin borrar las existentes).
- [ ] Cambiar **Site URL** a `https://app.gymlog.dpdns.org`.

## Paso 7 — Google Cloud Console (pantalla de consentimiento OAuth)

Branding / pantalla de consentimiento:

- [ ] **Dominios autorizados** (lista final de 3):
  1. `eoltmipoklizewxdpzfa.supabase.co` ← NUNCA quitarlo (redirect OAuth)
  2. `gymlog.dpdns.org`
  3. `gymlog-haplees-projects.vercel.app`
- [ ] **Eliminar** `pesos-wine.vercel.app` y `gymlog-rust.vercel.app` (despliegues viejos).
- [ ] Página principal: `https://gymlog.dpdns.org`
- [ ] Política de Privacidad: `https://app.gymlog.dpdns.org/privacy-policy.html`
- [ ] Condiciones del Servicio: `https://app.gymlog.dpdns.org/terms.html`
      (dejar vacío hasta mergear el Paso 8).
- [ ] Si Google pide verificar el dominio: https://search.google.com/search-console →
      propiedad tipo "Dominio" → `gymlog.dpdns.org` → pegar el registro TXT en
      Cloudflare (DNS → Add record → TXT).
- [ ] **Logo**: no tocarlo hasta que todo lo demás esté hecho — subirlo dispara el
      proceso de verificación de marca de Google (ahora sí es completable, pero
      mejor hacerlo una sola vez al final).

## Paso 8 — Cambios en el repo ✅ HECHO por Claude el 2026-07-12

Los cambios están **en el working tree, sin commitear** (los commits los hace el usuario):

- [x] `public/landing.html` — canonical → `gymlog.dpdns.org`; `og:image` y
      `twitter:image` → `app.gymlog.dpdns.org/pwa-512x512.png` (el PNG solo existe
      en Vercel; `docs/` solo tiene el .webp); 3 enlaces a la app → `app.gymlog.dpdns.org/app`.
- [x] `public/tutorial.html` — canonical, `og:image` y enlace a la app.
- [x] `public/privacy-policy.html` — footer con dominio nuevo + enlace a terms.html;
      colores actualizados del lima antiguo al menta actual (#60eca8).
- [x] `README.md` — badges de demo y landing + enlace de descarga.
- [x] `docs/play-store-listing.md` — URL de política de privacidad.
- [x] **Nuevo** `public/terms.html` — Condiciones del Servicio (estilo de
      privacy-policy, colores menta). Incluye aviso de salud y limitación de
      responsabilidad.

**Lo que queda para el usuario:**

- [ ] Revisar los cambios (`git diff`) y el contenido de `public/terms.html`.
- [ ] ⚠️ **NO mergear a `main` hasta que el dominio esté activo** (pasos 1–5):
      si se mergea antes, la landing y las metas OG apuntarán a un dominio muerto.
- [ ] Crear rama `fix/dominio-dpdns`, commit, PR y merge cuando el dominio funcione.
- [ ] ⚠️ Si el dominio final NO es `gymlog.dpdns.org` (p. ej. está cogido y usas
      `gymlog.qzz.io`): pedir a Claude "reemplaza el dominio del plan por X" y
      rehará el buscar-y-reemplazar en todos los archivos.
- [ ] Si la app está publicada en Play Console: actualizar allí la URL de la
      política de privacidad.
- [ ] NO editar `docs/` a mano: `sync-landing.yml` lo regenera al mergear a `main`.

## Paso 9 — Verificación final

- [ ] `https://gymlog.dpdns.org` → landing con candado HTTPS, botón de descarga OK.
- [ ] `https://gymlog.dpdns.org/tutorial.html` → tutorial OK.
- [ ] `https://app.gymlog.dpdns.org` → la app carga.
- [ ] **Login con Google funciona en el dominio nuevo** (la prueba crítica; si falla → Paso 6).
- [ ] Instalar la PWA desde el dominio nuevo en el móvil y comprobar que abre.
- [ ] Compartir la URL de la landing en WhatsApp/Telegram y ver que la preview
      (og:image) sale bien.

---

## Notas

- Renovación DigitalPlat: gratuita, pero revisar el dashboard periódicamente por si
  piden confirmar renovación anual.
- Si GymLog crece: migrar a un dominio de pago (`.app`, `.fit`, ~10 €/año en
  Cloudflare Registrar o Porkbun). Toda esta configuración (DNS, Pages, Vercel,
  Supabase, Google) se traslada igual, solo cambiando el nombre.
