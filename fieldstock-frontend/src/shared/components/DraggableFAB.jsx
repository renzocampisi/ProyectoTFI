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
 *   - Pointer Events (no touch): funciona igual con dedo y con mouse.
 *     El scroll durante el gesto lo bloquea `touch-action: none` del CSS.
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

  // ── Drag con Pointer Events ─────────────────────────────────
  // Un solo camino para mouse, touch y stylus. Antes esto escuchaba solo
  // eventos touch, así que en una notebook el FAB no se podía arrastrar
  // aunque el CSS mostrara `cursor: grab` prometiendo lo contrario.
  //
  // `setPointerCapture` hace que el elemento siga recibiendo los eventos
  // aunque el puntero se salga de él a mitad del arrastre — sin eso, mover
  // rápido "suelta" el FAB. El scroll durante el gesto lo bloquea
  // `touch-action: none` desde el CSS, no hace falta preventDefault.
  useEffect(() => {
    const el = fabRef.current
    if (!el) return

    const state = { startX: 0, startY: 0, fabX: 0, fabY: 0, moved: false, activo: false }

    const onPointerDown = (e) => {
      // Solo botón principal: con el secundario se abre el menú contextual.
      if (e.button !== 0) return
      const rect = el.getBoundingClientRect()
      state.startX = e.clientX
      state.startY = e.clientY
      state.fabX   = rect.left
      state.fabY   = rect.top
      state.moved  = false
      state.activo = true
      el.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e) => {
      if (!state.activo) return
      const dx = e.clientX - state.startX
      const dy = e.clientY - state.startY

      if (!state.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        state.moved = true
        setDragging(true)
      }
      if (state.moved) {
        setPos(clampPosition(state.fabX + dx, state.fabY + dy))
      }
    }

    const onPointerUp = (e) => {
      if (!state.activo) return
      state.activo = false
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)

      if (state.moved) {
        setDragging(false)
      } else {
        navigate('/qr')   // fue un tap/click, no un arrastre
      }
    }

    // Si el gesto se cancela (ej. el sistema se queda con el puntero),
    // cerramos el estado para no dejar el FAB "pegado" al cursor.
    const onPointerCancel = () => {
      state.activo = false
      state.moved  = false
      setDragging(false)
    }

    // Bloquea el click sintético posterior a un arrastre, que si no
    // navegaría a /qr apenas soltás el FAB en su nueva posición.
    const onClick = (e) => {
      if (state.moved) { e.preventDefault(); e.stopPropagation() }
    }

    el.addEventListener('pointerdown',   onPointerDown)
    el.addEventListener('pointermove',   onPointerMove)
    el.addEventListener('pointerup',     onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    el.addEventListener('click',         onClick)

    return () => {
      el.removeEventListener('pointerdown',   onPointerDown)
      el.removeEventListener('pointermove',   onPointerMove)
      el.removeEventListener('pointerup',     onPointerUp)
      el.removeEventListener('pointercancel', onPointerCancel)
      el.removeEventListener('click',         onClick)
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

  // Ya no hace falta un handler de click aparte para desktop: pointerup
  // cubre mouse y touch por igual, y navega solo si el gesto no fue drag.

  // Si hay posición custom, usar coordenadas absolutas (left/top).
  // Si no, dejar que el CSS por default lo ancle a bottom-right.
  const style = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : undefined

  return (
    <button ref={fabRef} type="button"
      className={`${styles.fabQr} ${dragging ? styles.dragging : ''}`}
      style={style}
      title="Escanear QR — arrastrá para mover"
      aria-label="Escanear QR">
      <span className={styles.fabQrIcon}><LuQrCode size={28} /></span>
    </button>
  )
}
