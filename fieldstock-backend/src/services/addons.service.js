// src/services/addons.service.js
/**
 * Add-ons self-service sobre la suscripción: empleados extra más allá del
 * límite del plan, y cupo de herramientas con seguimiento GPS más allá de
 * lo que venga incluido. El dueño los ajusta desde /facturacion sin subir
 * de plan ni esperar al próximo vencimiento — se cobra al instante.
 *
 * Precios placeholder (ver architecture.html) — visuales hasta que se
 * defina el costo real según el proveedor del hardware/conectividad.
 */
import { supabase } from '../config/supabase.js'
import * as SuscripcionService from './suscripcion.service.js'
import * as MercadoPagoService from './mercadopago.service.js'
import * as EmailService from './email.service.js'
import * as EmpresaService from './empresa.service.js'
import * as CentralReporteService from './central-reporte.service.js'

export const PRECIO_EMPLEADO_EXTRA = 2.99
export const PRECIO_HERRAMIENTA_SEGUIMIENTO = 9.99

/** Plan base + extras, cada uno como línea separada para el comprobante. */
export function calcularDetalle(suscripcion) {
  const detalle = [{ concepto: `Plan ${suscripcion.plan.nombre}`, monto: Number(suscripcion.plan.precio_mensual) }]

  if (suscripcion.empleados_extra > 0) {
    detalle.push({
      concepto: `${suscripcion.empleados_extra} empleado${suscripcion.empleados_extra === 1 ? '' : 's'} extra`,
      monto: suscripcion.empleados_extra * PRECIO_EMPLEADO_EXTRA,
    })
  }
  if (suscripcion.herramientas_seguimiento_cupo > 0) {
    detalle.push({
      concepto: `${suscripcion.herramientas_seguimiento_cupo} herramienta${suscripcion.herramientas_seguimiento_cupo === 1 ? '' : 's'} con seguimiento`,
      monto: suscripcion.herramientas_seguimiento_cupo * PRECIO_HERRAMIENTA_SEGUIMIENTO,
    })
  }
  return detalle
}

export function calcularMontoTotal(suscripcion) {
  return calcularDetalle(suscripcion).reduce((acc, d) => acc + d.monto, 0)
}

/**
 * Ajusta los extras contratados y cobra la diferencia al instante vía MP
 * (actualiza el monto del preapproval activo, sin pasar por un checkout
 * nuevo). Requiere que la instancia ya tenga un plan elegido — no aplica
 * durante PRUEBA ni antes de elegir un plan pago.
 */
export async function actualizarExtras({ empleadosExtra, herramientasCupo, payerEmail }) {
  if (empleadosExtra < 0 || herramientasCupo < 0) {
    const err = new Error('Las cantidades no pueden ser negativas'); err.status = 400; throw err
  }

  const suscripcion = await SuscripcionService.getActual()
  if (!suscripcion?.plan) {
    const err = new Error('Elegí un plan antes de agregar extras'); err.status = 400; throw err
  }
  if (!suscripcion.mp_preapproval_id) {
    const err = new Error('No hay una suscripción de Mercado Pago activa para ajustar'); err.status = 400; throw err
  }

  // No se puede bajar el cupo de herramientas por debajo de los dispositivos
  // ya emparejados — se valida cuando exista dispositivos.service (Fase 2).
  // Por ahora el piso es 0.

  const actualizada = { ...suscripcion, empleados_extra: empleadosExtra, herramientas_seguimiento_cupo: herramientasCupo }
  const montoTotal = calcularMontoTotal(actualizada)
  const detalle = calcularDetalle(actualizada)

  await MercadoPagoService.actualizarMontoPreapproval(suscripcion.mp_preapproval_id, montoTotal)

  const { error } = await supabase
    .from('suscripcion')
    .update({
      empleados_extra: empleadosExtra,
      herramientas_seguimiento_cupo: herramientasCupo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', suscripcion.id)
  if (error) throw error

  await supabase.from('eventos_pago').insert({
    tipo: 'AJUSTE_EXTRAS',
    mp_preapproval_id: suscripcion.mp_preapproval_id,
    monto: montoTotal,
    payload: { detalle },
  })

  // Fire-and-forget: el cobro y la actualización de la suscripción ya se
  // hicieron. Si Resend falla (dominio sin verificar, hiccup del proveedor),
  // no puede hacer parecer fallido un cambio que en realidad sí se aplicó.
  EmpresaService.get()
    .then(empresa => EmailService.enviarComprobantePago({
      to: payerEmail,
      nombreEmpresa: empresa.nombre || 'tu empresa',
      detalle,
      montoTotal,
    }))
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error('[addons] no se pudo enviar el comprobante por email:', err.message)
    })

  CentralReporteService.reportar() // fire-and-forget — nunca bloquea esta respuesta

  return { montoTotal, detalle }
}
