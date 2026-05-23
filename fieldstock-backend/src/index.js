// src/index.js
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
app.get('/health', (_req, res) => res.json({ ok: true, service: 'FieldStock API' }))
app.use('/api', router)

// ── Error handler ─────────────────────────────────────────────
app.use(errorHandler)

// ── Inicio ────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ FieldStock API corriendo en http://0.0.0.0:${PORT}`)
})
