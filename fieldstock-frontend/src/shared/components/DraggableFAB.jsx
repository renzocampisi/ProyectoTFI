// src/shared/components/DraggableFAB.jsx
/**
 * FAB de "Escanear QR" arrastrable. Por default arranca anclado a la
 * esquina inferior derecha (config previa), pero el usuario lo puede
 * mover libremente con drag. La posición elegida se persiste en
 * localStorage por device.
 *
 * Detalles de UX:
 *   - Diferencia tap vs drag con un umbral de 8px. Tap navega; drag mueve.
 *   - Clamping: el FAB no puede salirse del viewport (8px de padding).
 *   - Re-clamp en resize: si rotás el dispositivo y la posición guardada
 *     queda fuera de los nuevos límites, se ajusta automaticamente.
 *   - `touchmove` con `passive: false` (vía addEventListener manual,
 *     no se puede via prop de React) para poder `preventDefault()` y
 *     bloquear el scroll de la página durante el drag.
 *
 * Solo se monta en mobile/tablet (≤768px) — en desktop el sidebar
 * lateral ya tiene el item "Escanear QR" normal y no hace falta FAB.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LuQrCode } from 'react-icons/lu'
import styles from './DraggableFAB.module.css'

const STORAGE_KEY    = 'fs-fab-position-qr'
const DRAG_THRESHOLD = 8   // px — distancia mínima para considerar drag
const FAB_SIZE       = 64  // px — debe matchear el CSS
const PADDING        = 8   // px — margen mínimo del borde del viewport

function clampPosition(x, y) {
  const maxX = window.innerWidth  - FAB_SIZE - PADDING
  const maxY = window.innerHeight - FAB_SIZE - PADDING
  return {
    x: Math.max(PADDING, Math.min(maxX, x)),
    y: Math.max(PADDING, Math.min(maxY, y)),
  }
}

function leerPosicionGuardada() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch { return null }
}

export default function DraggableFAB() {
  const navigate = useNavigate()
  const fabRef   = useRef(null)
  const [pos, setPos] = useState(leerPosicionGuardada)
  const [dragging, setDragging] = useState(false)

  // ── Drag con touch ──────────────────────────────────────────
  useEffect(() => {
    const el = fabRef.current
    if (!el) return

    const state = { startX: 0, startY: 0, fabX: 0, fabY: 0, moved: false }

    const onTouchStart = (e) => {
      const touch = e.touches[0]
      const rect  = el.getBoundingClientRect()
      state.startX = touch.clientX
      state.startY = touch.clientY
      state.fabX   = rect.left
      state.fabY   = rect.top
      state.moved  = false
    }

    const onTouchMove = (e) => {
      const touch = e.touches[0]
      const dx = touch.clientX - state.startX
      const dy = touch.clientY - state.startY

      if (!state.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        state.moved = true
        setDragging(true)
      }

      if (state.moved) {
        e.preventDefault()  // bloquea scroll de la página
        const next = clampPosition(state.fabX + dx, state.fabY + dy)
        setPos(next)
      }
    }

    const onTouchEnd = () => {
      if (state.moved) {
        setDragging(false)
      } else {
        // tap sin drag — navegar
        navigate('/qr')
      }
    }

    // Prevenir el click "fantasma" después de un drag (en mobile el browser
    // dispara click ~300ms después del touchend en algunos casos).
    const onClick = (e) => {
      if (state.moved) e.preventDefault()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    el.addEventListener('click',      onClick)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
      el.removeEventListener('click',      onClick)
    }
  }, [navigate])

  // ── Persistir cuando termina el drag ────────────────────────
  useEffect(() => {
    if (!pos) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)) } catch { /* localStorage lleno o privado, ignorar */ }
  }, [pos])

  // ── Re-clamp en resize/rotate ───────────────────────────────
  useEffect(() => {
    const onResize = () => {
      if (!pos) return
      const next = clampPosition(pos.x, pos.y)
      if (next.x !== pos.x || next.y !== pos.y) setPos(next)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [pos])

  // ── Handler para desktop (mouse click — sin drag) ───────────
  // Si el user tiene mouse en una tablet o ventana de DevTools, queremos
  // que el click siga llevando a /qr (el touch handler no se dispara).
  const onMouseClick = (e) => {
    // Si llegamos acá vía touchend, el touch handler ya navegó — el
    // browser dispara click después, lo bloqueamos en el listener manual.
    // En desktop, navegamos manualmente.
    if (!('ontouchstart' in window)) {
      e.preventDefault()
      navigate('/qr')
    }
  }

  // Si hay posición custom, usar coordenadas absolutas (left/top).
  // Si no, dejar que el CSS por default lo ancle a bottom-right.
  const style = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : undefined

  return (
    <button ref={fabRef} type="button"
      className={`${styles.fabQr} ${dragging ? styles.dragging : ''}`}
      style={style}
      onClick={onMouseClick}
      title="Escanear QR — arrastrá para mover"
      aria-label="Escanear QR">
      <span className={styles.fabQrIcon}><LuQrCode size={28} /></span>
    </button>
  )
}
