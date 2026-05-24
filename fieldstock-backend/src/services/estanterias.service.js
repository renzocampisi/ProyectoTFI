// src/services/estanterias.service.js
/**
 * Service del M8 — Estanterías (ubicación física del stock en el galpón).
 *
 * Una estantería tiene un QR propio (`FS-EST-001`, `FS-EST-002`, ...) que se
 * escanea desde el celular para ver qué hay guardado. Los items pueden ser
 * herramientas o materiales — el discriminador es cuál de los dos *_id
 * viene seteado.
 *
 * El borrado es soft (campo `activa = false`).
 */
import { supabase } from '../config/supabase.js'

// Número correlativo zero-padded a 3 dígitos → "FS-EST-001"
function generarQREstanteria(numero) {
  return `FS-EST-${String(numero).padStart(3, '0')}`
}

// ── Listar estanterías ────────────────────────────────────────
export async function getAll() {
  const { data, error } = await supabase
    .from('estanterias')
    .select('*')
    .eq('activa', true)
    .order('numero')
  if (error) throw error
  return data
}

// ── Detalle con contenido ─────────────────────────────────────
export async function getById(id) {
  const [
    { data: estanteria, error: errE },
    { data: contenido,  error: errC },
  ] = await Promise.all([
    supabase.from('estanterias').select('*').eq('id', id).single(),
    supabase.from('estanterias_contenido').select('*').eq('estanteria_id', id),
  ])
  if (errE) throw errE
  if (errC) throw errC
  return { ...estanteria, items: contenido ?? [] }
}

// ── Buscar por QR ─────────────────────────────────────────────
export async function getByQR(codigoQR) {
  const { data, error } = await supabase
    .from('estanterias')
    .select('*')
    .ilike('codigo_qr', `%${codigoQR}%`)
    .single()
  if (error) throw error
  return data
}

// ── Crear ─────────────────────────────────────────────────────
export async function create(body) {
  // Auto-asignar número siguiente
  const { data: ultima } = await supabase
    .from('estanterias')
    .select('numero')
    .order('numero', { ascending: false })
    .limit(1)

  const numero   = (ultima?.[0]?.numero ?? 0) + 1
  const codigoQR = generarQREstanteria(numero)

  const { data, error } = await supabase
    .from('estanterias')
    .insert({
      numero,
      codigo_qr:   codigoQR,
      descripcion: body.descripcion || null,
    })
    .select().single()
  if (error) throw error
  return data
}

// ── Editar ────────────────────────────────────────────────────
export async function update(id, body) {
  const { data, error } = await supabase
    .from('estanterias')
    .update({ descripcion: body.descripcion || null })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Eliminar (soft) ───────────────────────────────────────────
export async function remove(id) {
  const { error } = await supabase
    .from('estanterias').update({ activa: false }).eq('id', id)
  if (error) throw error
}

// ── Agregar ítem ──────────────────────────────────────────────
export async function addItem(estanteriaId, body) {
  if (!body.herramientaId && !body.materialId) {
    const err = new Error('Debe especificar herramientaId o materialId')
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('estanteria_items')
    .insert({
      estanteria_id:  estanteriaId,
      herramienta_id: body.herramientaId || null,
      material_id:    body.materialId    || null,
    })
    .select().single()
  if (error) throw error
  return data
}

// ── Quitar ítem ───────────────────────────────────────────────
export async function removeItem(itemId) {
  const { error } = await supabase
    .from('estanteria_items').delete().eq('id', itemId)
  if (error) throw error
}

// ── Mover ítem a otra estantería ──────────────────────────────
export async function moverItem(itemId, nuevaEstanteriaId) {
  const { data, error } = await supabase
    .from('estanteria_items')
    .update({ estanteria_id: nuevaEstanteriaId })
    .eq('id', itemId).select().single()
  if (error) throw error
  return data
}
