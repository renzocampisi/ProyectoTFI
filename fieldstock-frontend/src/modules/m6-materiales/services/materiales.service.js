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

  // Word #B: detección de duplicados antes de crear. Devuelve el material
  // existente con mismo nombre+marca, o null si no existe.
  checkDuplicate: ({ nombre, marca }) => {
    const p = new URLSearchParams({ nombre: nombre || '' })
    if (marca) p.set('marca', marca)
    return api.get(`/materiales/check-duplicate?${p.toString()}`)
  },

  // Word #B: suma cantidad al stock_actual de un material existente.
  // Disparado desde el modal cuando el usuario elige "sumar al existente".
  agregarStock: (id, cantidad) =>
    api.post(`/materiales/${id}/agregar-stock`, { cantidad }),
}
