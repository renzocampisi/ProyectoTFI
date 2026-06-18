// src/modules/m4-obra/constants.js
/**
 * Mapeos centralizados de Obras — fuente única de verdad para labels,
 * colores y agrupamientos por estado. Antes vivía duplicado en
 * ObrasListPage y ObrasDetailPage (issue menor 3.4 de la auditoría).
 */

// 5 estados del ciclo de vida de una obra.
// `cls` matchea con las clases CSS en cada módulo que use el badge.
export const ESTADO_INFO = {
  PENDIENTE_PRESUPUESTO: { label: '⏳ Pendiente presupuesto', cls: 'pendiente' },
  EN_APROBACION:         { label: '⏰ En aprobación',         cls: 'enAprobacion' },
  ACTIVA:                { label: '● Activa',                 cls: 'activa' },
  FINALIZADA:            { label: '✓ Finalizada',             cls: 'finalizada' },
  RECHAZADA:             { label: '✕ Rechazada',              cls: 'rechazada' },
}

// Agrupamiento por bucket: "En proceso" = estados vivos, "Historial" = terminales.
// Lo usa la lista para los tabs.
export const BUCKET_EN_PROCESO = ['PENDIENTE_PRESUPUESTO', 'EN_APROBACION', 'ACTIVA']
export const BUCKET_HISTORIAL  = ['FINALIZADA', 'RECHAZADA']
