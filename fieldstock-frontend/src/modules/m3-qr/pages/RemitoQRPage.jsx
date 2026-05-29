// src/modules/m3-qr/pages/RemitoQRPage.jsx
// Página mobile-first para escaneo del QR de remitos
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@shared/utils/api'
import styles from './RemitoQRPage.module.css'

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const ESTADO_LABEL = {
  CONFIRMADO:  { texto: 'Listo para salir',    color: '#2dd4a0' },
  EN_TRANSITO: { texto: 'En camino a la obra', color: '#f5a623' },
}

export default function RemitoQRPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [remito,       setRemito]       = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [accion,       setAccion]       = useState(null) // 'SALIDA' | 'LLEGADA'
  const [procesando,   setProcesando]   = useState(false)
  const [showProblema, setShowProblema] = useState(false)
  // Word C: reporte de problema ahora granular por ítem.
  //   - descGeneral: descripción general del incidente (opcional)
  //   - itemsProblema:     { [remitoItemId]:     descripcion }
  //   - materialesProblema:{ [remitoMaterialId]: descripcion }
  // La presencia de una key en el objeto = "este ítem tuvo problema",
  // su value = descripción puntual (puede ser '').
  const [descGeneral,         setDescGeneral]         = useState('')
  const [itemsProblema,       setItemsProblema]       = useState({})
  const [materialesProblema,  setMaterialesProblema]  = useState({})
  const [confirmado,   setConfirmado]   = useState(false)
  // Conductor / persona que realiza el traslado. Se pide únicamente en
  // SALIDA (1er escaneo) y queda guardado en el remito para mostrarse
  // después en el PDF y en la llegada.
  const [conductor,    setConductor]    = useState('')

  useEffect(() => {
    api.get(`/remitos/${id}`)
      .then(data => {
        setRemito(data)
        // Determinar qué acción corresponde según el estado
        if (data.estado === 'CONFIRMADO')  setAccion('SALIDA')
        if (data.estado === 'EN_TRANSITO') setAccion('LLEGADA')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleConfirmar = async () => {
    // En SALIDA el conductor es obligatorio. Doble guarda: el botón ya
    // queda disabled, pero validamos también acá por si llega un click
    // duplicado o un autocompletar raro.
    if (accion === 'SALIDA' && !conductor.trim()) {
      setError('Ingresá el nombre del conductor o persona a cargo del traslado.')
      return
    }
    setProcesando(true)
    setError(null)
    try {
      await api.post(`/remitos/${id}/confirmar-escaneo`,
        accion === 'SALIDA' ? { conductor: conductor.trim() } : {}
      )
      setConfirmado(true)
    } catch (err) { setError(err.message) }
    finally { setProcesando(false) }
  }

  // Helpers para marcar/desmarcar ítems y editar su descripción
  const toggleItem = (itemId) => {
    setItemsProblema(prev => {
      const next = { ...prev }
      if (itemId in next) delete next[itemId]
      else                next[itemId] = ''
      return next
    })
  }
  const setItemDesc = (itemId, desc) =>
    setItemsProblema(prev => ({ ...prev, [itemId]: desc }))

  const toggleMaterial = (matId) => {
    setMaterialesProblema(prev => {
      const next = { ...prev }
      if (matId in next) delete next[matId]
      else               next[matId] = ''
      return next
    })
  }
  const setMaterialDesc = (matId, desc) =>
    setMaterialesProblema(prev => ({ ...prev, [matId]: desc }))

  // Para el botón submit y mensajes informativos
  const totalAfectados = Object.keys(itemsProblema).length +
                         Object.keys(materialesProblema).length
  const puedeReportar = totalAfectados > 0 || descGeneral.trim().length > 0

  const handleReportarProblema = async () => {
    if (!puedeReportar) return
    setProcesando(true)
    setError(null)
    try {
      await api.post(`/remitos/${id}/reportar-problema`, {
        descripcion: descGeneral.trim() || null,
        items: Object.entries(itemsProblema).map(([remitoItemId, descripcion]) => ({
          remitoItemId, descripcion: descripcion?.trim() || null,
        })),
        materiales: Object.entries(materialesProblema).map(([remitoMaterialId, descripcion]) => ({
          remitoMaterialId, descripcion: descripcion?.trim() || null,
        })),
      })
      setConfirmado(true)
    } catch (err) { setError(err.message) }
    finally { setProcesando(false) }
  }

  // ── Pantalla de carga ────────────────────────────────────────
  if (loading) return (
    <div className={styles.fullPage}>
      <div className={styles.spinner} />
      <p className={styles.loadingText}>Cargando remito...</p>
    </div>
  )

  // ── Error ────────────────────────────────────────────────────
  if (error || !remito) return (
    <div className={styles.fullPage}>
      <span className={styles.icon}>⚠</span>
      <p className={styles.errorText}>{error || 'Remito no encontrado'}</p>
      <button className={styles.btnSecondary} onClick={() => navigate('/')}>
        Ir al inicio
      </button>
    </div>
  )

  // ── Estado no válido para escaneo ────────────────────────────
  if (!['CONFIRMADO', 'EN_TRANSITO'].includes(remito.estado)) return (
    <div className={styles.fullPage}>
      <span className={styles.icon}>ℹ</span>
      <p className={styles.infoTitle}>{remito.numero}</p>
      <p className={styles.infoText}>
        Este remito está en estado <strong>{remito.estado.replace(/_/g, ' ')}</strong> y no requiere confirmación por QR en este momento.
      </p>
      <button className={styles.btnSecondary} onClick={() => navigate(`/remitos/${id}`)}>
        Ver remito completo
      </button>
    </div>
  )

  // ── Confirmado exitosamente ───────────────────────────────────
  if (confirmado) return (
    <div className={styles.fullPage}>
      <div className={styles.successCircle}>✓</div>
      <p className={styles.successTitle}>
        {accion === 'SALIDA' ? '¡Salida confirmada!' : '¡Llegada confirmada!'}
      </p>
      <p className={styles.successSub}>
        {accion === 'SALIDA'
          ? `El remito ${remito.numero} salió del depósito.`
          : `El remito ${remito.numero} llegó a la obra.`
        }
      </p>
      <button className={styles.btnSecondary} onClick={() => navigate(`/remitos/${id}`)}>
        Ver remito
      </button>
    </div>
  )

  // ── Pantalla de problema (Word C: por ítem) ──────────────────
  if (showProblema) return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => setShowProblema(false)}>← Volver</button>
        <span className={styles.headerNumero}>{remito.numero}</span>
      </div>
      <div className={styles.problemaSection}>
        <span className={styles.problemaIcon}>⚠</span>
        <h2 className={styles.problemaTitle}>Reportar problema</h2>
        <p className={styles.problemaDesc}>
          Marcá los ítems con problema y/o agregá una descripción general.
          El sistema avisa al encargado y al dueño automáticamente.
        </p>

        {/* Herramientas */}
        {remito.items?.length > 0 && (
          <div className={styles.checkSection}>
            <p className={styles.checkSectionTitle}>🔧 Herramientas</p>
            {remito.items.map(item => {
              const marcada = item.id in itemsProblema
              return (
                <div key={item.id} className={`${styles.checkRow} ${marcada ? styles.checkRowActive : ''}`}>
                  <label className={styles.checkLabel}>
                    <input type="checkbox" checked={marcada}
                      onChange={() => toggleItem(item.id)} />
                    <div className={styles.checkInfo}>
                      <span className={styles.checkNombre}>{item.herramienta_nombre}</span>
                      <span className={styles.checkSub}>{item.herramienta_qr}</span>
                    </div>
                  </label>
                  {marcada && (
                    <textarea
                      className={styles.checkDescripcion}
                      placeholder="¿Qué le pasó? (opcional — ej. rota, faltante, devuelta dañada)"
                      value={itemsProblema[item.id]}
                      onChange={e => setItemDesc(item.id, e.target.value)}
                      rows={2}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Materiales */}
        {remito.materiales?.length > 0 && (
          <div className={styles.checkSection}>
            <p className={styles.checkSectionTitle}>📦 Materiales / insumos</p>
            {remito.materiales.map(m => {
              const marcado = m.id in materialesProblema
              return (
                <div key={m.id} className={`${styles.checkRow} ${marcado ? styles.checkRowActive : ''}`}>
                  <label className={styles.checkLabel}>
                    <input type="checkbox" checked={marcado}
                      onChange={() => toggleMaterial(m.id)} />
                    <div className={styles.checkInfo}>
                      <span className={styles.checkNombre}>{m.material_nombre || m.descripcion_libre}</span>
                      <span className={styles.checkSub}>{m.cantidad_egreso} {m.unidad}</span>
                    </div>
                  </label>
                  {marcado && (
                    <textarea
                      className={styles.checkDescripcion}
                      placeholder="¿Qué le pasó? (opcional — ej. faltante, vino menos cantidad)"
                      value={materialesProblema[m.id]}
                      onChange={e => setMaterialDesc(m.id, e.target.value)}
                      rows={2}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Descripción general — opcional, agrega contexto si nada específico */}
        <div className={styles.checkSection}>
          <label className={styles.checkSectionTitle} htmlFor="descGeneral">
            Descripción general <span className={styles.opt}>(opcional)</span>
          </label>
          <textarea id="descGeneral"
            className={styles.problemaTextarea}
            placeholder="Contexto general del problema, situación en obra..."
            value={descGeneral}
            onChange={e => setDescGeneral(e.target.value)}
            rows={3}
          />
        </div>

        {error && <div className={styles.errorBox}>⚠ {error}</div>}

        <button
          className={styles.btnDanger}
          onClick={handleReportarProblema}
          disabled={procesando || !puedeReportar}>
          {procesando
            ? 'Enviando...'
            : totalAfectados > 0
              ? `⚠ Confirmar (${totalAfectados} ítem${totalAfectados !== 1 ? 's' : ''} afectado${totalAfectados !== 1 ? 's' : ''})`
              : '⚠ Confirmar y reportar problema'
          }
        </button>

        {!puedeReportar && (
          <p className={styles.problemaHint}>
            Marcá al menos un ítem o escribí una descripción general para continuar.
          </p>
        )}
      </div>
    </div>
  )

  // ── Pantalla principal ────────────────────────────────────────
  const esSalida  = accion === 'SALIDA'
  const esLlegada = accion === 'LLEGADA'
  const estadoInfo = ESTADO_LABEL[remito.estado]

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerLogo}>FieldStock AI</span>
        <span className={styles.headerNumero}>{remito.numero}</span>
      </div>

      {/* Estado badge */}
      <div className={styles.estadoBadge} style={{ borderColor: estadoInfo.color, color: estadoInfo.color }}>
        {estadoInfo.texto}
      </div>

      {/* Datos principales */}
      <div className={styles.card}>
        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>Obra</span>
          <span className={styles.cardValue}>
            {remito.cliente_nombre ? `${remito.cliente_nombre} - ${remito.obra}` : remito.obra}
          </span>
        </div>
        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>Responsable</span>
          <span className={styles.cardValue}>{remito.responsable}</span>
        </div>
        {remito.empresa_transporte && (
          <div className={styles.cardRow}>
            <span className={styles.cardLabel}>Transporte</span>
            <span className={styles.cardValue}>{remito.empresa_transporte}</span>
          </div>
        )}
        {/* En LLEGADA mostramos quién hizo el traslado (cargado en SALIDA) */}
        {remito.conductor && (
          <div className={styles.cardRow}>
            <span className={styles.cardLabel}>Conductor</span>
            <span className={styles.cardValue}>{remito.conductor}</span>
          </div>
        )}
        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>Fecha egreso</span>
          <span className={styles.cardValue}>{formatFecha(remito.fecha_egreso)}</span>
        </div>
      </div>

      {/* Resumen de ítems */}
      <div className={styles.resumen}>
        <div className={styles.resumenItem}>
          <span className={styles.resumenNum}>{remito.items?.length ?? 0}</span>
          <span className={styles.resumenLabel}>Herramientas</span>
        </div>
        <div className={styles.resumenDivider} />
        <div className={styles.resumenItem}>
          <span className={styles.resumenNum}>{remito.materiales?.length ?? 0}</span>
          <span className={styles.resumenLabel}>Materiales</span>
        </div>
      </div>

      {/* Lista de herramientas — solo en llegada */}
      {esLlegada && remito.items?.length > 0 && (
        <div className={styles.lista}>
          <p className={styles.listaTitle}>🔧 Herramientas a verificar</p>
          {remito.items.map((item, idx) => (
            <div key={item.id} className={styles.listaRow}>
              <span className={styles.listaIdx}>{idx + 1}</span>
              <div className={styles.listaInfo}>
                <span className={styles.listaNombre}>{item.herramienta_nombre}</span>
                <span className={styles.listaCodigo}>{item.herramienta_qr}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de materiales — solo en llegada */}
      {esLlegada && remito.materiales?.length > 0 && (
        <div className={styles.lista}>
          <p className={styles.listaTitle}>📦 Materiales a verificar</p>
          {remito.materiales.map((m, idx) => (
            <div key={m.id} className={styles.listaRow}>
              <span className={styles.listaIdx}>{idx + 1}</span>
              <div className={styles.listaInfo}>
                <span className={styles.listaNombre}>{m.material_nombre || m.descripcion_libre}</span>
                <span className={styles.listaCodigo}>{m.cantidad_egreso} {m.unidad}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Problema registrado */}
      {remito.observacion_llegada && (
        <div className={styles.problemaRegistrado}>
          <span>⚠ Problema registrado:</span> {remito.observacion_llegada}
        </div>
      )}

      {/* Conductor — solo en SALIDA. Obligatorio para confirmar. */}
      {esSalida && (
        <div className={styles.conductorBox}>
          <label className={styles.conductorLabel} htmlFor="conductor">
            Conductor / persona a cargo del traslado <span className={styles.req}>*</span>
          </label>
          <input id="conductor" type="text"
            className={styles.conductorInput}
            placeholder="Nombre y apellido"
            value={conductor}
            onChange={e => setConductor(e.target.value)}
            autoComplete="off"
            autoCapitalize="words" />
          <p className={styles.conductorHint}>
            Queda registrado en el remito y se muestra en el PDF.
          </p>
        </div>
      )}

      {/* Acciones */}
      <div className={styles.acciones}>
        {esSalida && (
          <button className={styles.btnPrimary} onClick={handleConfirmar}
            disabled={procesando || !conductor.trim()}>
            {procesando ? 'Procesando...' : '✓ Confirmar salida del depósito'}
          </button>
        )}

        {esLlegada && (
          <>
            <button className={styles.btnPrimary} onClick={handleConfirmar} disabled={procesando}>
              {procesando ? 'Procesando...' : '✓ Todo llegó correctamente'}
            </button>
            <button className={styles.btnDangerOutline} onClick={() => setShowProblema(true)} disabled={procesando}>
              ⚠ Reportar problema
            </button>
          </>
        )}
      </div>

      <button className={styles.btnLink} onClick={() => navigate(`/remitos/${id}`)}>
        Ver remito completo en el sistema →
      </button>

    </div>
  )
}
