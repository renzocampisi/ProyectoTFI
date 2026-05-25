// src/modules/m8-estanterias/pages/EstanteriasPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { EstanteriasService } from '../services/estanterias.service'
import { InventarioService } from '@modules/m2-inventario/services/inventario.service'
import { MaterialesService } from '@modules/m6-materiales/services/materiales.service'
import styles from './EstanteriasPage.module.css'

function QREstanteriaModal({ estanteria, onClose }) {
  const handlePrint = () => {
    const ventana = window.open('', '_blank', 'width=400,height=500')
    ventana.document.write(`
      <html><head><title>QR Estantería ${estanteria.numero}</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: white; }
        .container { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; border: 2px solid #000; border-radius: 8px; }
        .titulo { font-size: 18px; font-weight: 700; }
        .codigo { font-size: 13px; font-family: monospace; font-weight: 600; }
        .desc { font-size: 11px; color: #666; }
      </style></head>
      <body>
        <div class="container">
          <div id="qr"></div>
          <div class="titulo">Estantería N° ${estanteria.numero}</div>
          <div class="codigo">${estanteria.codigo_qr}</div>
          ${estanteria.descripcion ? `<div class="desc">${estanteria.descripcion}</div>` : ''}
        </div>
      </body>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      <script>
        new QRCode(document.getElementById('qr'), { text: '${estanteria.codigo_qr}', width: 180, height: 180 })
        window.onload = () => { setTimeout(() => { window.print(); window.close() }, 500) }
      </script>
      </html>
    `)
    ventana.document.close()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>QR — Estantería N° {estanteria.numero}</h3>
          <button className={styles.btnClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.qrCenter}>
          <QRCodeSVG value={estanteria.codigo_qr} size={180} level="H" includeMargin />
          <p className={styles.qrCodigo}>{estanteria.codigo_qr}</p>
          {estanteria.descripcion && <p className={styles.qrDesc}>{estanteria.descripcion}</p>}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose}>Cerrar</button>
          <button className={styles.btnPrimary} onClick={handlePrint}>🖨 Imprimir QR</button>
        </div>
      </div>
    </div>
  )
}

function AsignarModal({ estanteria, onClose, onSaved }) {
  const [tab,          setTab]          = useState('herramienta')
  const [herramientas, setHerramientas] = useState([])
  const [materiales,   setMateriales]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState(null)

  // IDs ya en la estantería
  const idsHerr = estanteria.items?.filter(i => i.tipo === 'herramienta').map(i => i.ref_id) ?? []
  const idsMat  = estanteria.items?.filter(i => i.tipo === 'material').map(i => i.ref_id) ?? []

  useEffect(() => {
    Promise.all([
      InventarioService.getAll({ estado: 'DISPONIBLE' }),
      MaterialesService.getAll(),
    ]).then(([herr, mats]) => {
      setHerramientas(herr.filter(h => !idsHerr.includes(h.id)))
      setMateriales(mats.filter(m => !idsMat.includes(m.id)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleAdd = async (tipo, id) => {
    setSaving(true); setError(null)
    try {
      await EstanteriasService.addItem(estanteria.id, {
        herramientaId: tipo === 'herramienta' ? id : null,
        materialId:    tipo === 'material'    ? id : null,
      })
      onSaved()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modalGrande}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Agregar a Estantería N° {estanteria.numero}</h3>
          <button className={styles.btnClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.miniTabs}>
          <button className={`${styles.miniTab} ${tab === 'herramienta' ? styles.miniTabActive : ''}`}
            onClick={() => setTab('herramienta')}>🔧 Herramientas</button>
          <button className={`${styles.miniTab} ${tab === 'material' ? styles.miniTabActive : ''}`}
            onClick={() => setTab('material')}>📦 Materiales</button>
        </div>

        {error && <p className={styles.error}>⚠ {error}</p>}

        {loading ? (
          <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando...</div>
        ) : (
          <ul className={styles.lista}>
            {tab === 'herramienta'
              ? herramientas.length === 0
                ? <li className={styles.listaVacia}>No hay herramientas disponibles para asignar.</li>
                : herramientas.map(h => (
                    <li key={h.id} className={styles.listaItem}>
                      <div>
                        <span className={styles.listaNombre}>{h.nombre}</span>
                        <span className={styles.listaSub}>{h.codigo_qr}</span>
                      </div>
                      <button className={styles.btnAdd} disabled={saving}
                        onClick={() => handleAdd('herramienta', h.id)}>
                        + Agregar
                      </button>
                    </li>
                  ))
              : materiales.length === 0
                ? <li className={styles.listaVacia}>No hay materiales para asignar.</li>
                : materiales.map(m => (
                    <li key={m.id} className={styles.listaItem}>
                      <div>
                        <span className={styles.listaNombre}>{m.nombre}</span>
                        <span className={styles.listaSub}>Stock: {m.stock_actual} {m.unidad}</span>
                      </div>
                      <button className={styles.btnAdd} disabled={saving}
                        onClick={() => handleAdd('material', m.id)}>
                        + Agregar
                      </button>
                    </li>
                  ))
            }
          </ul>
        )}
      </div>
    </div>
  )
}

export default function EstanteriasPage() {
  const navigate = useNavigate()
  const [estanterias, setEstanterias] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [showQR,      setShowQR]      = useState(null)
  const [showAsignar, setShowAsignar] = useState(null)
  const [creando,     setCreando]     = useState(false)

  const fetchEstanterias = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const lista = await EstanteriasService.getAll()
      // Cargar contenido de cada estantería
      const conContenido = await Promise.all(
        lista.map(e => EstanteriasService.getById(e.id))
      )
      setEstanterias(conContenido)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchEstanterias() }, [fetchEstanterias])

  const handleCrear = async () => {
    setCreando(true)
    try {
      await EstanteriasService.create({})
      await fetchEstanterias()
    } catch (err) { setError(err.message) }
    finally { setCreando(false) }
  }

  const handleQuitarItem = async (estanteriaId, itemId) => {
    try {
      await EstanteriasService.removeItem(estanteriaId, itemId)
      await fetchEstanterias()
    } catch (err) { setError(err.message) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Estanterías</h1>
          <p className={styles.subtitle}>
            {loading ? 'Cargando...' : `${estanterias.length} estantería${estanterias.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={handleCrear} disabled={creando}>
          {creando ? 'Creando...' : '+ Nueva estantería'}
        </button>
      </div>

      {showQR && <QREstanteriaModal estanteria={showQR} onClose={() => setShowQR(null)} />}

      {showAsignar && (
        <AsignarModal
          estanteria={showAsignar}
          onClose={() => setShowAsignar(null)}
          onSaved={async () => { setShowAsignar(null); await fetchEstanterias() }}
        />
      )}

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {loading && (
        <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando estanterías...</div>
      )}

      {!loading && estanterias.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🗄️</span>
          <p>No hay estanterías creadas todavía.</p>
          <button className={styles.btnPrimary} onClick={handleCrear}>
            Crear primera estantería
          </button>
        </div>
      )}

      {!loading && estanterias.length > 0 && (
        <div className={styles.grid}>
          {estanterias.map(est => (
            <div key={est.id} className={styles.card}>

              {/* Header de la estantería */}
              <div className={styles.cardHeader}>
                <div className={styles.cardTitulo}>
                  <span className={styles.cardNumero}>Estantería N° {est.numero}</span>
                  <span className={styles.cardQR}>{est.codigo_qr}</span>
                  {est.descripcion && <span className={styles.cardDesc}>{est.descripcion}</span>}
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.btnIcono} onClick={() => setShowQR(est)} title="Ver QR">⬛</button>
                  <button className={styles.btnAgregar} onClick={() => setShowAsignar(est)}>+ Agregar</button>
                </div>
              </div>

              {/* Contenido */}
              {(!est.items?.length) ? (
                <div className={styles.cardVacia}>Sin ítems asignados</div>
              ) : (
                <div className={styles.itemsWrapper}>
                  <table className={styles.tabla}>
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Nombre</th>
                        <th>Código / Stock</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {est.items.map(item => (
                        <tr key={item.item_id} className={styles.tablaRow}>
                          <td>
                            <span className={`${styles.tipoBadge} ${styles[item.tipo]}`}>
                              {item.tipo === 'herramienta' ? '🔧' : '📦'}
                            </span>
                          </td>
                          <td className={styles.itemNombre}>
                            {item.nombre}
                            {item.importante && <span className={styles.importanteBadge}>⭐ Importante</span>}
                          </td>
                          <td className={styles.itemSub}>
                            {item.tipo === 'herramienta'
                              ? item.codigo_qr
                              : `${item.stock_actual} ${item.unidad}`
                            }
                          </td>
                          <td>
                            {item.tipo === 'herramienta' ? (
                              <span className={`${styles.estadoBadge} ${styles[item.estado?.toLowerCase().replace('_','')]}`}>
                                {item.estado}
                              </span>
                            ) : '—'}
                          </td>
                          <td>
                            <button className={styles.btnQuitar}
                              onClick={() => handleQuitarItem(est.id, item.item_id)}
                              title="Quitar de estantería">
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className={styles.cardFooter}>
                <span className={styles.cardCount}>
                  {est.items?.filter(i => i.tipo === 'herramienta').length ?? 0} herramientas ·{' '}
                  {est.items?.filter(i => i.tipo === 'material').length ?? 0} materiales
                </span>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  )
}
