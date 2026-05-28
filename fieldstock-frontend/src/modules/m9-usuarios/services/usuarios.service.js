// src/modules/m9-usuarios/services/usuarios.service.js
/**
 * Service del M9 — Gestión de usuarios. Solo el DUEÑO accede.
 *
 * Endpoints CRUD básicos. El `create` devuelve { usuario, passwordPlano } —
 * el frontend usa `passwordPlano` UNA SOLA VEZ para mostrarlo en el modal
 * de éxito y no lo persiste.
 */
import { api } from '@shared/utils/api.js'

export const UsuariosService = {
  getAll:    ()         => api.get('/usuarios'),
  getById:   (id)       => api.get(`/usuarios/${id}`),
  getMe:     ()         => api.get('/usuarios/me'),
  create:    (body)     => api.post('/usuarios', body),
  update:    (id, body) => api.patch(`/usuarios/${id}`, body),
  updateMe:  (body)     => api.patch('/usuarios/me', body),
  desactivar:(id)       => api.delete(`/usuarios/${id}`),
}
