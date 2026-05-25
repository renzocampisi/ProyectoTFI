// src/modules/m6-materiales/services/materiales.service.js
/**
 * Service del M6 (frontend) — wrapper sobre el backend de materiales.
 *
 * CRUD básico. No expone `updateStock` — eso es uso interno del backend
 * desde remitos.service (avance/retorno de estado), no se debe llamar
 * desde el frontend directamente.
 *
 * FIXME: el nombre `MateriasService` es legacy (cuando el módulo se
 * llamaba "Materias"). Conviene renombrar a `MaterialesService` y
 * actualizar los imports en hooks y páginas.
 */
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
