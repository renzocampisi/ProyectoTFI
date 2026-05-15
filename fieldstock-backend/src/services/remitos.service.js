// src/services/remitos.service.js
import { supabase } from '../config/supabase.js'
import { updateStock } from './materiales.service.js'

async function generarNumero(tipo) {
  const { data, error } = await supabase.rpc('generar_numero_remito', { tipo })
  if (error) throw error
  return data
}

// ── Listar ────────────────────────────────────────────────────
export async function getAll({ tipo, estado } = {}) {
  let query = supabase
    .from('remitos_resumen')
    .select('*')
    .order('fecha', { ascending: false })

  if (tipo)   query = query.eq('tipo',   tipo)
  if (estado) query = query.eq('estado', estado)

  const { data, error } = await query
  if (error) throw error
  return data
}

// ── Detalle ───────────────────────────────────────────────────
export async function getById(id) {
  const [
    { data: remito,     error: errR },
    { data: items,      error: errI },
    { data: materiales, error: errM },
  ] = await Promise.all([
    supabase.from('remitos_resumen').select('*').eq('id', id).single(),
    supabase.from('remito_items_completo').select('*').eq('remito_id', id),
    supabase.from('remito_materiales_completo').select('*').eq('remito_id', id),
  ])

  if (errR) throw errR
  if (errI) throw errI
  if (errM) throw errM

  return { ...remito, items: items ?? [], materiales: materiales ?? [] }
}

// ── Crear ─────────────────────────────────────────────────────
export async function create(body) {
  const numero = await generarNumero(body.tipo)

  const { data, error } = await supabase
    .from('remitos')
    .insert({
      numero,
      tipo:               body.tipo,
      estado:             'BORRADOR',
      obra:               body.obra,
      responsable:        body.responsable,
      empresa_transporte: body.empresaTransporte || null,
      fecha:              body.fecha || new Date().toISOString().split('T')[0],
      observacion:        body.observacion || null,
    })
    .select().single()

  if (error) throw error
  return data
}

// ── Agregar herramienta ───────────────────────────────────────
export async function addItem(remitoId, body) {
  const { data: remito } = await supabase
    .from('remitos').select('tipo, estado').eq('id', remitoId).single()

  if (remito.estado !== 'BORRADOR') {
    const err = new Error('Solo se pueden agregar ítems a remitos en estado BORRADOR')
    err.status = 400; throw err
  }

  if (remito.tipo === 'EGRESO') {
    const { data: herr } = await supabase
      .from('herramientas').select('estado').eq('id', body.herramientaId).single()
    if (herr?.estado !== 'DISPONIBLE') {
      const err = new Error('La herramienta no está disponible')
      err.status = 400; throw err
    }
  }

  const { data, error } = await supabase
    .from('remito_items')
    .insert({
      remito_id:      remitoId,
      herramienta_id: body.herramientaId,
      estado_salida:  body.estadoSalida || 'BUENO',
      observacion:    body.observacion  || null,
    })
    .select().single()

  if (error) throw error
  return data
}

export async function removeItem(remitoId, itemId) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito?.estado !== 'BORRADOR') {
    const err = new Error('Solo se pueden quitar ítems de remitos en estado BORRADOR')
    err.status = 400; throw err
  }

  const { error } = await supabase
    .from('remito_items').delete().eq('id', itemId).eq('remito_id', remitoId)
  if (error) throw error
}

// ── Agregar material ──────────────────────────────────────────
export async function addMaterial(remitoId, body) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito?.estado !== 'BORRADOR') {
    const err = new Error('Solo se pueden agregar materiales a remitos en estado BORRADOR')
    err.status = 400; throw err
  }

  if (body.materialId) {
    const { data: mat } = await supabase
      .from('materiales').select('stock_actual, nombre').eq('id', body.materialId).single()
    if (mat.stock_actual < body.cantidad) {
      const err = new Error(`Stock insuficiente de "${mat.nombre}". Disponible: ${mat.stock_actual}`)
      err.status = 400; throw err
    }
  }

  const { data, error } = await supabase
    .from('remito_materiales')
    .insert({
      remito_id:         remitoId,
      material_id:       body.materialId       || null,
      descripcion_libre: body.descripcionLibre || null,
      cantidad:          body.cantidad,
      unidad:            body.unidad           || 'unidad',
      observacion:       body.observacion      || null,
    })
    .select().single()

  if (error) throw error
  return data
}

export async function removeMaterial(remitoId, materialItemId) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito?.estado !== 'BORRADOR') {
    const err = new Error('Solo se pueden quitar materiales de remitos en estado BORRADOR')
    err.status = 400; throw err
  }

  const { error } = await supabase
    .from('remito_materiales').delete()
    .eq('id', materialItemId).eq('remito_id', remitoId)
  if (error) throw error
}

// ── Avanzar estado ────────────────────────────────────────────
const TRANSICIONES = {
  BORRADOR:         'CONFIRMADO',
  CONFIRMADO:       'EN_TRANSITO',
  EN_TRANSITO:      'RECIBIDO_EN_OBRA',
  RECIBIDO_EN_OBRA: 'CERRADO',
}

export async function avanzarEstado(id, body = {}) {
  const { data: remito, error: errR } = await supabase
    .from('remitos').select('*').eq('id', id).single()
  if (errR) throw errR

  const nuevoEstado = TRANSICIONES[remito.estado]
  if (!nuevoEstado) {
    const err = new Error(`El remito ya está en estado final: ${remito.estado}`)
    err.status = 400; throw err
  }

  // Al confirmar EGRESO → validar que tenga al menos herramienta O material
  if (remito.estado === 'BORRADOR' && remito.tipo === 'EGRESO') {
    const [{ data: items }, { data: mats }] = await Promise.all([
      supabase.from('remito_items').select('id').eq('remito_id', id),
      supabase.from('remito_materiales').select('id').eq('remito_id', id),
    ])

    if (!items?.length && !mats?.length) {
      const err = new Error('El remito debe tener al menos una herramienta o un material antes de confirmar')
      err.status = 400; throw err
    }

    // Herramientas → EN_OBRA
    if (items?.length) {
      await supabase.from('herramientas')
        .update({ estado: 'EN_OBRA' })
        .in('id', items.map(i => i.herramienta_id))
    }

    // Descontar stock materiales catálogo
    const { data: matsConId } = await supabase
      .from('remito_materiales')
      .select('material_id, cantidad')
      .eq('remito_id', id)
      .not('material_id', 'is', null)

    for (const m of (matsConId ?? [])) {
      await updateStock(m.material_id, m.cantidad, 'descontar')
    }
  }

  // Al cerrar INGRESO → herramientas DISPONIBLE + reponer stock + cerrar egreso automáticamente
  if (remito.estado === 'RECIBIDO_EN_OBRA' && remito.tipo === 'INGRESO') {
    const { data: items } = await supabase
      .from('remito_items').select('herramienta_id').eq('remito_id', id)

    if (items?.length) {
      await supabase.from('herramientas')
        .update({ estado: 'DISPONIBLE' })
        .in('id', items.map(i => i.herramienta_id))
    }

    // Reponer stock materiales
    const { data: mats } = await supabase
      .from('remito_materiales')
      .select('material_id, cantidad')
      .eq('remito_id', id)
      .not('material_id', 'is', null)

    for (const m of (mats ?? [])) {
      await updateStock(m.material_id, m.cantidad, 'reponer')
    }

    // Cerrar el egreso de origen automáticamente
    if (remito.remito_origen_id) {
      await supabase.from('remitos')
        .update({ estado: 'CERRADO' })
        .eq('id', remito.remito_origen_id)
    }
  }

  // Actualizar retornos si vienen en el body
  if (body.retornos?.length && remito.estado === 'EN_TRANSITO') {
    for (const r of body.retornos) {
      await supabase.from('remito_items')
        .update({ estado_retorno: r.estadoRetorno, observacion: r.observacion || null })
        .eq('id', r.itemId)
    }
  }

  const { data, error } = await supabase
    .from('remitos').update({ estado: nuevoEstado }).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Crear ingreso desde egreso ────────────────────────────────
export async function crearIngreso(egresoId) {
  const { data: egreso, error: errE } = await supabase
    .from('remitos').select('*').eq('id', egresoId).single()
  if (errE) throw errE

  if (egreso.tipo !== 'EGRESO') {
    const err = new Error('Solo se puede crear un ingreso desde un egreso')
    err.status = 400; throw err
  }

  if (!['RECIBIDO_EN_OBRA','CERRADO'].includes(egreso.estado)) {
    const err = new Error('El egreso debe estar en estado RECIBIDO_EN_OBRA o CERRADO')
    err.status = 400; throw err
  }

  const numero = await generarNumero('INGRESO')

  const { data: ingreso, error: errI } = await supabase
    .from('remitos')
    .insert({
      numero,
      tipo:               'INGRESO',
      estado:             'BORRADOR',
      obra:               egreso.obra,
      responsable:        egreso.responsable,
      empresa_transporte: egreso.empresa_transporte,
      fecha:              new Date().toISOString().split('T')[0],
      remito_origen_id:   egresoId,
    })
    .select().single()
  if (errI) throw errI

  // Copiar herramientas del egreso
  const { data: itemsEgreso } = await supabase
    .from('remito_items').select('herramienta_id').eq('remito_id', egresoId)

  if (itemsEgreso?.length) {
    await supabase.from('remito_items').insert(
      itemsEgreso.map(i => ({ remito_id: ingreso.id, herramienta_id: i.herramienta_id }))
    )
  }

  // Copiar materiales del egreso
  const { data: matsEgreso } = await supabase
    .from('remito_materiales')
    .select('material_id, descripcion_libre, cantidad, unidad')
    .eq('remito_id', egresoId)

  if (matsEgreso?.length) {
    await supabase.from('remito_materiales').insert(
      matsEgreso.map(m => ({ ...m, remito_id: ingreso.id }))
    )
  }

  return ingreso
}

// ── Eliminar remito cerrado ───────────────────────────────────
export async function eliminar(id) {
  const { data: remito, error: errR } = await supabase
    .from('remitos').select('estado, tipo, remito_origen_id').eq('id', id).single()
  if (errR) throw errR

  if (remito.estado !== 'CERRADO') {
    const err = new Error('Solo se pueden eliminar remitos en estado CERRADO')
    err.status = 400; throw err
  }

  // Verificar que no haya herramientas del remito todavía en obra
  const { data: items } = await supabase
    .from('remito_items').select('herramienta_id').eq('remito_id', id)

  if (items?.length) {
    const ids = items.map(i => i.herramienta_id)
    const { data: herrsEnObra } = await supabase
      .from('herramientas').select('id').in('id', ids).eq('estado', 'EN_OBRA')

    if (herrsEnObra?.length) {
      const err = new Error('No se puede eliminar: hay herramientas del remito que aún están en obra')
      err.status = 400; throw err
    }
  }

  // Si es un egreso, verificar que el ingreso asociado esté cerrado
  if (remito.tipo === 'EGRESO') {
    const { data: ingresos } = await supabase
      .from('remitos')
      .select('id, estado')
      .eq('remito_origen_id', id)

    const ingresoPendiente = ingresos?.find(r => r.estado !== 'CERRADO')
    if (ingresoPendiente) {
      const err = new Error('No se puede eliminar: el remito de ingreso asociado no está cerrado')
      err.status = 400; throw err
    }
  }

  const { error } = await supabase.from('remitos').delete().eq('id', id)
  if (error) throw error
}
