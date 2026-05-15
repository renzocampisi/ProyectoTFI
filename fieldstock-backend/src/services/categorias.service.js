// src/services/categorias.service.js
import { supabase } from '../config/supabase.js'

export async function getAll() {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('nombre')

  if (error) throw error
  return data
}
