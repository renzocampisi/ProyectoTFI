// src/shared/utils/unidades.js
/**
 * Formato de unidades de medida de materiales (`material.unidad`).
 *
 * El campo es texto libre: viene con una base fija (unidad, kg, metro,
 * litro, caja, rollo, juego, par — ver UNIDADES_BASE en MateriasNewPage.jsx)
 * más lo que cada usuario agregue a mano (Word #21), así que estas funciones
 * no dependen de un diccionario cerrado — usan reglas genéricas que cubren
 * la base y cualquier unidad custom razonable.
 */

// Unidades ya cortas (2 letras o menos) se consideran "ya abreviadas"
// (ej: "kg") y no se tocan ni para plural ni para abreviar.
function esCorta(u) {
  return u.length <= 2
}

// Abreviatura explícita para cada unidad base (ver UNIDADES_BASE en
// MateriasNewPage.jsx / MateriasEditPage.jsx / ScanMatchModal.jsx). Si se
// agrega una unidad base nueva a mano hay que sumarla acá — si no, cae al
// fallback de "primera letra" en abreviarUnidad(), que puede ser ambiguo
// (ej: "caja" y "cinta" abrevian igual a "c").
const ABREVIATURAS_BASE = {
  unidad: 'u',
  kg: 'kg',
  metro: 'm',
  litro: 'l',
  caja: 'cj',
  rollo: 'rl',
  juego: 'jg',
  par: 'pr',
}

/**
 * Pluraliza una unidad según la cantidad. 1 → singular, cualquier otro
 * valor (incluido 0) → plural. Regla genérica de español: termina en
 * vocal → +s, termina en consonante → +es (cubre unidad→unidades,
 * caja→cajas, metro→metros, bolsa→bolsas, par→pares, etc).
 */
export function pluralizarUnidad(unidad, cantidad = 2) {
  if (!unidad) return ''
  const u = unidad.trim().toLowerCase()
  if (!u) return ''
  if (Number(cantidad) === 1) return u
  if (esCorta(u)) return u
  if (/s$/.test(u)) return u
  return /[aeiouáéíóú]$/.test(u) ? `${u}s` : `${u}es`
}

// Como pluralizarUnidad pero con la primera letra en mayúscula, para
// usar como texto de "tipo" (ej: "Unidades", "Cajas").
export function tipoUnidadLabel(unidad) {
  const plural = pluralizarUnidad(unidad, 2)
  if (!plural) return '—'
  return plural.charAt(0).toUpperCase() + plural.slice(1)
}

/**
 * Abreviatura corta de una unidad para mostrar pegada a un número de
 * stock (ej: "5u", "12cj"). Las unidades base tienen abreviatura explícita
 * en ABREVIATURAS_BASE; una unidad custom ya corta (kg, m2, ...) se deja
 * tal cual, y cualquier otra custom cae a su primera letra.
 */
export function abreviarUnidad(unidad) {
  if (!unidad) return ''
  const u = unidad.trim().toLowerCase()
  if (!u) return ''
  if (ABREVIATURAS_BASE[u]) return ABREVIATURAS_BASE[u]
  if (esCorta(u)) return u
  return u.charAt(0)
}

// Cantidad + abreviatura pegada, sin espacio (ej: "5u", "12cj").
export function formatStockAbreviado(cantidad, unidad) {
  return `${cantidad}${abreviarUnidad(unidad)}`
}

// Cantidad + unidad completa pluralizada según corresponda (ej:
// "1 unidad", "5 unidades"). Para texto corrido / prosa.
export function formatStockCompleto(cantidad, unidad) {
  const u = pluralizarUnidad(unidad, cantidad)
  return u ? `${cantidad} ${u}` : `${cantidad}`
}
