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
}
