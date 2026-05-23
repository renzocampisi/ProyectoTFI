# FieldStock AI — CLAUDE.md

Sistema de gestión de inventario de herramientas para empresas constructoras.
Proyecto académico UAI · Renzo Campisi · Legajo 20534.

## Comandos

```bash
# Desde la raíz del repo — levanta backend (3000) y frontend (5173) en paralelo
npm run dev

# Por separado
npm run dev --prefix fieldstock-backend
npm run dev --prefix fieldstock-frontend

# Build frontend
npm run build --prefix fieldstock-frontend

# Lint frontend
npm run lint --prefix fieldstock-frontend
```

## Arquitectura

```
ProyectoFinal_TFI/
├── package.json                  ← raíz: solo concurrently
├── fieldstock-backend/           ← Node.js + Express + ESM
│   ├── src/
│   │   ├── index.js              ← entry point, cors, rutas, error handler
│   │   ├── config/supabase.js    ← cliente Supabase (service role key)
│   │   ├── routes/index.js       ← todas las rutas bajo /api
│   │   ├── controllers/          ← recibe req/res, delega a services
│   │   ├── services/             ← lógica de negocio, llama a Supabase
│   │   └── middlewares/errorHandler.js
│   └── .env                      ← PORT, SUPABASE_URL, SUPABASE_SERVICE_KEY
└── fieldstock-frontend/          ← React 18 + Vite 5 + ESM
    └── src/
        ├── main.jsx
        ├── routes/AppRouter.jsx  ← react-router-dom v6
        ├── layouts/
        │   ├── AppLayout.jsx     ← sidebar + outlet
        │   └── AuthLayout.jsx
        ├── modules/              ← por módulo del sistema
        │   ├── m2-inventario/
        │   ├── m3-qr/
        │   ├── m4-obra/
        │   ├── m5-remito/
        │   ├── m6-materiales/
        │   ├── m7-directorio/
        │   └── m8-estanterias/
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

## Variables de entorno

**Backend** (`fieldstock-backend/.env`):
```
PORT=3000
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
```

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
- **Hooks por módulo**: `useInventario`, `useRemitos`, `useObras`, `useMateriales` — encapsulan llamadas a `api.*`.
- **`api.js`**: único punto de salida HTTP hacia el backend. Lanza `Error` con `.status` si `!res.ok`.
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

**Remitos**: máquina de estados con transiciones (`avanzar`, `volver-borrador`, `confirmar-escaneo`, `reportar-problema`).

## Módulos y rutas

| Módulo | Ruta frontend | Estado |
|---|---|---|
| M2 Inventario | `/herramientas` | Implementado |
| M3 QR Scanner | `/qr` | Implementado |
| M4 Obras | `/obras` | Implementado |
| M5 Remitos | `/remitos` | Implementado |
| M6 Materiales | `/materiales` | Implementado |
| M7 Directorio | `/directorio/transportes`, `/directorio/clientes` | Implementado |
| M8 Estanterías | `/estanterias` | Implementado |
| M6 Proveedores | `/directorio/proveedores` | Coming soon |
| Compras | `/compras` | Coming soon |
| Facturación | `/facturacion` | Coming soon |
| M1 Panel IA | `/panel` | Coming soon |

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
```

## Reglas SQL (antes de cualquier migración)

Antes de generar SQL que modifique schema, verificar:
1. Tablas afectadas por DROP/ALTER
2. Vistas que dependen (`herramientas_completas` depende de `herramientas`)
3. RPCs que cambien de firma (`dar_baja_herramienta`, `reactivar_herramienta`)
4. Campos renombrados que use backend o frontend

Reportar el análisis antes de ejecutar. Nunca dropear sin confirmación explícita.
