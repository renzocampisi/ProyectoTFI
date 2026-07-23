// src/config/resend.js
/**
 * Cliente de Resend (envío de emails transaccionales) para el BACKEND.
 *
 * Mismo criterio que config/mercadopago.js: no falla fast al importar el
 * módulo — RESEND_API_KEY recién hace falta cuando algo intenta mandar un
 * email de verdad (ej. el comprobante de un cambio en la suscripción), y
 * el resto del sistema tiene que poder levantar sin esa credencial.
 */
import { Resend } from 'resend'
import 'dotenv/config'

let client = null

export function getClient() {
  if (client) return client

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    const err = new Error('Falta RESEND_API_KEY en el .env — no se puede enviar el email')
    err.status = 500
    throw err
  }

  client = new Resend(apiKey)
  return client
}
