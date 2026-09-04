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
  // body es opcional: { horasHombre?, inconvenientes?, costosNoAnticipados? }
  // — datos del cierre de obra (Historial de Obra). Se puede finalizar sin
  // cargar nada, igual que antes de esta feature.
  finalizar: (id, body) => api.post(`/obras/${id}/finalizar`, body || {}),
  reactivar: (id)       => api.post(`/obras/${id}/reactivar`, {}),
  getReservas: (id)     => api.get(`/obras/${id}/reservas`),
  getHistorial: (id)    => api.get(`/obras/${id}/historial`),
}
