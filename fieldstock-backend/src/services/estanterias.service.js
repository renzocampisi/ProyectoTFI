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
// Match EXACTO — el código QR es un valor fijo tipo "FS-EST-001", no un
// término de búsqueda parcial. Un ILIKE con comodines acá matchearía
// cualquier código que lo contenga como substring (ej. "FS-EST-1"
// matchearía "FS-EST-001", "FS-EST-010", "FS-EST-100", etc.), rompiendo
// .single() con múltiples resultados o devolviendo la estantería
// equivocada.
export async function getByQR(codigoQR) {
  // activa=true es obligatorio acá: con la numeración por huecos, una
  // estantería borrada (soft-delete) puede coexistir con una nueva que
  // reusó el mismo codigo_qr — sin este filtro .single() rompe con dos
  // filas apenas se reusa un código.
  const { data, error } = await supabase
    .from('estanterias')
    .select('*')
    .eq('codigo_qr', codigoQR)
    .eq('activa', true)
    .single()
  if (error) throw error
  return data
}

/**
 * Primer número libre entre las estanterías ACTIVAS — no el siguiente al
 * máximo histórico. Con soft delete, una estantería dada de baja libera su
 * número (ver índice único parcial `estanterias_numero_activa_key`); si no
 * se rellenara el hueco acá, la numeración saltaría para siempre cada vez
 * que se borra una del medio.
 */
async function siguienteNumeroLibre() {
  const { data, error } = await supabase
    .from('estanterias')
    .select('numero')
    .eq('activa', true)
    .order('numero', { ascending: true })
  if (error) throw error

  let numero = 1
  for (const fila of data || []) {
    if (fila.numero !== numero) break
    numero++
  }
  return numero
}

// ── Crear ─────────────────────────────────────────────────────
export async function create(body) {
  const numero   = await siguienteNumeroLibre()
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
// Solo se puede borrar una estantería vacía — si tiene algo guardado, hay
// que sacarlo (o moverlo) primero. Evita perder de vista dónde estaba
// guardado un material/herramienta por accidente.
export async function remove(id) {
  const { count, error: errCount } = await supabase
    .from('estanteria_items')
    .select('id', { count: 'exact', head: true })
    .eq('estanteria_id', id)
  if (errCount) throw errCount

  if ((count || 0) > 0) {
    const err = new Error('No se puede borrar una estantería que todavía tiene herramientas o materiales guardados.')
    err.status = 409; throw err
  }

  const { error } = await supabase
    .from('estanterias').update({ activa: false }).eq('id', id)
  if (error) throw error
}

// ── Agregar ítem ──────────────────────────────────────────────
// Un material o herramienta solo puede estar guardado en UNA estantería a
// la vez (ver índices únicos parciales de la migración) — acá se valida
// antes de insertar para poder devolver un mensaje claro, en vez de dejar
// que explote como un error crudo de constraint violado.
export async function addItem(estanteriaId, body) {
  if (!body.herramientaId && !body.materialId) {
    const err = new Error('Debe especificar herramientaId o materialId')
    err.status = 400; throw err
  }

  const columna = body.herramientaId ? 'herramienta_id' : 'material_id'
  const valorId = body.herramientaId || body.materialId

  const { data: existente, error: errExistente } = await supabase
    .from('estanteria_items')
    .select('estanteria_id, estanterias(numero)')
    .eq(columna, valorId)
    .maybeSingle()
  if (errExistente) throw errExistente

  if (existente) {
    const err = new Error(`Ya está guardado en la Estantería ${existente.estanterias.numero} — sacalo de ahí antes de moverlo.`)
    err.status = 409; throw err
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
