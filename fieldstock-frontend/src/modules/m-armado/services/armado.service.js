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
  // criterio que panel.service.js y scan-match). Con foto adjunta pasa a
  // multipart (mismo patrón que scanMatchProponer en compras.service.js);
  // sin foto sigue mandando JSON puro, sin tocar el caso existente.
  interpretar: (texto, destino, foto) => {
    if (foto) {
      const fd = new FormData()
      fd.append('texto', texto)
      fd.append('destino', destino)
      fd.append('foto', foto)
      return api.postForm('/armado/interpretar', fd, { timeoutMs: 60_000 })
    }
    return api.post('/armado/interpretar', { texto, destino }, { timeoutMs: 60_000 })
  },

  // Con foto adjunta (mismo File que ya se usó en interpretar) pasa a
  // multipart — el payload viaja serializado en un campo porque un campo
  // multipart es siempre texto plano. Se reenvía acá (no se sube en
  // interpretar) porque interpretar() es de solo lectura — ver
  // _plans/historial-obra/architecture.html.
  confirmar: (payload, foto) => {
    if (foto) {
      const fd = new FormData()
      fd.append('payload', JSON.stringify(payload))
      fd.append('foto', foto)
      return api.postForm('/armado/confirmar', fd)
    }
    return api.post('/armado/confirmar', payload)
  },
}
