// src/services/dispositivos.service.js
/**
 * Dispositivos de rastreo GPS — relación 1 a 1 con una herramienta a la
 * vez. El dueño empareja un dispositivo LIBRE escaneando su QR propio
 * (ver shared/utils/qr.js del frontend); reasignarlo a otra herramienta o
 * darlo de baja por rotura siempre pasa por `liberar`, exclusivo de ADMIN
 * — el dueño nunca puede reasignar un dispositivo por su cuenta.
 */
import { supabase } from '../config/supabase.js'
import * as SuscripcionService from './suscripcion.service.js'
import * as CentralReporteService from './central-reporte.service.js'

/** Resuelve un dispositivo por su código QR — lo usa la acción remota del
 * panel central, que solo conoce el código impreso, no el id interno. */
export async function getByCodigoQR(codigoQR) {
  const { data, error } = await supabase
    .from('dispositivos_rastreo')
    .select('*')
    .eq('codigo_qr', codigoQR)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    const e = new Error('No existe ningún dispositivo con ese código QR'); e.status = 404; throw e
  }
  return data
}

export async function getAll() {
  const { data, error } = await supabase
    .from('dispositivos_rastreo')
    .select('*, herramientas(nombre, codigo_qr)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/** Alta de un dispositivo nuevo en el inventario — lo carga ADMIN cuando llega el hardware. */
export async function crear({ codigoQR, imeiProveedor }) {
  if (!codigoQR?.trim()) {
    const e = new Error('codigoQR es obligatorio'); e.status = 400; throw e
  }
  const { data, error } = await supabase
    .from('dispositivos_rastreo')
    .insert({ codigo_qr: codigoQR.trim(), imei_proveedor: imeiProveedor?.trim() || null })
    .select().single()
  if (error) throw error
  return data
}

/**
 * Empareja un dispositivo LIBRE a una herramienta. El UPDATE lleva el
 * filtro de estado en la misma sentencia (no un SELECT previo) para que
 * dos escaneos casi simultáneos del mismo dispositivo no lo emparejen dos
 * veces — si otro request ya lo tomó, esta llamada no actualiza ninguna
 * fila y lo tratamos como conflicto.
 */
export async function emparejar({ codigoQR, herramientaId }) {
  if (!herramientaId) {
    const e = new Error('herramientaId es obligatorio'); e.status = 400; throw e
  }

  const suscripcion = await SuscripcionService.getActual()
  const cupo = suscripcion?.herramientas_seguimiento_cupo || 0

  const { count: emparejados, error: errCount } = await supabase
    .from('dispositivos_rastreo')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'EMPAREJADO')
  if (errCount) throw errCount

  if ((emparejados || 0) >= cupo) {
    const e = new Error('Ya usaste todo el cupo de herramientas con seguimiento contratado. Sumá más desde Facturación.')
    e.status = 403; throw e
  }

  const { data, error } = await supabase
    .from('dispositivos_rastreo')
    .update({ estado: 'EMPAREJADO', herramienta_id: herramientaId, updated_at: new Date().toISOString() })
    .eq('codigo_qr', codigoQR)
    .eq('estado', 'LIBRE')
    .select().maybeSingle()
  if (error) throw error

  if (!data) {
    const e = new Error('El dispositivo no existe, ya está emparejado o fue dado de baja')
    e.status = 409; throw e
  }
  CentralReporteService.reportar() // fire-and-forget
  return data
}

/**
 * Libera un dispositivo (rotura o cambio de herramienta) — exclusivo de
 * ADMIN. Vuelve a LIBRE y queda disponible para que el dueño lo empareje
 * de nuevo a la herramienta que corresponda.
 */
export async function liberar(id) {
  const { data, error } = await supabase
    .from('dispositivos_rastreo')
    .update({ estado: 'LIBRE', herramienta_id: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select().maybeSingle()
  if (error) throw error
  if (!data) {
    const e = new Error('Dispositivo no encontrado'); e.status = 404; throw e
  }
  CentralReporteService.reportar() // fire-and-forget
  return data
}

/** Baja definitiva (dispositivo perdido/roto sin reemplazo) — exclusivo de ADMIN. */
export async function darDeBaja(id) {
  const { data, error } = await supabase
    .from('dispositivos_rastreo')
    .update({ estado: 'BAJA', herramienta_id: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select().maybeSingle()
  if (error) throw error
  if (!data) {
    const e = new Error('Dispositivo no encontrado'); e.status = 404; throw e
  }
  CentralReporteService.reportar() // fire-and-forget
  return data
}
