// src/services/suscripcion.service.js
/**
 * Estado de la suscripción de esta instancia (sistema single-tenant: una
 * sola fila viva en `suscripcion`, se actualiza in-place).
 *
 * El estado "efectivo" (lo que realmente determina si se puede usar el
 * sistema) se calcula al vuelo a partir de fechas — no depende de un cron
 * que vaya degradando el estado guardado. Esto evita que alguien quede con
 * acceso de más solo porque todavía no corrió un job nocturno.
 *
 * Ciclo: PRUEBA (7 días, sin gracia al vencer) → ACTIVA (mientras Mercado
 * Pago siga cobrando) → VENCIDA (dejó de cobrar, período de gracia) →
 * BLOQUEADA (se acabó la gracia, o la prueba venció sin elegir plan).
 */
import { supabase } from '../config/supabase.js'
import * as PlanesService from './planes.service.js'
import * as MercadoPagoService from './mercadopago.service.js'

export const DIAS_PRUEBA  = 7
export const DIAS_GRACIA  = 5

const SELECT = `
  id, plan_id, estado, fecha_inicio_prueba, fecha_fin_prueba, fecha_vencimiento,
  mp_preapproval_id, mp_payer_id, creado_por, created_at, updated_at,
  plan:planes(*)
`

function diasEntre(desde, hasta) {
  return (hasta.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24)
}

/**
 * Deriva el estado real a partir de la fila cruda + la fecha actual. Pura
 * (no toca la DB) — la usa tanto el middleware de gating como la pantalla
 * de Facturación para no tener dos implementaciones del mismo cálculo.
 */
export function calcularEstadoEfectivo(suscripcion, ahora = new Date()) {
  if (!suscripcion) return 'BLOQUEADA'

  if (suscripcion.estado === 'PRUEBA') {
    if (suscripcion.fecha_fin_prueba && ahora > new Date(suscripcion.fecha_fin_prueba)) {
      return 'BLOQUEADA' // la prueba no tiene gracia — o eligen plan, o se corta
    }
    return 'PRUEBA'
  }

  if (suscripcion.estado === 'ACTIVA' || suscripcion.estado === 'VENCIDA') {
    if (suscripcion.fecha_vencimiento && ahora > new Date(suscripcion.fecha_vencimiento)) {
      const dias = diasEntre(new Date(suscripcion.fecha_vencimiento), ahora)
      return dias > DIAS_GRACIA ? 'BLOQUEADA' : 'VENCIDA'
    }
    return 'ACTIVA'
  }

  return 'BLOQUEADA'
}

export async function getActual() {
  const { data, error } = await supabase
    .from('suscripcion')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Estado + metadata lista para mostrar en /facturacion. */
export async function getEstado() {
  const suscripcion = await getActual()
  const estadoEfectivo = calcularEstadoEfectivo(suscripcion)

  let diasRestantesPrueba = null
  if (suscripcion?.estado === 'PRUEBA' && suscripcion.fecha_fin_prueba) {
    diasRestantesPrueba = Math.max(0, Math.ceil(diasEntre(new Date(), new Date(suscripcion.fecha_fin_prueba))))
  }

  return { ...suscripcion, estadoEfectivo, diasRestantesPrueba }
}

export async function crearPrueba(creadoPor) {
  const ahora = new Date()
  const finPrueba = new Date(ahora.getTime() + DIAS_PRUEBA * 24 * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('suscripcion')
    .insert({
      estado: 'PRUEBA',
      fecha_inicio_prueba: ahora.toISOString(),
      fecha_fin_prueba: finPrueba.toISOString(),
      creado_por: creadoPor,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function elegirPlan({ codigoPlan, payerEmail, backUrl }) {
  const plan = await PlanesService.getByCodigo(codigoPlan)
  if (!plan) {
    const err = new Error('Plan inválido'); err.status = 400; throw err
  }
  if (plan.precio_mensual == null) {
    const err = new Error(`El plan "${plan.nombre}" es a medida — escribinos para coordinarlo, no tiene alta automática.`)
    err.status = 400; throw err
  }

  const suscripcion = await getActual()
  if (!suscripcion) {
    const err = new Error('No hay una suscripción para esta instancia'); err.status = 404; throw err
  }

  const mp = await MercadoPagoService.crearPreapproval({
    reason: `FieldStock AI — Plan ${plan.nombre}`,
    payerEmail,
    transactionAmount: Number(plan.precio_mensual),
    backUrl,
    externalReference: suscripcion.id,
  })

  const { error } = await supabase
    .from('suscripcion')
    .update({ plan_id: plan.id, mp_preapproval_id: mp.id, updated_at: new Date().toISOString() })
    .eq('id', suscripcion.id)
  if (error) throw error

  return { initPoint: mp.init_point }
}

export async function cancelar() {
  const suscripcion = await getActual()
  if (!suscripcion?.mp_preapproval_id) {
    const err = new Error('No hay una suscripción activa de Mercado Pago para cancelar')
    err.status = 400; throw err
  }

  await MercadoPagoService.cancelarPreapproval(suscripcion.mp_preapproval_id)

  const { error } = await supabase
    .from('suscripcion')
    .update({ estado: 'BLOQUEADA', updated_at: new Date().toISOString() })
    .eq('id', suscripcion.id)
  if (error) throw error

  await registrarEvento({ tipo: 'CANCELACION', mpPreapprovalId: suscripcion.mp_preapproval_id })
}

async function registrarEvento({ tipo, mpPaymentId = null, mpPreapprovalId = null, monto = null, estadoMp = null, payload = null }) {
  // Idempotencia: si ya procesamos este mismo pago (mp_payment_id), no lo
  // insertamos de nuevo — Mercado Pago puede reintentar el mismo webhook.
  if (mpPaymentId) {
    const { data: existente } = await supabase
      .from('eventos_pago').select('id').eq('mp_payment_id', mpPaymentId).maybeSingle()
    if (existente) return
  }

  const { error } = await supabase
    .from('eventos_pago')
    .insert({ tipo, mp_payment_id: mpPaymentId, mp_preapproval_id: mpPreapprovalId, monto, estado_mp: estadoMp, payload })
  if (error) throw error
}

// Mapea el status de un preapproval de MP a nuestro enum de estado.
const ESTADO_PREAPPROVAL_MP = {
  authorized: 'ACTIVA',
  paused:     'VENCIDA',
  cancelled:  'BLOQUEADA',
}

/**
 * Procesa una notificación de webhook. NO confía en el body de la
 * notificación — solo usa `type` + `data.id` para volver a pedirle el
 * recurso completo a la API de MP, y con esa respuesta fresca actualiza
 * todo. Tira 401 si la firma no valida.
 */
export async function procesarWebhook({ type, dataId, headers, query }) {
  if (!MercadoPagoService.validarFirmaWebhook(headers, dataId)) {
    const err = new Error('Firma de webhook inválida'); err.status = 401; throw err
  }

  const suscripcion = await getActual()
  if (!suscripcion) return // no hay nada que actualizar en esta instancia

  if (type === 'preapproval') {
    const mp = await MercadoPagoService.obtenerPreapproval(dataId)
    const estado = ESTADO_PREAPPROVAL_MP[mp.status] || suscripcion.estado

    const { error } = await supabase
      .from('suscripcion')
      .update({
        estado,
        mp_payer_id: mp.payer_id ? String(mp.payer_id) : suscripcion.mp_payer_id,
        fecha_vencimiento: mp.next_payment_date || suscripcion.fecha_vencimiento,
        updated_at: new Date().toISOString(),
      })
      .eq('id', suscripcion.id)
    if (error) throw error

    await registrarEvento({
      tipo: mp.status === 'cancelled' ? 'CANCELACION' : 'ALTA',
      mpPreapprovalId: mp.id, estadoMp: mp.status, payload: mp,
    })
    return
  }

  if (type === 'payment') {
    const mp = await MercadoPagoService.obtenerPago(dataId)

    if (mp.status === 'approved') {
      const proximoVencimiento = new Date()
      proximoVencimiento.setMonth(proximoVencimiento.getMonth() + 1)

      const { error } = await supabase
        .from('suscripcion')
        .update({ estado: 'ACTIVA', fecha_vencimiento: proximoVencimiento.toISOString(), updated_at: new Date().toISOString() })
        .eq('id', suscripcion.id)
      if (error) throw error

      await registrarEvento({ tipo: 'COBRO', mpPaymentId: String(mp.id), monto: mp.transaction_amount, estadoMp: mp.status, payload: mp })
    } else {
      await registrarEvento({ tipo: 'RECHAZO', mpPaymentId: String(mp.id), monto: mp.transaction_amount, estadoMp: mp.status, payload: mp })
    }
    return
  }

  // Otros tipos de notificación (ej. "subscription_preapproval_plan") no
  // nos interesan hoy — se ignoran silenciosamente en vez de tirar error,
  // porque MP puede mandar tipos nuevos sin previo aviso.
  void query
}
