// src/modules/m5-remito/components/RemitoQRModal.jsx
/**
 * Modal para mostrar e imprimir el QR físico del remito.
 *
 * Diseño paralelo al QRModal de herramientas (m3-qr/components/QRModal):
 * el valor del QR es `remito.numero` (ej: "FS-00018") porque eso es lo
 * que el scanner detecta como tipo "remito" (regex /^FS-\d{3,}$/i,
 * ver shared/utils/qr.js — issue #11) y resuelve via
 * GET /remitos/numero/:numero.
 *
 * El layout impreso es A4-portrait compacto: un solo QR centrado con
 * la info principal del remito debajo (número, obra, responsable,
 * fecha). Pensado para pegarse a un sobre o folder físico que viaja
 * con la carga.
 */
import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import styles from './RemitoQRModal.module.css'

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export default function RemitoQRModal({ remito, onClose }) {
  const printRef = useRef()

  const handlePrint = () => {
    const contenido = printRef.current.innerHTML
    const ventana = window.open('', '_blank', 'width=420,height=600')
    ventana.document.write(`
      <html>
        <head>
          <title>QR Remito ${remito.numero}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: white; }
            .qr-container { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 28px; border: 1px solid #ddd; border-radius: 10px; max-width: 280px; }
            .qr-title  { font-size: 12px; font-weight: 700; color: #444; text-transform: uppercase; letter-spacing: 0.08em; }
            .qr-numero { font-size: 22px; font-weight: 800; color: #111; font-family: monospace; }
            .qr-meta   { display: flex; flex-direction: column; gap: 2px; align-items: center; }
            .qr-meta-row { font-size: 11px; color: #555; }
            .qr-meta-label { font-weight: 600; color: #888; }
            .qr-hint   { font-size: 10px; color: #999; text-align: center; max-width: 240px; margin-top: 4px; }
            @page { size: A6; margin: 8mm; }
          </style>
        </head>
        <body>${contenido}</body>
        <script>window.onload = () => { window.print(); window.close() }</script>
      </html>
    `)
    ventana.document.close()
  }

  // El valor codificado es el número del remito — coincide con el regex
  // de detección del scanner (FS-NNNNN). Si esto cambia, hay que actualizar
  // shared/utils/qr.js (RE_REMITO).
  const qrValue = remito.numero

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Código QR del remito</h3>
          <button className={styles.btnClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.qrWrapper} ref={printRef}>
          <div className="qr-container">
            <span className="qr-title">Remito</span>
            <QRCodeSVG
              value={qrValue}
              size={220}
              bgColor="#ffffff"
              fgColor="#000000"
              level="H"
              includeMargin={true}
            />
            <span className="qr-numero">{remito.numero}</span>
            <div className="qr-meta">
              <span className="qr-meta-row">
                <span className="qr-meta-label">Obra:</span> {remito.obra}
              </span>
              {remito.responsable && (
                <span className="qr-meta-row">
                  <span className="qr-meta-label">Responsable:</span> {remito.responsable}
                </span>
              )}
              <span className="qr-meta-row">
                <span className="qr-meta-label">Egreso:</span> {formatFecha(remito.fecha_egreso)}
              </span>
            </div>
            <p className="qr-hint">Escanear con la app FieldStock al llegar a obra</p>
          </div>
        </div>

        <p className={styles.hint}>
          Código: <strong>{remito.numero}</strong> — el encargado puede
          tipearlo manualmente si no funciona el escaneo.
        </p>

        <div className={styles.actions}>
          <button className={styles.btnGhost}   onClick={onClose}>Cerrar</button>
          <button className={styles.btnPrimary} onClick={handlePrint}>🖨 Imprimir QR</button>
        </div>
      </div>
    </div>
  )
}
