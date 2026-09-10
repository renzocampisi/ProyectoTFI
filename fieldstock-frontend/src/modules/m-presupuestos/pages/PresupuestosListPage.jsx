// src/modules/m-presupuestos/pages/PresupuestosListPage.jsx
/**
 * Listado global de presupuestos, con filtros por estado (chips) y obra
 * (select). Espejado de ComprasListPage para mantener consistencia visual.
 *
 * Alta: PresupuestoNewPage necesita `?obraId=` (la obra va read-only en la
 * cabecera), así que el botón "+ Nuevo presupuesto" despliega un selector
 * de obra inline y recién ahí navega a /presupuestos/nuevo?obraId=X — mismo
 * destino que el botón dentro de la página de una obra.
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePresupuestos } from '../hooks/usePresupuestos'
import { ObrasService } from '@modules/m4-obra/services/obras.service'
import EstadoPresupuestoBadge from '../components/EstadoPresupuestoBadge'
import { ESTADO_INFO, formatMoney, formatFecha } from '../constants'
import styles from './PresupuestosListPage.module.css'

// Chips de filtro: TODOS primero, después el ciclo de vida en orden.
const ESTADOS_FILTRO = ['TODOS', 'BORRADOR', 'EN_APROBACION', 'APROBADO', 'RECHAZADO']

export default function PresupuestosListPage() {
  const navigate = useNavigate()

  // ── Filtros ───────────────────────────────────────────────────
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [filtroObra,   setFiltroObra]   = useState('')
  const [obras,        setObras]        = useState([])

  // ── Picker de obra para el alta ───────────────────────────────
  const [pickerAbierto, setPickerAbierto] = useState(false)
  const [obraNueva,     setObraNueva]     = useState('')

  // Traemos todo sin filtrar por estado y filtramos en cliente (mismo
  // patrón que ComprasListPage): evita round-trip por cada chip.
  const { presupuestos: todos, loading, error } = usePresupuestos({
    obraId: filtroObra || undefined,
  })

  const presupuestos = useMemo(() => {
    if (filtroEstado === 'TODOS') return todos
    return todos.filter(p => p.estado === filtroEstado)
  }, [todos, filtroEstado])

  const conteos = useMemo(() => {
    const acc = { TODOS: todos.length }
    for (const p of todos) acc[p.estado] = (acc[p.estado] || 0) + 1
    return acc
  }, [todos])

  // Obras para el select del filtro y para el picker de alta.
  useEffect(() => {
    let cancelado = false
    ObrasService.getAll()
      .then(data => { if (!cancelado) setObras(Array.isArray(data) ? data : []) })
      .catch(() => {}) // sin obras el select queda vacío, no bloquea
    return () => { cancelado = true }
  }, [])

  // Para crear un presupuesto la obra no puede estar finalizada.
  const obrasParaAlta = useMemo(
    () => obras.filter(o => o.estado !== 'FINALIZADA'),
    [obras],
  )

  function confirmarAlta() {
    if (!obraNueva) return
    navigate(`/presupuestos/nuevo?obraId=${obraNueva}`)
  }

  const hayFiltro = filtroEstado !== 'TODOS' || filtroObra

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Presupuestos</h1>
          <p className={styles.subtitle}>
            {loading
              ? 'Cargando...'
              : `${presupuestos.length} presupuesto${presupuestos.length !== 1 ? 's' : ''}${hayFiltro ? ' (filtrados)' : ''}`}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setPickerAbierto(v => !v)}>
          + Nuevo presupuesto
        </button>
      </div>

      {/* ── Picker de obra para el alta ──────────────────────────── */}
      {pickerAbierto && (
        <div className={styles.pickerObra}>
          <label className={styles.pickerLabel}>
            ¿Para qué obra?
          </label>
          <div className={styles.pickerRow}>
            <select className={styles.select}
              value={obraNueva}
              onChange={e => setObraNueva(e.target.value)}>
              <option value="">Elegí una obra…</option>
              {obrasParaAlta.map(o => (
                <option key={o.id} value={o.id}>
                  {o.nombre || 'Sin nombre'}{o.cliente ? ` — ${o.cliente}` : ''}
                </option>
              ))}
            </select>
            <button className={styles.btnPrimary}
              onClick={confirmarAlta} disabled={!obraNueva}>
              Continuar
            </button>
            <button className={styles.btnLimpiar}
              onClick={() => { setPickerAbierto(false); setObraNueva('') }}>
              Cancelar
            </button>
          </div>
          {obrasParaAlta.length === 0 && (
            <p className={styles.pickerHint}>
              No hay obras activas. Creá una obra antes de armar un presupuesto.
            </p>
          )}
        </div>
      )}

      {/* ── Chips de filtro por estado ───────────────────────────── */}
      <div className={styles.estadoChips}>
        {ESTADOS_FILTRO.map(estado => {
          const label = estado === 'TODOS' ? 'Todos' : ESTADO_INFO[estado]?.label || estado
          const count = conteos[estado] ?? 0
          const active = filtroEstado === estado
          return (
            <button key={estado}
              type="button"
              className={`${styles.chip} ${active ? styles.chipActive : ''}`}
              onClick={() => setFiltroEstado(estado)}>
              {label}
              <span className={styles.chipCount}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Toolbar: select de obra ──────────────────────────────── */}
      <div className={styles.toolbar}>
        <select className={styles.select}
          value={filtroObra}
          onChange={e => setFiltroObra(e.target.value)}>
          <option value="">Todas las obras</option>
          {obras.map(o => (
            <option key={o.id} value={o.id}>{o.nombre || 'Sin nombre'}</option>
          ))}
        </select>
        {hayFiltro && (
          <button type="button" className={styles.btnLimpiar}
            onClick={() => { setFiltroEstado('TODOS'); setFiltroObra('') }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {loading && (
        <div className={styles.loading}>
          <span className={styles.spinner} /> Cargando presupuestos...
        </div>
      )}

      {!loading && !error && presupuestos.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📄</span>
          <p>
            {hayFiltro
              ? 'No hay presupuestos que coincidan con el filtro.'
              : 'Todavía no hay presupuestos.'}
          </p>
          {!hayFiltro && (
            <button className={styles.btnPrimary} onClick={() => setPickerAbierto(true)}>
              Crear primer presupuesto
            </button>
          )}
        </div>
      )}

      {!loading && !error && presupuestos.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Número</th>
                <th>Obra</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th className={styles.tdNum}>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {presupuestos.map(p => (
                <tr key={p.id} className={styles.row}
                  onClick={() => navigate(`/presupuestos/${p.id}`)}>
                  <td className={styles.numero} data-label="Número">{p.numero}</td>
                  <td className={styles.obra} data-label="Obra">
                    {p.obra?.nombre || '—'}
                  </td>
                  <td className={styles.cliente} data-label="Cliente">
                    {p.obra?.cliente || '—'}
                  </td>
                  <td className={styles.fecha} data-label="Fecha">
                    {formatFecha(p.fecha_creacion || p.created_at)}
                  </td>
                  <td className={styles.estadoCell} data-label="Estado">
                    <EstadoPresupuestoBadge estado={p.estado} />
                  </td>
                  <td className={styles.total} data-label="Total">
                    {formatMoney(p.total)}
                  </td>
                  <td className={styles.actions}>
                    <button className={styles.btnRow}
                      onClick={e => { e.stopPropagation(); navigate(`/presupuestos/${p.id}`) }}>
                      Ver →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
