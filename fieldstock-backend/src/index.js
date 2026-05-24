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
app.use(cors({ origin: '*' }))
app.use(express.json())

// ── Rutas ─────────────────────────────────────────────────────
// Health check (sin /api): útil para probes de uptime.
app.get('/health', (_req, res) => res.json({ ok: true, service: 'FieldStock API' }))
// Toda la API REST bajo /api/...
app.use('/api', router)

// Error handler global: captura cualquier error propagado con next(err)
// y lo convierte en JSON consistente. Debe ir AL FINAL (después de rutas).
app.use(errorHandler)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ FieldStock API corriendo en http://0.0.0.0:${PORT}`)
})
