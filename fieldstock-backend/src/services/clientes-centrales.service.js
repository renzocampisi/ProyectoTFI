// src/services/clientes-centrales.service.js
/**
 * Lado CENTRAL del panel multi-cliente (ver architecture-multi-cliente.html)
 * — en la práctica solo se usa de verdad en la instancia que Renzo usa
 * para sí mismo; en el resto de los deploys estas funciones existen pero
 * la tabla `clientes_reportados` queda vacía porque nadie les reporta ahí.
 *
 * IMPORTANTE: `client_key` de cada cliente NUNCA sale de acá hacia el
 * frontend — se usa server-side únicamente para autenticar las llamadas
 * de vuelta hacia ese cliente (liberarDispositivoRemoto).
 */
import { supabase } from '../config/supabase.js'
import { getProvisioningSecret } from '../config/central.js'

const LIMITE_FRESCURA_MIN = 30
const REPORT_TIMEOUT_MS = 5_000
const MAX_INTENTOS = 2

/**
 * Recibe el reporte de una instancia-cliente. Si su client_key ya es
 * conocida, solo actualiza el registro existente. Si es la primera vez
 * que se ve esa clave, exige que venga acompañada del provisioning secret
 * compartido — es el único momento en que ese secreto hace falta.
 */
export async function registrarOActualizar(payload, headers) {
  const clientKey = headers['x-client-key']
  if (!clientKey) {
    const e = new Error('Falta x-client-key'); e.status = 400; throw e
  }
  if (!payload.urlBackend) {
    const e = new Error('Falta urlBackend en el payload'); e.status = 400; throw e
  }

  const { data: existente, error: errSel } = await supabase
    .from('clientes_reportados')
    .select('id')
    .eq('client_key', clientKey)
    .maybeSingle()
  if (errSel) throw errSel

  if (!existente) {
    const secretoEsperado = getProvisioningSecret()
    const secretoRecibido = headers['x-provisioning-secret']
    if (!secretoEsperado || secretoRecibido !== secretoEsperado) {
      const e = new Error('Provisioning secret inválido — no se puede dar de alta este cliente')
      e.status = 401; throw e
    }
  }

  const fila = {
    client_key: clientKey,
    empresa_nombre: payload.empresaNombre || null,
    url_backend: payload.urlBackend,
    plan_codigo: payload.planCodigo || null,
    plan_nombre: payload.planNombre || null,
    empleados_extra: payload.empleadosExtra || 0,
    herramientas_cupo: payload.herramientasCupo || 0,
    herramientas_emparejadas: payload.herramientasEmparejadas || 0,
    ultimo_reporte_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('clientes_reportados')
    .upsert(fila, { onConflict: 'client_key' })
  if (error) throw error
}

/** Lista para el panel "Mis clientes" — nunca incluye client_key. */
export async function getAll() {
  const { data, error } = await supabase
    .from('clientes_reportados')
    .select('id, empresa_nombre, dueño_nombre, dueño_email, plan_codigo, plan_nombre, empleados_extra, herramientas_cupo, herramientas_emparejadas, ultimo_reporte_at')
    .order('empresa_nombre', { ascending: true })
  if (error) throw error

  const ahora = Date.now()
  return (data || []).map(c => {
    const minutosDesdeReporte = (ahora - new Date(c.ultimo_reporte_at).getTime()) / (1000 * 60)
    return { ...c, activo: minutosDesdeReporte <= LIMITE_FRESCURA_MIN }
  })
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

/**
 * Ejecuta una acción remota contra la instancia real de un cliente
 * (por ahora, liberar un dispositivo). Hasta 2 intentos con una espera
 * corta entre uno y otro — si los dos fallan, se corta y se informa la
 * causa más probable en vez de reintentar indefinidamente.
 */
export async function liberarDispositivoRemoto(clienteId, codigoQR) {
  const { data: cliente, error } = await supabase
    .from('clientes_reportados')
    .select('url_backend, client_key')
    .eq('id', clienteId)
    .maybeSingle()
  if (error) throw error
  if (!cliente) {
    const e = new Error('Cliente no encontrado'); e.status = 404; throw e
  }

  let ultimoError
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS)
    try {
      const res = await fetch(`${cliente.url_backend}/api/central/acciones/liberar-dispositivo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-client-key': cliente.client_key },
        body: JSON.stringify({ codigoQR }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `La instancia del cliente respondió ${res.status}`)
      }
      return await res.json()
    } catch (err) {
      ultimoError = err
      if (intento < MAX_INTENTOS) await delay(1000)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const e = new Error(
    `No se pudo conectar con la instancia de este cliente después de ${MAX_INTENTOS} intentos ` +
    `(${ultimoError?.message || 'sin detalle'}). Causas probables: el backend del cliente está ` +
    `dormido o caído, no tiene internet, tuvo un deploy roto, o la URL guardada quedó desactualizada.`
  )
  e.status = 502
  throw e
}
