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

export const supabase = createClient(supabaseUrl, supabaseAnon)

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
    // eslint-disable-next-line no-console
    if (keys.length) console.warn('[supabaseClient] localStorage limpiado:', keys)
  } catch {
    // localStorage puede tirar QuotaExceeded o SecurityError en modo
    // privado — lo tragamos para no romper más el flow ya degradado.
  }
}
