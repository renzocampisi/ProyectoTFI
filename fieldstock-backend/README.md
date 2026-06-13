# FieldStock AI — Backend

Node.js + Express · Supabase

Deploy automático a Fly.io en cada push a `main` (workflow `.github/workflows/fly-deploy.yml`).

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Completar SUPABASE_URL y SUPABASE_SERVICE_KEY

# 3. Iniciar en desarrollo
npm run dev
```

La API corre en http://localhost:3000

## Endpoints M2

| Método | Ruta                                    | Descripción                        |
|--------|-----------------------------------------|------------------------------------|
| GET    | /health                                 | Health check                       |
| GET    | /api/categorias                         | Listar categorías                  |
| GET    | /api/herramientas                       | Listar herramientas (con filtros)  |
| POST   | /api/herramientas                       | Registrar herramienta              |
| GET    | /api/herramientas/:id                   | Detalle de herramienta             |
| PATCH  | /api/herramientas/:id/estado            | Cambiar estado                     |
| GET    | /api/herramientas/:id/movimientos       | Historial de movimientos           |
| POST   | /api/herramientas/:id/movimientos       | Registrar movimiento               |

## Variables de entorno

```
PORT=3000
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  ← service_role key (NO la anon)
```
