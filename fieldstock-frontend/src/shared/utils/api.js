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
import { supabase, clearSupabaseStorage } from './supabaseClient.js'

const API_BASE = import.meta.env.VITE_API_URL || ''
const BASE_URL = `${API_BASE}/api`

// Timeouts defensivos: previenen que la UI quede "esperando" para siempre
// cuando el browser estuvo inactivo y la sesión Supabase quedó en estado
// raro (refresh hangueado, network cortado, etc.). Si después de N segundos
// no hay respuesta, abortamos y dejamos que el caller decida qué hacer.
const SESSION_TIMEOUT_MS = 5_000   // getSession debería ser instantáneo (localStorage)
const FETCH_TIMEOUT_MS   = 15_000  // backend tiene que responder en este tiempo

// Promesa que rechaza después de N ms — para race contra operaciones que
// pueden colgar (típicamente getSession cuando intenta refrescar un token).
function timeout(ms, label) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout (${label}) tras ${ms}ms`)), ms)
  )
}

// Cuando el backend responde 401 (sesión inválida o expirada), limpiamos
// la sesión local y redirigimos a /login. Fire-and-forget el signOut
// para no quedar esperando si Supabase está lento — el redirect es lo
// importante. Hard reload con window.location.href para resetear todo
// el state in-memory.
let yaRedirigiendo = false
function on401() {
  if (yaRedirigiendo) return
  yaRedirigiendo = true
  // Limpiar localStorage ANTES del signOut/redirect. signOut() también
  // limpia internamente pero puede colgarse si el cliente está en estado
  // raro — el clearSupabaseStorage es sincrónico y garantiza que el
  // próximo login arranque limpio. Bug del 29/05.
  clearSupabaseStorage()
  supabase.auth.signOut().catch(() => {})
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

// Lee el access_token directamente del localStorage cuando getSession() se
// cuelga (SDK Supabase en lock interno tras un reload). Usa el mismo formato
// estable del SDK v2: la key empieza con `sb-` y termina con `-auth-token`,
// el valor es JSON con { access_token, refresh_token, user, expires_at, ... }.
// Mismo patrón que el fallback del boot del AuthProvider — el storage es
// la fuente de verdad cuando el SDK no responde.
function leerTokenDeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const key = Object.keys(localStorage).find(k =>
      k.startsWith('sb-') && k.endsWith('-auth-token')
    )
    if (!key) return null
    const stored = JSON.parse(localStorage.getItem(key))
    return stored?.access_token || stored?.currentSession?.access_token || null
  } catch {
    return null
  }
}

async function request(path, options = {}) {
  // Inyectar el JWT actual de Supabase Auth en cada request. Hacemos un
  // getSession() por request porque Supabase maneja el refresh automático
  // internamente y devuelve el token vigente. Si la llamada se cuelga
  // (caso edge: tab estuvo idle y el refresh quedó pendiente), abortamos
  // y caemos al fallback de leer storage directo.
  let token = null
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      timeout(SESSION_TIMEOUT_MS, 'getSession'),
    ])
    token = result?.data?.session?.access_token ?? null
  } catch {
    // getSession timeout: el SDK Supabase está colgado en su lock interno.
    // Antes mandábamos la request sin Authorization → backend 401 → on401()
    // limpiaba storage y echaba al user al login (bug del 03/06 con CRUD
    // de Proveedores). Ahora intentamos leer el token directo del storage,
    // que es donde el SDK lo persiste de forma estable.
    token = leerTokenDeStorage()
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  // Fetch con AbortController + timeout. Si el backend nunca responde
  // (caso edge: proxy de Vite roto, backend hangueado), evitamos que el
  // hook que llamó nunca termine y deje la UI "cargando" para siempre.
  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers, signal: controller.signal })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      const e = new Error('El servidor tardó demasiado en responder. Reintentá en un momento.')
      e.status = 0
      throw e
    }
    throw err
  }
  clearTimeout(timeoutId)

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
