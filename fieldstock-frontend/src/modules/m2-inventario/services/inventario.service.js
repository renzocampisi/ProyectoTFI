// src/modules/m2-inventario/services/inventario.service.js
import { api } from '@shared/utils/api.js'

export const InventarioService = {
  getAll: ({ estado, categoriaId, q, incluirBajas } = {}) => {
    const params = new URLSearchParams()
    if (estado)       params.set('estado',       estado)
    if (categoriaId)  params.set('categoriaId',  categoriaId)
    if (q)            params.set('q',            q)
    if (incluirBajas) params.set('incluirBajas', 'true')
    const qs = params.toString()
    return api.get(`/api/herramientas${qs ? `?${qs}` : ''}`)
  },

  getById: (id)       => api.get(`/api/herramientas/${id}`),
  create:  (body)     => api.post('/api/herramientas', body),
  update:  (id, body) => api.put(`/api/herramientas/${id}`, body),

  updateEstado: (id, estado) =>
    api.patch(`/api/herramientas/${id}/estado`, { estado }),

  darDeBaja: (id, motivo) =>
    api.post(`/api/herramientas/${id}/baja`, { motivo }),

  reactivar: (id) =>
    api.post(`/api/herramientas/${id}/reactivar`, {}),

  getMovimientos: (herramientaId) =>
    api.get(`/api/herramientas/${herramientaId}/movimientos`),

  createMovimiento: (herramientaId, body) =>
    api.post(`/api/herramientas/${herramientaId}/movimientos`, body),

  getCategorias: () =>
    api.get('/api/categorias'),
}
