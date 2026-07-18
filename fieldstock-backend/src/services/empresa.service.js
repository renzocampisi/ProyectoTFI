// src/services/empresa.service.js
/**
 * Datos de la empresa dueña de esta instancia (nombre, teléfono,
 * dirección, email). Sistema single-tenant: no hay tabla `empresa`
 * dedicada, se guarda como 4 keys más en `config_sistema` (la misma
 * tabla key/value que ya usa el % de ganancia default) para no sumar
 * una tabla nueva por 4 campos de texto.
 *
 * `nombre` es el único obligatorio — es lo que se muestra al lado de
 * "FieldStock AI" en el sidebar/topbar (ver AppLayout.jsx).
 */
import { supabase } from '../config/supabase.js'

const KEYS = {
  nombre:    'empresa_nombre',
  telefono:  'empresa_telefono',
  direccion: 'empresa_direccion',
  email:     'empresa_email',
}

export async function get() {
  const { data, error } = await supabase
    .from('config_sistema').select('key, value').in('key', Object.values(KEYS))
  if (error) throw error
  const byKey = Object.fromEntries((data || []).map(r => [r.key, r.value]))
  return {
    nombre:    byKey[KEYS.nombre]    || null,
    telefono:  byKey[KEYS.telefono]  || null,
    direccion: byKey[KEYS.direccion] || null,
    email:     byKey[KEYS.email]     || null,
  }
}

export async function set(body, userId) {
  const nombre = body.nombre?.trim()
  if (!nombre) {
    const err = new Error('El nombre de la empresa es obligatorio')
    err.status = 400; throw err
  }

  const ahora = new Date().toISOString()
  const filas = [
    { key: KEYS.nombre,    value: nombre },
    { key: KEYS.telefono,  value: body.telefono?.trim()  || '' },
    { key: KEYS.direccion, value: body.direccion?.trim() || '' },
    { key: KEYS.email,     value: body.email?.trim()     || '' },
  ].map(f => ({ ...f, updated_at: ahora, updated_by: userId || null }))

  const { error } = await supabase.from('config_sistema').upsert(filas)
  if (error) throw error
  return get()
}
