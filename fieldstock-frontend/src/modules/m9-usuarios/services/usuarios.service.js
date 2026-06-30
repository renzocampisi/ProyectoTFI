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
  // Reset administrativo. Sin body → backend autogenera. Con { password } →
  // usa esa custom (mínimo 8 chars validado en backend). Devuelve
  // { passwordPlano } UNA SOLA VEZ — mostrar en PasswordRevealModal.
  resetPassword: (id, password) => api.post(`/usuarios/${id}/reset-password`, password ? { password } : {}),

  // Lista de candidatos a responsable de remito (ENCARGADO / DUEÑO / ADMIN
  // activos) con flag `ocupado: true` si tienen al menos un remito en
  // estado distinto a CERRADO. Usado por el modal post-aprobacion.
  getEncargadosDisponibles: () => api.get('/usuarios/encargados-disponibles'),
}
