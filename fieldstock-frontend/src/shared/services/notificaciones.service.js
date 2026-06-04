// src/shared/services/notificaciones.service.js
/**
 * Service de Notificaciones (frontend) — wrapper sobre el backend.
 *
 * Las notificaciones son globales (no por usuario): cualquier user logueado
 * ve la misma bandeja. Útil para alertas operativas del galpón: problemas
 * reportados en remitos, herramientas vencidas, stock bajo, etc.
 *
 * Patrón espejado del backend:
 *   GET    /notificaciones                  → últimas 50
 *   GET    /notificaciones?soloNoLeidas=true → solo no leídas
 *   POST   /notificaciones                  → crear (poco usado del front)
 *   PATCH  /notificaciones/:id/leida        → marcar 1 como leída
 *   PATCH  /notificaciones/todas-leidas     → marcar todas
 */
import { api } from '@shared/utils/api.js'

export const NotificacionesService = {
  getAll:           ({ soloNoLeidas } = {}) =>
    api.get(`/notificaciones${soloNoLeidas ? '?soloNoLeidas=true' : ''}`),
  marcarLeida:      (id) => api.patch(`/notificaciones/${id}/leida`),
  marcarTodasLeidas: () => api.patch('/notificaciones/todas-leidas'),
}
