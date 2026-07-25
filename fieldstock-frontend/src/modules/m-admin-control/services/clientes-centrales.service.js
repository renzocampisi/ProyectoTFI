// src/modules/m-admin-control/services/clientes-centrales.service.js
import { api } from '@shared/utils/api.js'

export const ClientesCentralesService = {
  getAll: () => api.get('/central/clientes'),
  liberarDispositivo: (clienteId, codigoQR) =>
    api.post(`/central/clientes/${clienteId}/liberar-dispositivo`, { codigoQR }),
}
