// src/modules/m-presupuestos/services/presupuestos.service.js
/**
 * Service del módulo Presupuestos (frontend) — wrapper sobre /presupuestos.
 *
 * Mismo patrón espejado que ComprasService:
 *  - Mutaciones se llaman directo desde el componente y luego refetch().
 *  - Los items (insumos/costos) tienen endpoints anidados.
 *  - Transiciones de estado son POST a sub-rutas (/enviar-aprobacion, etc.).
 *  - PDF: POST multipart con `archivo`, GET devuelve signed URL.
 */
import { api } from '@shared/utils/api.js'

export const PresupuestosService = {
  // ── CRUD ───────────────────────────────────────────────────
  getAll: ({ obraId, estado } = {}) => {
    const p = new URLSearchParams()
    if (obraId) p.set('obraId', obraId)
    if (estado) p.set('estado', estado)
    const qs = p.toString()
    return api.get(`/presupuestos${qs ? `?${qs}` : ''}`)
  },
  getById:  (id)        => api.get(`/presupuestos/${id}`),
  create:   (body)      => api.post('/presupuestos', body),
  update:   (id, body)  => api.patch(`/presupuestos/${id}`, body),
  remove:   (id)        => api.delete(`/presupuestos/${id}`),

  // ── Insumos (items materiales) ─────────────────────────────
  addInsumo:    (id, body)            => api.post(`/presupuestos/${id}/insumos`, body),
  updateInsumo: (id, insumoId, body)  => api.patch(`/presupuestos/${id}/insumos/${insumoId}`, body),
  removeInsumo: (id, insumoId)        => api.delete(`/presupuestos/${id}/insumos/${insumoId}`),

  // ── Costos extra (mano de obra, viáticos, etc.) ────────────
  addCosto:    (id, body)           => api.post(`/presupuestos/${id}/costos`, body),
  updateCosto: (id, costoId, body)  => api.patch(`/presupuestos/${id}/costos/${costoId}`, body),
  removeCosto: (id, costoId)        => api.delete(`/presupuestos/${id}/costos/${costoId}`),

  // ── Transiciones de estado ─────────────────────────────────
  enviarAprobacion: (id)         => api.post(`/presupuestos/${id}/enviar-aprobacion`, {}),
  volverABorrador:  (id)         => api.post(`/presupuestos/${id}/volver-borrador`, {}),
  aprobar:          (id)         => api.post(`/presupuestos/${id}/aprobar`, {}),
  rechazar:         (id, motivo) => api.post(`/presupuestos/${id}/rechazar`, motivo ? { motivo } : {}),

  // ── PDF ───────────────────────────────────────────────────
  getPdf:    (id)       => api.get(`/presupuestos/${id}/pdf`),
  uploadPdf: (id, file) => {
    const fd = new FormData()
    fd.append('archivo', file)
    return api.postForm(`/presupuestos/${id}/pdf`, fd)
  },
}

// Service de config global del sistema. Lo usa el form de presupuestos
// para tomar el % de ganancia default y el panel de Settings.
export const ConfigService = {
  getAll:    ()              => api.get('/config'),
  get:       (key)           => api.get(`/config/${key}`),
  set:       (key, value)    => api.put(`/config/${key}`, { value }),
}
