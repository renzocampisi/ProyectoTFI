// src/shared/utils/supabaseClient.js
/**
 * Cliente Supabase del FRONTEND — usado EXCLUSIVAMENTE para Auth.
 *
 * IMPORTANTE: usa la ANON_KEY (pública, segura para el browser).
 * Toda lectura/escritura de datos pasa por el BACKEND (vía api.js), nunca
 * directo a Supabase desde acá. El backend usa SERVICE_KEY para bypassear
 * RLS y centralizar la lógica de negocio.
 *
 * Único uso legítimo en el frontend: `useAuth.jsx` (signIn, signOut,
 * onAuthStateChange).
 *
 * Los fallbacks 'http://localhost' / 'placeholder' evitan que crashee
 * el build si faltan envs — pero en runtime Auth fallará hasta que se
 * configure el .env del frontend.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || 'http://localhost'
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'

// Opciones explícitas para hacer evidente cómo manejamos sesiones:
//   - persistSession:    true → el token vive en localStorage entre recargas.
//   - autoRefreshToken:  true → el SDK refresca el access_token automáticamente
//                                antes de que expire (~1h). Si el refresh falla
//                                (red, refresh token vencido), dispara SIGNED_OUT.
//   - detectSessionInUrl:true → procesa #access_token=... de magic links.
// Cuando SIGNED_OUT viene de un refresh fallido tras inactividad larga, el
// listener de useAuth limpia el localStorage explícitamente — sino el sb-*
// quedaba en estado intermedio y rompía el próximo signIn (bug del 01/06).
export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
  },
})

// Cache en memoria del access_token vigente, mantenido al día por un único
// listener de auth state (vive acá, a nivel de módulo, para no depender del
// ciclo de vida de ningún componente React).
//
// api.js y useAuth.jsx lo leen de forma SINCRÓNICA en vez de llamar
// supabase.auth.getSession() en cada request — esa llamada es async y
// compite por el lock interno del SDK (usado para serializar el refresh
// del token). Con varios hooks poleando en paralelo (useRemito cada 3s,
// useNotificaciones cada 30s, dashboard, etc.) se disparaban decenas de
// getSession() concurrentes; si UNA se colgaba refrescando el token, el
// lock nunca se liberaba y TODAS las siguientes quedaban timeouteando para
// siempre, deslogueando al user sin motivo real (bug reportado el 04/07).
// Leer de una variable en memoria elimina la contención de raíz.
//
// Nota de orden: este listener se registra al importar el módulo (antes de
// que monte cualquier componente), así que siempre corre ANTES que el
// listener propio de useAuth.jsx (registrado en un useEffect, después del
// primer render) — el cache queda al día antes de que cualquier código de
// AuthProvider intente leerlo. Si algún día se agrega otro consumer que
// dependa del orden inverso, este comentario es la referencia.
let cachedAccessToken = null
supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token ?? null
})

export function getCachedAccessToken() {
  return cachedAccessToken
}

/**
 * Lee el access_token directamente del localStorage. Fallback para el
 * único hueco real del cache: la ventana entre el import de este módulo y
 * el primer callback de onAuthStateChange (que es async — Supabase no lo
 * dispara sincrónicamente). Usa el mismo formato estable del SDK v2: la key
 * empieza con `sb-` y termina con `-auth-token`, el valor es JSON con
 * { access_token, refresh_token, user, expires_at, ... }.
 *
 * Centralizado acá (en vez de duplicado en api.js y useAuth.jsx) para que
 * cualquier cambio futuro en el formato de storage del SDK se actualice en
 * un solo lugar.
 */
export function leerTokenDeStorage() {
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

/**
 * Limpia TODAS las entradas de localStorage que pertenecen a Supabase
 * (cualquier key que empieza con "sb-"). Sirve como reset duro cuando
 * detectamos sesión en estado corrupto — el caso reportado el 29/05:
 * cada vez que el user quería loguearse en su browser tradicional tenía
 * que borrar manualmente la entrada `sb-elxmkqascjsyoakedlqf-auth-token`
 * porque el SDK no podía refrescar el token y quedaba colgado en estado
 * inválido (en incógnito, sin storage previo, andaba perfecto).
 *
 * Estrategia: ante cualquier signo de problema (getSession timeout,
 * fetchPerfil failure, on401 del backend), limpiamos el storage para
 * que el próximo intento arranque limpio y el SDK trate de loguear
 * desde cero en vez de intentar reusar tokens podridos.
 *
 * Se llama desde useAuth.jsx (boot, cargarPerfil, signIn) y api.js
 * (on401). Es segura de llamar incluso si no hay nada que limpiar.
 */
export function clearSupabaseStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-')) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
    if (keys.length) console.warn('[supabaseClient] localStorage limpiado:', keys)
  } catch {
    // localStorage puede tirar QuotaExceeded o SecurityError en modo
    // privado — lo tragamos para no romper más el flow ya degradado.
  }
}
