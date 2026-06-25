// src/modules/m-presupuestos/utils/pdfGenerator.js
/**
 * Generador del PDF de un presupuesto usando jsPDF + jspdf-autotable.
 *
 * El PDF se arma 100% client-side y se descarga directamente (sin pasar
 * por backend ni Storage). El bucket `presupuestos-pdf` queda disponible
 * por si en el futuro queremos guardar el PDF generado para historial.
 *
 * Layout (A4 vertical):
 *   - Header: número grande, estado, fecha
 *   - Datos cliente/obra
 *   - Tabla insumos con subtotal
 *   - Tablas por categoría de costos (solo las que tienen items)
 *   - Sección de totales con ganancia desglosada
 *   - Footer con número de página
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { CATEGORIA_INFO, formatMoney, formatCantidad, formatFecha } from '../constants'

// Colores de la paleta del sistema (matchea el theme oscuro de la app
// pero para PDF usamos versiones que se ven bien en papel blanco)
const COLOR_PRIMARY  = [29, 159, 102]   // verde
const COLOR_TEXT     = [40, 40, 40]
const COLOR_MUTED    = [120, 120, 120]
const COLOR_BORDER   = [220, 220, 220]
const COLOR_HEADER   = [245, 245, 245]

const MARGIN = 14

function header(doc, presupuesto) {
  doc.setFontSize(20).setTextColor(...COLOR_PRIMARY).setFont('helvetica', 'bold')
  doc.text('FieldStock AI', MARGIN, 18)

  doc.setFontSize(10).setTextColor(...COLOR_MUTED).setFont('helvetica', 'normal')
  doc.text('Presupuesto', MARGIN, 24)

  // Caja derecha con número + fecha
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFontSize(16).setTextColor(...COLOR_TEXT).setFont('helvetica', 'bold')
  doc.text(presupuesto.numero, pageW - MARGIN, 18, { align: 'right' })
  doc.setFontSize(9).setTextColor(...COLOR_MUTED).setFont('helvetica', 'normal')
  doc.text(`Fecha: ${formatFecha(presupuesto.fecha_creacion)}`, pageW - MARGIN, 24, { align: 'right' })

  // Linea separadora
  doc.setDrawColor(...COLOR_BORDER).setLineWidth(0.4)
  doc.line(MARGIN, 28, pageW - MARGIN, 28)
}

function datosClienteObra(doc, presupuesto, startY) {
  doc.setFontSize(11).setTextColor(...COLOR_TEXT).setFont('helvetica', 'bold')
  doc.text('Datos del cliente y obra', MARGIN, startY)

  const obra = presupuesto.obra || {}
  const lines = [
    ['Cliente:',  obra.cliente || '-'],
    ['Obra:',     obra.nombre  || '-'],
    ['Dirección:', obra.direccion || '-'],
  ]

  doc.setFontSize(10).setFont('helvetica', 'normal')
  let y = startY + 6
  for (const [label, value] of lines) {
    doc.setTextColor(...COLOR_MUTED).setFont('helvetica', 'bold')
    doc.text(label, MARGIN, y)
    doc.setTextColor(...COLOR_TEXT).setFont('helvetica', 'normal')
    doc.text(String(value), MARGIN + 22, y)
    y += 5
  }

  return y + 4
}

function tablaInsumos(doc, insumos, startY) {
  if (!insumos?.length) return startY

  doc.setFontSize(11).setTextColor(...COLOR_TEXT).setFont('helvetica', 'bold')
  doc.text('Insumos', MARGIN, startY)

  const rows = insumos.map(i => [
    i.material?.nombre || '-',
    formatCantidad(i.cantidad),
    i.material?.unidad || 'unidad',
    formatMoney(i.precio_unitario),
    formatMoney(i.subtotal),
  ])

  autoTable(doc, {
    startY: startY + 3,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Material', 'Cant.', 'Unidad', 'Precio unit.', 'Subtotal']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5, textColor: COLOR_TEXT, lineColor: COLOR_BORDER },
    headStyles: { fillColor: COLOR_HEADER, textColor: COLOR_TEXT, fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
    },
  })

  return doc.lastAutoTable.finalY + 4
}

function tablaCostosPorCategoria(doc, costos, startY) {
  if (!costos?.length) return startY

  // Agrupar por categoria
  const porCat = costos.reduce((acc, c) => {
    (acc[c.categoria] ||= []).push(c)
    return acc
  }, {})

  let y = startY
  for (const [cat, items] of Object.entries(porCat)) {
    const info = CATEGORIA_INFO[cat]
    doc.setFontSize(11).setTextColor(...COLOR_TEXT).setFont('helvetica', 'bold')
    doc.text(info?.label || cat, MARGIN, y)

    const rows = items.map(c => [
      c.descripcion,
      formatCantidad(c.cantidad),
      c.unidad || '-',
      formatMoney(c.costo_unitario),
      formatMoney(c.subtotal),
    ])

    autoTable(doc, {
      startY: y + 3,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Descripción', 'Cant.', 'Unidad', 'Costo unit.', 'Subtotal']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5, textColor: COLOR_TEXT, lineColor: COLOR_BORDER },
      headStyles: { fillColor: COLOR_HEADER, textColor: COLOR_TEXT, fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
    })

    y = doc.lastAutoTable.finalY + 5
  }

  return y
}

function totales(doc, presupuesto, startY) {
  const pageW = doc.internal.pageSize.getWidth()
  const xLabel = pageW - MARGIN - 70
  const xVal   = pageW - MARGIN

  const subInsumos = Number(presupuesto.subtotal_insumos) || 0
  const subCostos  = Number(presupuesto.subtotal_costos)  || 0
  const pct        = Number(presupuesto.porcentaje_ganancia) || 0
  const ganancia   = subInsumos * (pct / 100)
  // En el PDF al cliente NO mostramos la ganancia como linea separada
  // — la disolvemos dentro de los costos extra (concretamente en los
  // items de Mano de obra, ver aplicarGananciaEnManoDeObra). Mostrar
  // "+ Costos extra" con el monto inflado mantiene el total cuadrado.
  const costosVisibles = subCostos + ganancia

  const lines = [
    ['Subtotal insumos',  formatMoney(subInsumos),       false],
    ['+ Costos extra',    formatMoney(costosVisibles),   false],
    ['Total',             formatMoney(presupuesto.total), true],
  ]

  // Issue 2.8: el bloque de totales (4 filas + total grande) ocupa ~30mm.
  // Si no entra en la pagina actual, salta a una nueva antes de empezar.
  startY = ensureSpace(doc, startY, 32)

  doc.setDrawColor(...COLOR_BORDER).setLineWidth(0.3)
  doc.line(xLabel, startY, xVal, startY)

  let y = startY + 5
  for (const [label, value, bold] of lines) {
    if (bold) {
      // Padding extra antes del bold + linea separadora bien arriba del
      // texto, para que no quede tachando el numero del total (bug del 25/06:
      // con fontSize 12 bold el texto ocupa ~4-5mm hacia arriba desde y,
      // antes la linea en y-2 caia adentro del texto y lo tapaba).
      y += 3
      doc.setDrawColor(...COLOR_TEXT).setLineWidth(0.6)
      doc.line(xLabel, y - 6, xVal, y - 6)
      doc.setFontSize(12).setFont('helvetica', 'bold').setTextColor(...COLOR_PRIMARY)
    } else {
      doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(...COLOR_TEXT)
    }
    doc.text(label, xLabel, y)
    doc.text(value, xVal, y, { align: 'right' })
    y += bold ? 7 : 5
  }

  return y
}

// Garantiza que quedan `needed` mm libres antes del footer en la pagina
// actual. Si no entran, agrega pagina nueva y devuelve el y inicial de
// la nueva pagina (margen superior). Issue 2.8: antes el bloque de
// observaciones largas podia pisar el footer.
function ensureSpace(doc, y, needed) {
  const pageH      = doc.internal.pageSize.getHeight()
  const FOOTER_RES = 18  // 8mm del footer + 10mm de padding visual
  if (y + needed > pageH - FOOTER_RES) {
    doc.addPage()
    return MARGIN  // reset al margen superior de la pagina nueva
  }
  return y
}

function observaciones(doc, presupuesto, startY) {
  if (!presupuesto.observaciones) return startY

  doc.setTextColor(...COLOR_TEXT).setFont('helvetica', 'normal').setFontSize(10)
  const lines = doc.splitTextToSize(
    presupuesto.observaciones,
    doc.internal.pageSize.getWidth() - MARGIN * 2,
  )
  // Espacio que ocuparia: titulo (5mm) + lineas (4mm c/u) + padding (3mm)
  const needed = 5 + lines.length * 4 + 3
  const y = ensureSpace(doc, startY, needed)

  doc.setFontSize(10).setTextColor(...COLOR_MUTED).setFont('helvetica', 'bold')
  doc.text('Observaciones:', MARGIN, y)
  doc.setTextColor(...COLOR_TEXT).setFont('helvetica', 'normal')
  doc.text(lines, MARGIN, y + 5)
  return y + 5 + lines.length * 4
}

function footer(doc) {
  const pageCount = doc.internal.getNumberOfPages()
  const pageH = doc.internal.pageSize.getHeight()
  const pageW = doc.internal.pageSize.getWidth()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8).setTextColor(...COLOR_MUTED).setFont('helvetica', 'normal')
    doc.text(`Página ${i} de ${pageCount}`, pageW - MARGIN, pageH - 8, { align: 'right' })
    doc.text(`Generado el ${formatFecha(new Date().toISOString())}`, MARGIN, pageH - 8)
  }
}

/**
 * Distribuye la ganancia (subInsumos * pct/100) entre los items de
 * categoria MANO_OBRA proporcionalmente al subtotal de cada uno. Si no
 * hay items de MANO_OBRA, agrega una fila nueva con esa ganancia.
 *
 * Esto se hace SOLO en el PDF al cliente — la app interna sigue
 * mostrando la ganancia desglosada para uso del dueno/encargado.
 *
 * Devuelve un array nuevo (no muta el original).
 */
function aplicarGananciaEnManoDeObra(costos, ganancia) {
  if (!(ganancia > 0)) return costos || []
  const arr = (costos || []).map(c => ({ ...c }))

  const manoDeObra = arr.filter(c => c.categoria === 'MANO_OBRA')
  const totalManoObra = manoDeObra.reduce((s, c) => s + Number(c.subtotal || 0), 0)

  if (manoDeObra.length === 0) {
    arr.push({
      categoria:      'MANO_OBRA',
      descripcion:    'Mano de obra',
      cantidad:       1,
      unidad:         '-',
      costo_unitario: ganancia,
      subtotal:       ganancia,
    })
    return arr
  }

  if (totalManoObra <= 0) {
    // Items existen en $0 — repartir parejo
    const porItem = ganancia / manoDeObra.length
    for (const item of manoDeObra) {
      item.subtotal = Number(item.subtotal || 0) + porItem
      const cant = Number(item.cantidad) || 1
      item.costo_unitario = item.subtotal / cant
    }
    return arr
  }

  for (const item of manoDeObra) {
    const proporcion    = Number(item.subtotal) / totalManoObra
    const gananciaItem  = ganancia * proporcion
    item.subtotal       = Number(item.subtotal) + gananciaItem
    const cant          = Number(item.cantidad) || 1
    item.costo_unitario = item.subtotal / cant
  }
  return arr
}

// Helper interno: arma el PDF completo y devuelve { doc, fileName }.
// Single source of truth para el layout — descargar y subir reusan esto.
function construirPdf(presupuesto) {
  const doc = new jsPDF('p', 'mm', 'a4')

  // Inflar Mano de obra con la ganancia ANTES de pasar a las tablas.
  const subInsumos = Number(presupuesto.subtotal_insumos) || 0
  const pct        = Number(presupuesto.porcentaje_ganancia) || 0
  const ganancia   = subInsumos * (pct / 100)
  const costosVisibles = aplicarGananciaEnManoDeObra(presupuesto.costos, ganancia)

  header(doc, presupuesto)
  let y = datosClienteObra(doc, presupuesto, 36)
  y = tablaInsumos(doc, presupuesto.insumos, y)
  y = tablaCostosPorCategoria(doc, costosVisibles, y)
  y = totales(doc, presupuesto, y + 2)
  observaciones(doc, presupuesto, y + 6)
  footer(doc)

  const fileName = `${presupuesto.numero}-${presupuesto.obra?.nombre || 'presupuesto'}`
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    + '.pdf'

  return { doc, fileName }
}

/**
 * Genera y descarga el PDF de un presupuesto (lo dispara el browser).
 * @param {object} presupuesto El detalle completo (con insumos y costos).
 */
export function descargarPdfPresupuesto(presupuesto) {
  const { doc, fileName } = construirPdf(presupuesto)
  doc.save(fileName)
}

/**
 * Genera el PDF y devuelve un File listo para uploadear al backend.
 * Issue 2.9: para guardar copia oficial en el bucket Storage.
 * @param {object} presupuesto El detalle completo.
 * @returns {File} archivo PDF con el nombre derivado del presupuesto.
 */
export function generarFilePdfPresupuesto(presupuesto) {
  const { doc, fileName } = construirPdf(presupuesto)
  const blob = doc.output('blob')
  return new File([blob], fileName, { type: 'application/pdf' })
}

/**
 * Abre el PDF en una pestana nueva y dispara el dialogo de imprimir del
 * browser. La pestana queda abierta para que el usuario pueda revisar
 * antes de imprimir. Si el browser bloquea pop-ups, el llamador deberia
 * mostrar un mensaje sugiriendo descargar e imprimir manualmente.
 */
export function imprimirPdfPresupuesto(presupuesto) {
  const { doc } = construirPdf(presupuesto)
  const blob = doc.output('blob')
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (!win) {
    // Pop-up bloqueado: liberamos la URL y avisamos via throw.
    URL.revokeObjectURL(url)
    const err = new Error('El navegador bloqueó la ventana. Habilitá pop-ups para imprimir.')
    err.code = 'POPUP_BLOCKED'
    throw err
  }
  // Disparar print apenas se cargue el PDF en la pestana nueva.
  // Pequeño delay para que el viewer del PDF arme su layout.
  win.addEventListener('load', () => setTimeout(() => win.print(), 300))
  // Liberar el objeto URL despues de un rato (el PDF ya esta cacheado).
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
