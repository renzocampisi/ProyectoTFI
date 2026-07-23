// src/shared/utils/qr.js
/**
 * Detección del tipo de código QR que el usuario acaba de escanear (issue #11).
 *
 * Los formatos que conoce el sistema:
 *   - REMITO       → "FS-NNNNN"        ej: FS-00018, FS-00043
 *   - DISPOSITIVO  → "FS-DEV-XXXXXXXX" ej: FS-DEV-1ABD152F (QR propio pegado
 *     en el dispositivo de rastreo — no el código de fábrica del proveedor)
 *   - HERRAMIENTA  → "FS-XXX-XXXXXXXX" ej: FS-TAL-1ABD152F
 *
 * El primer caso (remito) son 2 partes con dígitos al final.
 * DISPOSITIVO y HERRAMIENTA comparten forma (3 partes, última en
 * hexa-base36) — por eso DISPOSITIVO se chequea primero con el prefijo
 * literal "DEV", que si no, matchearía también el patrón genérico de
 * herramienta.
 *
 * Si el código no matchea ninguno de los patrones devolvemos
 * 'desconocido' y el scanner cae al fallback histórico (intentar como
 * herramienta + parsear como URL).
 */

const RE_REMITO      = /^FS-\d{3,}$/i
const RE_DISPOSITIVO = /^FS-DEV-[A-Z0-9]+$/i
const RE_HERRAMIENTA = /^FS-[A-Z]{1,4}-[A-Z0-9]+$/i

/**
 * @param {string} codigo  String crudo decodificado del QR (o tipeado a mano)
 * @returns {{tipo: 'remito'|'dispositivo'|'herramienta'|'desconocido', codigo: string}}
 */
export function detectarTipoQR(codigo) {
  const limpio = (codigo ?? '').trim()
  if (!limpio) return { tipo: 'desconocido', codigo: limpio }

  if (RE_REMITO.test(limpio))      return { tipo: 'remito',      codigo: limpio }
  if (RE_DISPOSITIVO.test(limpio)) return { tipo: 'dispositivo', codigo: limpio }
  if (RE_HERRAMIENTA.test(limpio)) return { tipo: 'herramienta', codigo: limpio }
  return { tipo: 'desconocido', codigo: limpio }
}
