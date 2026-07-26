// src/modules/m1-dashboard/pages/DashboardPage.jsx
/**
 * Home del sistema (Word #16) — primera pantalla post-login.
 *
 * Layout (Opción A + Notificaciones):
 *   [ KPIs: Herramientas | Obras activas | Remitos en curso | Alertas ]
 *   [ 🔔 Notificaciones  |  📦 Materiales con stock bajo               ]
 *   [                  📄 Últimos remitos                              ]
 *
 * Todo el data fetching está agregado en un solo endpoint (/dashboard)
 * para minimizar round-trips. Ver useDashboard().
 */
import { Link } from 'react-router-dom'
import {
  LuWrench, LuConstruction, LuClipboardList, LuTriangleAlert, LuCheck,
  LuBell, LuPackage, LuFileText, LuTrendingUp, LuChartBar,
} from 'react-icons/lu'
import { useDashboard } from '../hooks/useDashboard'
import EstadoRemitoBadge from '@modules/m5-remito/components/EstadoRemitoBadge'
import styles from './DashboardPage.module.css'

// Formateo de fecha corto — solo día/mes (la home es de un vistazo rápido)
function fechaCorta(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

function tiempoRelativo(iso) {
  if (!iso) return ''
  const ahora = Date.now()
  const t     = new Date(iso).getTime()
  const min   = Math.floor((ahora - t) / 60000)
  if (min < 1)    return 'recién'
  if (min < 60)   return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias < 7)   return `hace ${dias} d`
  return fechaCorta(iso)
}

// Barra horizontal simple para un ranking (magnitud, una sola serie —
// no hace falta leyenda, el título de la card ya nombra qué mide). El
// ancho de cada barra es proporcional al máximo de la lista, no a un
// total externo, así el ítem #1 siempre llena la barra completa.
function BarList({ items, unidadSufijo }) {
  const max = Math.max(1, ...items.map(i => i.valor))
  return (
    <div className={styles.barList}>
      {items.map(item => (
        <div key={item.id} className={styles.barRow} title={`${item.nombre}: ${item.valor}${unidadSufijo ? ` ${unidadSufijo(item)}` : ''}`}>
          <span className={styles.barLabel}>{item.nombre}</span>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${(item.valor / max) * 100}%` }} />
          </div>
          <span className={styles.barValue}>{item.valor}{unidadSufijo ? ` ${unidadSufijo(item)}` : ''}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { data, loading, error } = useDashboard()

  if (loading) return (
    <div className={styles.page}>
      <Header />
      <div className={styles.loading}>Cargando resumen...</div>
    </div>
  )

  if (error) return (
    <div className={styles.page}>
      <Header />
      <div className={styles.errorBox}>⚠ {error}</div>
    </div>
  )

  const { kpis, notificaciones, insumosMenorStock, ultimosRemitos, topHerramientas, topMateriales } = data

  return (
    <div className={styles.page}>
      <Header />

      {/* ── KPIs ── */}
      <div className={styles.kpiGrid}>
        <Link to="/herramientas" className={styles.kpiCard}>
          <span className={styles.kpiLabel}>
            <span className={styles.kpiIcon}><LuWrench size={14} /></span> Herramientas
          </span>
          <span className={styles.kpiValue}>{kpis.herramientas.total}</span>
          <span className={styles.kpiHint}>
            {kpis.herramientas.disponibles} disponibles · {kpis.herramientas.enObra} en obra
          </span>
        </Link>

        <Link to="/obras" className={styles.kpiCard}>
          <span className={styles.kpiLabel}>
            <span className={styles.kpiIcon}><LuConstruction size={14} /></span> Obras activas
          </span>
          <span className={styles.kpiValue}>{kpis.obrasActivas}</span>
          <span className={styles.kpiHint}>En ejecución</span>
        </Link>

        <Link to="/remitos" className={styles.kpiCard}>
          <span className={styles.kpiLabel}>
            <span className={styles.kpiIcon}><LuClipboardList size={14} /></span> Remitos en curso
          </span>
          <span className={styles.kpiValue}>{kpis.remitosEnCurso}</span>
          <span className={styles.kpiHint}>Sin cerrar</span>
        </Link>

        {/* KPI Alertas: verde si 0 (todo OK), rojo si >0 (Word C).
            Semaforo conceptual — el verde refuerza positivamente. */}
        <Link to="/materiales" className={`${styles.kpiCard} ${kpis.alertasStockBajo > 0 ? styles.kpiAlerta : styles.kpiOk}`}>
          <span className={styles.kpiLabel}>
            <span className={styles.kpiIcon}>
              {kpis.alertasStockBajo > 0 ? <LuTriangleAlert size={14} /> : <LuCheck size={14} />}
            </span> Alertas
          </span>
          <span className={styles.kpiValue}>{kpis.alertasStockBajo}</span>
          <span className={styles.kpiHint}>
            {kpis.alertasStockBajo > 0 ? 'Materiales con stock bajo' : 'Todo el stock está OK'}
          </span>
        </Link>
      </div>

      {/* ── Notificaciones + Stock bajo ── */}
      <div className={styles.row2}>

        {/* Notificaciones */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}><LuBell size={14} /> Notificaciones recientes</span>
          </div>
          {notificaciones.length === 0
            ? <div className={styles.empty}>No hay notificaciones por ahora.</div>
            : (
              <div className={styles.list}>
                {notificaciones.map(n => {
                  // Si la noti tiene remito asociado, linkeamos al detalle
                  const href = n.remito_id ? `/remitos/${n.remito_id}` : '#'
                  return (
                    <Link key={n.id} to={href} className={styles.listItem}>
                      {!n.leida && <span className={styles.dotNueva} title="No leída" />}
                      <div className={styles.listMain}>
                        <span className={styles.listTitle}>{n.titulo || n.tipo}</span>
                        <span className={styles.listSub}>
                          {n.mensaje || (n.remitos?.numero ? `Remito ${n.remitos.numero}` : '')}
                        </span>
                      </div>
                      <span className={styles.listMeta}>{tiempoRelativo(n.created_at)}</span>
                    </Link>
                  )
                })}
              </div>
            )
          }
        </div>

        {/* Insumos con menos stock — SIEMPRE muestra hasta 5 filas (si hay
            materiales cargados), no solo los que están en alerta real, así
            este slot del grid nunca queda vacío/discreto. La severidad de
            color solo se aplica a los que de verdad están en o por debajo
            del mínimo — el resto se ve neutro, es "el que menos margen
            tiene", no necesariamente un problema. */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}><LuPackage size={14} /> Insumos con menos stock</span>
            <Link to="/materiales" className={styles.cardLink}>Ver catálogo →</Link>
          </div>
          {insumosMenorStock.length === 0
            ? <div className={styles.empty}>Todavía no hay materiales cargados.</div>
            : (
              <div className={styles.list}>
                {insumosMenorStock.map(m => {
                  const stock = Number(m.stock_actual)
                  const min   = Number(m.stock_minimo)
                  const enAlerta = stock <= min
                  const critico  = stock === 0 || (enAlerta && stock <= min / 2)
                  const severidad = !enAlerta ? '' : (critico ? styles.severidadCritica : styles.severidadBaja)
                  return (
                    <Link key={m.id} to="/materiales" className={styles.listItem}>
                      <div className={styles.listMain}>
                        <span className={styles.listTitle}>{m.nombre}</span>
                        <span className={styles.listSub}>
                          {m.marca ? `${m.marca} · ` : ''}mínimo: {min} {m.unidad}
                        </span>
                      </div>
                      <span className={`${styles.listMeta} ${severidad}`}>
                        {stock} {m.unidad}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )
          }
        </div>

      </div>

      {/* ── Herramientas más usadas + Materiales más consumidos ── */}
      <div className={styles.row2}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}><LuTrendingUp size={14} /> Herramientas más usadas</span>
          </div>
          {topHerramientas.length === 0
            ? <div className={styles.empty}>Todavía no hay egresos registrados.</div>
            : <BarList items={topHerramientas.map(h => ({ id: h.id, nombre: h.nombre, valor: h.usos }))}
                unidadSufijo={() => 'usos'} />
          }
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}><LuChartBar size={14} /> Materiales más consumidos</span>
          </div>
          {topMateriales.length === 0
            ? <div className={styles.empty}>Todavía no hay consumo de materiales registrado.</div>
            : <BarList items={topMateriales.map(m => ({ id: m.id, nombre: m.nombre, valor: m.consumo, unidad: m.unidad }))}
                unidadSufijo={item => item.unidad} />
          }
        </div>
      </div>

      {/* ── Últimos remitos ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}><LuFileText size={14} /> Últimos remitos</span>
          <Link to="/remitos" className={styles.cardLink}>Ver todos →</Link>
        </div>
        {ultimosRemitos.length === 0
          ? <div className={styles.empty}>Todavía no se generaron remitos.</div>
          : (
            <div className={styles.list}>
              {ultimosRemitos.map(r => (
                <Link key={r.id} to={`/remitos/${r.id}`} className={styles.listItem}>
                  <div className={styles.listMain}>
                    {/* Cliente y obra separados en dos líneas — el cliente
                        manda la jerarquía visual y la obra queda como
                        contexto secundario. Coherente con el resto de la app. */}
                    <span className={styles.listTitle}>
                      {r.numero} — {r.cliente_nombre || 'Sin cliente'}
                    </span>
                    <span className={styles.listSub}>
                      {r.obra || 'Sin obra'} · Egreso: {fechaCorta(r.fecha_egreso)}
                      {r.fecha_retorno && ` · Retorno: ${fechaCorta(r.fecha_retorno)}`}
                    </span>
                  </div>
                  {/* Mismo badge coloreado que en /remitos para consistencia */}
                  <EstadoRemitoBadge estado={r.estado} />
                </Link>
              ))}
            </div>
          )
        }
      </div>

    </div>
  )
}

function Header() {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>Inicio</h1>
      <p className={styles.subtitle}>Resumen general del depósito y la operación.</p>
    </div>
  )
}
