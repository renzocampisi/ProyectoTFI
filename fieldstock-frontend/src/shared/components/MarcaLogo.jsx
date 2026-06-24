// src/shared/components/MarcaLogo.jsx
/**
 * Logo de marca a partir del texto del campo `marca` de un material.
 *
 * Convención: la imagen se sirve desde `/marcas/<slug>.png` (o .jpg/.svg).
 * `slug` = marca lowercase, sin tildes, sin espacios.
 *   "Fischer"          → "/marcas/fischer.png"
 *   "Bosch Profesional" → "/marcas/bosch-profesional.png"
 *
 * Si la imagen no existe (404), el componente se oculta. Si no hay
 * marca, devuelve null. No hay error visible al usuario.
 *
 * Para agregar una marca nueva: poner el archivo en
 * `fieldstock-frontend/public/marcas/<slug>.<ext>`. Sin cambios de
 * codigo, sin migración.
 *
 * @param {string} marca   Texto de la marca (case-insensitive, con o sin espacios).
 * @param {number} size    Lado del cuadrado contenedor. Default 64px.
 * @param {string} ext     Extension preferida. Default "png".
 */
import { useState } from 'react'

const RANGO_DIACRITICOS = /[̀-ͯ]/g

export function marcaSlug(marca) {
  if (!marca) return ''
  return String(marca)
    .toLowerCase()
    .normalize('NFD').replace(RANGO_DIACRITICOS, '')   // quitar tildes
    .replace(/[^a-z0-9]+/g, '-')                       // espacios/simbolos → -
    .replace(/(^-|-$)/g, '')                           // trim hyphens
}

export default function MarcaLogo({ marca, size = 64, ext = 'png', className = '' }) {
  const [hidden, setHidden] = useState(false)
  if (!marca || hidden) return null
  const slug = marcaSlug(marca)
  if (!slug) return null

  const wrapperStyle = {
    width: size,
    height: size,
    background: '#fff',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }
  const imgStyle = {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    display: 'block',
  }
  return (
    <div className={className} style={wrapperStyle} title={marca}>
      <img src={`/marcas/${slug}.${ext}`} alt={marca}
        style={imgStyle}
        onError={() => setHidden(true)} />
    </div>
  )
}
