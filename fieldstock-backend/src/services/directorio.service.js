// src/services/directorio.service.js
import { supabase } from '../config/supabase.js'

// ── TRANSPORTES ───────────────────────────────────────────────
export async function getAllTransportes({ q } = {}) {
  let query = supabase.from('transportes').select('*').eq('activo', true).order('nombre')
  if (q) query = query.ilike('nombre', `%${q}%`)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createTransporte(body) {
  const { data, error } = await supabase.from('transportes')
    .insert({
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
