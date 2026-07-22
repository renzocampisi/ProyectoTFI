// src/config/mercadopago.js
/**
 * Cliente de Mercado Pago para el BACKEND.
 *
 * A diferencia de config/supabase.js, acá NO fallamos fast al importar el
 * módulo — MP_ACCESS_TOKEN es necesario recién cuando se usa una ruta de
 * pagos, y el resto del sistema (inventario, remitos, etc.) tiene que poder
 * levantar sin esa credencial configurada (ej. mientras se está armando el
 * feature, o en un ambiente que todavía no la tiene). getClient() lanza el
 * error recién en el momento en que algo intenta hablarle a MP de verdad.
 */
import { MercadoPagoConfig } from 'mercadopago'
import 'dotenv/config'

let client = null

export function getClient() {
  if (client) return client

  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    const err = new Error('Falta MP_ACCESS_TOKEN en el .env — no se puede hablar con Mercado Pago')
    err.status = 500
    throw err
  }

  client = new MercadoPagoConfig({ accessToken })
  return client
}
