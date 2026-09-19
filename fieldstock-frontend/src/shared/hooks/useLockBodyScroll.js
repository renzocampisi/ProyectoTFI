// src/shared/hooks/useLockBodyScroll.js
import { useEffect } from 'react'

// Bloquea el scroll del body mientras un modal está montado. Sin esto, en
// mobile el overlay fixed no impide que el touch-scroll siga moviendo la
// página de atrás (el modal "flota" pero el fondo se sigue desplazando).
export default function useLockBodyScroll() {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
}
