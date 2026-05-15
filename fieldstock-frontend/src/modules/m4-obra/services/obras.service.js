// src/modules/m4-obra/services/obras.service.js
import { api } from '@shared/utils/api.js'

export const ObrasService = {
  getAll:    ({ estado, q } = {}) => {
    const p = new URLSearchParams()
    if (estado) p.set('estado', estado)
    if (q)      p.set('q', q)
    const qs = p.toString()
    return api.get(`/api/obras${qs ? `?${qs}` : ''}`)
  },
  getById:   (id)       => api.get(`/api/obras/${id}`),
  create:    (body)     => api.post('/api/obras', body),
  update:    (id, body) => api.put(`/api/obras/${id}`, body),
  finalizar: (id)       => api.post(`/api/obras/${id}/finalizar`, {}),
  reactivar: (id)       => api.post(`/api/obras/${id}/reactivar`, {}),
}
