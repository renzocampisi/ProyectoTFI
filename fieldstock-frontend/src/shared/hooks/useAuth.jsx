// src/shared/hooks/useAuth.jsx
/**
 * Context global de autenticación basado en Supabase Auth.
 *
 * Provee { user, profile, role, loading, signIn, signOut, refrescarPerfil }
 * a toda la app vía <AuthProvider>.
 *
 * - `user`     : objeto de Supabase Auth (id, email, ...). Lo que vive en auth.users.
 * - `profile`  : perfil del backend (id, nombre, telefono, role, activo, email).
 *                Cargado de GET /api/usuarios/me después del login.
 * - `role`     : shortcut de profile.role para checks ergonómicos en la UI.
 * - `loading`  : true SOLO durante la primera carga (incluye fetch del perfil).
 *
 * Flujo:
 * 1. Al montar, lee la sesión con getSession() + carga el perfil del backend.
 * 2. Se suscribe a onAuthStateChange — si llega un SIGNED_IN/SIGNED_OUT,
 *    recarga (o limpia) el perfil acordemente.
 * 3. Desuscribe en el cleanup.
 *
 * Errores al cargar el perfil: limpian la sesión y dejan al user en estado
 * deslogueado. Esto cubre el edge case de que el user exista en auth.users
 * pero no tenga fila en usuarios (típico: olvidaste el INSERT del seed).
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, clearSupabaseStorage } from '@shared/utils/supabaseClient'

const AuthContext = createContext(null)

// Timeouts defensivos para evitar que la UI quede en pantalla negra cuando
// Supabase tarda en responder o la red se cae a mitad de un refresh de
// token. Ver issue del 28/05 ("pantalla en negro tras inactividad").
//
// SESSION_TIMEOUT_MS subido de 5s → 10s (02/06): el SDK puede tardar más
// que 5s en boot tras un reload (lock interno + refresh automático del
// token). El timeout corto disparaba el catch del boot que limpiaba
// storage y echaba al user al login en navegaciones cotidianas. Ahora
// el catch es no-destructivo en caso de timeout (ver más abajo).
const SESSION_TIMEOUT_MS = 10_000
const FETCH_TIMEOUT_MS   = 10_000

// Race contra una promesa que rechaza tras N ms. Útil para envolver llamadas
// que potencialmente se cuelgan sin tirar error (Supabase getSession en estado
// raro, fetch hangueado por proxy, etc.).
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout (${label}) tras ${ms}ms`)), ms)
    ),
  ])
}

// Helper interno: GET /api/usuarios/me usando el JWT actual. No usamos `api`
// de utils/api.js para no crear dependencia circular (api importa supabase
// para el JWT, y este hook también lo usaría).
//
// CRÍTICO: esta función NUNCA debe lanzar. Si lo hace, el await en el boot
// del AuthProvider rompe el flujo y `loading` se queda en true → pantalla
// en negro. Atrapamos todo error de red/CORS internamente y devolvemos null.
async function fetchPerfil() {
  try {
    // getSession con timeout — si Supabase queda colgada refrescando el token
    // tras inactividad larga, no esperamos para siempre.
    const sessionResult = await withTimeout(
      supabase.auth.getSession(),
      SESSION_TIMEOUT_MS,
      'getSession'
    )
    const session = sessionResult?.data?.session
    if (!session?.access_token) return null

    // fetch con AbortController + timeout — si el backend no responde
    // (proxy roto, backend caído, red intermitente), abortamos.
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const apiBase = import.meta.env.VITE_API_URL || ''
    const res = await fetch(`${apiBase}/api/usuarios/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal: controller.signal,
    }).finally(() => clearTimeout(tid))

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[useAuth] fetchPerfil falló con HTTP ${res.status}`)
      // NOTA: NO limpiamos storage acá. Un 401 puede ser "perfil
      // faltante / cuenta desactivada" — el token de Auth es válido,
      // el problema es de datos. Si limpiamos, borramos tokens
      // recién emitidos por un signIn exitoso (bug del 30/05).
      return null
    }
    const json = await res.json()
    return json.data
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[useAuth] fetchPerfil exception:', err)
    // Timeout/crash de red al cargar el perfil. Acá tampoco limpiamos
    // storage para no romper sesiones recién creadas si el backend
    // tardó por una razón pasajera. El boot timeout sí limpia (es la
    // señal clara de storage corrupto) y el botón "Limpiar sesión"
    // queda como escape hatch.
    return null
  }
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Carga del perfil — se llama desde varios lados (mount, signIn, refresh).
  const cargarPerfil = useCallback(async () => {
    const p = await fetchPerfil()
    setProfile(p)
    // Si tenemos sesión pero no perfil, deslogueamos para evitar estado
    // inconsistente. El user va a tener que pedirle al dueño que le cree
    // el perfil correctamente.
    if (!p) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.auth.signOut()
        // signOut() debería limpiar storage pero a veces falla en silencio.
        // clearSupabaseStorage como red de seguridad para no dejar sb-*
        // roto que confunda al próximo signIn (bug del 01/06).
        clearSupabaseStorage()
      }
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    // Boot: sesión + perfil. CRÍTICO: setLoading(false) DEBE ejecutarse
    // siempre, pase lo que pase, sino la app queda en pantalla negra
    // (RequireAuth devuelve null mientras loading=true).
    //
    // Doble protección:
    //   1. try/finally garantiza que setLoading(false) corre incluso ante throws.
    //   2. withTimeout en getSession() para que un Supabase colgado no
    //      bloquee el await indefinidamente (el caso del 28/05).
    ;(async () => {
      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS,
          'boot:getSession'
        )
        if (!mounted) return
        const session = sessionResult?.data?.session ?? null
        setUser(session?.user ?? null)
        if (session) await cargarPerfil()
      } catch (err) {
        console.error('[AuthProvider] error en boot:', err)
        if (/Timeout/i.test(err?.message || '')) {
          // FALLBACK: el SDK de Supabase se colgó (lock interno tras un
          // full reload). En lugar de echar al user al login, leemos el
          // token directo del localStorage — el formato del SDK v2 es
          // estable: { access_token, refresh_token, user, expires_at, ... }
          // Si encontramos un user válido, lo seteamos y cargamos perfil
          // (fetchPerfil tiene su propio timeout independiente). Si más
          // tarde el token resulta inválido, on401() del api.js limpia.
          try {
            const key = Object.keys(localStorage).find(k =>
              k.startsWith('sb-') && k.endsWith('-auth-token')
            )
            if (key) {
              const stored = JSON.parse(localStorage.getItem(key))
              const session = stored?.currentSession || stored
              if (session?.user && session?.access_token) {
                console.warn('[AuthProvider] boot timeout — fallback a token de localStorage')
                if (mounted) setUser(session.user)
                await cargarPerfil()
              } else {
                console.warn('[AuthProvider] boot timeout — storage sin user válido')
              }
            } else {
              console.warn('[AuthProvider] boot timeout — sin sb-* en storage')
            }
          } catch (fallbackErr) {
            console.warn('[AuthProvider] boot timeout — fallback storage failed:', fallbackErr)
          }
        } else {
          // CRASH/OTRO ERROR: storage probablemente corrupto, limpiamos
          // como antes (comportamiento defensivo del 28/05).
          clearSupabaseStorage()
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    // Reactividad: si la sesión cambia (login/logout en otro tab), sincronizamos.
    //
    // CRÍTICO: el event SIGNED_OUT se dispara en TRES casos:
    //   1. Logout manual (signOut() del user) → supabase ya limpió el storage.
    //   2. Logout en otro tab (storage event) → idem.
    //   3. Refresh del token FALLÓ (refresh_token vencido o red caída tras
    //      inactividad larga) → el SDK NO siempre limpia el sb-* y queda
    //      un token podrido que rompe el próximo signIn.
    //
    // Por eso siempre que llega SIGNED_OUT limpiamos storage defensivamente.
    // Es idempotente — si ya estaba limpio, no hace nada. Si el SDK no
    // alcanzó a limpiar (caso 3), arregla el bug del 01/06 donde el user
    // tenía que borrar el sb-* a mano para poder volver a loguearse.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      if (event === 'SIGNED_OUT' || !session) {
        setProfile(null)
        clearSupabaseStorage()
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await cargarPerfil()
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [cargarPerfil])

  const signIn = async (email, password) => {
    // NOTA: la primera versión del fix llamaba clearSupabaseStorage() acá
    // ANTES del signInWithPassword. Eso disparaba race condition: el
    // storage event hacía que el SDK procesara SIGNED_OUT en paralelo
    // con el signIn en curso, y el flow terminaba rompiéndose (el user
    // veía aparecer y desaparecer el sb-* en localStorage seguido de
    // "credenciales incorrectas" aunque eran correctas). Confiamos en
    // que el SDK maneje los tokens viejos al loguearse — sino, el
    // botón "Limpiar sesión" del LoginPage queda como escape hatch.

    // Timeout defensivo igual que en getSession/fetchPerfil. Si Supabase
    // no responde en 10s, devolvemos un "error" simulado para que la
    // LoginPage muestre algo accionable en vez de "Ingresando..." infinito.
    try {
      const res = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        10_000,
        'signIn'
      )
      // onAuthStateChange dispara cargarPerfil automáticamente.
      return res
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[useAuth] signIn timeout/error:', err)
      return {
        data: null,
        error: { message: 'Supabase no respondió. Revisá tu conexión a internet o reintentá.' },
      }
    }
  }

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      role: profile?.role || null,
      loading,
      signIn,
      signOut,
      refrescarPerfil: cargarPerfil,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
