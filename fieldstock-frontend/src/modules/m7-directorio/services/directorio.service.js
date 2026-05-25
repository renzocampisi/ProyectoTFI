// src/modules/m7-directorio/services/directorio.service.js
/**
 * Service del M7 (frontend) — wrapper sobre el backend de directorio.
 *
 * Exporta DOS objetos espejados: TransportesService y ClientesService.
 * Esta separación matchea la decisión del backend de mantener los dos CRUDs
 * en tablas/endpoints separados pero con la misma forma (ver
 * directorio.controller).
 *
 * `delete` aplica borrado SOFT en el backend (no hard delete).
 */
import { api } from '@shared/utils/api.js'

export const TransportesService = {
  getAll:  ({ q } = {}) => api.get(`/api/transportes${q ? `?q=${q}` : ''}`),
  create:  (body)        => api.post('/api/transportes', body),
  update:  (id, body)    => api.put(`/api/transportes/${id}`, body),
  delete:  (id)          => api.delete(`/api/transportes/${id}`),
}

export const ClientesService = {
  getAll:  ({ q } = {}) => api.get(`/api/clientes${q ? `?q=${q}` : ''}`),
  create:  (body)        => api.post('/api/clientes', body),
  update:  (id, body)    => api.put(`/api/clientes/${id}`, body),
  delete:  (id)          => api.delete(`/api/clientes/${id}`),
}
