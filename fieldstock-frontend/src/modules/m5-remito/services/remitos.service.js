// src/modules/m5-remito/services/remitos.service.js
import { api } from '@shared/utils/api.js'

export const RemitosService = {
  getAll:          ({ tipo, estado } = {}) => {
    const p = new URLSearchParams()
    if (tipo)   p.set('tipo',   tipo)
    if (estado) p.set('estado', estado)
    const qs = p.toString()
    return api.get(`/api/remitos${qs ? `?${qs}` : ''}`)
  },
  getById:         (id)            => api.get(`/api/remitos/${id}`),
  create:          (body)          => api.post('/api/remitos', body),
  avanzar:         (id, body)      => api.post(`/api/remitos/${id}/avanzar`, body ?? {}),
  crearIngreso:    (id)            => api.post(`/api/remitos/${id}/ingreso`, {}),
  eliminar:        (id)            => api.delete(`/api/remitos/${id}`),
  addItem:         (id, body)      => api.post(`/api/remitos/${id}/items`, body),
  removeItem:      (id, itemId)    => api.delete(`/api/remitos/${id}/items/${itemId}`),
  addMaterial:     (id, body)      => api.post(`/api/remitos/${id}/materiales`, body),
  removeMaterial:  (id, matItemId) => api.delete(`/api/remitos/${id}/materiales/${matItemId}`),
}
