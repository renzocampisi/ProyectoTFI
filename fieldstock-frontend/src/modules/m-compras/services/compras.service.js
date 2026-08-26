// src/modules/m-compras/services/compras.service.js
/**
 * Service del módulo Compras (frontend) — wrapper sobre el backend de
 * órdenes de compra a proveedores.
 *
 * Cubre la API completa:
 *   - Lectura: getAll (con filtros), getById
 *   - CRUD cabecera: create, update (solo en BORRADOR)
 *   - Transiciones de estado: avanzar (BORRADOR→CONFIRMADA), cancelar
 *   - Recepción: recibir (parcial o total — backend suma al stock_actual
 *     de cada material y avanza el estado a RECIBIDA_PARCIAL o RECIBIDA)
 *   - Items: addItem, updateItem, removeItem (solo en BORRADOR)
 *
 * Patrón espejado de RemitosService. Las mutaciones se llaman directo
 * desde el componente y luego se hace refetch() del hook.
 */
import { api } from '@shared/utils/api.js'

export const ComprasService = {
  getAll: ({ estado, proveedorId, q } = {}) => {
    const p = new URLSearchParams()
    if (estado)      p.set('estado', estado)
    if (proveedorId) p.set('proveedorId', proveedorId)
    if (q)           p.set('q', q)
    const qs = p.toString()
    return api.get(`/compras${qs ? `?${qs}` : ''}`)
  },
  getById:  (id)        => api.get(`/compras/${id}`),
  create:   (body)      => api.post('/compras', body),
  update:   (id, body)  => api.patch(`/compras/${id}`, body),
  avanzar:  (id)        => api.post(`/compras/${id}/avanzar`, {}),
  cancelar: (id, motivo)=> api.post(`/compras/${id}/cancelar`, motivo ? { motivo } : {}),
  recibir:  (id, items) => api.post(`/compras/${id}/recibir`, { items }),

  addItem:    (id, body)         => api.post(`/compras/${id}/items`, body),
  updateItem: (id, itemId, body) => api.patch(`/compras/${id}/items/${itemId}`, body),
  removeItem: (id, itemId)       => api.delete(`/compras/${id}/items/${itemId}`),

  // Pagos: desglose de medio + moneda + monto (solo editable en BORRADOR).
  addPago:    (id, body)        => api.post(`/compras/${id}/pagos`, body),
  removePago: (id, pagoId)      => api.delete(`/compras/${id}/pagos/${pagoId}`),

  // Comprobante de pago. El backend espera multipart con field `archivo`.
  // getComprobante devuelve { url, path, expiresIn } o lanza 404 si no hay.
  getComprobante: (id) => api.get(`/compras/${id}/comprobante`),
  uploadComprobante: (id, file) => {
    const fd = new FormData()
    fd.append('archivo', file)
    return api.postForm(`/compras/${id}/comprobante`, fd)
  },
  deleteComprobante: (id) => api.delete(`/compras/${id}/comprobante`),

  // Scan & Match: lee un remito/factura de proveedor y propone el matching
  // contra los items de esta compra. proponer() es multipart (foto o PDF);
  // confirmar() aplica la propuesta ya revisada. Ver scanMatch.service.js
  // del backend para el contrato completo.
  // timeoutMs alto porque el backend hace una llamada a Gemini con la
  // imagen/PDF adjunto antes de responder (mismo criterio que panel.service.js).
  scanMatchProponer: (id, file) => {
    const fd = new FormData()
    fd.append('archivo', file)
    return api.postForm(`/compras/${id}/scan-match`, fd, { timeoutMs: 60_000 })
  },
  scanMatchConfirmar: (id, items) => api.post(`/compras/${id}/scan-match/confirmar`, { items }),
}
