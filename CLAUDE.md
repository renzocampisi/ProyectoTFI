# FieldStock AI — CLAUDE.md

Sistema de gestión de inventario de herramientas para empresas constructoras.
Proyecto académico UAI · Renzo Campisi · Legajo 20534.

## Comandos

```bash
# Desde la raíz del repo — levanta backend (3000) y frontend (5173 con HTTPS) en paralelo
# Por defecto el frontend usa HTTPS para que la cámara funcione desde mobile en LAN
# (getUserMedia requiere contexto seguro, ver issue #12). Cert autofirmado: el browser
# se queja la primera vez, hay que aceptar el warning una sola vez por dispositivo.
npm run dev

# Variante sin HTTPS (si por algún motivo molesta el cert autofirmado)
npm run dev:http

# Por separado
npm run dev       --prefix fieldstock-backend
npm run dev:https --prefix fieldstock-frontend   # con HTTPS (default en `npm run dev`)
npm run dev       --prefix fieldstock-frontend   # sin HTTPS

# Build frontend
npm run build --prefix fieldstock-frontend

# Lint frontend — el proyecto arrastra ~200 warnings preexistentes
# (imports usados solo en JSX que la regla no detecta). Lo que importa
# es que salga con 0 ERRORES.
npm run lint --prefix fieldstock-frontend

# Tests del backend (Jest). No hay tests de frontend.
npm test --prefix fieldstock-backend

# Un archivo solo (ojo: --prefix es de npm, no de npx — hay que cd)
cd fieldstock-backend && npx jest armado.service.test.js
```

**Tests**: solo el backend, y solo a nivel **service** — los controllers son
thin por convención y no se testean. Los tests mockean `config/supabase.js`
con un chain mockeado (ver `compras.service.test.js`), o mockean los services
que compone cuando el módulo solo orquesta (ver `armado.service.test.js`).

## Arquitectura

```
ProyectoFinal_TFI/
├── package.json                  ← raíz: solo concurrently
├── _sql/migrations/              ← SQL aplicado, con fecha en el nombre
├── _plans/                       ← planes de features (liber-plan), HTML autocontenido
├── fieldstock-backend/           ← Node.js + Express + ESM
│   ├── src/
│   │   ├── index.js              ← entry point, cors, rutas, error handler
│   │   ├── config/supabase.js    ← cliente Supabase (service role key)
│   │   ├── routes/index.js       ← todas las rutas bajo /api
│   │   ├── controllers/          ← recibe req/res, delega a services
│   │   ├── services/             ← lógica de negocio, llama a Supabase
│   │   └── middlewares/errorHandler.js
│   └── .env                      ← ver "Variables de entorno" abajo
└── fieldstock-frontend/          ← React 18 + Vite 5 + ESM
    └── src/
        ├── main.jsx
        ├── routes/AppRouter.jsx  ← react-router-dom v6
        ├── layouts/
        │   ├── AppLayout.jsx     ← sidebar + outlet
        │   └── AuthLayout.jsx
        ├── modules/              ← por módulo del sistema
        │   ├── m0-auth/          ← login, registro, recuperar password, perfil
        │   ├── m1-dashboard/     ← home con KPIs
        │   ├── m1-panel/         ← Panel IA (chat con tool use)
        │   ├── m2-inventario/
        │   ├── m3-qr/
        │   ├── m4-obra/
        │   ├── m5-remito/
        │   ├── m6-materiales/
        │   ├── m7-directorio/
        │   ├── m8-estanterias/
        │   ├── m9-usuarios/
        │   ├── m-armado/         ← Kits de Montaje (armado por lenguaje natural)
        │   ├── m-compras/
        │   ├── m-presupuestos/
        │   ├── m-kits/           ← kits estáticos (herramientas + materiales)
        │   ├── m-facturacion/    ← planes y suscripción (Mercado Pago)
        │   ├── m-admin-control/  ← panel multi-cliente, solo rol ADMIN
        │   ├── m-config/
        │   └── m-landing/
        └── shared/
            ├── components/
            ├── hooks/useAuth.jsx ← AuthContext + Supabase Auth
            └── utils/
                ├── api.js        ← fetch wrapper → backend
                └── supabaseClient.js ← anon key, solo para auth
```

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 5 |
| Backend | Node.js + Express 4 (ESM) |
| Base de datos | Supabase / PostgreSQL |
| Autenticación | Supabase Auth (anon key en frontend) |
| DB en backend | Supabase JS SDK (service role key) |
| QR | `qrcode.react` (generar) · `jsqr` (escanear cámara) |
| Routing | react-router-dom v6 |
| Estilos | CSS Modules (sin Tailwind, sin styled-components) |
| IA | Google Gemini (`@google/genai`, modelo `gemini-2.5-flash`) |
| Uploads | `multer` con `memoryStorage` → Supabase Storage (nunca a disco) |
| Emails | Resend (`resend`) |
| Pagos | Mercado Pago (`mercadopago`) |
| Cron | `node-cron` |
| Deploy | Backend en Fly.io (`fieldstock-api`) · Frontend en Vercel |

## Variables de entorno

**Backend** (`fieldstock-backend/.env`):
```
PORT=3000
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
GEMINI_API_KEY=<api-key>          ← Panel IA, Scan & Match, Kits de Montaje
RESEND_API_KEY=<api-key>          ← envío de emails
RESEND_FROM_EMAIL=<from>
MP_ACCESS_TOKEN=<token>           ← Mercado Pago (suscripciones)
MP_WEBHOOK_SECRET=<secret>
CORS_ALLOWED_ORIGINS=<urls>
FRONTEND_URL=<url>
BACKEND_PUBLIC_URL=<url>
CENTRAL_URL=<url>                 ← panel multi-cliente
CENTRAL_PROVISIONING_SECRET=<secret>
```

En producción los secrets viven en Fly.io (`flyctl secrets list -a fieldstock-api`
lista los nombres, nunca los valores).

**Frontend** (`fieldstock-frontend/.env`):
```
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## Convenciones del backend

- **ESM puro**: `import`/`export`, `"type": "module"` en package.json. No usar `require`.
- **Patrón controller → service**: Los controllers solo reciben `req/res` y llaman al service. La lógica va en el service.
- **Errores**: `const err = new Error('msg'); err.status = 400; throw err` — el `errorHandler` lo convierte a JSON `{ ok: false, error }`.
- **Respuestas exitosas**: `res.json({ data: resultado })` — el frontend espera siempre `json.data`.
- **Supabase en backend**: usa `SUPABASE_SERVICE_KEY` (bypassa RLS). Nunca usar anon key en el backend.
- **Sin ORM**: queries directas con el SDK de Supabase JS.

## Convenciones del frontend

- **Path aliases** configurados en Vite: `@layouts`, `@modules`, `@shared`.
- **CSS Modules**: un `.module.css` por componente/página. No estilos inline en JSX para layout.
- **Hooks por módulo**: `useInventario`, `useRemitos`, `useObras`, `useMateriales`, `useCompras`, `useScanMatch`, `useArmado` — encapsulan llamadas a `api.*`. El componente no llama a `api` directo.
- **`api.js`**: único punto de salida HTTP hacia el backend. Lanza `Error` con `.status` si `!res.ok`. Timeout default 15s; las llamadas que pasan por un LLM necesitan `{ timeoutMs: 60_000 }` explícito (Gemini se pasa de 15s con imágenes o tool chaining). `postForm` para multipart.
- **Auth**: `useAuth()` desde `@shared/hooks/useAuth`. Supabase Auth, `signInWithPassword`. El frontend NO llama a Supabase directamente para datos (solo para auth).
- **Rutas públicas**: `/remitos/:id/qr` sin AppLayout (página mobile para escaneo QR de remito).

## Dominio — entidades y estados

**Estados de Herramienta** (validados en backend):
```
DISPONIBLE | EN_OBRA | EN_MANTENIMIENTO | RESERVADA | BAJA
```
- `BAJA` es terminal — se ejecuta via RPC `dar_baja_herramienta(p_id, p_motivo)`.
- Reactivar desde BAJA: RPC `reactivar_herramienta(p_id)`.
- `EN_MANTENIMIENTO` bloquea asignación y transferencia (regla de negocio).

**Formato de código QR**: `FS-{INICIALES_NOMBRE}-{TIMESTAMP_BASE36}` — generado al crear, inmutable.

**Vista Supabase**: `herramientas_completas` — joins de herramienta + categoría + marca. Siempre leer desde esta vista, no de `herramientas` directamente.

**Movimientos**: inmutables — nunca editar ni eliminar. Son el log de trazabilidad.

**Remitos**: máquina de estados de 7 pasos con transiciones (`avanzar`,
`volver-borrador`, `confirmar-escaneo`, `reportar-problema`):
```
BORRADOR → CONFIRMADO → EN_TRÁNSITO → EN_OBRA → EN_RETORNO → VOLVIENDO → CERRADO
```
El stock de materiales se descuenta al **avanzar de estado**, no al agregar el
ítem — un remito en BORRADOR no toca `stock_actual`. Eliminar un remito solo
se permite en BORRADOR (cualquier rol) o CERRADO, y en CERRADO valida que no
queden herramientas en obra.

**Compras**: `BORRADOR → CONFIRMADA → RECIBIDA_PARCIAL → RECIBIDA`, más
`CANCELADA` (terminal, no permitida si ya está RECIBIDA). Los ítems solo se
editan en BORRADOR. `recibir()` recibe el total acumulado, no un delta.
`precio_unitario` y `total` van siempre **en pesos**; la moneda solo aplica a
las líneas de pago (`compra_pagos`), que pueden ser ARS o USD.

**Presupuestos**: `BORRADOR → EN_APROBACION → APROBADO | RECHAZADO`. Aprobar
corre la RPC `aprobar_presupuesto(p_id, p_user_id)`, que en una transacción
crea un **remito en BORRADOR** con los insumos ya copiados y devuelve su id.
El estado de la obra se sincroniza solo según sus presupuestos.

**Ciclo de vida de una Herramienta dada de baja:**
1. `dar_baja_herramienta(id, motivo)` → `estado=BAJA`, `activo=false`, `fecha_eliminacion = HOY + 1 año`
2. Durante ese año la herramienta sigue visible pero filtrada (`activo=false`), permite `reactivar_herramienta(id)` para cancelar la baja
3. Cron `eliminar-herramientas-vencidas` corre todas las noches a las 02:00 y hace HARD DELETE de las que pasaron 1 año. La RPC se llama `eliminar_herramientas_vencidas()` y vive en Postgres, no en el backend Node — no la invoques desde `services/`

## Módulos y rutas

Todos implementados salvo donde se aclara.

| Módulo | Ruta frontend | Notas |
|---|---|---|
| Dashboard | `/` | KPIs + listas de la home |
| M2 Inventario | `/herramientas` | |
| M3 QR Scanner | `/qr` | |
| M4 Obras | `/obras` | |
| M5 Remitos | `/remitos` | |
| M6 Materiales | `/materiales` | |
| M7 Directorio | `/directorio/transportes`, `/directorio/clientes`, `/directorio/proveedores` | |
| M8 Estanterías | `/estanterias` | |
| M9 Usuarios | `/usuarios` | Solo DUEÑO/ADMIN. El DUEÑO ve "Empleados" |
| Compras | `/compras` | Incluye Scan & Match (ver abajo) |
| Presupuestos | `/presupuestos/nuevo`, `/presupuestos/:id` | El listado sigue en Coming soon |
| Kits de Montaje | `/armado` | Armado por lenguaje natural (ver abajo) |
| Facturación | `/facturacion` | Planes y suscripción vía Mercado Pago |
| M1 Panel IA | `/panel` | Chat con tool use sobre los datos del sistema |
| Configuración | `/configuracion` | Solo DUEÑO/ADMIN |
| Panel de control | `/admin/control` | Solo rol ADMIN — vista multi-cliente |
| Landing | `/bienvenida` | Pública |

## Features de IA

Las tres comparten el mismo adapter: `services/panel/provider.js` envuelve el
SDK de Gemini detrás de `chat({ system, contents, tools, responseSchema })`.
Cambiar de proveedor es reescribir ese archivo solo. Requiere `GEMINI_API_KEY`.

| Feature | Dónde | Qué hace |
|---|---|---|
| **Panel IA** | `/panel` | Chat en lenguaje natural sobre los datos. Tools de lectura en `panel/tools.js`; las de escritura (`panel/writeTools.js`) siguen el patrón preview → confirmación explícita del usuario → execute. |
| **Scan & Match** | detalle de una compra | Foto o PDF del remito del proveedor → matchea cada línea contra los ítems de ESA orden → revisás → registra la recepción. |
| **Kits de Montaje** | `/armado` | Describís el tramo en una frase → arma el desglose contra el catálogo → va a presupuesto o a remito. |

**Regla que aplica a las tres**: la IA **propone**, nunca escribe sola. Y en
Kits de Montaje además **nunca estima cantidades** — solo interpreta las que
enunciás. El plan explica por qué (no existe una fórmula de cañería estándar
que se pueda aplicar sin inventar datos): ver `_plans/kits-montaje/`.

En Kits de Montaje, si el destino es remito el sistema reparte cada línea
según el stock: lo disponible sale al remito y lo faltante va a una orden de
compra (con proveedor opcional — "decidir después" no crea la orden).

## Endpoints API

Base URL: `http://localhost:3000/api`

```
GET    /health                                 ← health check (sin /api)

GET    /categorias
POST   /categorias
GET    /marcas
POST   /marcas

GET    /herramientas                           ← query: estado, categoriaId, q, codigoQR
POST   /herramientas
GET    /herramientas/:id
PUT    /herramientas/:id
PATCH  /herramientas/:id/estado
POST   /herramientas/:id/baja
POST   /herramientas/:id/reactivar
GET    /herramientas/:id/movimientos
POST   /herramientas/:id/movimientos

GET    /materiales
POST   /materiales
GET    /materiales/:id
PUT    /materiales/:id

GET    /remitos
POST   /remitos
GET    /remitos/:id
PATCH  /remitos/:id
POST   /remitos/:id/avanzar
POST   /remitos/:id/volver-borrador
POST   /remitos/:id/confirmar-escaneo
POST   /remitos/:id/reportar-problema
DELETE /remitos/:id
POST   /remitos/:id/items
DELETE /remitos/:id/items/:itemId
PATCH  /remitos/:id/items/:itemId/retorno
POST   /remitos/:id/materiales
DELETE /remitos/:id/materiales/:matItemId
PATCH  /remitos/:id/materiales/:matItemId/retorno

GET    /obras
POST   /obras
GET    /obras/:id
PUT    /obras/:id
POST   /obras/:id/finalizar
POST   /obras/:id/reactivar

GET    /transportes
POST   /transportes
PUT    /transportes/:id
DELETE /transportes/:id
GET    /clientes
POST   /clientes
PUT    /clientes/:id
DELETE /clientes/:id
GET    /proveedores
POST   /proveedores
PUT    /proveedores/:id
DELETE /proveedores/:id

GET    /estanterias
POST   /estanterias
GET    /estanterias/qr/:qr
GET    /estanterias/:id
PUT    /estanterias/:id
DELETE /estanterias/:id
POST   /estanterias/:id/items
DELETE /estanterias/:id/items/:itemId
PATCH  /estanterias/:id/items/:itemId/mover

GET    /notificaciones
POST   /notificaciones
PATCH  /notificaciones/:id/leida
PATCH  /notificaciones/todas-leidas

GET    /compras                                ← query: estado, proveedorId, q
POST   /compras
GET    /compras/:id
PATCH  /compras/:id
POST   /compras/:id/avanzar
POST   /compras/:id/cancelar
POST   /compras/:id/recibir
POST   /compras/:id/items
PATCH  /compras/:id/items/:itemId
DELETE /compras/:id/items/:itemId
POST   /compras/:id/pagos                      ← N pagos por compra (medio + moneda + monto)
DELETE /compras/:id/pagos/:pagoId
GET    /compras/:id/comprobante                ← bucket privado, signed URL
POST   /compras/:id/comprobante                ← multipart, field `archivo`
DELETE /compras/:id/comprobante
POST   /compras/:id/scan-match                 ← IA: multipart, foto/PDF del remito
POST   /compras/:id/scan-match/confirmar

POST   /armado/interpretar                     ← IA: Kits de Montaje, { texto, destino }
POST   /armado/confirmar

GET    /presupuestos
POST   /presupuestos
GET    /presupuestos/:id
PATCH  /presupuestos/:id
DELETE /presupuestos/:id
POST   /presupuestos/:id/insumos
PATCH  /presupuestos/:id/insumos/:insumoId
DELETE /presupuestos/:id/insumos/:insumoId
POST   /presupuestos/:id/costos
PATCH  /presupuestos/:id/costos/:costoId
DELETE /presupuestos/:id/costos/:costoId
POST   /presupuestos/:id/enviar-aprobacion
POST   /presupuestos/:id/volver-borrador
POST   /presupuestos/:id/aprobar               ← genera el remito automáticamente
POST   /presupuestos/:id/rechazar
GET    /presupuestos/:id/pdf
POST   /presupuestos/:id/pdf

GET    /kits
POST   /kits
GET    /kits/:id
PUT    /kits/:id
DELETE /kits/:id
POST   /remitos/:remitoId/kits/:kitId          ← vuelca un kit entero al remito
GET    /herramientas/:id/kits

GET    /herramientas/:id/reservas
POST   /herramientas/:id/reservas
DELETE /herramientas/:id/reservas/:reservaId
GET    /obras/:id/reservas

GET    /materiales/marcas
GET    /materiales/check-duplicate             ← query: nombre, marca
DELETE /materiales/:id
POST   /materiales/:id/agregar-stock
GET    /materiales/:id/precio-referencia
GET    /materiales/:id/sugerencia-reposicion

GET    /remitos/numero/:numero
GET    /remitos/:id/sugerencias-presupuesto

GET    /dashboard                              ← KPIs + listas de la home

GET    /usuarios/me                            ← literales ANTES de /:id
PATCH  /usuarios/me
GET    /usuarios/encargados-disponibles
GET    /usuarios                               ← DUEÑO/ADMIN de acá abajo
POST   /usuarios
GET    /usuarios/:id
PATCH  /usuarios/:id
DELETE /usuarios/:id                           ← soft delete (activo=false)
POST   /usuarios/:id/reset-password

GET    /invitaciones                           ← códigos de registro, DUEÑO/ADMIN
POST   /invitaciones

GET    /planes
GET    /suscripcion
POST   /suscripcion/elegir-plan
POST   /suscripcion/cancelar
PATCH  /suscripcion/extras

GET    /dispositivos                           ← rastreo GPS
POST   /dispositivos
POST   /dispositivos/emparejar
POST   /dispositivos/:id/liberar
POST   /dispositivos/:id/dar-de-baja

GET    /config
GET    /config/:key
PUT    /config/:key
GET    /empresa
PUT    /empresa

POST   /panel/chat                             ← IA: Panel IA
POST   /panel/ejecutar-accion                  ← solo tras confirmación del usuario

# ── Públicas (sin requireAuth) ──────────────────────────────
GET    /auth/estado
POST   /auth/registro-dueno                    ← bootstrap: primer usuario del sistema
POST   /auth/registro-invitado                 ← requiere código de invitación
POST   /webhooks/mercadopago                   ← valida firma x-signature

# ── Panel central multi-cliente (instancia a instancia) ─────
POST   /central/reportar
POST   /central/acciones/liberar-dispositivo
GET    /central/clientes                       ← solo rol ADMIN
POST   /central/clientes/:clienteId/liberar-dispositivo
```

**Middlewares globales** (en orden, `routes/index.js`): `requireAuth` corre
para todo `/api` salvo las públicas de arriba; después
`requireSuscripcionActiva` gatea por estado de pago (con excepciones para que
alguien BLOQUEADO pueda ir a pagar). Los guards de rol (`requireRole`) se
aplican por ruta.

**Roles** (`constants/roles.js`): `ADMIN > DUEÑO > ENCARGADO > OPERARIO`.
`ROLES_ADMIN_LEVEL` = ADMIN + DUEÑO (gestión). `ROLES_OPERATIVOS` = todos
menos OPERARIO (que es read-only + escaneo de QR).

## Reglas SQL (antes de cualquier migración)

Antes de generar SQL que modifique schema, verificar:
1. Tablas afectadas por DROP/ALTER
2. Vistas que dependen (`herramientas_completas` depende de `herramientas`)
3. RPCs que cambien de firma (`dar_baja_herramienta`, `reactivar_herramienta`,
   `aprobar_presupuesto`, `eliminar_herramientas_vencidas`)
4. Campos renombrados que use backend o frontend

Reportar el análisis antes de ejecutar. Nunca dropear sin confirmación explícita.

**Guardar siempre el SQL aplicado** como archivo fechado en `_sql/migrations/`
(`AAAA_MM_DD_descripcion.sql`), aunque se haya corrido a mano en el editor de
Supabase. Cuando se le pasa SQL al usuario para pegar ahí, **sugerirle un
nombre para guardar la query** — el editor las llama "Untitled query" por
default y se vuelven imposibles de encontrar.

**Vistas**: crearlas siempre con `security_invoker = on`. Por default Postgres
las hace `SECURITY DEFINER`, lo que bypassea RLS y el Security Advisor de
Supabase lo marca como ERROR (pasó con `herramientas_completas`,
`remito_items_completo` y `usuarios_resumen`, corregido en
`2026_08_19_fix_security_advisor_views.sql`). Ojo también con exponer
`auth.users` a `anon`/`authenticated` al joinear para traer el email.

## Deploy

Automático al pushear a `main`: backend a Fly.io, frontend a Vercel.
`dev` es la rama de trabajo; mergear a `main` **solo con confirmación
explícita del usuario**, porque dispara el deploy real.

```bash
flyctl releases -a fieldstock-api          # ver estado del deploy
flyctl secrets list -a fieldstock-api      # nombres de secrets (nunca valores)
curl https://fieldstock-api.fly.dev/health
```

- Backend: `https://fieldstock-api.fly.dev` · Frontend: `https://fieldstock-ai.vercel.app`
- La máquina de Fly tiene **auto-stop** (`min_machines_running = 0`) para el free
  tier: la primera request después de un rato tarda ~20s en despertarla. Es
  esperado, no es un cuelgue.
- Dev y producción comparten **la misma base de Supabase**: cualquier dato de
  prueba que se cree localmente aparece en producción. Limpiarlo al terminar.
