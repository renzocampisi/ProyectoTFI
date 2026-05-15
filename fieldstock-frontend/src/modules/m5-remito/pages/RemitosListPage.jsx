// src/modules/m5-remito/pages/RemitosListPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRemitos } from '../hooks/useRemitos'
import { RemitosService } from '../services/remitos.service'
import EstadoRemitoBadge from '../components/EstadoRemitoBadge'
import styles from './RemitosListPage.module.css'

const ESTADOS_ACTIVOS = ['BORRADOR','CONFIRMADO','EN_TRANSITO','RECIBIDO_EN_OBRA']
const TIPOS = ['EGRESO','INGRESO']

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function TablaRemitos({ remitos, navigate, onEliminar, mostrarEliminar }) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Número</th>
            <th>Tipo</th>
            <th>Obra</th>
            <th>Responsable</th>
            <th>Fecha</th>
            <th>Herramientas</th>
            <th>Insumos</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {remitos.map(r => (
            <tr key={r.id} className={styles.row} onClick={() => navigate(`/remitos/${r.id}`)}>
              <td className={styles.numero}>{r.numero}</td>
              <td>
                <span className={`${styles.tipoBadge} ${r.tipo === 'EGRESO' ? styles.egreso : styles.ingreso}`}>
                  {r.tipo === 'EGRESO' ? '↑ Egreso' : '↓ Ingreso'}
                </span>
              </td>
              <td className={styles.obra}>{r.obra}</td>
              <td className={styles.resp}>{r.responsable}</td>
              <td className={styles.fecha}>{formatFecha(r.fecha)}</td>
              <td className={styles.cant}>{r.cantidad_herramientas ?? 0}</td>
              <td className={styles.cant}>{r.cantidad_materiales ?? 0}</td>
              <td><EstadoRemitoBadge estado={r.estado} /></td>
              <td className={styles.actions}>
                <button className={styles.btnRow}
                  onClick={e => { e.stopPropagation(); navigate(`/remitos/${r.id}`) }}>
                  Ver →
                </button>
                {mostrarEliminar && (
                  <button className={styles.btnEliminar}
                    onClick={e => { e.stopPropagation(); onEliminar(r) }}>
                    🗑
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function RemitosListPage() {
  const navigate = useNavigate()
  const [filtroTipo,   setFiltroTipo]   = useState('')
  const [seccion,      setSeccion]      = useState('activos') // 'activos' | 'cerrados'
  const [confirmando,  setConfirmando]  = useState(null) // remito a eliminar
  const [eliminando,   setEliminando]   = useState(false)
  const [errEliminar,  setErrEliminar]  = useState(null)

  const { remitos: activos,  loading: loadingA, error: errorA }  = useRemitos({
    tipo: filtroTipo || undefined,
  })
  const { remitos: cerrados, loading: loadingC, error: errorC, refetch: refetchC } = useRemitos({
    estado: 'CERRADO',
    tipo:   filtroTipo || undefined,
  })

  // Filtrar activos (sin cerrados)
  const remitosActivos  = activos.filter(r => r.estado !== 'CERRADO')
  const remitosCerrados = cerrados

  const handleEliminar = async () => {
    if (!confirmando) return
    setEliminando(true); setErrEliminar(null)
    try {
      await RemitosService.eliminar(confirmando.id)
      setConfirmando(null)
      await refetchC()
    } catch (err) {
      setErrEliminar(err.message)
    } finally { setEliminando(false) }
  }

  const loading = seccion === 'activos' ? loadingA : loadingC
  const error   = seccion === 'activos' ? errorA   : errorC
  const lista   = seccion === 'activos' ? remitosActivos : remitosCerrados

  return (
    <div className={styles.page}>

      {/* Encabezado */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Remitos</h1>
          <p className={styles.subtitle}>
            {loading ? 'Cargando...' : `${lista.length} remito${lista.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/remitos/nuevo')}>
          + Nuevo remito
        </button>
      </div>

      {/* Tabs activos / cerrados */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${seccion === 'activos' ? styles.tabActive : ''}`}
          onClick={() => setSeccion('activos')}
        >
          En curso
          {!loadingA && <span className={styles.tabCount}>{remitosActivos.length}</span>}
        </button>
        <button
          className={`${styles.tab} ${seccion === 'cerrados' ? styles.tabActive : ''}`}
          onClick={() => setSeccion('cerrados')}
        >
          Cerrados
          {!loadingC && <span className={styles.tabCount}>{remitosCerrados.length}</span>}
        </button>
      </div>

      {/* Filtros */}
      <div className={styles.toolbar}>
        <select className={styles.select} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t === 'EGRESO' ? 'Egreso' : 'Ingreso'}</option>)}
        </select>
        {filtroTipo && (
          <button className={styles.btnGhost} onClick={() => setFiltroTipo('')}>Limpiar</button>
        )}
      </div>

      {/* Modal confirmación eliminar */}
      {confirmando && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>¿Eliminar remito?</h3>
            <p className={styles.modalText}>
              Vas a eliminar <strong>{confirmando.numero}</strong> permanentemente. Esta acción no se puede deshacer.
            </p>
            {errEliminar && <p className={styles.modalError}>⚠ {errEliminar}</p>}
            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={() => { setConfirmando(null); setErrEliminar(null) }}>
                Cancelar
              </button>
              <button className={styles.btnEliminarConfirm} onClick={handleEliminar} disabled={eliminando}>
                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {loading && (
        <div className={styles.loadingWrapper}>
          <span className={styles.spinner} />Cargando remitos...
        </div>
      )}

      {!loading && !error && lista.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📋</span>
          <p>{seccion === 'activos' ? 'No hay remitos en curso.' : 'No hay remitos cerrados.'}</p>
          {seccion === 'activos' && (
            <button className={styles.btnPrimary} onClick={() => navigate('/remitos/nuevo')}>
              Crear primer remito
            </button>
          )}
        </div>
      )}

      {!loading && !error && lista.length > 0 && (
        <TablaRemitos
          remitos={lista}
          navigate={navigate}
          onEliminar={setConfirmando}
          mostrarEliminar={seccion === 'cerrados'}
        />
      )}

    </div>
  )
}
