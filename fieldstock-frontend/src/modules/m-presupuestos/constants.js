// src/modules/m-presupuestos/constants.js
/**
 * Mapeos centralizados de Presupuestos: labels para estados, categorias
 * de costos, helpers de formato. Single source of truth.
 */

export const ESTADO_INFO = {
  BORRADOR:       { label: 'Borrador',       cls: 'estadoBorrador',       descripcion: 'Editable, todavía no enviado a aprobación.' },
  EN_APROBACION:  { label: 'En aprobación',  cls: 'estadoEnAprobacion',   descripcion: 'Esperando decisión del dueño/admin.' },
  APROBADO:       { label: 'Aprobado',       cls: 'estadoAprobado',       descripcion: 'Se generó un remito BORRADOR con los insumos.' },
  RECHAZADO:      { label: 'Rechazado',      cls: 'estadoRechazado',      descripcion: 'No avanzó. Se puede crear una nueva versión.' },
}

export const CATEGORIA_INFO = {
  MANO_OBRA:      { label: 'Mano de obra',   icon: '👷' },
  VIATICOS:       { label: 'Viáticos',       icon: '🚗' },
  SEGUROS:        { label: 'Seguros',        icon: '🛡️' },
  PERSONAL_EXTRA: { label: 'Personal extra', icon: '👥' },
  OTROS:          { label: 'Otros',          icon: '📋' },
}

// Todas las categorías validas (DB constraint).
export const CATEGORIAS = Object.keys(CATEGORIA_INFO)

// Categoría reservada para el bloque "Mano de obra" — se carga aparte
// con campos especificos (rubro, cantidad, costo unitario) sin unidad.
export const CATEGORIA_MANO_OBRA = 'MANO_OBRA'

// Categorías disponibles para el bloque "Costos extras" (todas menos
// mano de obra). El form de costos extras usa esta lista para popular
// el select — mano de obra NO aparece como opción porque tiene su
// propio bloque dedicado arriba.
export const CATEGORIAS_EXTRA = CATEGORIAS.filter(c => c !== CATEGORIA_MANO_OBRA)

// Helpers de formato. Mismos patrones que m-compras/constants.js.
export function formatMoney(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
  }).format(num)
}

export function formatCantidad(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  // Si es entero no muestro decimales, si no, hasta 2.
  return Number.isInteger(num) ? String(num) : num.toFixed(2)
}

export function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function formatFechaHora(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
