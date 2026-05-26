// src/shared/utils/qr.js
/**
 * Detección del tipo de código QR que el usuario acaba de escanear (issue #11).
 *
 * Los dos formatos que conoce el sistema:
 *   - REMITO       → "FS-NNNNN"        ej: FS-00018, FS-00043
 *   - HERRAMIENTA  → "FS-XXX-XXXXXXXX" ej: FS-TAL-1ABD152F
 *
 * El primer caso (remito) son 2 partes con dígitos al final.
 * El segundo (herramienta) son 3 partes con la última en hexa-base36.
 *
 * Si el código no matchea ninguno de los dos patrones devolvemos
 * 'desconocido' y el scanner cae al fallback histórico (intentar como
 * herramienta + parsear como URL).
 */

const RE_REMITO      = /^FS-\d{3,}$/i
const RE_HERRAMIENTA = /^FS-[A-Z]{1,4}-[A-Z0-9]+$/i

/**
 * @param {string} codigo  String crudo decodificado del QR (o tipeado a mano)
 * @returns {{tipo: 'remito'|'herramienta'|'desconocido', codigo: string}}
 */
export function detectarTipoQR(codigo) {
  const limpio = (codigo ?? '').trim()
  if (!limpio) return { tipo: 'desconocido', codigo: limpio }

  if (RE_REMITO.test(limpio))      return { tipo: 'remito',      codigo: limpio }
  if (RE_HERRAMIENTA.test(limpio)) return { tipo: 'herramienta', codigo: limpio }
  return { tipo: 'desconocido', codigo: limpio }
}
