// src/modules/m7-directorio/services/directorio.service.js
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
