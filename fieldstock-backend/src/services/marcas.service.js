// src/services/marcas.service.js
/**
 * Service de Marcas de herramientas (tabla pequeña, casi read-only).
 * Estructura espejada de categorias.service.js.
 */
import { supabase } from '../config/supabase.js'

export async function getAll() {
  const { data, error } = await supabase
    .from('marcas')
    .select('*')
    .order('nombre')

  if (error) throw error
  return data
}

export async function create(nombre) {
  const { data, error } = await supabase
    .from('marcas')
    .insert({ nombre: nombre.trim() })
    .select().single()

  if (error) throw error
  return data
}
