// src/modules/m9-usuarios/services/invitaciones.service.js
import { api } from '@shared/utils/api.js'

export const InvitacionesService = {
  getAll:  ()       => api.get('/invitaciones'),
  generar: (role)   => api.post('/invitaciones', { role }),
}
