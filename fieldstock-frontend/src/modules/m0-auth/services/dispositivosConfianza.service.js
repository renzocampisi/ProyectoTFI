// src/modules/m0-auth/services/dispositivosConfianza.service.js
import { api } from '@shared/utils/api'

export const DispositivosConfianzaService = {
  registrar:     ()   => api.post('/auth/dispositivos-confianza', {}),
  listar:        ()   => api.get('/auth/dispositivos-confianza'),
  revocarUno:    (id) => api.delete(`/auth/dispositivos-confianza/${id}`),
  revocarTodos:  ()   => api.delete('/auth/dispositivos-confianza'),
}
