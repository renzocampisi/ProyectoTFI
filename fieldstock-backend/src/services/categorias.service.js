// src/services/categorias.service.js
/**
 * Service de Categorías de herramientas (tabla pequeña, casi read-only).
 * Se consume desde el formulario de alta/edición de herramientas.
 */
import { supabase } from '../config/supabase.js'

export async function getAll() {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('nombre')

  if (error) throw error
  return data
}
