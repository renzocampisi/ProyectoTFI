// src/modules/m-compras/components/ScanMatchModal.jsx
/**
 * "Scan & Match" — foto o PDF de un remito/factura del proveedor →
 * propuesta de matching contra los items pendientes de ESTA compra →
 * revisión editable → confirmar (recepción real).
 *
 * Captura: mismo patrón getUserMedia + <video> + canvas que ya usa
 * QRScannerPage, pero una sola foto (sin loop de decodificación). PDF/imagen
 * también se puede subir directo con un file input.
 *
 * La lógica de estado vive en useScanMatch — este componente es solo UI +
 * la búsqueda de materiales existentes para el modo "material del catálogo".
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useScanMatch } from '../hooks/useScanMatch'
import { MaterialesService } from '@modules/m6-materiales/services/materiales.service'
import { formatCantidad } from '../constants'
import styles from './ScanMatchModal.module.css'

const UNIDADES_BASE = ['unidad', 'kg', 'metro', 'litro', 'caja', 'rollo', 'juego', 'par']
const CONFIANZA_LABEL = { alta: 'Confianza alta', media: 'Confianza media', baja: 'Confianza baja' }

/** Buscador inline de materiales del catálogo — usado en el modo "existente". */
function BuscadorMaterial({ valorId, onElegir }) {
  const [query,      setQuery]      = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando,   setBuscando]   = useState(false)
  const [elegido,    setElegido]    = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResultados([]); return }
    setBuscando(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await MaterialesService.getAll({ q: query.trim() })
        setResultados(Array.isArray(data) ? data.slice(0, 8) : [])
      } catch { setResultados([]) }
      finally { setBuscando(false) }
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  if (elegido && elegido.id === valorId) {
    return (
      <div className={styles.materialElegido}>
        <span>{elegido.nombre}{elegido.marca ? ` (${elegido.marca})` : ''}</span>
        <button type="button" className={styles.btnLinkChico}
          onClick={() => { setElegido(null); onElegir('') }}>
          cambiar
        </button>
      </div>
    )
  }

  return (
    <div className={styles.buscador}>
      <input type="text" className={styles.inputChico}
        placeholder="Buscar material..."
        value={query} onChange={e => setQuery(e.target.value)} />
      {buscando && <div className={styles.buscadorHint}>Buscando...</div>}
      {!buscando && resultados.length > 0 && (
        <ul className={styles.buscadorResultados}>
          {resultados.map(m => (
            <li key={m.id}>
              <button type="button" onClick={() => { setElegido(m); setQuery(''); setResultados([]); onElegir(m.id) }}>
                {m.nombre}{m.marca ? ` (${m.marca})` : ''} — stock {formatCantidad(m.stock_actual)} {m.unidad}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BadgeConfianza({ confianza }) {
  return (
    <span className={`${styles.badgeConfianza} ${styles[`confianza_${confianza}`] || ''}`}>
      {CONFIANZA_LABEL[confianza] || confianza}
    </span>
  )
}

function FilaRevision({ linea, candidatos, onCambiar, onQuitar, onRestaurar }) {
  if (!linea.incluida) {
    return (
      <tr className={styles.filaDescartada}>
        <td colSpan={3}>
          <span className={styles.textoDescartado}>"{linea.textoProveedor}" — no se va a cargar</span>
        </td>
        <td className={styles.cellAccion}>
          <button type="button" className={styles.btnLinkChico} onClick={onRestaurar}>deshacer</button>
        </td>
      </tr>
    )
  }

  return (
    <tr className={styles.fila}>
      <td className={styles.cellTexto}>
        <div className={styles.textoProveedor}>{linea.textoProveedor}</div>
        {linea.unidadDetectada && <div className={styles.metaChica}>Unidad leída: {linea.unidadDetectada}</div>}
        <BadgeConfianza confianza={linea.confianza} />
      </td>

      <td className={styles.cellMatch}>
        <select className={styles.inputChico}
          value={linea.modo}
          onChange={e => onCambiar({ modo: e.target.value })}>
          <option value="match">Ítem de la orden</option>
          <option value="existente">Material del catálogo</option>
          <option value="nuevo">Crear material nuevo</option>
        </select>

        {linea.modo === 'match' && (
          <select className={styles.inputChico}
            value={linea.compraItemId}
            onChange={e => onCambiar({ compraItemId: e.target.value })}>
            <option value="">— Elegí un ítem de la orden —</option>
            {candidatos.map(c => (
              <option key={c.itemId} value={c.itemId}>
                {c.nombre}{c.marca ? ` (${c.marca})` : ''} · pedido {formatCantidad(c.cantidadPedida)} {c.unidad}
              </option>
            ))}
          </select>
        )}

        {linea.modo === 'existente' && (
          <BuscadorMaterial valorId={linea.materialIdExistente}
            onElegir={id => onCambiar({ materialIdExistente: id })} />
        )}

        {linea.modo === 'nuevo' && (
          <div className={styles.materialNuevoForm}>
            <input type="text" className={styles.inputChico} placeholder="Nombre del material"
              value={linea.materialNuevoNombre}
              onChange={e => onCambiar({ materialNuevoNombre: e.target.value })} />
            <input type="text" className={styles.inputChico} placeholder="Marca (opcional)"
              value={linea.materialNuevoMarca}
              onChange={e => onCambiar({ materialNuevoMarca: e.target.value })} />
            <select className={styles.inputChico}
              value={linea.materialNuevoUnidad}
              onChange={e => onCambiar({ materialNuevoUnidad: e.target.value })}>
              {UNIDADES_BASE.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        )}
      </td>

      <td className={styles.cellCantidad}>
        <input type="number" min="0.01" step="any" className={styles.inputNum}
          value={linea.cantidadRecibida}
          onChange={e => onCambiar({ cantidadRecibida: e.target.value })} />
      </td>

      <td className={styles.cellAccion}>
        <button type="button" className={styles.btnQuitar} title="No cargar esta línea" onClick={onQuitar}>
          🗑
        </button>
      </td>
    </tr>
  )
}

export default function ScanMatchModal({ compra, onClose, onSuccess }) {
  const {
    paso, error, candidatos, lineas, puedeConfirmar,
    proponer, actualizarLinea, quitarLinea, restaurarLinea, confirmar,
  } = useScanMatch(compra.id, { onSuccess })

  const [errCaptura, setErrCaptura] = useState(null)
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)
  const [modoCaptura, setModoCaptura] = useState('elegir') // elegir | camara

  const detenerCamara = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => () => detenerCamara(), [detenerCamara])

  // El <video> recién existe en el DOM después de que modoCaptura pase a
  // 'camara' — enganchamos el stream ya obtenido en un efecto aparte en vez
  // de intentarlo en el mismo handler que llama a getUserMedia.
  useEffect(() => {
    if (modoCaptura !== 'camara' || !streamRef.current || !videoRef.current) return
    videoRef.current.srcObject = streamRef.current
    videoRef.current.play()
  }, [modoCaptura])

  const iniciarCamara = async () => {
    setErrCaptura(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      setModoCaptura('camara')
    } catch {
      setErrCaptura('No se pudo acceder a la cámara. Verificá los permisos del navegador.')
    }
  }

  const capturarFoto = () => {
    const video = videoRef.current, canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    detenerCamara()
    setModoCaptura('elegir')
    canvas.toBlob(blob => {
      if (!blob) return
      proponer(new File([blob], 'remito.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.9)
  }

  const handleArchivo = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErrCaptura(null)
    proponer(file)
  }

  const cerrar = () => { detenerCamara(); onClose?.() }

  return (
    <div className={styles.overlay} onClick={() => paso !== 'confirmando' && cerrar()}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>Cargar remito del proveedor</h3>
        <p className={styles.subtitle}>{compra.numero} · {compra.proveedor_nombre || compra.proveedor?.nombre || ''}</p>

        {/* ── Paso: captura ─────────────────────────────────── */}
        {(paso === 'captura' || paso === 'proponiendo') && modoCaptura === 'elegir' && (
          <div className={styles.captura}>
            {errCaptura && <div className={styles.errorBanner}>⚠ {errCaptura}</div>}
            {error && <div className={styles.errorBanner}>⚠ {error}</div>}
            {paso === 'proponiendo' ? (
              <div className={styles.cargando}>
                <span className={styles.spinner} /> Leyendo el remito...
              </div>
            ) : (
              <>
                <button type="button" className={styles.btnCaptura} onClick={iniciarCamara}>
                  📷 Sacar foto
                </button>
                <button type="button" className={styles.btnCaptura} onClick={() => fileInputRef.current?.click()}>
                  📄 Subir PDF o imagen
                </button>
                <p className={styles.hint}>
                  Usá la foto si el transporte trae el remito en papel. Subí el
                  PDF si la factura llegó por mail.
                </p>
              </>
            )}
            <input ref={fileInputRef} type="file" hidden
              accept="application/pdf,image/jpeg,image/png"
              onChange={handleArchivo} />
          </div>
        )}

        {/* ── Paso: cámara activa ──────────────────────────────── */}
        {modoCaptura === 'camara' && (
          <div className={styles.camara}>
            <video ref={videoRef} className={styles.video} playsInline muted />
            <canvas ref={canvasRef} hidden />
            <div className={styles.camaraAcciones}>
              <button type="button" className={styles.btnGhost}
                onClick={() => { detenerCamara(); setModoCaptura('elegir') }}>
                Cancelar
              </button>
              <button type="button" className={styles.btnPrimary} onClick={capturarFoto}>
                Sacar foto
              </button>
            </div>
          </div>
        )}

        {/* ── Paso: revisión ───────────────────────────────────── */}
        {(paso === 'revision' || paso === 'confirmando') && (
          <>
            <p className={styles.text}>
              Esto entendimos del documento. Revisá cada línea antes de confirmar —
              nada se carga todavía.
            </p>
            {error && <div className={styles.errorBanner}>⚠ {error}</div>}
            <div className={styles.itemsWrapper}>
              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th>Leído del documento</th>
                    <th>Corresponde a</th>
                    <th className={styles.numCol}>Recibido ahora</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map(l => (
                    <FilaRevision key={l.id} linea={l} candidatos={candidatos}
                      onCambiar={cambios => actualizarLinea(l.id, cambios)}
                      onQuitar={() => quitarLinea(l.id)}
                      onRestaurar={() => restaurarLinea(l.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Paso: éxito ───────────────────────────────────────── */}
        {paso === 'exito' && (
          <div className={styles.exito}>
            <span className={styles.exitoIcono}>✓</span>
            <p>Recepción registrada. El stock y el estado de la compra ya se actualizaron.</p>
          </div>
        )}

        <div className={styles.actions}>
          {paso === 'exito' ? (
            <button type="button" className={styles.btnPrimary} onClick={cerrar}>Cerrar</button>
          ) : (
            <>
              <button type="button" className={styles.btnGhost}
                onClick={cerrar} disabled={paso === 'confirmando'}>
                Cancelar
              </button>
              {(paso === 'revision' || paso === 'confirmando') && (
                <button type="button" className={styles.btnPrimary}
                  onClick={confirmar} disabled={!puedeConfirmar || paso === 'confirmando'}>
                  {paso === 'confirmando' ? 'Confirmando...' : 'Confirmar recepción'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
