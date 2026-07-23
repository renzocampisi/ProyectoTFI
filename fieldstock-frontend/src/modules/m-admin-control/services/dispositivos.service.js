// src/modules/m-admin-control/services/dispositivos.service.js
import { api } from '@shared/utils/api.js'

export const DispositivosService = {
  getAll:     ()                                => api.get('/dispositivos'),
  crear:      (codigoQR, imeiProveedor)         => api.post('/dispositivos', { codigoQR, imeiProveedor }),
  emparejar:  (codigoQR, herramientaId)         => api.post('/dispositivos/emparejar', { codigoQR, herramientaId }),
  liberar:    (id)                              => api.post(`/dispositivos/${id}/liberar`, {}),
  darDeBaja:  (id)                              => api.post(`/dispositivos/${id}/dar-de-baja`, {}),
}
