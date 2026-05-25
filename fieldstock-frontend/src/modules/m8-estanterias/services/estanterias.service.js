// src/modules/m8-estanterias/services/estanterias.service.js
/**
 * Service del M8 (frontend) — wrapper sobre el backend de estanterías.
 *
 * CRUD + manipulación de contenido (addItem, removeItem, moverItem).
 *
 * `getByQR` recibe el código de QR escaneado en el celular (formato
 * FS-EST-NNN) — se `encodeURIComponent` por seguridad aunque hoy el
 * formato no incluye caracteres especiales.
 *
 * `remove` aplica borrado SOFT (activa=false) en el backend.
 */
import { api } from '@shared/utils/api.js'

export const EstanteriasService = {
  getAll:      ()              => api.get('/api/estanterias'),
  getById:     (id)            => api.get(`/api/estanterias/${id}`),
  getByQR:     (qr)            => api.get(`/api/estanterias/qr/${encodeURIComponent(qr)}`),
  create:      (body)          => api.post('/api/estanterias', body),
  update:      (id, body)      => api.put(`/api/estanterias/${id}`, body),
  remove:      (id)            => api.delete(`/api/estanterias/${id}`),
  addItem:     (id, body)      => api.post(`/api/estanterias/${id}/items`, body),
  removeItem:  (id, itemId)    => api.delete(`/api/estanterias/${id}/items/${itemId}`),
  moverItem:   (id, itemId, nuevaEstanteriaId) =>
    api.patch(`/api/estanterias/${id}/items/${itemId}/mover`, { nuevaEstanteriaId }),
}
