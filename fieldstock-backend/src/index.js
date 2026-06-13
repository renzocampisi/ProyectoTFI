// src/index.js
/**
 * Entry point del backend FieldStock AI.
 *
 * Express server con la mínima ceremonia posible:
 *   - CORS abierto (origin: '*') porque el frontend corre en otro puerto.
 *   - Body parser JSON (no urlencoded — toda la API es JSON).
 *   - Health check en /health (fuera del prefijo /api).
 *   - Todas las rutas de negocio bajo /api (ver routes/index.js).
 *   - Error handler de último recurso al final del stack (orden crítico:
 *     debe ir DESPUÉS de las rutas para capturar errores propagados con next()).
 *
 * Bindea a 0.0.0.0 para que sea accesible desde otros dispositivos en LAN
 * (escaneo de QR desde celular en obra).
 */
import 'dotenv/config'
import express from 'express'
import cors    from 'cors'

import router       from './routes/index.js'
import { errorHandler } from './middlewares/errorHandler.js'

const app  = express()
const PORT = process.env.PORT || 3000

// ── Middlewares globales ──────────────────────────────────────
// CORS: en dev local seguimos abiertos para no romper LAN testing
// (scaneo QR desde celular en obra). En prod (NODE_ENV=production) usamos
// allowlist explicito controlado por env var CORS_ALLOWED_ORIGINS
// (CSV de dominios). Si la env no esta seteada, fallback a "*" — peor
// que nada pero no rompe.
//
// En Fly.io configuramos:
//   fly secrets set CORS_ALLOWED_ORIGINS="https://fieldstock-ai.vercel.app"
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '*')
  .split(',').map(s => s.trim()).filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // requests sin origin (ej. curl, server-to-server, health checks) → permitir
    if (!origin) return cb(null, true)
    // allowlist "*" → cualquier origin (modo dev / fallback)
    if (allowedOrigins.includes('*')) return cb(null, true)
    // origin en la lista → permitido
    if (allowedOrigins.includes(origin)) return cb(null, true)
    // resto → rechazar
    cb(new Error(`Origin ${origin} no autorizado por CORS`))
  },
  credentials: true,
}))
app.use(express.json())

// ── Rutas ─────────────────────────────────────────────────────
// Health check (sin /api): útil para probes de uptime.
app.get('/health', (_req, res) => res.json({ ok: true, service: 'FieldStock API' }))
// Toda la API REST bajo /api/...
app.use('/api', router)

// 404 explícito JSON: una ruta inexistente bajo /api devuelve 404 en lugar
// de pasar por requireAuth (que tira 401 confuso) o caer en el errorHandler
// como excepción. Facilita debugging desde el frontend.
app.use((req, res) => res.status(404).json({
  ok: false,
  error: `Ruta no encontrada: ${req.method} ${req.path}`,
}))

// Error handler global: captura cualquier error propagado con next(err)
// y lo convierte en JSON consistente. Debe ir AL FINAL (después de rutas).
app.use(errorHandler)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ FieldStock API corriendo en http://0.0.0.0:${PORT}`)
})
