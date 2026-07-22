// src/services/planes.service.js
/**
 * Catálogo de planes (Taller / Obra / Empresa). El plan Empresa es "a
 * medida" (precio_mensual null) — no tiene alta automática vía Mercado
 * Pago, se contacta manualmente (ver suscripcion.service.elegirPlan).
 */
import { supabase } from '../config/supabase.js'

export async function getAll() {
  const { data, error } = await supabase
    .from('planes')
    .select('*')
    .eq('activo', true)
    .order('precio_mensual', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data
}

export async function getByCodigo(codigo) {
  const { data, error } = await supabase
    .from('planes')
    .select('*')
    .eq('codigo', codigo)
    .eq('activo', true)
    .maybeSingle()
  if (error) throw error
  return data
}
