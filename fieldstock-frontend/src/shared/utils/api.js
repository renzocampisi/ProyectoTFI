// src/shared/utils/api.js
/**
 * Único punto de salida HTTP del frontend hacia el backend FieldStock.
 *
 * Convenciones:
 * - Todas las llamadas pasan por acá (NO usar fetch directo desde componentes/hooks).
 * - Se asume Content-Type JSON tanto en request como en response.
 * - Si el backend responde !res.ok, se lanza un Error con `.status` igual al
 *   HTTP status — el caller puede hacer `catch (err) { if (err.status === 404) ... }`.
 * - El backend siempre responde { ok, data, error? } pero acá devolvemos
 *   solo `json.data` para ergonomía — el `ok` y `error` se manejan internamente.
 *
 * Variable de entorno: VITE_API_URL (fallback: localhost:3000).
 *
 * El prefijo `/api` se aplica acá una sola vez (todas las rutas REST del
 * backend viven bajo /api). Los services llaman con rutas relativas:
 *   api.get('/herramientas')  →  http://localhost:3000/api/herramientas
 */
// BASE_URL: si VITE_API_URL viene seteada se respeta (útil para apuntar a
// un backend remoto desde un build de producción). Si no, usamos rutas
// RELATIVAS (`/api/...`) y dejamos que el dev server de Vite proxee al
// backend. Esto evita el bloqueo de mixed content en mobile cuando el
// frontend se sirve sobre HTTPS (issue #12) — todas las requests son
// same-origin desde el browser y el proxy hace el hop a HTTP plano
// server-to-server, donde la regla no aplica.
import { supabase } from './supabaseClient.js'

const API_BASE = import.meta.env.VITE_API_URL || ''
const BASE_URL = `${API_BASE}/api`

// Cuando una request del backend vuelve 401 (sesión inválida o expirada),
// limpiamos la sesión local y disparamos una redirección dura a /login.
// Hard reload para asegurarnos de que cualquier state in-memory se resetea.
async function on401() {
  try { await supabase.auth.signOut() } catch { /* ignore */ }
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

async function request(path, options = {}) {
  // Inyectar el JWT actual de Supabase Auth en cada request. Hacemos un
  // getSession() por request porque Supabase ya maneja el refresh automático
  // y devuelve el token vigente. No cacheamos para no servir uno expirado.
  const { data: { session } } = await supabase.auth.getSession()
  const headers = {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    on401()
    const err = new Error('Sesión inválida o expirada')
    err.status = 401; throw err
  }

  const json = await res.json()
  if (!res.ok) {
    const err = new Error(json.error || 'Error de red')
    err.status = res.status
    throw err
  }
  return json.data
}

export const api = {
  get:    (path)       => request(path),
  post:   (path, body) => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body) => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (path, body) => request(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path)       => request(path, { method: 'DELETE' }),
}
