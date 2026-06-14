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

  const lines = [
    ['Subtotal insumos',                       formatMoney(subInsumos), false],
    [`+ Ganancia (${pct}% sobre insumos)`,     formatMoney(ganancia),   false],
    ['+ Costos extra',                         formatMoney(subCostos),  false],
    ['Total',                                  formatMoney(presupuesto.total), true],
  ]

  doc.setDrawColor(...COLOR_BORDER).setLineWidth(0.3)
  doc.line(xLabel, startY, xVal, startY)

  let y = startY + 5
  for (const [label, value, bold] of lines) {
    if (bold) {
      doc.setDrawColor(...COLOR_TEXT).setLineWidth(0.6)
      doc.line(xLabel, y - 2, xVal, y - 2)
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

function observaciones(doc, presupuesto, startY) {
  if (!presupuesto.observaciones) return startY

  doc.setFontSize(10).setTextColor(...COLOR_MUTED).setFont('helvetica', 'bold')
  doc.text('Observaciones:', MARGIN, startY)
  doc.setTextColor(...COLOR_TEXT).setFont('helvetica', 'normal')
  const lines = doc.splitTextToSize(presupuesto.observaciones, doc.internal.pageSize.getWidth() - MARGIN * 2)
  doc.text(lines, MARGIN, startY + 5)
  return startY + 5 + lines.length * 4
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
 * Genera y descarga el PDF de un presupuesto.
 * @param {object} presupuesto El detalle completo (con insumos y costos).
 */
export function descargarPdfPresupuesto(presupuesto) {
  const doc = new jsPDF('p', 'mm', 'a4')

  header(doc, presupuesto)
  let y = datosClienteObra(doc, presupuesto, 36)
  y = tablaInsumos(doc, presupuesto.insumos, y)
  y = tablaCostosPorCategoria(doc, presupuesto.costos, y)
  y = totales(doc, presupuesto, y + 2)
  observaciones(doc, presupuesto, y + 6)
  footer(doc)

  const fileName = `${presupuesto.numero}-${presupuesto.obra?.nombre || 'presupuesto'}`
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    + '.pdf'
  doc.save(fileName)
}
