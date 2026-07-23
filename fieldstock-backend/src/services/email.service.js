// src/services/email.service.js
/**
 * Único punto de contacto con Resend — mismo criterio que
 * mercadopago.service.js siendo el único punto de contacto con el SDK de
 * Mercado Pago. Nadie más en el backend importa el paquete `resend` directo.
 *
 * Por ahora expone un solo tipo de email (comprobante de cambio en la
 * suscripción) — no se suma un motor de templates para un caso de uso.
 */
import { getClient } from '../config/resend.js'

function formatMonto(monto) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(monto)
}

function templateComprobante({ nombreEmpresa, detalle, montoTotal, fecha }) {
  const filasDetalle = detalle
    .map(d => `<tr><td style="padding:8px 0;color:#334155;">${d.concepto}</td><td style="padding:8px 0;text-align:right;color:#334155;">${formatMonto(d.monto)}</td></tr>`)
    .join('')

  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#0d2440;margin-bottom:4px;">Comprobante de pago</h2>
      <p style="color:#64748b;margin-top:0;">FieldStock AI — ${nombreEmpresa}</p>
      <p style="color:#64748b;font-size:13px;">${fecha}</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;border-top:1px solid #e2e8f0;">
        ${filasDetalle}
        <tr style="border-top:1px solid #e2e8f0;font-weight:700;">
          <td style="padding:12px 0;color:#0d2440;">Total mensual</td>
          <td style="padding:12px 0;text-align:right;color:#0d2440;">${formatMonto(montoTotal)}</td>
        </tr>
      </table>
      <p style="color:#94a3b8;font-size:12px;">Este comprobante también queda guardado en tu cuenta de FieldStock AI, en Facturación.</p>
    </div>
  `
}

/**
 * Envía el comprobante de un cambio en la suscripción (alta de plan, ajuste
 * de extras, etc.) y devuelve el id del email para poder loguearlo junto al
 * evento en `eventos_pago`.
 *
 * `detalle` es un array de `{ concepto, monto }` — ej. el plan base +
 * cada add-on como línea separada, para que quede claro qué se está cobrando.
 */
export async function enviarComprobantePago({ to, nombreEmpresa, detalle, montoTotal }) {
  const resend = getClient()
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) {
    const err = new Error('Falta RESEND_FROM_EMAIL en el .env')
    err.status = 500; throw err
  }

  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: 'FieldStock AI — Comprobante de pago',
    html: templateComprobante({ nombreEmpresa, detalle, montoTotal, fecha }),
  })
  if (error) {
    const err = new Error(error.message || 'No se pudo enviar el comprobante por email')
    err.status = 502; throw err
  }
  return data.id
}
