// src/services/remitos.service.js
import { supabase } from '../config/supabase.js'
import { updateStock } from './materiales.service.js'

// ── Generar número ────────────────────────────────────────────
async function generarNumero() {
  const { data, error } = await supabase.rpc('generar_numero_remito')
  if (error) throw error
  return data
}

// ── Transiciones de estado ────────────────────────────────────
const TRANSICIONES = {
  BORRADOR:            'CONFIRMADO',
  CONFIRMADO:          'EN_TRANSITO',
  EN_TRANSITO:         'EN_OBRA',
  EN_OBRA:             'EN_RETORNO',
  EN_RETORNO:          'EN_TRANSITO_RETORNO',
  EN_TRANSITO_RETORNO: 'CERRADO',
}

// ── Listar ────────────────────────────────────────────────────
export async function getAll({ estado, q } = {}) {
  let query = supabase
    .from('remitos_resumen')
    .select('*')
    .order('fecha_egreso', { ascending: false })

  if (estado) query = query.eq('estado', estado)
  if (q)      query = query.or(`obra.ilike.%${q}%,numero.ilike.%${q}%`)

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
  const numero = await generarNumero()

  const { data, error } = await supabase
    .from('remitos')
    .insert({
      numero,
      estado:             'BORRADOR',
      obra:               body.obra,
      responsable:        body.responsable,
      empresa_transporte: body.empresaTransporte || null,
      transporte_id:      body.transporteId      || null,
      cliente_id:         body.clienteId         || null,
      fecha_egreso:       body.fechaEgreso || new Date().toISOString().split('T')[0],
      observacion:        body.observacion || null,
    })
    .select().single()

  if (error) throw error
  return data
}

// ── Editar remito (solo BORRADOR o CONFIRMADO) ────────────────
export async function update(id, body) {
  const { data: remito, error: errR } = await supabase
    .from('remitos').select('estado').eq('id', id).single()
  if (errR) throw errR

  if (!['BORRADOR', 'CONFIRMADO'].includes(remito.estado)) {
    const err = new Error('Solo se pueden editar remitos en estado BORRADOR o CONFIRMADO')
    err.status = 400; throw err
  }

  const campos = {}
  if (body.obra              !== undefined) campos.obra               = body.obra
  if (body.responsable       !== undefined) campos.responsable        = body.responsable
  if (body.empresaTransporte !== undefined) campos.empresa_transporte = body.empresaTransporte || null
  if (body.fechaEgreso       !== undefined) campos.fecha_egreso       = body.fechaEgreso
  if (body.observacion       !== undefined) campos.observacion        = body.observacion || null

  if (!Object.keys(campos).length) {
    const err = new Error('No hay campos para actualizar')
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('remitos').update(campos).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Volver a Borrador ─────────────────────────────────────────
export async function volverABorrador(id) {
  const { data: remito, error: errR } = await supabase
    .from('remitos').select('estado').eq('id', id).single()
  if (errR) throw errR

  // Solo se puede volver a borrador desde CONFIRMADO
  if (remito.estado !== 'CONFIRMADO') {
    const err = new Error('Solo se puede volver a Borrador desde estado CONFIRMADO')
    err.status = 400; throw err
  }

  // Herramientas → DISPONIBLE
  const { data: items } = await supabase
    .from('remito_items').select('herramienta_id').eq('remito_id', id)

  if (items?.length) {
    await supabase.from('herramientas')
      .update({ estado: 'DISPONIBLE' })
      .in('id', items.map(i => i.herramienta_id))
  }

  // Reponer stock materiales del catálogo
  const { data: mats } = await supabase
    .from('remito_materiales')
    .select('material_id, cantidad_egreso')
    .eq('remito_id', id)
    .not('material_id', 'is', null)

  for (const m of (mats ?? [])) {
    await updateStock(m.material_id, m.cantidad_egreso, 'reponer')
  }

  // Volver a BORRADOR
  const { data, error } = await supabase
    .from('remitos').update({ estado: 'BORRADOR' }).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Agregar herramienta ───────────────────────────────────────
export async function addItem(remitoId, body) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito.estado !== 'BORRADOR') {
    const err = new Error('Solo se pueden agregar herramientas en estado BORRADOR')
    err.status = 400; throw err
  }

  const { data: herr } = await supabase
    .from('herramientas').select('estado, nombre').eq('id', body.herramientaId).single()

  if (herr?.estado !== 'DISPONIBLE') {
    const err = new Error(`La herramienta "${herr?.nombre}" no está disponible`)
    err.status = 400; throw err
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
    const err = new Error('Solo se pueden quitar herramientas en estado BORRADOR')
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
    const err = new Error('Solo se pueden agregar materiales en estado BORRADOR')
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
      cantidad_egreso:   body.cantidad,
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
    const err = new Error('Solo se pueden quitar materiales en estado BORRADOR')
    err.status = 400; throw err
  }

  const { error } = await supabase
    .from('remito_materiales').delete()
    .eq('id', materialItemId).eq('remito_id', remitoId)
  if (error) throw error
}

// ── Actualizar estado de retorno de herramienta ───────────────
export async function updateItemRetorno(remitoId, itemId, body) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito?.estado !== 'EN_RETORNO') {
    const err = new Error('Solo se puede actualizar el retorno en estado EN_RETORNO')
    err.status = 400; throw err
  }

  const ESTADOS_VALIDOS = ['VUELVE','QUEDA_EN_OBRA','PERDIDA','ROTA']
  if (!ESTADOS_VALIDOS.includes(body.estadoRetorno)) {
    const err = new Error(`Estado de retorno inválido: ${body.estadoRetorno}`)
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('remito_items')
    .update({ estado_retorno: body.estadoRetorno, observacion: body.observacion || null })
    .eq('id', itemId).eq('remito_id', remitoId)
    .select().single()

  if (error) throw error
  return data
}

// ── Actualizar cantidad de retorno de material ────────────────
export async function updateMaterialRetorno(remitoId, materialItemId, body) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito?.estado !== 'EN_RETORNO') {
    const err = new Error('Solo se puede actualizar el retorno en estado EN_RETORNO')
    err.status = 400; throw err
  }

  if (body.cantidadRetorno < 0) {
    const err = new Error('La cantidad de retorno no puede ser negativa')
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('remito_materiales')
    .update({ cantidad_retorno: body.cantidadRetorno, observacion: body.observacion || null })
    .eq('id', materialItemId).eq('remito_id', remitoId)
    .select().single()

  if (error) throw error
  return data
}

// ── Avanzar estado ────────────────────────────────────────────
export async function avanzarEstado(id, body = {}) {
  const { data: remito, error: errR } = await supabase
    .from('remitos').select('*').eq('id', id).single()
  if (errR) throw errR

  const nuevoEstado = TRANSICIONES[remito.estado]
  if (!nuevoEstado) {
    const err = new Error(`El remito ya está en estado final: ${remito.estado}`)
    err.status = 400; throw err
  }

  // BORRADOR → CONFIRMADO
  if (remito.estado === 'BORRADOR') {
    const [{ data: items }, { data: mats }] = await Promise.all([
      supabase.from('remito_items').select('id, herramienta_id').eq('remito_id', id),
      supabase.from('remito_materiales').select('id').eq('remito_id', id),
    ])

    if (!items?.length && !mats?.length) {
      const err = new Error('El remito debe tener al menos una herramienta o un material')
      err.status = 400; throw err
    }

    if (items?.length) {
      await supabase.from('herramientas')
        .update({ estado: 'EN_OBRA' })
        .in('id', items.map(i => i.herramienta_id))
    }

    const { data: matsConId } = await supabase
      .from('remito_materiales')
      .select('material_id, cantidad_egreso')
      .eq('remito_id', id)
      .not('material_id', 'is', null)

    for (const m of (matsConId ?? [])) {
      await updateStock(m.material_id, m.cantidad_egreso, 'descontar')
    }
  }

  // EN_RETORNO → EN_TRANSITO_RETORNO
  if (remito.estado === 'EN_RETORNO') {
    const { data: items } = await supabase
      .from('remito_items').select('id, estado_retorno').eq('remito_id', id)

    const sinRetorno = items?.filter(i => !i.estado_retorno)
    if (sinRetorno?.length) {
      const err = new Error(`Faltan definir el estado de retorno de ${sinRetorno.length} herramienta(s)`)
      err.status = 400; throw err
    }

    await supabase.from('remitos')
      .update({ fecha_retorno: new Date().toISOString().split('T')[0] })
      .eq('id', id)
  }

  // EN_TRANSITO_RETORNO → CERRADO
  if (remito.estado === 'EN_TRANSITO_RETORNO') {
    const { data: items } = await supabase
      .from('remito_items').select('herramienta_id, estado_retorno').eq('remito_id', id)

    for (const item of (items ?? [])) {
      if (item.estado_retorno === 'VUELVE') {
        await supabase.from('herramientas')
          .update({ estado: 'DISPONIBLE' }).eq('id', item.herramienta_id)
      } else if (item.estado_retorno === 'ROTA') {
        await supabase.from('herramientas')
          .update({ estado: 'EN_MANTENIMIENTO' }).eq('id', item.herramienta_id)
      } else if (item.estado_retorno === 'PERDIDA') {
        await supabase.rpc('dar_baja_herramienta', {
          p_id: item.herramienta_id,
          p_motivo: 'Pérdida registrada en remito ' + remito.numero
        })
      }
    }

    const { data: mats } = await supabase
      .from('remito_materiales')
      .select('material_id, cantidad_retorno')
      .eq('remito_id', id)
      .not('material_id', 'is', null)
      .not('cantidad_retorno', 'is', null)
      .gt('cantidad_retorno', 0)

    for (const m of (mats ?? [])) {
      await updateStock(m.material_id, m.cantidad_retorno, 'reponer')
    }

    // Materiales libres que vuelven → agregar al catálogo
    const { data: matsLibres } = await supabase
      .from('remito_materiales')
      .select('descripcion_libre, cantidad_retorno, unidad')
      .eq('remito_id', id)
      .is('material_id', null)
      .not('cantidad_retorno', 'is', null)
      .gt('cantidad_retorno', 0)

    for (const m of (matsLibres ?? [])) {
      const { data: existente } = await supabase
        .from('materiales').select('id, stock_actual')
        .ilike('nombre', m.descripcion_libre)
        .maybeSingle()

      if (existente) {
        await supabase.from('materiales')
          .update({ stock_actual: existente.stock_actual + m.cantidad_retorno })
          .eq('id', existente.id)
      } else {
        await supabase.from('materiales').insert({
          nombre:       m.descripcion_libre,
          unidad:       m.unidad || 'unidad',
          stock_actual: m.cantidad_retorno,
          stock_minimo: 0,
          descripcion:  'Creado automáticamente desde retorno de remito',
        })
      }
    }

    if (body.observacionRetorno) {
      await supabase.from('remitos')
        .update({ observacion_retorno: body.observacionRetorno })
        .eq('id', id)
    }
  }

  const { data, error } = await supabase
    .from('remitos').update({ estado: nuevoEstado }).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Eliminar remito cerrado ───────────────────────────────────
export async function eliminar(id) {
  const { data: remito, error: errR } = await supabase
    .from('remitos').select('estado').eq('id', id).single()
  if (errR) throw errR

  if (remito.estado !== 'CERRADO') {
    const err = new Error('Solo se pueden eliminar remitos en estado CERRADO')
    err.status = 400; throw err
  }

  const { data: items } = await supabase
    .from('remito_items').select('herramienta_id').eq('remito_id', id)

  if (items?.length) {
    const { data: herrsEnObra } = await supabase
      .from('herramientas').select('id')
      .in('id', items.map(i => i.herramienta_id))
      .eq('estado', 'EN_OBRA')

    if (herrsEnObra?.length) {
      const err = new Error('No se puede eliminar: hay herramientas del remito que aún están en obra')
      err.status = 400; throw err
    }
  }

  const { error } = await supabase.from('remitos').delete().eq('id', id)
  if (error) throw error
}
