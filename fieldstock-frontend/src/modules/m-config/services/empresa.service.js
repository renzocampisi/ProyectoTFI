// src/modules/m-config/services/empresa.service.js
/**
 * Datos de la empresa dueña de esta instancia — nombre, teléfono,
 * dirección, email. Se usa desde ConfigPage (para editar, DUEÑO/ADMIN)
 * y desde AppLayout vía useEmpresa (para mostrar el nombre en el
 * header, cualquier rol).
 */
import { api } from '@shared/utils/api.js'

export const EmpresaService = {
  get: ()     => api.get('/empresa'),
  set: (body) => api.put('/empresa', body),
}
