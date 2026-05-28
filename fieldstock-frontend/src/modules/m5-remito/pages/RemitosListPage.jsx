// src/modules/m5-remito/pages/RemitosListPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRemitos } from '../hooks/useRemitos'
import { RemitosService } from '../services/remitos.service'
import EstadoRemitoBadge from '../components/EstadoRemitoBadge'
import styles from './RemitosListPage.module.css'

const ESTADOS_ACTIVOS = ['BORRADOR','CONFIRMADO','EN_TRANSITO','EN_OBRA','EN_RETORNO','EN_TRANSITO_RETORNO']

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
            {/* Obra y cliente separados en columnas independientes —
                cuando el mismo cliente tiene varias obras, ayuda
                a ubicarse rápido sin tener que parsear un string compuesto. */}
            <th>Obra</th>
            <th>Cliente</th>
            <th>Responsable</th>
            <th>Fecha egreso</th>
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
              <td className={styles.obra}>{r.obra || '—'}</td>
              <td className={styles.obra}>{r.cliente_nombre || '—'}</td>
              <td className={styles.resp}>{r.responsable}</td>
              <td className={styles.fecha}>{formatFecha(r.fecha_egreso)}</td>
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
                    onClick={e => { e.stopPropagation(); onEliminar(r) }}
                    title="Eliminar remito">
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
  const [seccion,     setSeccion]     = useState('activos')
  const [busqueda,    setBusqueda]    = useState('')
  const [confirmando, setConfirmando] = useState(null)
  const [eliminando,  setEliminando]  = useState(false)
  const [errEliminar, setErrEliminar] = useState(null)

  const { remitos: todos,    loading: loadingA, error: errorA }              = useRemitos({ q: busqueda || undefined })
  const { remitos: cerrados, loading: loadingC, error: errorC, refetch }     = useRemitos({ estado: 'CERRADO', q: busqueda || undefined })

  const activos = todos.filter(r => ESTADOS_ACTIVOS.includes(r.estado))

  const handleEliminar = async () => {
    if (!confirmando) return
    setEliminando(true); setErrEliminar(null)
    try {
      await RemitosService.eliminar(confirmando.id)
      setConfirmando(null)
      await refetch()
    } catch (err) { setErrEliminar(err.message) }
    finally { setEliminando(false) }
  }

  const loading = seccion === 'activos' ? loadingA : loadingC
  const error   = seccion === 'activos' ? errorA   : errorC
  const lista   = seccion === 'activos' ? activos   : cerrados

  return (
    <div className={styles.page}>

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

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${seccion === 'activos' ? styles.tabActive : ''}`}
          onClick={() => setSeccion('activos')}>
          En curso
          {!loadingA && <span className={styles.tabCount}>{activos.length}</span>}
        </button>
        <button className={`${styles.tab} ${seccion === 'cerrados' ? styles.tabActive : ''}`}
          onClick={() => setSeccion('cerrados')}>
          Cerrados
          {!loadingC && <span className={styles.tabCount}>{cerrados.length}</span>}
        </button>
      </div>

      {/* Búsqueda */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input type="search" className={styles.searchInput}
            placeholder="Buscar por número (FS-00001), obra o cliente..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)} />
        </div>
        {busqueda && (
          <button className={styles.btnGhost} onClick={() => setBusqueda('')}>Limpiar</button>
        )}
      </div>

      {/* Modal confirmar eliminar */}
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
          <p>{busqueda ? `No se encontraron remitos con "${busqueda}".` : seccion === 'activos' ? 'No hay remitos en curso.' : 'No hay remitos cerrados.'}</p>
          {seccion === 'activos' && !busqueda && (
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
