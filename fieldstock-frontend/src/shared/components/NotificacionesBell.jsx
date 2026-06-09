// src/shared/components/NotificacionesBell.jsx
/**
 * Campanita de notificaciones para el topbar.
 *
 * - Badge rojo con count de no leídas (oculto si 0).
 * - Click → dropdown con lista de las 15 últimas notifs.
 * - Click en item → marca como leída + navega al destino según el tipo.
 * - Botón "Marcar todas como leídas" en el header del dropdown.
 *
 * Cierre del dropdown: click afuera o tecla Escape (handler global con
 * cleanup en el useEffect).
 *
 * Iconos: SVG inline (no emojis) para consistencia visual cross-platform.
 * Los emojis se renderizan distinto en Windows / macOS / Linux, y en
 * temas oscuros pierden contraste. Los SVG usan `currentColor` y se
 * adaptan al theme.
 *
 * Destinos por tipo (issue #51 parte 2): cada tipo de notif sabe a qué
 * entidad refiere y cuál es su URL. Si la FK queda null por ON DELETE
 * SET NULL (entidad eliminada) la notif se marca como "huérfana" — sigue
 * siendo leíble pero no navegable, con etiqueta visual que explica por qué.
 *
 * Para sumar un tipo nuevo (ej. MANTENIMIENTO_VENCIDO):
 *   1. Sumar al ICONO_POR_TIPO con su componente SVG.
 *   2. Sumar al DESTINO_POR_TIPO con su campo FK + función de URL + label.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificaciones } from '@shared/hooks/useNotificaciones'
import styles from './NotificacionesBell.module.css'

// ── SVG icons (inline para evitar dependencia de icon libs) ─────
// Todos usan currentColor para heredar el color del padre — así
// el theme controla el color desde CSS sin tener que pasar props.

function IconBell({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function IconAlert({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9"  x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function IconPackage({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}

function IconInfo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8"  x2="12.01" y2="8" />
    </svg>
  )
}

// Icono del empty state — un check dentro de círculo, semánticamente
// "todo OK, no hay nada urgente que ver".
function IconCheckCircle({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

const ICONO_POR_TIPO = {
  PROBLEMA_LLEGADA: IconAlert,
  STOCK_BAJO:       IconPackage,
  INFO:             IconInfo,
}

// Mapeo: tipo → cómo navegar y cómo marcar huérfana si falta la FK.
// Si un tipo no aparece acá es porque no es navegable (ej. INFO genérica).
const DESTINO_POR_TIPO = {
  PROBLEMA_LLEGADA: {
    campoFk:        'remito_id',
    rutaDeId:       (id) => `/remitos/${id}`,
    labelHuerfano:  '· remito eliminado',
    tooltipHuerfano:'El remito asociado a esta notificación fue eliminado',
  },
  STOCK_BAJO: {
    campoFk:        'material_id',
    rutaDeId:       (id) => `/materiales/${id}`,
    labelHuerfano:  '· material eliminado',
    tooltipHuerfano:'El material asociado a esta notificación fue eliminado',
  },
}

const esHuerfana = (notif) => {
  const dest = DESTINO_POR_TIPO[notif.tipo]
  return !!dest && !notif[dest.campoFk]
}

function fechaRelativa(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const seg = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seg < 60)        return `hace ${seg}s`
  if (seg < 3600)      return `hace ${Math.floor(seg / 60)}m`
  if (seg < 86400)     return `hace ${Math.floor(seg / 3600)}h`
  if (seg < 86400 * 7) return `hace ${Math.floor(seg / 86400)}d`
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export default function NotificacionesBell() {
  const navigate = useNavigate()
  const { notifs, noLeidas, marcarLeida, marcarTodasLeidas } = useNotificaciones()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  // Cerrar con click fuera o Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleItemClick = (notif) => {
    if (!notif.leida) marcarLeida(notif.id)
    const dest = DESTINO_POR_TIPO[notif.tipo]
    if (dest) {
      const id = notif[dest.campoFk]
      if (id) navigate(dest.rutaDeId(id))
    }
    setOpen(false)
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.bellBtn}
        onClick={() => setOpen(o => !o)}
        title={noLeidas > 0 ? `${noLeidas} ${noLeidas === 1 ? 'notificación' : 'notificaciones'} sin leer` : 'Notificaciones'}
        aria-label="Notificaciones"
      >
        <span className={styles.bellIcon}><IconBell /></span>
        {noLeidas > 0 && (
          <span className={styles.badge}>{noLeidas > 99 ? '99+' : noLeidas}</span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>Notificaciones</span>
            {noLeidas > 0 && (
              <button
                type="button"
                className={styles.markAllBtn}
                onClick={() => marcarTodasLeidas()}
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {notifs.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}><IconCheckCircle /></span>
              <p>No hay notificaciones</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {notifs.map(notif => {
                const dest      = DESTINO_POR_TIPO[notif.tipo]
                const huerfana  = esHuerfana(notif)
                const clickable = !!dest && !!notif[dest.campoFk]
                const Icono     = ICONO_POR_TIPO[notif.tipo] || IconBell
                return (
                  <li
                    key={notif.id}
                    className={`${styles.item} ${!notif.leida ? styles.itemUnread : ''} ${clickable ? styles.itemClickable : ''} ${huerfana ? styles.itemHuerfana : ''}`}
                    onClick={() => handleItemClick(notif)}
                    title={huerfana ? dest.tooltipHuerfano : undefined}
                  >
                    <span className={styles.itemIcon}>
                      <Icono />
                    </span>
                    <div className={styles.itemBody}>
                      <div className={styles.itemTitle}>
                        {notif.titulo}
                        {!notif.leida && <span className={styles.unreadDot} />}
                      </div>
                      <div className={styles.itemMensaje}>{notif.mensaje}</div>
                      <div className={styles.itemMeta}>
                        <span className={styles.itemFecha}>{fechaRelativa(notif.created_at)}</span>
                        {notif.remitos?.numero && (
                          <span className={styles.itemRemito}>· {notif.remitos.numero}</span>
                        )}
                        {notif.material?.nombre && !notif.remitos?.numero && (
                          <span className={styles.itemRemito}>· {notif.material.nombre}</span>
                        )}
                        {huerfana && (
                          <span className={styles.itemHuerfanaTag}>{dest.labelHuerfano}</span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
