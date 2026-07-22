// src/modules/m-kits/services/kits.service.js
/**
 * Service del módulo Kits (frontend) — wrapper sobre el backend de kits.
 *
 * Un kit es una plantilla de herramientas + materiales que se usan juntos
 * (ej. "kit soldadura"). CRUD básico; agregar un kit a un remito vive en
 * RemitosService.agregarKit (m5-remito) porque el endpoint cuelga de
 * /remitos/:id/kits/:kitId, no de /kits.
 */
import { api } from '@shared/utils/api.js'

export const KitsService = {
  getAll:  ({ q } = {}) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    const qs = p.toString()
    return api.get(`/kits${qs ? `?${qs}` : ''}`)
  },
  getById: (id)       => api.get(`/kits/${id}`),
  create:  (body)     => api.post('/kits', body),
  update:  (id, body) => api.put(`/kits/${id}`, body),
  remove:  (id)       => api.delete(`/kits/${id}`),
  // Kits que incluyen una herramienta puntual — usado desde la ficha de la
  // herramienta (InventarioDetailPage), ya no hay un listado propio de kits.
  getByHerramienta: (herramientaId) => api.get(`/herramientas/${herramientaId}/kits`),
}
