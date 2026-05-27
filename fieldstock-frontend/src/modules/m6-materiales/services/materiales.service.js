// src/modules/m6-materiales/services/materiales.service.js
/**
 * Service del M6 (frontend) — wrapper sobre el backend de materiales.
 *
 * CRUD básico. No expone `updateStock` — eso es uso interno del backend
 * desde remitos.service (avance/retorno de estado), no se debe llamar
 * desde el frontend directamente.
 */
import { api } from '@shared/utils/api.js'

export const MaterialesService = {
  getAll:  ({ q } = {}) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    const qs = p.toString()
    return api.get(`/materiales${qs ? `?${qs}` : ''}`)
  },
  getById: (id)       => api.get(`/materiales/${id}`),
  create:  (body)     => api.post('/materiales', body),
  update:  (id, body) => api.put(`/materiales/${id}`, body),
  // Soft delete (activo=false). El backend deja la fila para preservar
  // integridad con remitos viejos — el material sale del listado pero
  // sigue existiendo en la DB. Word #19.
  remove:  (id)       => api.delete(`/materiales/${id}`),

  // Lista de marcas únicas para autocomplete del form (Word #17)
  getMarcas: ()       => api.get('/materiales/marcas'),
}
