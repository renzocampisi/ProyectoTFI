// src/modules/m5-remito/services/remitos.service.js
import { api } from '@shared/utils/api.js'

export const RemitosService = {
  getAll:    ({ estado, q } = {}) => {
    const p = new URLSearchParams()
    if (estado) p.set('estado', estado)
    if (q)      p.set('q', q)
    const qs = p.toString()
    return api.get(`/api/remitos${qs ? `?${qs}` : ''}`)
  },
  getById:         (id)            => api.get(`/api/remitos/${id}`),
  create:          (body)          => api.post('/api/remitos', body),
  update:          (id, body)      => api.patch(`/api/remitos/${id}`, body),
  avanzar:         (id, body)      => api.post(`/api/remitos/${id}/avanzar`, body ?? {}),
  volverABorrador: (id)            => api.post(`/api/remitos/${id}/volver-borrador`, {}),
  eliminar:        (id)            => api.delete(`/api/remitos/${id}`),

  addItem:           (id, body)         => api.post(`/api/remitos/${id}/items`, body),
  removeItem:        (id, itemId)       => api.delete(`/api/remitos/${id}/items/${itemId}`),
  updateItemRetorno: (id, itemId, body) => api.patch(`/api/remitos/${id}/items/${itemId}/retorno`, body),

  addMaterial:           (id, body)         => api.post(`/api/remitos/${id}/materiales`, body),
  removeMaterial:        (id, matItemId)    => api.delete(`/api/remitos/${id}/materiales/${matItemId}`),
  updateMaterialRetorno: (id, matItemId, body) => api.patch(`/api/remitos/${id}/materiales/${matItemId}/retorno`, body),
}
