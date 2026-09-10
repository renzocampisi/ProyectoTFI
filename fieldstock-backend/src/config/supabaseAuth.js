// src/config/supabaseAuth.js
/**
 * Cliente Supabase para operaciones de AUTENTICACIÓN en el backend.
 *
 * Usa la ANON_KEY (pública, la misma del frontend) — NO la service key.
 * Es el cliente que el endpoint POST /auth/login usa para:
 *   - verificar la contraseña del usuario (signInWithPassword), sin
 *     quedarse con esa sesión, y
 *   - disparar el envío del código OTP por mail (signInWithOtp).
 *
 * `persistSession: false` + `autoRefreshToken: false`: este cliente no
 * mantiene ninguna sesión propia. Cada llamada es one-shot; la sesión que
 * devuelva signInWithPassword se lee en memoria y se descarta. Así el
 * cliente service-role compartido (config/supabase.js) queda intacto y no
 * hay estado de auth colgado en el proceso del backend.
 *
 * Si arranca el backend sin la variable, falla fast con un Error claro —
 * mismo criterio que config/supabase.js.
 */
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url     = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el .env')
}

export const supabaseAuth = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
