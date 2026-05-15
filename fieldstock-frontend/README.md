# FieldStock AI — Frontend

React + Vite · CSS Modules · React Router v6 · Supabase Auth

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

# 3. Iniciar servidor de desarrollo
npm run dev
```

La app corre en http://localhost:5173  
El proxy `/api` apunta a http://localhost:3000 (backend Node/Express)

## Estructura

```
src/
├── modules/
│   ├── auth/               # Login
│   ├── m2-inventario/      # M2 — activo
│   ├── m5-remito/          # futuro
│   ├── m4-obra/            # futuro
│   └── m3-qr/              # futuro
├── shared/
│   ├── components/         # Componentes reutilizables
│   ├── hooks/              # useAuth, etc.
│   └── utils/              # supabaseClient
├── layouts/                # AppLayout, AuthLayout
├── routes/                 # AppRouter
└── styles/                 # global.css (design tokens)
```

## Orden de módulos

M2 Inventario → M5 Remito → M4 Obra → M3 QR → M6/M7 Proveedores/Compras → M8 Facturación → M1 Panel IA
