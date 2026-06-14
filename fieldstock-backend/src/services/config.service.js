// src/services/config.service.js
/**
 * Service de la tabla `config_sistema` (key/value).
 *
 * Por ahora solo expone get/set genéricos. Los keys que usa el sistema
 * se mantienen en `KEYS` para que el frontend tenga una fuente única.
 */
import { supabase } from '../config/supabase.js'

export const KEYS = {
  PORCENTAJE_GANANCIA_DEFAULT: 'porcentaje_ganancia_default',
}

export async function getAll() {
  const { data, error } = await supabase
    .from('config_sistema').select('*').order('key')
  if (error) throw error
  return data
}

export async function get(key) {
  const { data, error } = await supabase
    .from('config_sistema').select('value').eq('key', key).maybeSingle()
  if (error) throw error
  return data?.value ?? null
}

export async function set(key, value, userId) {
  const { data, error } = await supabase
    .from('config_sistema').upsert({
      key,
      value: String(value),
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    }).select().single()
  if (error) throw error
  return data
}
