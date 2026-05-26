// src/modules/m3-qr/pages/QRScannerPage.jsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'
import { api } from '@shared/utils/api'
import { detectarTipoQR } from '@shared/utils/qr'
import { RemitosService } from '@modules/m5-remito/services/remitos.service'
import styles from './QRScannerPage.module.css'

/**
 * Resuelve un código escaneado al destino correspondiente (issue #11).
 * Devuelve `{ tipo, path }` para que el componente sepa adónde navegar,
 * o `null` si no encontró nada.
 */
async function resolverDestino(codigo) {
  const { tipo, codigo: limpio } = detectarTipoQR(codigo)

  // Caso 1: QR de remito → resolver número → /remitos/:id/qr
  if (tipo === 'remito') {
    try {
      const remito = await RemitosService.getByNumero(limpio)
      if (remito) return { tipo: 'remito', path: `/remitos/${remito.id}/qr` }
    } catch (err) {
      // 404 del backend cae acá; tratamos como "no encontrado" sin propagar
      if (err.status !== 404) throw err
    }
    return null
  }

  // Caso 2: QR de herramienta → buscar por codigo_qr → /herramientas/:id
  if (tipo === 'herramienta') {
    const herramientas = await api.get(`/herramientas?codigoQR=${encodeURIComponent(limpio)}`)
    if (herramientas?.length) {
      return { tipo: 'herramienta', path: `/herramientas/${herramientas[0].id}` }
    }
    return null
  }

  // Caso 3: formato desconocido. Fallbacks históricos:
  //   - intentar como herramienta (algunos QR viejos pueden no matchear regex)
  //   - parsear como URL y extraer un UUID al final del pathname
  const herramientas = await api.get(`/herramientas?codigoQR=${encodeURIComponent(limpio)}`)
  if (herramientas?.length) {
    return { tipo: 'herramienta', path: `/herramientas/${herramientas[0].id}` }
  }
  try {
    const url = new URL(limpio)
    const partes = url.pathname.split('/')
    const posibleId = partes[partes.length - 1]
    if (posibleId?.length === 36) {
      const herr = await api.get(`/herramientas/${posibleId}`)
      if (herr) return { tipo: 'herramienta', path: `/herramientas/${herr.id}` }
    }
  } catch {}

  return null
}

export default function QRScannerPage() {
  const navigate      = useNavigate()
  const videoRef      = useRef(null)
  const canvasRef     = useRef(null)
  const streamRef     = useRef(null)
  const animRef       = useRef(null)
  const procesandoRef = useRef(false)

  const [estado,   setEstado]   = useState('iniciando')
  const [mensaje,  setMensaje]  = useState('')
  const [buscando, setBuscando] = useState(false)
  const [inputVal, setInputVal] = useState('')

  useEffect(() => {
    iniciarCamara()
    return () => detenerCamara()
  }, [])

  const iniciarCamara = async () => {
    procesandoRef.current = false
    setEstado('iniciando')
    setMensaje('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        videoRef.current.onloadedmetadata = () => {
          setEstado('activo')
          escanearFrame()
        }
      }
    } catch {
      setEstado('error')
      setMensaje('No se pudo acceder a la cámara. Verificá los permisos del navegador.')
    }
  }

  const detenerCamara = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }

  const escanearFrame = () => {
    if (procesandoRef.current) return

    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(escanearFrame)
      return
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })

    if (code?.data) {
      procesandoRef.current = true
      procesarCodigo(code.data)
    } else {
      animRef.current = requestAnimationFrame(escanearFrame)
    }
  }

  const procesarCodigo = async (valor) => {
    detenerCamara()
    setEstado('buscando')
    setBuscando(true)
    try {
      const destino = await resolverDestino(valor)
      if (destino) {
        navigate(destino.path)
      } else {
        setEstado('noEncontrado')
        setMensaje(`Código leído: "${valor}"\n\nNo se encontró ningún remito ni herramienta con ese código.`)
      }
    } catch {
      setEstado('error')
      setMensaje('Error al conectar con el servidor.')
    } finally {
      setBuscando(false)
    }
  }

  const handleManual = async (e) => {
    e.preventDefault()
    const codigo = inputVal.trim()
    if (!codigo) return
    procesandoRef.current = true
    detenerCamara()
    await procesarCodigo(codigo)
  }

  const reiniciar = () => {
    setInputVal('')
    iniciarCamara()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Escanear QR</h1>
        <p className={styles.subtitle}>Apuntá la cámara al código QR de una herramienta o un remito.</p>
      </div>

      <div className={styles.scannerWrapper}>
        {estado === 'iniciando' && (
          <div className={styles.placeholder}>
            <span className={styles.spinner} />
            <p>Iniciando cámara...</p>
          </div>
        )}
        {estado === 'buscando' && (
          <div className={styles.placeholder}>
            <span className={styles.spinner} />
            <p>Buscando en la base de datos...</p>
          </div>
        )}
        {(estado === 'error' || estado === 'noEncontrado') && (
          <div className={styles.errorBox}>
            <span className={styles.errorIcon}>{estado === 'noEncontrado' ? '🔍' : '⚠'}</span>
            <p style={{ whiteSpace: 'pre-line', textAlign: 'center', fontSize: '12px' }}>{mensaje}</p>
            <button className={styles.btnGhost} onClick={reiniciar}>Intentar de nuevo</button>
          </div>
        )}

        <video
          ref={videoRef}
          className={`${styles.video} ${estado !== 'activo' ? styles.videoHidden : ''}`}
          muted playsInline
        />
        <canvas ref={canvasRef} className={styles.canvas} />

        {estado === 'activo' && (
          <div className={styles.overlay}>
            <div className={styles.scanFrame} />
            <p className={styles.scanHint}>Apuntá al código QR</p>
          </div>
        )}
      </div>

      <div className={styles.manualSection}>
        <p className={styles.manualTitle}>Búsqueda manual</p>
        <p className={styles.manualHint}>
          Ingresá el código impreso debajo del QR. Ej: <strong>FS-00018</strong> (remito) o <strong>FS-TAL-1ABD152F</strong> (herramienta)
        </p>
        <form className={styles.manualForm} onSubmit={handleManual}>
          <input
            type="text"
            className={styles.input}
            placeholder="FS-00018 o FS-TAL-1ABD152F"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            disabled={buscando}
            autoComplete="off"
          />
          <button type="submit" className={styles.btnSecondary}
            disabled={buscando || !inputVal.trim()}>
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </form>
      </div>
    </div>
  )
}
