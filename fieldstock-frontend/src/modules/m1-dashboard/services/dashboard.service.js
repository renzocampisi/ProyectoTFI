// src/modules/m1-dashboard/services/dashboard.service.js
/**
 * Service del Dashboard de inicio (Word #16).
 * Único endpoint — el backend ya devuelve agregado todo lo que pinta la home.
 */
import { api } from '@shared/utils/api.js'

export const DashboardService = {
  getResumen: () => api.get('/dashboard'),
}
