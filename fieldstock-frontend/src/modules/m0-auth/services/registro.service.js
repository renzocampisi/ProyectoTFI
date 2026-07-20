// src/modules/m0-auth/services/registro.service.js
import { api } from '@shared/utils/api'

export const RegistroService = {
  getEstado:              ()     => api.get('/auth/estado'),
  registrarDueño:         (body) => api.post('/auth/registro-dueno', body),
  registrarConInvitacion: (body) => api.post('/auth/registro-invitado', body),
}
