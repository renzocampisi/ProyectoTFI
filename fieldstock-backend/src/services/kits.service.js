// src/services/kits.service.js
/**
 * Service de kits de herramientas — un kit agrupa herramientas + materiales
 * que se usan juntos habitualmente (ej. "kit soldadura" = soldadora +
 * electrodos + careta). Es solo una plantilla de conveniencia: agregar un
 * kit a un remito simplemente agrega cada uno de sus componentes al remito
 * (reusa `addItem`/`addMaterial` de remitos.service para no duplicar la
 * lógica de reserva de herramienta / validación de stock). El kit en sí
 * no queda referenciado desde `remito_items`/`remito_materiales`.
 */
import { supabase } from '../config/supabase.js'
import * as RemitosService from './remitos.service.js'

const SELECT = `
  id, nombre, descripcion, activo, created_at,
  kit_herramientas(herramienta:herramientas(id, nombre, codigo_qr, estado)),
  kit_materiales(cantidad, material:materiales(id, nombre, unidad, stock_actual))
`

// Aplana la forma anidada que devuelve supabase (kit_herramientas: [{herramienta: {...}}])
// a algo más cómodo de consumir: herramientas: [{...}], materiales: [{...cantidad}]
function aplanar(kit) {
  if (!kit) return kit
  const { kit_herramientas, kit_materiales, ...resto } = kit
  return {
    ...resto,
    herramientas: (kit_herramientas || []).map(kh => kh.herramienta).filter(Boolean),
    materiales:   (kit_materiales   || []).map(km => ({ ...km.material, cantidad: Number(km.cantidad) })).filter(m => m.id),
  }
}

export async function getAll({ q } = {}) {
  let query = supabase
    .from('kits')
    .select('id, nombre, descripcion, activo, created_at, kit_herramientas(herramienta_id), kit_materiales(material_id)')
    .eq('activo', true)
    .order('nombre')
  if (q) query = query.ilike('nombre', `%${q}%`)

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(k => ({
    id:          k.id,
    nombre:      k.nombre,
    descripcion: k.descripcion,
    activo:      k.activo,
    created_at:  k.created_at,
    cantidadHerramientas: k.kit_herramientas?.length ?? 0,
    cantidadMateriales:   k.kit_materiales?.length ?? 0,
  }))
}

export async function getById(id) {
  const { data, error } = await supabase
    .from('kits').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return aplanar(data)
}

export async function create(body) {
  const { nombre, descripcion, herramientaIds = [], materiales = [] } = body
  if (!nombre?.trim()) {
    const err = new Error('El nombre del kit es obligatorio'); err.status = 400; throw err
  }
  if (!herramientaIds.length && !materiales.length) {
    const err = new Error('El kit debe tener al menos una herramienta o un material'); err.status = 400; throw err
  }

  const { data: kit, error: errK } = await supabase
    .from('kits')
    .insert({ nombre: nombre.trim(), descripcion: descripcion || null })
    .select().single()
  if (errK) throw errK

  await reemplazarComposicion(kit.id, { herramientaIds, materiales })
  return getById(kit.id)
}

export async function update(id, body) {
  const { data: actual } = await supabase.from('kits').select('id').eq('id', id).maybeSingle()
  if (!actual) {
    const err = new Error('Kit no encontrado'); err.status = 404; throw err
  }

  const { nombre, descripcion, herramientaIds, materiales } = body
  const campos = {}
  if (nombre      !== undefined) campos.nombre      = nombre.trim()
  if (descripcion !== undefined) campos.descripcion = descripcion || null

  if (Object.keys(campos).length) {
    const { error } = await supabase.from('kits').update(campos).eq('id', id)
    if (error) throw error
  }

  // herramientaIds/materiales son opcionales en el update: si vienen, se
  // reemplaza la composición completa (más simple que hacer diff).
  if (herramientaIds !== undefined || materiales !== undefined) {
    await reemplazarComposicion(id, {
      herramientaIds: herramientaIds ?? [],
      materiales:     materiales     ?? [],
    })
  }

  return getById(id)
}

async function reemplazarComposicion(kitId, { herramientaIds, materiales }) {
  await supabase.from('kit_herramientas').delete().eq('kit_id', kitId)
  await supabase.from('kit_materiales').delete().eq('kit_id', kitId)

  if (herramientaIds.length) {
    const { error } = await supabase.from('kit_herramientas')
      .insert(herramientaIds.map(herramientaId => ({ kit_id: kitId, herramienta_id: herramientaId })))
    if (error) throw error
  }
  if (materiales.length) {
    const { error } = await supabase.from('kit_materiales')
      .insert(materiales.map(m => ({ kit_id: kitId, material_id: m.materialId, cantidad: m.cantidad })))
    if (error) throw error
  }
}

// Soft delete — el kit es solo una plantilla, no hay dependencias que
// proteger (agregar un kit a un remito copia sus componentes, no queda
// ninguna referencia viva al kit en sí).
export async function remove(id) {
  const { error } = await supabase.from('kits').update({ activo: false }).eq('id', id)
  if (error) throw error
}

// ── Agregar un kit completo a un remito en BORRADOR ─────────────
// Valida TODO antes de insertar nada (todas las herramientas disponibles,
// stock suficiente de todos los materiales) para no dejar el remito con
// una carga parcial del kit si algo falla a mitad de camino.
export async function agregarARemito(remitoId, kitId) {
  const { data: remito, error: errR } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).maybeSingle()
  if (errR) throw errR
  if (!remito) {
    const err = new Error('Remito no encontrado'); err.status = 404; throw err
  }
  if (remito.estado !== 'BORRADOR') {
    const err = new Error('Solo se pueden agregar kits en estado BORRADOR')
    err.status = 400; throw err
  }

  const kit = await getById(kitId)
  if (!kit) {
    const err = new Error('Kit no encontrado'); err.status = 404; throw err
  }
  if (!kit.activo) {
    const err = new Error(`El kit "${kit.nombre}" está desactivado`); err.status = 400; throw err
  }

  const errores = []
  for (const h of kit.herramientas) {
    if (h.estado !== 'DISPONIBLE') {
      errores.push(`"${h.nombre}" no está disponible (estado: ${h.estado})`)
    }
  }
  for (const m of kit.materiales) {
    if (Number(m.stock_actual) < Number(m.cantidad)) {
      errores.push(`Stock insuficiente de "${m.nombre}": pediste ${m.cantidad} ${m.unidad}, hay ${m.stock_actual}`)
    }
  }
  if (errores.length) {
    const err = new Error(`No se pudo agregar el kit "${kit.nombre}":\n${errores.map(e => `· ${e}`).join('\n')}`)
    err.status = 409
    err.data = { errores }
    throw err
  }

  for (const h of kit.herramientas) {
    await RemitosService.addItem(remitoId, { herramientaId: h.id })
  }
  for (const m of kit.materiales) {
    await RemitosService.addMaterial(remitoId, { materialId: m.id, cantidad: m.cantidad, unidad: m.unidad })
  }

  return {
    kit: kit.nombre,
    herramientasAgregadas: kit.herramientas.length,
    materialesAgregados:   kit.materiales.length,
  }
}
