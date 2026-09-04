// src/services/obraHistorial.service.js
/**
 * Historial de Obra — consolida, para una obra (normalmente FINALIZADA),
 * todo lo que pasó en ella. Ver _plans/historial-obra/architecture.html
 * e implementation.html.
 *
 * getHistorial() es de solo lectura y agrega de fuentes que ya existen
 * (remitos, presupuestos, herramientas) más 3 datos que antes no se
 * registraban en ningún lado: horas hombre, inconvenientes, costos no
 * anticipados, y las fotos de plano/croquis de Kits de Montaje.
 *
 * "Insumos utilizados" vs "insumos presupuestados": se muestran separados
 * a propósito. Cuando un presupuesto se aprueba genera un remito con los
 * mismos insumos copiados — sumar ambos en un solo total los contaría dos
 * veces. remito_materiales es la fuente de verdad de lo que físicamente
 * salió del depósito; presupuesto_insumos queda como referencia de lo
 * cotizado.
 */
import { supabase } from '../config/supabase.js'

function bad(msg, status = 400) { const err = new Error(msg); err.status = status; return err }

const BUCKET_PLANOS = 'planos-obra'
const SIGNED_URL_TTL_SEC = 3600
const MAX_PLANO_BYTES = 8 * 1024 * 1024
const MIMES_PLANO = new Set(['image/jpeg', 'image/png'])

function extDeMime(mime) {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png')  return 'png'
  return 'bin'
}

function diasEntre(desde, hasta) {
  if (!desde || !hasta) return null
  const ms = new Date(hasta) - new Date(desde)
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)))
}

/**
 * Agrega todo el historial de una obra. Pura lectura.
 */
export async function getHistorial(obraId) {
  const { data: obra, error: errObra } = await supabase
    .from('obras')
    .select('id, nombre, fecha_inicio, fecha_fin, estado, horas_hombre')
    .eq('id', obraId)
    .maybeSingle()
  if (errObra) throw errObra
  if (!obra) throw bad('Obra no encontrada', 404)

  const { data: remitos, error: errR } = await supabase
    .from('remitos').select('id, numero, estado').eq('obra_id', obraId)
  if (errR) throw errR
  const remitoIds = (remitos || []).map(r => r.id)

  const { data: presupuestos, error: errP } = await supabase
    .from('presupuestos').select('id, numero, estado').eq('obra_id', obraId)
  if (errP) throw errP
  const presupuestoIds = (presupuestos || []).map(p => p.id)

  const [
    insumosUtilizados,
    herramientasUsadas,
    insumosPresupuestados,
    manoObra,
    planos,
    inconvenientes,
    costosNoAnticipados,
  ] = await Promise.all([
    getInsumosUtilizados(remitoIds),
    getHerramientasUsadas(remitoIds, obra),
    getInsumosPresupuestados(presupuestoIds),
    getManoObra(presupuestoIds),
    getPlanos(obraId),
    supabase.from('obra_inconvenientes').select('id, descripcion, created_at').eq('obra_id', obraId)
      .then(({ data, error }) => { if (error) throw error; return data || [] }),
    supabase.from('obra_costos_no_anticipados').select('id, descripcion, monto, created_at').eq('obra_id', obraId)
      .then(({ data, error }) => { if (error) throw error; return data || [] }),
  ])

  return {
    obra: {
      id: obra.id,
      nombre: obra.nombre,
      estado: obra.estado,
      fechaInicio: obra.fecha_inicio,
      fechaFin: obra.fecha_fin,
      duracionDias: diasEntre(obra.fecha_inicio, obra.fecha_fin),
      horasHombre: obra.horas_hombre,
    },
    remitos: (remitos || []).map(r => ({ id: r.id, numero: r.numero, estado: r.estado })),
    presupuestos: (presupuestos || []).map(p => ({ id: p.id, numero: p.numero, estado: p.estado })),
    insumosUtilizados,
    insumosPresupuestados,
    manoObra,
    herramientas: herramientasUsadas,
    planos,
    inconvenientes,
    costosNoAnticipados,
  }
}

async function getInsumosUtilizados(remitoIds) {
  if (!remitoIds.length) return []
  const { data, error } = await supabase
    .from('remito_materiales')
    .select('material_id, descripcion_libre, cantidad_egreso, unidad, materiales(nombre)')
    .in('remito_id', remitoIds)
  if (error) throw error
  return (data || []).map(m => ({
    materialId: m.material_id,
    nombre: m.materiales?.nombre || m.descripcion_libre || '(sin nombre)',
    cantidad: Number(m.cantidad_egreso) || 0,
    unidad: m.unidad || 'unidad',
  }))
}

async function getInsumosPresupuestados(presupuestoIds) {
  if (!presupuestoIds.length) return []
  const { data, error } = await supabase
    .from('presupuesto_insumos')
    .select('material_id, cantidad, materiales(nombre, unidad)')
    .in('presupuesto_id', presupuestoIds)
  if (error) throw error
  return (data || []).map(i => ({
    materialId: i.material_id,
    nombre: i.materiales?.nombre || '(material eliminado)',
    cantidad: Number(i.cantidad) || 0,
    unidad: i.materiales?.unidad || 'unidad',
  }))
}

async function getManoObra(presupuestoIds) {
  if (!presupuestoIds.length) return []
  const { data, error } = await supabase
    .from('presupuesto_costos')
    .select('descripcion, cantidad, costo_unitario, subtotal')
    .in('presupuesto_id', presupuestoIds)
    .eq('categoria', 'MANO_OBRA')
  if (error) throw error
  return (data || []).map(c => ({
    descripcion: c.descripcion,
    cantidad: Number(c.cantidad),
    costoUnitario: Number(c.costo_unitario),
    subtotal: Number(c.subtotal),
  }))
}

// Herramientas usadas en esta obra (via remito_items) y, de esas, cuáles
// están dadas de baja CON la fecha de baja dentro del rango de vida de
// esta obra — una herramienta reutilizada en una obra posterior no le
// carga su rotura a esta.
async function getHerramientasUsadas(remitoIds, obra) {
  if (!remitoIds.length) return []
  const { data: items, error } = await supabase
    .from('remito_items')
    .select('herramienta_id, herramientas(id, nombre, estado, fecha_baja, motivo_baja)')
    .in('remito_id', remitoIds)
  if (error) throw error

  const desde = obra.fecha_inicio ? new Date(obra.fecha_inicio) : null
  const hasta = obra.fecha_fin ? new Date(obra.fecha_fin) : new Date()

  const porId = new Map()
  for (const it of (items || [])) {
    const h = it.herramientas
    if (!h || porId.has(h.id)) continue

    let rotaEnEstaObra = false
    if (h.estado === 'BAJA' && h.fecha_baja) {
      const fechaBaja = new Date(h.fecha_baja)
      rotaEnEstaObra = (!desde || fechaBaja >= desde) && fechaBaja <= hasta
    }

    porId.set(h.id, {
      herramientaId: h.id,
      nombre: h.nombre,
      rotaEnEstaObra,
      motivoBaja: rotaEnEstaObra ? h.motivo_baja : null,
    })
  }
  return Array.from(porId.values())
}

async function getPlanos(obraId) {
  const { data, error } = await supabase
    .from('obra_planos').select('id, storage_path, created_at').eq('obra_id', obraId)
  if (error) throw error
  if (!data?.length) return []

  const conUrl = await Promise.all(data.map(async p => {
    const { data: signed, error: errSign } = await supabase.storage
      .from(BUCKET_PLANOS).createSignedUrl(p.storage_path, SIGNED_URL_TTL_SEC)
    // Best-effort: si un archivo puntual no puede firmarse (borrado a mano
    // del bucket, etc.) no rompemos el historial entero.
    return { id: p.id, url: errSign ? null : signed.signedUrl, createdAt: p.created_at }
  }))
  return conUrl
}

/**
 * Registra los datos manuales del cierre de obra. Todos los campos son
 * opcionales — se puede finalizar sin cargar nada, igual que antes de
 * esta feature.
 */
export async function registrarCierre(obraId, { horasHombre, inconvenientes, costosNoAnticipados } = {}) {
  if (horasHombre !== undefined && horasHombre !== null) {
    const h = Number(horasHombre)
    if (!Number.isFinite(h) || h < 0) throw bad('horasHombre debe ser 0 o mayor')
    const { error } = await supabase.from('obras').update({ horas_hombre: h }).eq('id', obraId)
    if (error) throw error
  }

  if (Array.isArray(inconvenientes) && inconvenientes.length) {
    const filas = inconvenientes
      .map(d => (d || '').trim())
      .filter(Boolean)
      .map(descripcion => ({ obra_id: obraId, descripcion }))
    if (filas.length) {
      const { error } = await supabase.from('obra_inconvenientes').insert(filas)
      if (error) throw error
    }
  }

  if (Array.isArray(costosNoAnticipados) && costosNoAnticipados.length) {
    const filas = costosNoAnticipados
      .filter(c => c?.descripcion?.trim() && Number.isFinite(Number(c.monto)) && Number(c.monto) >= 0)
      .map(c => ({ obra_id: obraId, descripcion: c.descripcion.trim(), monto: Number(c.monto) }))
    if (filas.length) {
      const { error } = await supabase.from('obra_costos_no_anticipados').insert(filas)
      if (error) throw error
    }
  }
}

/**
 * Sube la foto de un croquis/plano usado en Kits de Montaje y la liga a
 * la obra. Llamado desde armado.service.js — best-effort, un fallo acá
 * nunca debe bloquear la confirmación del presupuesto/remito.
 */
export async function agregarPlano(obraId, { buffer, mimeType }) {
  if (!buffer?.length) return null
  if (buffer.length > MAX_PLANO_BYTES) throw bad('La foto supera 8 MB')
  if (!MIMES_PLANO.has(mimeType)) throw bad(`Tipo no permitido: ${mimeType}. Use JPG o PNG.`)

  const path = `${obraId}/${Date.now()}.${extDeMime(mimeType)}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET_PLANOS).upload(path, buffer, { contentType: mimeType, upsert: false })
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('obra_planos').insert({ obra_id: obraId, storage_path: path }).select().single()
  if (error) throw error
  return data
}
