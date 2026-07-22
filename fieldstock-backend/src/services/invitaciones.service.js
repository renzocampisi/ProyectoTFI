// src/services/invitaciones.service.js
/**
 * Invitaciones: códigos de un solo uso que un DUEÑO/ADMIN genera desde
 * /usuarios para que un empleado se autoregistre con un rol pre-asignado.
 * `role` nunca incluye DUEÑO — ese rol solo sale del registro bootstrap
 * (ver auth-publico.service.js).
 *
 * El código es legible/copiable a mano: FS-INV-{6 chars base36 mayúsculas}.
 */
import crypto from 'crypto'
import { supabase } from '../config/supabase.js'
import { ROLES, ROLES_LIST } from '../constants/roles.js'

const ROLES_INVITABLES = ROLES_LIST.filter(r => r !== ROLES.DUEÑO)

function genCodigo() {
  const rand = crypto.randomBytes(6).toString('hex').toUpperCase().slice(0, 6)
  return `FS-INV-${rand}`
}

export async function generar({ role, creadoPor }) {
  if (!ROLES_INVITABLES.includes(role)) {
    const e = new Error(`role inválido para invitación. Debe ser uno de: ${ROLES_INVITABLES.join(', ')}`)
    e.status = 400; throw e
  }

  const codigo = genCodigo()
  const expiraEn = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('invitaciones')
    .insert({ codigo, role, creado_por: creadoPor, expira_en: expiraEn })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getAll() {
  const { data, error } = await supabase
    .from('invitaciones')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/** Devuelve la invitación si el código existe, no fue usada y no venció. Null si no. */
export async function getVigentePorCodigo(codigo) {
  const { data, error } = await supabase
    .from('invitaciones')
    .select('*')
    .eq('codigo', codigo?.trim().toUpperCase())
    .is('usado_por', null)
    .gt('expira_en', new Date().toISOString())
    .maybeSingle()
  if (error) throw error
  return data
}

export async function marcarUsada(id, usuarioId) {
  const { error } = await supabase
    .from('invitaciones')
    .update({ usado_por: usuarioId, usado_en: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
