// src/modules/m5-remito/services/remitos.service.js
/**
 * Service del M5 (frontend) — wrapper sobre el backend de remitos.
 *
 * Cubre la API completa de la máquina de estados:
 *   - CRUD básico (getAll, getById, create, update, eliminar)
 *   - Transiciones de estado: avanzar, volverABorrador
 *   - Items de herramientas: addItem, removeItem, updateItemRetorno
 *   - Items de materiales:  addMaterial, removeMaterial, updateMaterialRetorno
 *
 * Notar que `update` usa PATCH (no PUT) — el backend soporta actualización
 * parcial de cabecera, ver remitos.controller.update.
 *
 * NO incluye `confirmarEscaneo` ni `reportarProblema` porque esos endpoints
 * los usa la app mobile (m3-qr), no el flujo desktop del M5.
 */
import { api } from '@shared/utils/api.js'

export const RemitosService = {
  getAll:    ({ estado, q } = {}) => {
    const p = new URLSearchParams()
    if (estado) p.set('estado', estado)
    if (q)      p.set('q', q)
    const qs = p.toString()
    return api.get(`/remitos${qs ? `?${qs}` : ''}`)
  },
  getById:         (id)            => api.get(`/remitos/${id}`),
  // Resuelve el QR escaneado (FS-NNNNN) al remito completo (issue #11)
  getByNumero:     (numero)        => api.get(`/remitos/numero/${encodeURIComponent(numero)}`),
  create:          (body)          => api.post('/remitos', body),
  update:          (id, body)      => api.patch(`/remitos/${id}`, body),
  avanzar:         (id, body)      => api.post(`/remitos/${id}/avanzar`, body ?? {}),
  volverABorrador: (id)            => api.post(`/remitos/${id}/volver-borrador`, {}),
  eliminar:        (id)            => api.delete(`/remitos/${id}`),

  addItem:           (id, body)         => api.post(`/remitos/${id}/items`, body),
  removeItem:        (id, itemId)       => api.delete(`/remitos/${id}/items/${itemId}`),
  updateItemRetorno: (id, itemId, body) => api.patch(`/remitos/${id}/items/${itemId}/retorno`, body),

  addMaterial:           (id, body)         => api.post(`/remitos/${id}/materiales`, body),
  removeMaterial:        (id, matItemId)    => api.delete(`/remitos/${id}/materiales/${matItemId}`),
  updateMaterialRetorno: (id, matItemId, body) => api.patch(`/remitos/${id}/materiales/${matItemId}/retorno`, body),
}
