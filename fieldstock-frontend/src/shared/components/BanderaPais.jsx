// src/shared/components/BanderaPais.jsx
/**
 * Banderas como SVG inline en vez de emoji Unicode (🇦🇷 etc.) — en Windows
 * (sobre todo Chrome) los emoji de bandera no tienen glyph en la fuente por
 * default y no se ven (quedan las dos letras del código de país sueltas o
 * directamente nada). Un SVG chico se ve igual en cualquier SO/navegador.
 *
 * Diseños simplificados (no oficiales pixel-perfect), solo para que se
 * reconozcan a este tamaño chico al lado del código de discado.
 */
const VIEWBOX = '0 0 20 14'

const BANDERAS = {
  AR: (
    <svg viewBox={VIEWBOX} width="20" height="14" aria-hidden="true">
      <rect width="20" height="14" fill="#75aadb" />
      <rect y="4.67" width="20" height="4.67" fill="#fff" />
      <circle cx="10" cy="7" r="1.6" fill="#f6b40e" stroke="#85340a" strokeWidth="0.3" />
    </svg>
  ),
  UY: (
    <svg viewBox={VIEWBOX} width="20" height="14" aria-hidden="true">
      <rect width="20" height="14" fill="#fff" />
      <rect y="2" width="20" height="1.6" fill="#0038a8" />
      <rect y="5.2" width="20" height="1.6" fill="#0038a8" />
      <rect y="8.4" width="20" height="1.6" fill="#0038a8" />
      <rect y="11.6" width="20" height="1.6" fill="#0038a8" />
      <rect width="8" height="7.6" fill="#fff" />
      <circle cx="4" cy="3.8" r="1.7" fill="#fcd116" />
    </svg>
  ),
  CL: (
    <svg viewBox={VIEWBOX} width="20" height="14" aria-hidden="true">
      <rect width="20" height="7" fill="#fff" />
      <rect y="7" width="20" height="7" fill="#d52b1e" />
      <rect width="7" height="7" fill="#0039a6" />
      <path d="M3.5 2.2 L4.05 3.9 L5.8 3.9 L4.4 4.9 L4.95 6.6 L3.5 5.6 L2.05 6.6 L2.6 4.9 L1.2 3.9 L2.95 3.9 Z" fill="#fff" />
    </svg>
  ),
  PY: (
    <svg viewBox={VIEWBOX} width="20" height="14" aria-hidden="true">
      <rect width="20" height="4.67" fill="#d52b1e" />
      <rect y="4.67" width="20" height="4.67" fill="#fff" />
      <rect y="9.34" width="20" height="4.67" fill="#0038a8" />
    </svg>
  ),
  BO: (
    <svg viewBox={VIEWBOX} width="20" height="14" aria-hidden="true">
      <rect width="20" height="4.67" fill="#d52b1e" />
      <rect y="4.67" width="20" height="4.67" fill="#f9e300" />
      <rect y="9.34" width="20" height="4.67" fill="#007934" />
    </svg>
  ),
  BR: (
    <svg viewBox={VIEWBOX} width="20" height="14" aria-hidden="true">
      <rect width="20" height="14" fill="#009739" />
      <path d="M10 1.5 L18.5 7 L10 12.5 L1.5 7 Z" fill="#fedd00" />
      <circle cx="10" cy="7" r="3" fill="#012169" />
    </svg>
  ),
  ES: (
    <svg viewBox={VIEWBOX} width="20" height="14" aria-hidden="true">
      <rect width="20" height="14" fill="#aa151b" />
      <rect y="3.5" width="20" height="7" fill="#f1bf00" />
    </svg>
  ),
  US: (
    <svg viewBox={VIEWBOX} width="20" height="14" aria-hidden="true">
      <rect width="20" height="14" fill="#fff" />
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <rect key={i} y={i * 2} width="20" height="1" fill="#b22234" />
      ))}
      <rect width="9" height="7.5" fill="#3c3b6e" />
    </svg>
  ),
}

export default function BanderaPais({ codigo, className }) {
  return <span className={className}>{BANDERAS[codigo] || null}</span>
}
