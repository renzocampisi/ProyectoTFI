// src/modules/m3-qr/components/QRModal.jsx
import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import styles from './QRModal.module.css'

export default function QRModal({ herramienta, onClose }) {
  const printRef = useRef()

  const handlePrint = () => {
    const contenido = printRef.current.innerHTML
    const ventana = window.open('', '_blank', 'width=400,height=500')
    ventana.document.write(`
      <html>
        <head>
          <title>QR - ${herramienta.nombre}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: white; }
            .qr-container { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; border: 1px solid #ddd; border-radius: 8px; }
            .qr-nombre { font-size: 14px; font-weight: 600; color: #111; text-align: center; max-width: 200px; }
            .qr-codigo { font-size: 12px; color: #444; font-family: monospace; letter-spacing: 0.05em; font-weight: 600; }
            .qr-marca  { font-size: 11px; color: #666; }
            .qr-hint   { font-size: 10px; color: #999; text-align: center; max-width: 200px; }
          </style>
        </head>
        <body>${contenido}</body>
        <script>window.onload = () => { window.print(); window.close() }</script>
      </html>
    `)
    ventana.document.close()
  }

  // El valor del QR es el codigo_qr de la herramienta (ej: FS-QR-00001)
  // Así el escaneo por cámara y la búsqueda manual usan el mismo código
  const qrValue = herramienta.codigo_qr

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Código QR</h3>
          <button className={styles.btnClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.qrWrapper} ref={printRef}>
          <div className="qr-container">
            <QRCodeSVG
              value={qrValue}
              size={220}
              bgColor="#ffffff"
              fgColor="#000000"
              level="H"
              includeMargin={true}
            />
            <p className="qr-nombre">{herramienta.nombre}</p>
            {herramienta.marca && herramienta.modelo && (
              <p className="qr-marca">{herramienta.marca} · {herramienta.modelo}</p>
            )}
            <p className="qr-codigo">{herramienta.codigo_qr}</p>
            <p className="qr-hint">Escanear con la app FieldStock</p>
          </div>
        </div>

        <p className={styles.hint}>
          Código: <strong>{herramienta.codigo_qr}</strong> — ingresalo manualmente si no podés escanear.
        </p>

        <div className={styles.actions}>
          <button className={styles.btnGhost} onClick={onClose}>Cerrar</button>
          <button className={styles.btnPrimary} onClick={handlePrint}>🖨 Imprimir QR</button>
        </div>
      </div>
    </div>
  )
}
