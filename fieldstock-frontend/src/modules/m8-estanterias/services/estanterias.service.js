// src/modules/m8-estanterias/services/estanterias.service.js
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
