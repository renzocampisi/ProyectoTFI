// src/modules/m4-obra/pages/ObraHistorialPage.jsx
/**
 * Historial de Obra — consolida lo que pasó en una obra (normalmente
 * FINALIZADA): duración, insumos, mano de obra, herramientas usadas y
 * rotas, fotos de plano/croquis, inconvenientes y costos no anticipados.
 * Ver _plans/historial-obra/. Página de solo lectura — todo lo editable
 * (horas hombre, inconvenientes, costos no anticipados) se carga al
 * finalizar la obra, desde ObrasDetailPage.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ObrasService } from '../services/obras.service'
import styles from './ObraHistorialPage.module.css'

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function formatMoney(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(num)
}

export default function ObraHistorialPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [historial, setHistorial] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    setLoading(true); setError(null)
    ObrasService.getHistorial(id)
      .then(setHistorial)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando historial...</div>
  )
  if (error || !historial) return (
    <div className={styles.noEncontrado}>
      <span>🔍</span><h2>{error || 'No se pudo cargar el historial'}</h2>
      <button className={styles.btnGhost} onClick={() => navigate(`/obras/${id}`)}>← Volver</button>
    </div>
  )

  const { obra, insumosUtilizados, insumosPresupuestados, manoObra, herramientas, planos, inconvenientes, costosNoAnticipados } = historial
  const herramientasRotas = herramientas.filter(h => h.rotaEnEstaObra)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link to={`/obras/${id}`} className={styles.btnBack}>← Volver a la obra</Link>
        <h1 className={styles.title}>Historial — {obra.nombre}</h1>
        <div className={styles.resumen}>
          <span>{formatFecha(obra.fechaInicio)} → {formatFecha(obra.fechaFin)}</span>
          {obra.duracionDias != null && <span>· {obra.duracionDias} días</span>}
          {obra.horasHombre != null && <span>· {obra.horasHombre} horas hombre</span>}
        </div>
      </div>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          Insumos utilizados
          <span className={styles.cardCount}>{insumosUtilizados.length}</span>
        </h2>
        {insumosUtilizados.length === 0 ? (
          <div className={styles.empty}>Sin insumos registrados en remitos de esta obra.</div>
        ) : (
          <ul className={styles.lista}>
            {insumosUtilizados.map((i, idx) => (
              <li key={idx}>{i.nombre} — {i.cantidad} {i.unidad}</li>
            ))}
          </ul>
        )}
      </section>

      {insumosPresupuestados.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            Insumos presupuestados
            <span className={styles.cardCount}>{insumosPresupuestados.length}</span>
          </h2>
          <p className={styles.hint}>Lo cotizado en los presupuestos de la obra — puede diferir de lo que finalmente salió por remito.</p>
          <ul className={styles.lista}>
            {insumosPresupuestados.map((i, idx) => (
              <li key={idx}>{i.nombre} — {i.cantidad} {i.unidad}</li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          Mano de obra
          <span className={styles.cardCount}>{manoObra.length}</span>
        </h2>
        {manoObra.length === 0 ? (
          <div className={styles.empty}>Sin mano de obra cargada en los presupuestos de la obra.</div>
        ) : (
          <ul className={styles.lista}>
            {manoObra.map((m, idx) => (
              <li key={idx}>{m.descripcion} — {formatMoney(m.subtotal)}</li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          Herramientas usadas
          <span className={styles.cardCount}>{herramientas.length}</span>
          {herramientasRotas.length > 0 && (
            <span className={styles.badgeRotas}>{herramientasRotas.length} rota{herramientasRotas.length !== 1 ? 's' : ''}</span>
          )}
        </h2>
        {herramientas.length === 0 ? (
          <div className={styles.empty}>Sin herramientas registradas en remitos de esta obra.</div>
        ) : (
          <ul className={styles.lista}>
            {herramientas.map(h => (
              <li key={h.herramientaId}>
                {h.nombre}
                {h.rotaEnEstaObra && (
                  <span className={styles.motivoBaja}> — se dio de baja acá: {h.motivoBaja}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          Planos y croquis
          <span className={styles.cardCount}>{planos.length}</span>
        </h2>
        {planos.length === 0 ? (
          <div className={styles.empty}>Sin fotos de plano/croquis adjuntadas en Kits de Montaje.</div>
        ) : (
          <div className={styles.galeria}>
            {planos.map(p => (
              p.url && (
                <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className={styles.planoThumb}>
                  <img src={p.url} alt="Plano/croquis" />
                </a>
              )
            ))}
          </div>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          Inconvenientes
          <span className={styles.cardCount}>{inconvenientes.length}</span>
        </h2>
        {inconvenientes.length === 0 ? (
          <div className={styles.empty}>Sin inconvenientes anotados.</div>
        ) : (
          <ul className={styles.lista}>
            {inconvenientes.map(i => <li key={i.id}>{i.descripcion}</li>)}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          Costos no anticipados
          <span className={styles.cardCount}>{costosNoAnticipados.length}</span>
        </h2>
        {costosNoAnticipados.length === 0 ? (
          <div className={styles.empty}>Sin costos no anticipados cargados.</div>
        ) : (
          <ul className={styles.lista}>
            {costosNoAnticipados.map(c => (
              <li key={c.id}>{c.descripcion} — {formatMoney(c.monto)}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
