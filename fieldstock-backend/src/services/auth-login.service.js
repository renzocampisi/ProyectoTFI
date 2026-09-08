// src/services/auth-login.service.js
/**
 * Login con segundo factor por mail (ver _plans/login-2fl/).
 *
 * Único punto de entrada de login del sistema. El frontend NO llama más a
 * supabase.auth.signInWithPassword directo — pasa por acá para que:
 *
 *   1. La contraseña se verifique en el backend y su sesión se descarte
 *      ahí mismo (el cliente nunca tiene una sesión "solo password").
 *   2. Se decida por rol: ADMIN entra directo (cuenta de pruebas); todo
 *      otro rol recibe un código de 6 dígitos por mail y recién con
 *      verifyOtp (client-side) obtiene sesión.
 *
 * Supabase Auth genera el código, lo hashea, lo manda por SMTP (Resend),
 * controla su vencimiento y crea la sesión al verificarlo. Acá solo
 * orquestamos.
 */
import { supabaseAuth } from '../config/supabaseAuth.js'
import { supabase } from '../config/supabase.js'
import { ROLES } from '../constants/roles.js'

// ── Rate limit en memoria ─────────────────────────────────────
// Clave: `${email}|${ip}`. Valor: timestamps (ms) de los intentos dentro
// de la ventana. Cuenta TODOS los intentos (ok y fallidos) para topear
// también el abuso de envío de código. Se reinicia con el proceso y es
// por-instancia — alcanza para la escala del proyecto (una máquina en Fly).
const VENTANA_MS       = 10 * 60 * 1000
const MAX_POR_VENTANA  = 5
const _intentos = new Map()

function chequearRateLimit(email, ip) {
  const clave = `${(email || '').trim().toLowerCase()}|${ip || 'sin-ip'}`
  const ahora = Date.now()
  const previos = (_intentos.get(clave) || []).filter(t => ahora - t < VENTANA_MS)
  previos.push(ahora)
  _intentos.set(clave, previos)
  if (previos.length > MAX_POR_VENTANA) {
    const e = new Error('Demasiados intentos. Esperá unos minutos y reintentá.')
    e.status = 429
    throw e
  }
}

// 422 y no 401 a propósito: api.js del frontend trata CUALQUIER 401 como
// "sesión expirada" y dispara logout + redirect. Acá el login todavía no
// tiene sesión — un rechazo es 422 ("no procede"), que el frontend muestra
// inline sin efectos colaterales.
function credencialesInvalidas() {
  // Mensaje genérico único — mismo criterio anti-enumeración que LoginPage.
  const e = new Error('Email o contraseña incorrectos.')
  e.status = 422
  return e
}

/**
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string=} params.ip     — req.ip, para el rate limit (best-effort).
 * @returns {Promise<{ session: { access_token, refresh_token } } | { requiereCodigo: true, email: string }>}
 */
export async function login({ email, password, ip }) {
  if (!email?.trim() || !password) throw credencialesInvalidas()

  chequearRateLimit(email, ip)

  // 1. Verificar la contraseña. La sesión que devuelve queda en memoria y
  //    NO se persiste (supabaseAuth tiene persistSession:false).
  const { data: signIn, error: errPass } = await supabaseAuth.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (errPass || !signIn?.user) throw credencialesInvalidas()

  // 2. Cargar el perfil para saber el rol y si la cuenta está activa.
  const { data: perfil, error: errPerfil } = await supabase
    .from('usuarios_resumen')
    .select('id, role, activo')
    .eq('id', signIn.user.id)
    .maybeSingle()
  if (errPerfil) throw errPerfil
  if (!perfil) {
    // auth.users existe pero no hay perfil — estado inconsistente, mismo
    // criterio que requireAuth: no lo dejamos pasar.
    const e = new Error('Tu usuario no tiene perfil cargado. Contactá al administrador.')
    e.status = 422
    throw e
  }
  if (!perfil.activo) {
    const e = new Error('Cuenta desactivada.')
    e.status = 422
    throw e
  }

  // 3a. ADMIN: entra directo, sin código (cuenta de pruebas).
  if (perfil.role === ROLES.ADMIN) {
    return {
      session: {
        access_token:  signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
      },
    }
  }

  // 3b. Cualquier otro rol: disparar el código por mail. Supabase manda el
  //     OTP por SMTP; el frontend lo verifica con verifyOtp.
  const { error: errOtp } = await supabaseAuth.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: false },
  })
  if (errOtp) {
    const e = new Error('No pudimos enviar el código. Reintentá en un momento.')
    e.status = 502
    throw e
  }

  return { requiereCodigo: true, email: email.trim().toLowerCase() }
}
