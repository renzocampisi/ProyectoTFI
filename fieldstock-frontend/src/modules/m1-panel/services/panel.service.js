// src/modules/m1-panel/services/panel.service.js
/**
 * Service del M1 Panel IA (frontend) — wrapper sobre el backend /panel.
 *
 * El timeout default de api.js es 15s, pero el backend del panel encadena
 * llamadas al LLM con tool use y puede tardar 20-40s en el peor caso. Por
 * eso pasamos un timeoutMs explicito de 60s.
 *
 * @typedef {{ role: 'user' | 'assistant', content: string }} Mensaje
 * @typedef {{ tool: string, args: object, ok: boolean }}     TrazaItem
 * @typedef {{ respuesta: string, traza: TrazaItem[] }}       Respuesta
 */
import { api } from '@shared/utils/api.js'

export const PanelService = {
  /**
   * @param {string}    mensaje    Pregunta del usuario.
   * @param {Mensaje[]} historial  Turnos previos del chat.
   * @returns {Promise<Respuesta>}
   */
  chat: (mensaje, historial = []) =>
    api.post('/panel/chat', { mensaje, historial }, { timeoutMs: 60_000 }),
}
