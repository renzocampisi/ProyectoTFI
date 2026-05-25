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
  const [problema,     setProblema]     = useState('')
  const [confirmado,   setConfirmado]   = useState(false)

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
    setProcesando(true)
    try {
      await api.post(`/remitos/${id}/confirmar-escaneo`, {})
      setConfirmado(true)
    } catch (err) { setError(err.message) }
    finally { setProcesando(false) }
  }

  const handleReportarProblema = async () => {
    if (!problema.trim()) return
    setProcesando(true)
    try {
      await api.post(`/remitos/${id}/reportar-problema`, { descripcion: problema.trim() })
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

  // ── Pantalla de problema ──────────────────────────────────────
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
          Describí qué pasó. Se guardará en el remito y se notificará al sistema.
        </p>
        <textarea
          className={styles.problemaTextarea}
          placeholder="Ej: Faltó una herramienta, llegó dañada, llegó incompleto..."
          value={problema}
          onChange={e => setProblema(e.target.value)}
          rows={5}
          autoFocus
        />
        <button
          className={styles.btnDanger}
          onClick={handleReportarProblema}
          disabled={procesando || !problema.trim()}>
          {procesando ? 'Enviando...' : '⚠ Confirmar y reportar problema'}
        </button>
        <p className={styles.problemaHint}>
          El remito avanzará a EN_OBRA con el problema registrado.
        </p>
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
          <span className={styles.cardValue}>{remito.obra}</span>
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

      {/* Acciones */}
      <div className={styles.acciones}>
        {esSalida && (
          <button className={styles.btnPrimary} onClick={handleConfirmar} disabled={procesando}>
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
