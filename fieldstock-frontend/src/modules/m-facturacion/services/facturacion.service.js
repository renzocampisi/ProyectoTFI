// src/modules/m-facturacion/services/facturacion.service.js
import { api } from '@shared/utils/api.js'

export const FacturacionService = {
  getPlanes:      ()          => api.get('/planes'),
  getSuscripcion: ()          => api.get('/suscripcion'),
  elegirPlan:     (codigoPlan) => api.post('/suscripcion/elegir-plan', { codigoPlan }),
  cancelar:       ()          => api.post('/suscripcion/cancelar', {}),
}
