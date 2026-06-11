// src/services/directorio.service.js
/**
 * Service del M7 — Directorio.
 *
 * Maneja TRES tablas paralelas con casi el mismo CRUD:
 * - transportes: empresas de transporte que mueven los remitos
 * - clientes:    empresas/personas dueñas de las obras
 * - proveedores: empresas que venden herramientas/materiales al galpón
 *
 * Borrado soft en las tres (campo `activo = false`).
 *
 * Nota: el CRUD es prácticamente idéntico entre las tres entidades. Se
 * mantienen separadas por claridad y porque los campos opcionales difieren
 * ligeramente (proveedores incluye `rubro`). Si en el futuro hace falta una
 * cuarta entidad, conviene extraer un helper genérico tipo
 * `crudFactory(tableName, allowedFields)`.
 */
import { supabase } from '../config/supabase.js'

// ── TRANSPORTES ───────────────────────────────────────────────
export async function getAllTransportes({ q } = {}) {
  let query = supabase.from('transportes').select('*').eq('activo', true).order('nombre')
  if (q) query = query.ilike('nombre', `%${q}%`)
  const { data, error } = await query
  if (error) throw error
  return data
}

function normalizarTipoTransporte(tipo) {
  return tipo === 'PARTICULAR' ? 'PARTICULAR' : 'EMPRESA'
}

export async function createTransporte(body) {
  const { data, error } = await supabase.from('transportes')
    .insert({
      tipo:      normalizarTipoTransporte(body.tipo),
      nombre:    body.nombre,
      cuit:      body.cuit      || null,
      direccion: body.direccion || null,
      localidad: body.localidad || null,
      provincia: body.provincia || null,
      telefono:  body.telefono  || null,
      email:     body.email     || null,
      contacto:  body.contacto  || null,
    })
    .select().single()
  if (error) throw error
  return data
}

export async function updateTransporte(id, body) {
  const { data, error } = await supabase.from('transportes')
    .update({
      tipo:      normalizarTipoTransporte(body.tipo),
      nombre:    body.nombre,
      cuit:      body.cuit      || null,
      direccion: body.direccion || null,
      localidad: body.localidad || null,
      provincia: body.provincia || null,
      telefono:  body.telefono  || null,
      email:     body.email     || null,
      contacto:  body.contacto  || null,
    })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteTransporte(id) {
  const { error } = await supabase.from('transportes')
    .update({ activo: false }).eq('id', id)
  if (error) throw error
}

// ── CLIENTES ──────────────────────────────────────────────────
export async function getAllClientes({ q } = {}) {
  let query = supabase.from('clientes').select('*').eq('activo', true).order('nombre')
  if (q) query = query.ilike('nombre', `%${q}%`)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createCliente(body) {
  const { data, error } = await supabase.from('clientes')
    .insert({
      nombre:    body.nombre,
      contacto:  body.contacto  || null,
      telefono:  body.telefono  || null,
      email:     body.email     || null,
      direccion: body.direccion || null,
      localidad: body.localidad || null,
      provincia: body.provincia || null,
      notas:     body.notas     || null,
    })
    .select().single()
  if (error) throw error
  return data
}

export async function updateCliente(id, body) {
  const { data, error } = await supabase.from('clientes')
    .update({
      nombre:    body.nombre,
      contacto:  body.contacto  || null,
      telefono:  body.telefono  || null,
      email:     body.email     || null,
      direccion: body.direccion || null,
      localidad: body.localidad || null,
      provincia: body.provincia || null,
      notas:     body.notas     || null,
    })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteCliente(id) {
  const { error } = await supabase.from('clientes')
    .update({ activo: false }).eq('id', id)
  if (error) throw error
}

// ── PROVEEDORES ───────────────────────────────────────────────
// Mismo patrón que clientes/transportes pero con `rubro` como campo extra
// (texto libre con qué provee la empresa, p.ej. "Herramientas eléctricas").
export async function getAllProveedores({ q } = {}) {
  let query = supabase.from('proveedores').select('*').eq('activo', true).order('nombre')
  if (q) query = query.ilike('nombre', `%${q}%`)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createProveedor(body) {
  const { data, error } = await supabase.from('proveedores')
    .insert({
      nombre:    body.nombre,
      rubro:     body.rubro     || null,
      cuit:      body.cuit      || null,
      contacto:  body.contacto  || null,
      telefono:  body.telefono  || null,
      email:     body.email     || null,
      direccion: body.direccion || null,
      localidad: body.localidad || null,
      provincia: body.provincia || null,
      notas:     body.notas     || null,
    })
    .select().single()
  if (error) throw error
  return data
}

export async function updateProveedor(id, body) {
  const { data, error } = await supabase.from('proveedores')
    .update({
      nombre:    body.nombre,
      rubro:     body.rubro     || null,
      cuit:      body.cuit      || null,
      contacto:  body.contacto  || null,
      telefono:  body.telefono  || null,
      email:     body.email     || null,
      direccion: body.direccion || null,
      localidad: body.localidad || null,
      provincia: body.provincia || null,
      notas:     body.notas     || null,
    })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteProveedor(id) {
  const { error } = await supabase.from('proveedores')
    .update({ activo: false }).eq('id', id)
  if (error) throw error
}
