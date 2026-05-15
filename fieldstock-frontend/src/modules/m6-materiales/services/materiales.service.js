// src/modules/m6-materiales/services/materiales.service.js
import { api } from '@shared/utils/api.js'

export const MateriasService = {
  getAll:  ({ q } = {}) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    const qs = p.toString()
    return api.get(`/api/materiales${qs ? `?${qs}` : ''}`)
  },
  getById: (id)       => api.get(`/api/materiales/${id}`),
  create:  (body)     => api.post('/api/materiales', body),
  update:  (id, body) => api.put(`/api/materiales/${id}`, body),
}
