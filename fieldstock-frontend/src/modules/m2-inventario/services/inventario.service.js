// src/modules/m2-inventario/services/inventario.service.js
/**
 * Service del M2 (frontend) — wrapper sobre el backend de herramientas.
 *
 * Patrón estándar de los services del frontend:
 *   export const NombreService = { metodo1, metodo2, ... }
 *
 * Cada método mapea 1:1 contra un endpoint del backend (ver routes/index.js).
 * No tiene state, no usa React — solo arma URLs y delega a `api`.
 *
 * `incluirBajas` es un flag opcional para la lista (mostrar también las
 * herramientas dadas de baja); por defecto se filtran.
 *
 * `getCategorias` existe pero hoy las páginas siguen leyendo CATEGORIAS
 * del archivo de constantes (inventario.mock.js) — pendiente del cleanup H2.
 */
import { api } from '@shared/utils/api.js'

export const InventarioService = {
  getAll: ({ estado, categoriaId, q, incluirBajas } = {}) => {
    const params = new URLSearchParams()
    if (estado)       params.set('estado',       estado)
    if (categoriaId)  params.set('categoriaId',  categoriaId)
    if (q)            params.set('q',            q)
    if (incluirBajas) params.set('incluirBajas', 'true')
    const qs = params.toString()
    return api.get(`/herramientas${qs ? `?${qs}` : ''}`)
  },

  getById: (id)       => api.get(`/herramientas/${id}`),
  create:  (body)     => api.post('/herramientas', body),
  update:  (id, body) => api.put(`/herramientas/${id}`, body),

  updateEstado: (id, estado) =>
    api.patch(`/herramientas/${id}/estado`, { estado }),

  darDeBaja: (id, motivo) =>
    api.post(`/herramientas/${id}/baja`, { motivo }),

  reactivar: (id) =>
    api.post(`/herramientas/${id}/reactivar`, {}),

  getMovimientos: (herramientaId) =>
    api.get(`/herramientas/${herramientaId}/movimientos`),

  createMovimiento: (herramientaId, body) =>
    api.post(`/herramientas/${herramientaId}/movimientos`, body),

  getCategorias: () =>
    api.get('/categorias'),
}
