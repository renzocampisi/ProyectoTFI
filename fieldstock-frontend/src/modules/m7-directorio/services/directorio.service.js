// src/modules/m7-directorio/services/directorio.service.js
/**
 * Service del M6/M7 (frontend) — wrapper sobre el backend de directorio.
 *
 * Exporta TRES objetos espejados: TransportesService, ClientesService y
 * ProveedoresService. Esta separación matchea la decisión del backend de
 * mantener los CRUDs en tablas/endpoints separados pero con la misma forma
 * (ver directorio.controller).
 *
 * `delete` aplica borrado SOFT en el backend (no hard delete).
 */
import { api } from '@shared/utils/api.js'

// Arma el query string con URLSearchParams (encodea `q`) en vez de
// concatenar a mano — un valor con `&`, `#` o `+` (ej. "Juan & Cía")
// rompía la URL y mandaba una búsqueda distinta a la tipeada.
const qs = (q) => {
  if (!q) return ''
  return `?${new URLSearchParams({ q }).toString()}`
}

export const TransportesService = {
  getAll:  ({ q } = {}) => api.get(`/transportes${qs(q)}`),
  create:  (body)        => api.post('/transportes', body),
  update:  (id, body)    => api.put(`/transportes/${id}`, body),
  delete:  (id)          => api.delete(`/transportes/${id}`),
}

export const ClientesService = {
  getAll:  ({ q } = {}) => api.get(`/clientes${qs(q)}`),
  create:  (body)        => api.post('/clientes', body),
  update:  (id, body)    => api.put(`/clientes/${id}`, body),
  delete:  (id)          => api.delete(`/clientes/${id}`),
}

export const ProveedoresService = {
  getAll:  ({ q } = {}) => api.get(`/proveedores${qs(q)}`),
  create:  (body)        => api.post('/proveedores', body),
  update:  (id, body)    => api.put(`/proveedores/${id}`, body),
  delete:  (id)          => api.delete(`/proveedores/${id}`),
}
