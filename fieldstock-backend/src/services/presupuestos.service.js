// src/services/presupuestos.service.js
/**
 * Service del módulo Presupuestos.
 *
 * Flujo: BORRADOR → EN_APROBACION → APROBADO / RECHAZADO
 *
 * Side effects relevantes:
 *  · `obras.estado` — al aprobar pasa a ACTIVA; al rechazar (si TODOS los
 *     presupuestos están rechazados) pasa a RECHAZADA.
 *  · `remitos` (insert) — al aprobar se crea un remito BORRADOR con los
 *     insumos del presupuesto. El operador después completa transporte
 *     y responsable.
 *  · `presupuestos.subtotal_*` y `total` se recalculan via triggers SQL
 *     cuando cambian items o el % de ganancia (ver migration parte 1).
 *
 * Reglas:
 *  - Solo se pueden editar cabecera/items en BORRADOR.
 *  - EN_APROBACION solo puede volver a BORRADOR (no editable directo).
 *  - APROBADO y RECHAZADO son terminales — no se puede revertir.
 *  - Múltiples presupuestos por obra (versiones complementarias):
 *    cada uno APROBADO genera su propio remito BORRADOR.
 */
import { supabase } from '../config/supabase.js'

function bad(msg, status = 400) {
  const err = new Error(msg)
  err.status = status
  return err
}

// ── Helpers ───────────────────────────────────────────────────
async function generarNumero() {
  const { data, error } = await supabase.rpc('generar_numero_presupuesto')
  if (error) throw error
  return data
}

async function getCabecera(id) {
  const { data, error } = await supabase
    .from('presupuestos').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

// ── Listar presupuestos ───────────────────────────────────────
// Filtros: obraId (lo más común), estado.
export async function getAll({ obraId, estado } = {}) {
  let query = supabase
    .from('presupuestos')
    .select('*, obra:obras(id, nombre, cliente, direccion)')
    .order('created_at', { ascending: false })

  if (obraId) query = query.eq('obra_id', obraId)
  if (estado) query = query.eq('estado', estado)

  const { data, error } = await query
  if (error) throw error
  return data
}

// ── Detalle: cabecera + insumos + costos (en paralelo) ───────
export async function getById(id) {
  const [
    { data: presupuesto, error: errP },
    { data: insumos,     error: errI },
    { data: costos,      error: errC },
  ] = await Promise.all([
    supabase.from('presupuestos').select('*, obra:obras(id, nombre, cliente, direccion, cliente_id, cliente_rel:clientes!cliente_id(email))').eq('id', id).maybeSingle(),
    supabase.from('presupuesto_insumos').select('*, material:materiales(id, nombre, unidad, marca)').eq('presupuesto_id', id).order('created_at'),
    supabase.from('presupuesto_costos').select('*').eq('presupuesto_id', id).order('created_at'),
  ])
  if (errP) throw errP
  if (errI) throw errI
  if (errC) throw errC
  if (!presupuesto) return null

  // Issue menor 3.11: enriquecer con el aprobador. La FK aprobado_por
  // referencia auth.users (no la tabla `usuarios` publica), asi que
  // PostgREST no puede inferir el join inline. Hacemos query separada
  // contra `usuarios` (mirror del perfil con nombre y rol).
  let aprobador = null
  if (presupuesto.aprobado_por) {
    const { data: u } = await supabase
      .from('usuarios').select('id, nombre, role')
      .eq('id', presupuesto.aprobado_por).maybeSingle()
    aprobador = u ?? null
  }

  return { ...presupuesto, insumos: insumos ?? [], costos: costos ?? [], aprobador }
}

// ── Crear (arranca en BORRADOR) ──────────────────────────────
export async function create(body) {
  if (!body?.obraId) throw bad('obraId es obligatorio')

  // Validar que la obra existe
  const { data: obra, error: errObra } = await supabase
    .from('obras').select('id, estado').eq('id', body.obraId).maybeSingle()
  if (errObra) throw errObra
  if (!obra) throw bad('Obra no encontrada', 404)

  const numero = await generarNumero()

  // % ganancia: si vino en el body usarlo; sino tomar el default global
  let pct = body.porcentajeGanancia
  if (pct === undefined || pct === null || pct === '') {
    const { data: cfg } = await supabase
      .from('config_sistema').select('value').eq('key', 'porcentaje_ganancia_default').maybeSingle()
    pct = Number(cfg?.value ?? 10)
  } else {
    pct = Number(pct)
  }
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw bad('porcentajeGanancia debe ser un número entre 0 y 100')
  }

  const { data, error } = await supabase
    .from('presupuestos').insert({
      numero,
      obra_id:             body.obraId,
      estado:              'BORRADOR',
      porcentaje_ganancia: pct,
      observaciones:       body.observaciones || null,
    }).select().single()
  if (error) throw error

  // Sincronizar estado de la obra (issue 2.1). Caso típico que cubre:
  //   - Obra recién creada (ACTIVA por default) → pasa a PENDIENTE_PRESUPUESTO
  //     porque ahora tiene un BORRADOR.
  //   - Obra RECHAZADA (todos los presupuestos anteriores rechazados) →
  //     vuelve a PENDIENTE_PRESUPUESTO al sumar este BORRADOR nuevo.
  //   - Obra ACTIVA con presupuesto APROBADO previo → se mantiene ACTIVA
  //     (estados.has('APROBADO') gana en la cascada de sincronizar).
  // FINALIZADA nunca se sobrescribe (decisión manual final).
  await sincronizarEstadoObra(body.obraId)

  return data
}

// ── Editar cabecera (solo BORRADOR) ──────────────────────────
// Campos editables: porcentaje_ganancia, observaciones.
export async function update(id, body) {
  const cab = await getCabecera(id)
  if (!cab) throw bad('Presupuesto no encontrado', 404)
  if (cab.estado !== 'BORRADOR') throw bad('Solo se pueden editar presupuestos en BORRADOR')

  const campos = {}
  if (body.porcentajeGanancia !== undefined) {
    const pct = Number(body.porcentajeGanancia)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      throw bad('porcentajeGanancia debe ser un número entre 0 y 100')
    }
    campos.porcentaje_ganancia = pct
  }
  if (body.observaciones !== undefined) campos.observaciones = body.observaciones || null

  if (!Object.keys(campos).length) throw bad('No hay campos para actualizar')

  const { data, error } = await supabase
    .from('presupuestos').update(campos).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Eliminar (solo BORRADOR) ─────────────────────────────────
// Hard delete con cascade a insumos/costos. Storage del PDF NO se toca
// (si había PDF cargado queda huérfano pero ocupa < 5 MiB, lo aceptamos).
export async function remove(id) {
  const cab = await getCabecera(id)
  if (!cab) throw bad('Presupuesto no encontrado', 404)
  if (cab.estado !== 'BORRADOR') throw bad('Solo se pueden eliminar presupuestos en BORRADOR')

  const { error } = await supabase.from('presupuestos').delete().eq('id', id)
  if (error) throw error

  // Re-sincronizar la obra tras el delete (el set de presupuestos cambió,
  // el estado de la obra podría cambiar — ej. era el único BORRADOR y se
  // elimina, la obra vuelve a su estado anterior según los presupuestos
  // que queden).
  await sincronizarEstadoObra(cab.obra_id)
}

// ── Insumos (items materiales) ───────────────────────────────
export async function addInsumo(id, body) {
  const cab = await getCabecera(id)
  if (!cab) throw bad('Presupuesto no encontrado', 404)
  if (cab.estado !== 'BORRADOR') throw bad('Solo se pueden agregar insumos en BORRADOR')

  if (!body?.materialId) throw bad('materialId es obligatorio')
  const cantidad = Number(body.cantidad)
  const precio   = Number(body.precioUnitario)
  if (!Number.isFinite(cantidad) || cantidad <= 0) throw bad('cantidad debe ser > 0')
  if (!Number.isFinite(precio)   || precio   <  0) throw bad('precioUnitario debe ser >= 0')

  // Issue menor 3.7: validar que el material existe antes de insertar.
  // Sin esto, Postgres devuelve un FK violation críptico ("violates foreign
  // key constraint") en lugar de un 404 con mensaje legible.
  const { data: material, error: errMat } = await supabase
    .from('materiales').select('id').eq('id', body.materialId).maybeSingle()
  if (errMat) throw errMat
  if (!material) throw bad(`Material no encontrado (id: ${body.materialId})`, 404)

  const { data, error } = await supabase
    .from('presupuesto_insumos').insert({
      presupuesto_id:  id,
      material_id:     body.materialId,
      cantidad,
      precio_unitario: precio,
    }).select().single()
  if (error) throw error
  return data
}

export async function updateInsumo(id, insumoId, body) {
  const cab = await getCabecera(id)
  if (!cab) throw bad('Presupuesto no encontrado', 404)
  if (cab.estado !== 'BORRADOR') throw bad('Solo se pueden editar insumos en BORRADOR')

  const campos = {}
  if (body.cantidad !== undefined) {
    const c = Number(body.cantidad)
    if (!Number.isFinite(c) || c <= 0) throw bad('cantidad debe ser > 0')
    campos.cantidad = c
  }
  if (body.precioUnitario !== undefined) {
    const p = Number(body.precioUnitario)
    if (!Number.isFinite(p) || p < 0) throw bad('precioUnitario debe ser >= 0')
    campos.precio_unitario = p
  }
  if (!Object.keys(campos).length) throw bad('No hay campos para actualizar')

  const { data, error } = await supabase
    .from('presupuesto_insumos').update(campos)
    .eq('id', insumoId).eq('presupuesto_id', id)
    .select().single()
  if (error) throw error
  return data
}

export async function removeInsumo(id, insumoId) {
  const cab = await getCabecera(id)
  if (!cab) throw bad('Presupuesto no encontrado', 404)
  if (cab.estado !== 'BORRADOR') throw bad('Solo se pueden eliminar insumos en BORRADOR')

  const { error } = await supabase
    .from('presupuesto_insumos').delete()
    .eq('id', insumoId).eq('presupuesto_id', id)
  if (error) throw error
}

// ── Costos extra (mano de obra, viáticos, etc.) ──────────────
const CATEGORIAS_VALIDAS = new Set([
  'MANO_OBRA', 'VIATICOS', 'SEGUROS', 'PERSONAL_EXTRA', 'OTROS',
])

export async function addCosto(id, body) {
  const cab = await getCabecera(id)
  if (!cab) throw bad('Presupuesto no encontrado', 404)
  if (cab.estado !== 'BORRADOR') throw bad('Solo se pueden agregar costos en BORRADOR')

  if (!CATEGORIAS_VALIDAS.has(body?.categoria)) throw bad(`categoria inválida: ${body?.categoria}`)
  if (!body.descripcion?.trim()) throw bad('descripcion es obligatoria')
  const cantidad = Number(body.cantidad ?? 1)
  const costo    = Number(body.costoUnitario)
  if (!Number.isFinite(cantidad) || cantidad <= 0) throw bad('cantidad debe ser > 0')
  if (!Number.isFinite(costo)    || costo    <  0) throw bad('costoUnitario debe ser >= 0')

  const { data, error } = await supabase
    .from('presupuesto_costos').insert({
      presupuesto_id: id,
      categoria:      body.categoria,
      descripcion:    body.descripcion.trim(),
      cantidad,
      unidad:         body.unidad || null,
      costo_unitario: costo,
    }).select().single()
  if (error) throw error
  return data
}

export async function updateCosto(id, costoId, body) {
  const cab = await getCabecera(id)
  if (!cab) throw bad('Presupuesto no encontrado', 404)
  if (cab.estado !== 'BORRADOR') throw bad('Solo se pueden editar costos en BORRADOR')

  const campos = {}
  if (body.descripcion !== undefined) {
    if (!body.descripcion.trim()) throw bad('descripcion no puede quedar vacía')
    campos.descripcion = body.descripcion.trim()
  }
  if (body.cantidad !== undefined) {
    const c = Number(body.cantidad)
    if (!Number.isFinite(c) || c <= 0) throw bad('cantidad debe ser > 0')
    campos.cantidad = c
  }
  if (body.unidad         !== undefined) campos.unidad         = body.unidad || null
  if (body.costoUnitario  !== undefined) {
    const p = Number(body.costoUnitario)
    if (!Number.isFinite(p) || p < 0) throw bad('costoUnitario debe ser >= 0')
    campos.costo_unitario = p
  }
  if (!Object.keys(campos).length) throw bad('No hay campos para actualizar')

  const { data, error } = await supabase
    .from('presupuesto_costos').update(campos)
    .eq('id', costoId).eq('presupuesto_id', id)
    .select().single()
  if (error) throw error
  return data
}

export async function removeCosto(id, costoId) {
  const cab = await getCabecera(id)
  if (!cab) throw bad('Presupuesto no encontrado', 404)
  if (cab.estado !== 'BORRADOR') throw bad('Solo se pueden eliminar costos en BORRADOR')

  const { error } = await supabase
    .from('presupuesto_costos').delete()
    .eq('id', costoId).eq('presupuesto_id', id)
  if (error) throw error
}

// ── Transiciones de estado ────────────────────────────────────
// BORRADOR → EN_APROBACION
export async function enviarAprobacion(id) {
  const cab = await getCabecera(id)
  if (!cab) throw bad('Presupuesto no encontrado', 404)
  if (cab.estado !== 'BORRADOR') throw bad(`Solo BORRADOR puede enviarse a aprobación (actual: ${cab.estado})`)

  // Issue menor 3.1: bloquear envío si la obra ya está FINALIZADA.
  // Semánticamente raro aprobar un presupuesto de una obra cerrada — y
  // el sincronizarEstadoObra protege FINALIZADA igual, así que aprobar
  // no devolvería nada útil.
  const { data: obra } = await supabase
    .from('obras').select('estado').eq('id', cab.obra_id).maybeSingle()
  if (obra?.estado === 'FINALIZADA') {
    throw bad('No se puede enviar a aprobación: la obra ya está finalizada.')
  }

  // Validar que tenga al menos 1 item (insumo o costo)
  const [{ count: cInsumos }, { count: cCostos }] = await Promise.all([
    supabase.from('presupuesto_insumos').select('id', { count: 'exact', head: true }).eq('presupuesto_id', id),
    supabase.from('presupuesto_costos').select('id',  { count: 'exact', head: true }).eq('presupuesto_id', id),
  ])
  if ((cInsumos ?? 0) + (cCostos ?? 0) === 0) {
    throw bad('El presupuesto no tiene items. Agregá al menos un insumo o costo antes de enviar.')
  }

  const { data, error } = await supabase
    .from('presupuestos').update({
      estado: 'EN_APROBACION',
      fecha_envio: new Date().toISOString(),
    }).eq('id', id).select().single()
  if (error) throw error

  // Actualizar estado de la obra si es la primera en aprobación
  await sincronizarEstadoObra(cab.obra_id)
  return data
}

// EN_APROBACION → BORRADOR (rollback antes de aprobar/rechazar)
export async function volverABorrador(id) {
  const cab = await getCabecera(id)
  if (!cab) throw bad('Presupuesto no encontrado', 404)
  if (cab.estado !== 'EN_APROBACION') throw bad(`Solo EN_APROBACION puede volver a BORRADOR (actual: ${cab.estado})`)

  const { data, error } = await supabase
    .from('presupuestos').update({
      estado: 'BORRADOR',
      fecha_envio: null,
    }).eq('id', id).select().single()
  if (error) throw error

  await sincronizarEstadoObra(cab.obra_id)
  return data
}

// EN_APROBACION → APROBADO + genera remito BORRADOR con los insumos
//
// Implementado como RPC transaccional `aprobar_presupuesto(p_id, p_user_id)`
// (ver migration 2026_06_15_presupuestos_rls_y_rpc.sql). Antes esto eran
// 4 escrituras sucesivas sin transacción — si fallaba cualquiera después
// del insert del remito quedaba un remito huérfano y el presupuesto en
// EN_APROBACION, permitiendo re-aprobar y duplicar. La RPC envuelve todo
// en una sola transacción PL/pgSQL: si cualquier paso lanza excepción,
// Postgres revierte todos los cambios.
//
// Adicional: la RPC NO crea un remito si el presupuesto no tiene insumos
// (evita remitos vacíos que confunden al operador — issue 2.4).
export async function aprobar(id, userId) {
  // La RPC devuelve el uuid del remito generado (o NULL si el presupuesto
  // no tenia insumos). Lo usamos para que el frontend pueda abrir el
  // modal "configurar transporte y responsable" sobre ese remito.
  const { data: remitoId, error: errRpc } = await supabase.rpc('aprobar_presupuesto', {
    p_id:      id,
    p_user_id: userId || null,
  })
  if (errRpc) {
    // Postgres ERRCODE P0002 = "no_data_found", lo mapeamos a 404.
    // Cualquier otro raise (P0001 estado inválido) cae como 400.
    throw bad(errRpc.message, errRpc.code === 'P0002' ? 404 : 400)
  }

  // Re-leer el presupuesto + adjuntar el remitoGeneradoId (puede ser null
  // si el presupuesto no tenia insumos — no se genera remito en ese caso).
  const cabecera = await getCabecera(id)
  return { ...cabecera, remitoGeneradoId: remitoId || null }
}

// EN_APROBACION → RECHAZADO
export async function rechazar(id, motivo) {
  const cab = await getCabecera(id)
  if (!cab) throw bad('Presupuesto no encontrado', 404)
  if (cab.estado !== 'EN_APROBACION') throw bad(`Solo EN_APROBACION puede rechazarse (actual: ${cab.estado})`)

  const { data, error } = await supabase
    .from('presupuestos').update({
      estado:         'RECHAZADO',
      motivo_rechazo: motivo || null,
    }).eq('id', id).select().single()
  if (error) throw error

  await sincronizarEstadoObra(cab.obra_id)
  return data
}

// ── Sincronizar estado de la obra según sus presupuestos ─────
// Logica:
//   - hay alguno APROBADO → obra ACTIVA
//   - sino, hay alguno EN_APROBACION → obra EN_APROBACION
//   - sino, hay alguno BORRADOR → obra PENDIENTE_PRESUPUESTO
//   - sino, todos son RECHAZADO → obra RECHAZADA
//   - sin presupuestos + obra estaba en algún estado del flow de
//     presupuestos → volver a ACTIVA (caso: se eliminó el último
//     BORRADOR, la obra no debería quedar pegada en
//     PENDIENTE_PRESUPUESTO con 0 presupuestos).
// FINALIZADA no se sobrescribe nunca (es decisión manual final).
async function sincronizarEstadoObra(obraId) {
  const { data: obra } = await supabase
    .from('obras').select('estado').eq('id', obraId).maybeSingle()
  if (!obra || obra.estado === 'FINALIZADA') return

  const { data: presupuestos } = await supabase
    .from('presupuestos').select('estado').eq('obra_id', obraId)

  // Si quedó sin presupuestos y la obra estaba en algún estado del flow
  // de presupuestos, vuelve a ACTIVA. Si ya era ACTIVA, no toca nada.
  if (!presupuestos?.length) {
    const ESTADOS_FLOW_PRESUP = ['PENDIENTE_PRESUPUESTO', 'EN_APROBACION', 'RECHAZADA']
    if (ESTADOS_FLOW_PRESUP.includes(obra.estado)) {
      await supabase.from('obras').update({ estado: 'ACTIVA' }).eq('id', obraId)
    }
    return
  }

  const estados = new Set(presupuestos.map(p => p.estado))
  let nuevoEstado
  if      (estados.has('APROBADO'))      nuevoEstado = 'ACTIVA'
  else if (estados.has('EN_APROBACION')) nuevoEstado = 'EN_APROBACION'
  else if (estados.has('BORRADOR'))      nuevoEstado = 'PENDIENTE_PRESUPUESTO'
  else                                    nuevoEstado = 'RECHAZADA'

  if (nuevoEstado === obra.estado) return

  await supabase.from('obras').update({ estado: nuevoEstado }).eq('id', obraId)
}

// ── PDF ──────────────────────────────────────────────────────
const BUCKET_PDF = 'presupuestos-pdf'
const SIGNED_URL_TTL_SEC = 3600

export async function uploadPdf(id, { buffer, mimetype }) {
  if (mimetype !== 'application/pdf') throw bad('El comprobante debe ser PDF')
  if (!buffer || buffer.length === 0)  throw bad('Archivo vacío')
  if (buffer.length > 5 * 1024 * 1024) throw bad('PDF supera 5 MB')

  const cab = await getCabecera(id)
  if (!cab) throw bad('Presupuesto no encontrado', 404)

  const path = `${cab.numero}-${Date.now()}.pdf`

  // Borrar el viejo si existía (no acumular huérfanos)
  if (cab.pdf_url) {
    await supabase.storage.from(BUCKET_PDF).remove([cab.pdf_url]).catch(() => {})
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET_PDF).upload(path, buffer, { contentType: mimetype, upsert: false })
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('presupuestos').update({ pdf_url: path }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function getPdfSignedUrl(id) {
  const cab = await getCabecera(id)
  if (!cab) throw bad('Presupuesto no encontrado', 404)
  if (!cab.pdf_url) return null

  const { data, error } = await supabase.storage
    .from(BUCKET_PDF).createSignedUrl(cab.pdf_url, SIGNED_URL_TTL_SEC)
  if (error) throw error
  return { url: data.signedUrl, path: cab.pdf_url, expiresIn: SIGNED_URL_TTL_SEC }
}
