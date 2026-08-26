// src/modules/m-armado/services/armado.service.js
/**
 * Service de "Kits de Montaje" (frontend) — armado de presupuestos/remitos
 * a partir de una descripción en lenguaje natural.
 *
 * `interpretar` no escribe nada: devuelve la propuesta para que el usuario
 * la revise. `confirmar` es el que aplica.
 */
import { api } from '@shared/utils/api.js'

export const ArmadoService = {
  // timeoutMs alto: el backend llama a Gemini antes de responder (mismo
  // criterio que panel.service.js y scan-match).
  interpretar: (texto, destino) =>
    api.post('/armado/interpretar', { texto, destino }, { timeoutMs: 60_000 }),

  confirmar: (payload) => api.post('/armado/confirmar', payload),
}
