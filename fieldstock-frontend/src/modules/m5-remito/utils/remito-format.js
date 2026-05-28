// src/modules/m5-remito/utils/remito-format.js
/**
 * Helpers de formateo compartidos para mostrar un remito en la UI.
 *
 * nombreRemito() arma el texto "Cliente - Obra" que usamos como
 * identificador legible en listados, encabezados, PDFs y QR. La idea
 * (feedback de usuario) es que cuando un mismo cliente tiene varias
 * obras, se distinga rápido de cuál se trata sin tener que abrir el
 * detalle.
 *
 * Fallbacks:
 *   - cliente + obra  → "Cliente - Obra"
 *   - solo obra       → "Obra"
 *   - solo cliente    → "Cliente"
 *   - ninguno         → "Sin asignar"
 *
 * Asume que `remito` viene de la vista `remitos_resumen` (que ya
 * expone `cliente_nombre` joineado desde la tabla clientes).
 */
export function nombreRemito(remito) {
  if (!remito) return 'Sin asignar'
  const cliente = remito.cliente_nombre?.trim()
  const obra    = remito.obra?.trim()
  if (cliente && obra) return `${cliente} - ${obra}`
  return cliente || obra || 'Sin asignar'
}
