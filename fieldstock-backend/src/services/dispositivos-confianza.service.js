// src/services/dispositivos-confianza.service.js
/**
 * Dispositivo de confianza para el login 2FA (ver _plans/dispositivo-confianza/).
 *
 * Un usuario no-ADMIN puede marcar un equipo como "de confianza" al verificar
 * el código 2FA. Mientras la fila esté vigente, ese equipo saltea el segundo
 * factor — la contraseña se sigue verificando siempre (baja de 2FA a 1FA,
 * nunca a 0). `auth-login.service` compone este service.
 *
 * El token crudo (32 bytes aleatorios, base64url) nunca se persiste: en la
 * tabla va su sha-256 hex, igual que una contraseña.
 */
import crypto from 'crypto'
import { supabase } from '../config/supabase.js'

const TABLA = 'usuario_dispositivos_confianza'
const DIAS_INACTIVIDAD_MS = 30 * 24 * 60 * 60 * 1000
const DIAS_TOPE_MS        = 90 * 24 * 60 * 60 * 1000

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Descripción cosmética a partir del User-Agent, solo para mostrar en "Mi perfil". */
function descripcionDesdeUserAgent(userAgent) {
  const ua = userAgent || ''
  let navegador = 'Navegador'
  if (/edg\//i.test(ua)) navegador = 'Edge'
  else if (/chrome\//i.test(ua)) navegador = 'Chrome'
  else if (/firefox\//i.test(ua)) navegador = 'Firefox'
  else if (/safari\//i.test(ua)) navegador = 'Safari'

  let so = 'dispositivo desconocido'
  if (/windows/i.test(ua)) so = 'Windows'
  else if (/android/i.test(ua)) so = 'Android'
  else if (/iphone|ipad/i.test(ua)) so = 'iOS'
  else if (/mac os/i.test(ua)) so = 'Mac'
  else if (/linux/i.test(ua)) so = 'Linux'

  return `${navegador} en ${so}`
}

/**
 * Genera un token nuevo para el usuario y guarda su hash.
 * @returns {Promise<{ id: string, token: string }>} el token crudo — única vez que se ve, no se persiste.
 */
export async function registrar(usuarioId, userAgent) {
  const token = crypto.randomBytes(32).toString('base64url')
  const { data, error } = await supabase
    .from(TABLA)
    .insert({
      usuario_id:  usuarioId,
      token_hash:  hashToken(token),
      descripcion: descripcionDesdeUserAgent(userAgent),
    })
    .select('id')
    .single()
  if (error) throw error

  return { id: data.id, token }
}

/**
 * Valida el token para ese usuario y, si está vigente, actualiza `ultimo_uso`.
 * Un token ausente/inválido/vencido NO es error — devuelve false.
 * @returns {Promise<boolean>}
 */
export async function validarYUsar(usuarioId, token) {
  if (!usuarioId || !token) return false

  const { data: fila, error } = await supabase
    .from(TABLA)
    .select('id, created_at, ultimo_uso, revocado_at')
    .eq('usuario_id', usuarioId)
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (error) throw error
  if (!fila) return false

  const ahora = Date.now()
  const vigente = !fila.revocado_at
    && (ahora - new Date(fila.ultimo_uso).getTime()) < DIAS_INACTIVIDAD_MS
    && (ahora - new Date(fila.created_at).getTime()) < DIAS_TOPE_MS
  if (!vigente) return false

  const { error: errUpdate } = await supabase
    .from(TABLA)
    .update({ ultimo_uso: new Date().toISOString() })
    .eq('id', fila.id)
  if (errUpdate) throw errUpdate

  return true
}

/** Lista los dispositivos del usuario (incluye revocados, para "Mi perfil"). */
export async function listar(usuarioId) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('id, descripcion, created_at, ultimo_uso, revocado_at')
    .eq('usuario_id', usuarioId)
    .order('ultimo_uso', { ascending: false })
  if (error) throw error
  return data
}

export async function revocarUno(usuarioId, id) {
  const { error } = await supabase
    .from(TABLA)
    .update({ revocado_at: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', usuarioId)
  if (error) throw error
}

export async function revocarTodos(usuarioId) {
  const { error } = await supabase
    .from(TABLA)
    .update({ revocado_at: new Date().toISOString() })
    .eq('usuario_id', usuarioId)
    .is('revocado_at', null)
  if (error) throw error
}
