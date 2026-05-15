// src/services/materiales.service.js
import { supabase } from '../config/supabase.js'

export async function getAll({ q } = {}) {
  let query = supabase
    .from('materiales')
    .select('*')
    .eq('activo', true)
    .order('nombre')

  if (q) query = query.ilike('nombre', `%${q}%`)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getById(id) {
  const { data, error } = await supabase
    .from('materiales').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function create(body) {
  const { data, error } = await supabase
    .from('materiales')
    .insert({
      nombre:       body.nombre,
      descripcion:  body.descripcion  || null,
      unidad:       body.unidad       || 'unidad',
      stock_actual: body.stockActual  || 0,
      stock_minimo: body.stockMinimo  || 0,
    })
    .select().single()
  if (error) throw error
  return data
}

export async function update(id, body) {
  const campos = {}
  if (body.nombre      !== undefined) campos.nombre       = body.nombre
  if (body.descripcion !== undefined) campos.descripcion  = body.descripcion || null
  if (body.unidad      !== undefined) campos.unidad       = body.unidad
  if (body.stockActual !== undefined) campos.stock_actual = body.stockActual
  if (body.stockMinimo !== undefined) campos.stock_minimo = body.stockMinimo

  if (!Object.keys(campos).length) {
    const err = new Error('No hay campos para actualizar')
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('materiales')
    .update(campos)
    .eq('id', id)
    .select().single()
  if (error) throw error
  return data
}

export async function updateStock(id, cantidad, operacion = 'descontar') {
  const { data: mat, error: errM } = await supabase
    .from('materiales').select('stock_actual').eq('id', id).single()
  if (errM) throw errM

  const nuevoStock = operacion === 'descontar'
    ? mat.stock_actual - cantidad
    : mat.stock_actual + cantidad

  if (nuevoStock < 0) {
    const err = new Error(`Stock insuficiente. Disponible: ${mat.stock_actual}`)
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('materiales')
    .update({ stock_actual: nuevoStock })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}
