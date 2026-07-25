// src/services/central-reporte.service.js
/**
 * Único punto de contacto con la instancia central (ver
 * architecture-multi-cliente.html) — mismo criterio que
 * mercadopago.service.js siendo el único punto de contacto con el SDK de
 * Mercado Pago. Nadie más en el backend le habla a CENTRAL_URL directo.
 *
 * `reportar()` es fire-and-forget a propósito: un problema de red o que
 * la instancia central esté caída NUNCA puede afectar a un usuario real
 * de esta instancia. Se llama sin `await` desde donde corresponda, y
 * cualquier error se loguea y se descarta.
 *
 * No hace nada si CENTRAL_URL no está configurada — es el caso normal en
 * la instancia que actúa de central (no se reporta a sí misma).
 */
import { supabase } from '../config/supabase.js'
import { getCentralUrl, getProvisioningSecret } from '../config/central.js'
import * as EmpresaService from './empresa.service.js'
import * as SuscripcionService from './suscripcion.service.js'
import crypto from 'crypto'

const REPORT_TIMEOUT_MS = 5_000

/**
 * Devuelve la client_key de esta instancia, generándola si todavía no
 * existe. Mismo criterio de "fila única, autosanable ante una carrera"
 * que suscripcion.service.getActual() — si dos réplicas la generan al
 * mismo tiempo, ambas van a existir pero siempre se usa la más vieja.
 */
async function asegurarInstancia() {
  const { data: existente, error: errSel } = await supabase
    .from('instancia_central')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (errSel) throw errSel
  if (existente) return existente

  const { data: creada, error: errIns } = await supabase
    .from('instancia_central')
    .insert({ client_key: crypto.randomBytes(32).toString('hex') })
    .select()
    .single()
  if (errIns) throw errIns
  return creada
}

async function armarPayload() {
  const [empresa, suscripcion, dispositivos] = await Promise.all([
    EmpresaService.get(),
    SuscripcionService.getEstado(),
    supabase.from('dispositivos_rastreo').select('estado'),
  ])

  const emparejados = (dispositivos.data || []).filter(d => d.estado === 'EMPAREJADO').length

  return {
    empresaNombre: empresa?.nombre || null,
    urlBackend: null, // lo completa quien llama a reportar() — ver nota en esa función
    planCodigo: suscripcion?.plan?.codigo || null,
    planNombre: suscripcion?.plan?.nombre || null,
    empleadosExtra: suscripcion?.empleados_extra || 0,
    herramientasCupo: suscripcion?.herramientas_seguimiento_cupo || 0,
    herramientasEmparejadas: emparejados,
  }
}

/**
 * Reporta el estado de esta instancia a la central. Fire-and-forget desde
 * el caller (nunca lleva `await` en el código que la invoca por un evento
 * de negocio) — acá adentro sí esperamos la red, pero con timeout corto.
 *
 * `urlPropia` es la URL pública del backend de ESTA instancia — hace falta
 * para que la central sepa a dónde pegarle después si necesita ejecutar
 * una acción remota (ej. liberar un dispositivo). No hay forma de que el
 * backend la deduzca solo, así que viene de una env var (BACKEND_PUBLIC_URL).
 */
export async function reportar() {
  const centralUrl = getCentralUrl()
  if (!centralUrl) return // esta instancia actúa de central — no se reporta a sí misma

  try {
    const instancia = await asegurarInstancia()
    const payload = await armarPayload()
    payload.urlBackend = process.env.BACKEND_PUBLIC_URL || null

    const headers = { 'Content-Type': 'application/json', 'x-client-key': instancia.client_key }
    if (!instancia.registrada_at) {
      const secreto = getProvisioningSecret()
      if (secreto) headers['x-provisioning-secret'] = secreto
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS)
    let res
    try {
      res = await fetch(`${centralUrl}/api/central/reportar`, {
        method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (res.ok && !instancia.registrada_at) {
      await supabase
        .from('instancia_central')
        .update({ registrada_at: new Date().toISOString() })
        .eq('id', instancia.id)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[central-reporte] no se pudo reportar a la central:', err.message)
  }
}
