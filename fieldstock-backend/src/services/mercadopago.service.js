// src/services/mercadopago.service.js
/**
 * Único punto de contacto con el SDK de Mercado Pago — igual criterio que
 * config/supabase.js siendo el único punto de contacto con Supabase. Nadie
 * más en el backend importa el paquete `mercadopago` directo.
 *
 * `validarFirmaWebhook` implementa el esquema de firma documentado por MP:
 * el header `x-signature` trae `ts=<timestamp>,v1=<hmac>`, y el hmac es
 * SHA256 de un "manifest" armado con el id del recurso, el x-request-id y
 * el ts, usando MP_WEBHOOK_SECRET como clave. Si no matchea, la notificación
 * no vino de Mercado Pago (o fue alterada) y se descarta sin procesar nada.
 */
import crypto from 'crypto'
import { PreApproval, Payment } from 'mercadopago'
import { getClient } from '../config/mercadopago.js'

// El webhook NO se pasa por request acá — para Preapproval, Mercado Pago
// usa la "Notification URL" configurada una sola vez en la aplicación
// (Panel de desarrolladores → tu app → Notificaciones), no una por cada
// suscripción creada. Ese valor es lo que hay que apuntar a APP_BASE_URL
// + /api/webhooks/mercadopago (con el túnel de ngrok mientras se prueba
// en desarrollo, ver implementation.html paso 11).
export async function crearPreapproval({ reason, payerEmail, transactionAmount, backUrl, externalReference }) {
  const preApproval = new PreApproval(getClient())
  const data = await preApproval.create({
    body: {
      reason,
      payer_email: payerEmail,
      external_reference: externalReference,
      back_url: backUrl,
      status: 'pending', // el payer todavía tiene que autorizar la tarjeta en el init_point
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: transactionAmount,
        currency_id: 'ARS',
      },
    },
  })
  return data
}

export async function obtenerPreapproval(id) {
  const preApproval = new PreApproval(getClient())
  return preApproval.get({ id })
}

export async function cancelarPreapproval(id) {
  const preApproval = new PreApproval(getClient())
  return preApproval.update({ id, body: { status: 'cancelled' } })
}

/**
 * Actualiza el monto recurrente de un preapproval ya autorizado — permite
 * cobrar un add-on (empleado extra, herramienta con seguimiento) desde el
 * próximo débito sin cancelar y volver a mandar al dueño a un checkout
 * nuevo. La documentación pública de MP no aclara si esto requiere que el
 * pagador reautorice — está probado contra el ambiente de test antes de
 * confiar en este camino (ver addons.service.js para el fallback).
 */
export async function actualizarMontoPreapproval(id, nuevoMonto) {
  const preApproval = new PreApproval(getClient())
  return preApproval.update({
    id,
    body: { auto_recurring: { transaction_amount: nuevoMonto, currency_id: 'ARS' } },
  })
}

export async function obtenerPago(id) {
  const payment = new Payment(getClient())
  return payment.get({ id })
}

/**
 * Valida que una notificación de webhook realmente venga de Mercado Pago.
 * `headers` es el objeto de headers de Express (ya vienen en minúscula).
 * `dataId` es el `data.id` que trae el query string de la notificación.
 */
export function validarFirmaWebhook(headers, dataId) {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    const err = new Error('Falta MP_WEBHOOK_SECRET en el .env — no se puede validar el webhook')
    err.status = 500; throw err
  }

  const signatureHeader = headers['x-signature']
  const requestId       = headers['x-request-id']
  if (!signatureHeader || !requestId) return false

  const partes = Object.fromEntries(
    signatureHeader.split(',').map(p => p.trim().split('=').map(s => s.trim()))
  )
  const { ts, v1 } = partes
  if (!ts || !v1) return false

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  // timingSafeEqual exige buffers del mismo largo — si no matchean en
  // longitud ya sabemos que la firma es inválida, sin arriesgar el compare.
  const a = Buffer.from(hmac)
  const b = Buffer.from(v1)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
