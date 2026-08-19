// src/modules/m-compras/constants.js
/**
 * Tablas de lookup y helpers compartidos por el módulo Compras.
 *
 * Centralizar acá evita duplicar el mapping en List/Detail/Badge y mantiene
 * un solo lugar para sumar tipos nuevos en el futuro (ej. si agregamos un
 * estado RECHAZADA o un medio de pago nuevo).
 */

// Cada estado tiene su label y className (estos últimos viven en
// EstadoBadge.module.css). Centralizado acá para que list/detail/badge
// pinten lo mismo.
export const ESTADO_INFO = {
  BORRADOR:         { label: 'Borrador',         clsKey: 'estadoBorrador' },
  CONFIRMADA:       { label: 'Confirmada',       clsKey: 'estadoConfirmada' },
  RECIBIDA_PARCIAL: { label: 'Recibida parcial', clsKey: 'estadoParcial' },
  RECIBIDA:         { label: 'Recibida',         clsKey: 'estadoRecibida' },
  CANCELADA:        { label: 'Cancelada',        clsKey: 'estadoCancelada' },
}

export const MEDIO_PAGO_LABEL = {
  EFECTIVO:         'Efectivo',
  TRANSFERENCIA:    'Transferencia',
  CHEQUE:           'Cheque',
  TARJETA:          'Tarjeta',
  CUENTA_CORRIENTE: 'Cuenta corriente',
}

export const MONEDA_LABEL = { ARS: 'ARS', USD: 'USD' }

// ── Helpers de formato ──────────────────────────────────────────

export function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

// Para timestamps completos (created_at, updated_at) — fecha + hora local.
export function formatFechaHora(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatMoney(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '$0,00'
  return num.toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 2,
  })
}

// Para líneas de compra_pagos, que pueden estar en ARS o USD — a diferencia
// de formatMoney (siempre ARS, usado para compras.total).
export function formatMontoMoneda(n, moneda = 'ARS') {
  const num = Number(n)
  if (!Number.isFinite(num)) return moneda === 'USD' ? 'US$0,00' : '$0,00'
  return num.toLocaleString('es-AR', {
    style: 'currency', currency: moneda, maximumFractionDigits: 2,
  })
}

// Para cantidades de materiales: tolera enteros y decimales, sin símbolo.
// Si es entero exacto no muestra coma; si tiene decimales, máximo 2.
export function formatCantidad(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('es-AR', {
    maximumFractionDigits: 2,
  })
}
