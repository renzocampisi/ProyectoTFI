# Login 2FA — pendientes / hardening

## ✅ VERIFICADO EN PRODUCCIÓN (2026_09_10)

El login 2FA quedó **funcionando end-to-end en producción** (Fly v38 + Vercel
sobre `52b9bac`), probado en el browser contra `https://fieldstock-ai.vercel.app`:

| Paso | Resultado |
|---|---|
| Password server-side + branch por rol | OK — cuenta DUEÑO va a OTP (no entra directo como ADMIN) |
| `signInWithOtp` dispara el mail | OK vía Resend SMTP, llegó rápido |
| Template del mail | OK — estilo consistente con el de reset password |
| `verifyOtp` código → sesión | OK — código de 6 dígitos aceptado |
| Redirect con sesión activa | OK — cae en `/` con el dashboard cargado |

**El rate limit ya no bloquea:** se activó Custom SMTP (Opción B) apuntando a
Resend, reemplazando el SMTP interno de Supabase (~2 mails/hora). Config aplicada
en el dashboard de Supabase:

- Authentication → Emails → SMTP Settings → *Enable Custom SMTP*:
  Host `smtp.resend.com` · Port `465` · Username `resend` · Password = `RESEND_API_KEY`
  · Sender `onboarding@resend.dev` · Sender name `FieldStock AI`
- Authentication → Rate Limits → "Rate limit for sending emails" subido a 30–60/h
- Authentication → Emails → Templates → pestaña "Magic Link": pegado el contenido
  de `magic-link-email-template.html` (usa `{{ .Token }}`, no el link)

**Limitación conocida (no bloquea la defensa):** con el remitente sandbox
`onboarding@resend.dev`, Resend **solo entrega a `campisirenzo0@gmail.com`** (la
casilla dueña de la cuenta Resend). Para usuarios reales con otro mail hay que
verificar un dominio en Resend → **Opción C**, más abajo.

**Merge a `main` hecho (2026_09_10):** `dev → main` en `fc2e8d9` (merge-commit).
El código del 2FA ya estaba en `main` desde `52b9bac`; este merge subió solo
documentación (este archivo, template del mail, planes, CLAUDE.md). No disparó
deploy de backend — `fly-deploy.yml` está filtrado por path a
`fieldstock-backend/**`. Fly sigue en **v38** (`complete`, `/health` 200).

---

## Opción C — dominio verificado en Resend (PENDIENTE — para usuarios reales)

Con la Opción B (SMTP + remitente sandbox) el 2FA ya funciona, pero Resend
**solo entrega a `campisirenzo0@gmail.com`**. Para que cualquier otro usuario
reciba su código hace falta un dominio verificado.

**Fix:** configurar SMTP propio en Supabase con dominio verificado en Resend.

1. **Resend → Domains → Add Domain** (ej. `mail.fieldstock.app` o el dominio
   que se use). Cargar los registros DNS que pide (SPF `TXT`, DKIM `CNAME`x3,
   y `MX` para el subdominio). Esperar a que Resend lo marque "Verified".
   - El `RESEND_FROM_EMAIL` actual es `onboarding@resend.dev` → sandbox, NO
     sirve para SMTP. Cambiarlo a `algo@<dominio-verificado>`.
2. **Resend → API Keys** → crear una key con permiso *Sending* (o reusar la
   que ya está en `RESEND_API_KEY`).
3. **Supabase Dashboard → Authentication → Emails → SMTP Settings →
   Enable Custom SMTP**:
   - Host: `smtp.resend.com`
   - Port: `465`
   - User: `resend`
   - Password: la API key de Resend
   - Sender email: `algo@<dominio-verificado>` · Sender name: `FieldStock AI`
4. **Authentication → Rate Limits**: subir "Emails per hour" (con SMTP propio
   el límite pasa a ser el de Resend, no el de Supabase). Dejar algo sano,
   ej. 30–60/h.
5. Actualizar `.env` local + secret de Fly: `RESEND_FROM_EMAIL` al nuevo from.
6. Probar el flujo completo varias veces seguidas — ya no debería cortar.

Detalle largo en `_plans/login-2fl/implementation.html` pasos 9–11.

## Secret SUPABASE_ANON_KEY en Fly (resuelto — 2026_09_10)

Al mergear el 2FA a `main`, el deploy **v37 quedó en crash-loop**:
`config/supabaseAuth.js` hace `throw` en el import si falta `SUPABASE_ANON_KEY`,
e `index.js` lo importa al arrancar → el contenedor entero no levanta.
La variable estaba en el `.env` local pero nunca se había cargado como secret
en Fly.

Se resolvió con `flyctl secrets set SUPABASE_ANON_KEY=... -a fieldstock-api`
(redeploy automático → v38 OK). **Regla para la próxima:** toda variable nueva
del backend va con `flyctl secrets set` ANTES de mergear a `main`. Anotado
también en `CLAUDE.md` → "Variables de entorno".

## Longitud del código OTP (resuelto — dejar en 6)

**Contexto:** al probar el flujo (2026-09-09) el mail llegó con un código de **8 dígitos**
y `LoginPage.jsx` está cableado a 6 (`slice(0, 6)`, `maxLength={6}`, valida `length !== 6`),
así que el código no se podía tipear. Se bajó **Email OTP Length a 6** en el dashboard de
Supabase (Authentication → Sign In / Providers → Email) y el front funciona tal cual.

**Decisión:** dejar en **6**. Es el estándar de facto:
- RFC 4226 (HOTP) / RFC 6238 (TOTP): las apps de autenticación (Google Authenticator,
  Microsoft Authenticator, Authy, 1Password) usan 6. RFC 4226 exige soportar 6, opcional 7–8.
- NIST SP 800-63B: mínimo 6 dígitos para OTP.
- Default de Supabase: 6. Mail/SMS OTP en general: 6 (algunos 4, banca a veces 7–8).
- 10^6 combinaciones + rate limit del `verify` de Supabase + expiración de 10 min
  (Email OTP Expiration = 600) → fuerza bruta impracticable. 8 dígitos no aporta
  seguridad real y rompe la expectativa del usuario.

## Hardening opcional (no urgente)

- **`LoginPage.jsx`: aceptar rango 6–10 dígitos** en vez de fijar 6.
  Supabase permite configurar el OTP length entre 6 y 10; hoy el front rompe en
  silencio si alguien cambia ese valor en el dashboard. Cambiar `slice(0, 6)` →
  `slice(0, 10)`, `maxLength={6}` → `maxLength={10}`, y la validación
  `length !== 6` → `length < 6 || length > 10` (o leer el largo esperado de una
  constante compartida). Con eso el login tolera cualquier config válida de Supabase.
  Sólo hace falta si en algún momento se decide volver a subir el OTP length.

## Verificado en la prueba del 2026-09-09

- Paso 1 (password server-side + branch por rol): OK. ADMIN entra directo.
- Paso 2 (`signInWithOtp` dispara el mail): OK cuando no hay rate limit.
- Template del mail: OK (asunto "Tu código de acceso a FieldStock AI", branding, código visible).
- `verifyOtp` código → sesión: OK (probado contra `/auth/v1/verify` de Supabase, devolvió
  `access_token` para el user correcto).
- Rate limit del mail: el SMTP interno de Supabase topea en ~2/hora. Para producción
  hace falta custom SMTP con **dominio verificado en Resend** (el `.env` tiene
  `onboarding@resend.dev`, que es sandbox y no sirve para SMTP). Ver
  `_plans/login-2fl/implementation.html` pasos 9–11.
- Log agregado en `auth-login.service.js`: `console.error` con status + mensaje reales
  de Supabase antes del 502 genérico (antes el 502 no dejaba rastro).
