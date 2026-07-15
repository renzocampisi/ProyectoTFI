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

  /**
   * Confirma y ejecuta una accion propuesta (campo `accionPendiente` de chat()).
   * 45s (no 15s default) porque `crear_presupuesto_guiado` encadena varias
   * escrituras secuenciales (materiales nuevos + insumos + costo) y re-valida
   * todo via preview() antes de ejecutar — más lento que una acción de un
   * solo campo.
   * @param {string} tool
   * @param {object} args
   * @returns {Promise<{ resumen: string, detalle: object }>}
   */
  ejecutarAccion: (tool, args) =>
    api.post('/panel/ejecutar-accion', { tool, args }, { timeoutMs: 45_000 }),
}
