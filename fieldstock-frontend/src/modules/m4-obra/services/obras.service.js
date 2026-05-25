// src/modules/m4-obra/services/obras.service.js
/**
 * Service del M4 (frontend) — wrapper sobre el backend de obras.
 *
 * CRUD básico + dos transiciones de estado dedicadas (`finalizar`, `reactivar`)
 * que matchean los endpoints POST /:id/finalizar y POST /:id/reactivar del
 * backend.
 */
import { api } from '@shared/utils/api.js'

export const ObrasService = {
  getAll:    ({ estado, q } = {}) => {
    const p = new URLSearchParams()
    if (estado) p.set('estado', estado)
    if (q)      p.set('q', q)
    const qs = p.toString()
    return api.get(`/obras${qs ? `?${qs}` : ''}`)
  },
  getById:   (id)       => api.get(`/obras/${id}`),
  create:    (body)     => api.post('/obras', body),
  update:    (id, body) => api.put(`/obras/${id}`, body),
  finalizar: (id)       => api.post(`/obras/${id}/finalizar`, {}),
  reactivar: (id)       => api.post(`/obras/${id}/reactivar`, {}),
}
