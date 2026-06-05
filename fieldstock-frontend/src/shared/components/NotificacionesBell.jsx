// src/shared/components/NotificacionesBell.jsx
/**
 * Campanita de notificaciones para el topbar.
 *
 * - Badge rojo con count de no leídas (oculto si 0).
 * - Click → dropdown con lista de las 50 últimas notifs.
 * - Click en item → marca como leída + navega al detalle del remito si tiene
 *   remito_id asociado.
 * - Botón "Marcar todas como leídas" en el header del dropdown.
 *
 * Cierre del dropdown: click afuera o tecla Escape (handler global con
 * cleanup en el useEffect).
 *
 * Iconos por tipo: PROBLEMA_LLEGADA → ⚠, INFO → ℹ, default → 🔔.
 * Si en el futuro se agregan tipos (STOCK_BAJO, MANTENIMIENTO_VENCIDO),
 * se mapean acá sin tocar el resto.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificaciones } from '@shared/hooks/useNotificaciones'
import styles from './NotificacionesBell.module.css'

const ICONO_POR_TIPO = {
  PROBLEMA_LLEGADA: '⚠',
  STOCK_BAJO:       '📦',
  INFO:             'ℹ',
}

function fechaRelativa(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const seg = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seg < 60)        return `hace ${seg}s`
  if (seg < 3600)      return `hace ${Math.floor(seg / 60)}m`
  if (seg < 86400)     return `hace ${Math.floor(seg / 3600)}h`
  if (seg < 86400 * 7) return `hace ${Math.floor(seg / 86400)}d`
  // Más de una semana: fecha corta
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
    // Marca como leída si no lo está y, si la notif refiere a un remito,
    // navega al detalle. Cierra el dropdown.
    if (!notif.leida) marcarLeida(notif.id)
    if (notif.remito_id) {
      navigate(`/remitos/${notif.remito_id}`)
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
        <span className={styles.bellIcon}>🔔</span>
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
              <span className={styles.emptyIcon}>🎉</span>
              <p>No hay notificaciones</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {notifs.map(notif => (
                <li
                  key={notif.id}
                  className={`${styles.item} ${!notif.leida ? styles.itemUnread : ''} ${notif.remito_id ? styles.itemClickable : ''}`}
                  onClick={() => handleItemClick(notif)}
                >
                  <span className={styles.itemIcon}>
                    {ICONO_POR_TIPO[notif.tipo] || '🔔'}
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
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
