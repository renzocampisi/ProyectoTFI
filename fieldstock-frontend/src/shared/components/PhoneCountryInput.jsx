// src/shared/components/PhoneCountryInput.jsx
/**
 * Input de teléfono con selector de país (bandera + código de discado) que
 * se completa ANTES de escribir el número — el país elegido prefija todo lo
 * que se tipea. El valor combinado (dial + número, todo junto, sin
 * separadores) es lo que viaja como `telefono` — mismo formato de string
 * que ya usa el resto del sistema (ver formatearTelefono en las páginas de
 * directorio), así que no requiere cambios de backend/schema.
 */
import { useState, useRef, useEffect } from 'react'
import BanderaPais from './BanderaPais'
import styles from './PhoneCountryInput.module.css'

// `codigo` (ISO alpha-2) elige el SVG en BanderaPais — ver ese archivo para
// el porqué de usar SVG en vez de emoji de bandera (no rinden en Windows).
export const PAISES_TELEFONO = [
  { dial: '54',  codigo: 'AR', nombre: 'Argentina' },
  { dial: '598', codigo: 'UY', nombre: 'Uruguay' },
  { dial: '56',  codigo: 'CL', nombre: 'Chile' },
  { dial: '595', codigo: 'PY', nombre: 'Paraguay' },
  { dial: '591', codigo: 'BO', nombre: 'Bolivia' },
  { dial: '55',  codigo: 'BR', nombre: 'Brasil' },
  { dial: '34',  codigo: 'ES', nombre: 'España' },
  { dial: '1',   codigo: 'US', nombre: 'Estados Unidos' },
]

const DEFAULT_PAIS = PAISES_TELEFONO[0] // Argentina

// Separa un string guardado ("549341...") en {pais, numeroNacional}.
// Se ordenan los códigos por longitud descendente para que un código de
// 3 dígitos no quede eclipsado por uno de 1 o 2 (ej. no confundir "598" con "5").
export function parseTelefono(valor) {
  const limpio = (valor || '').replace(/\D/g, '')
  if (!limpio) return { pais: DEFAULT_PAIS, numeroNacional: '' }
  const candidato = [...PAISES_TELEFONO]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find(p => limpio.startsWith(p.dial))
  if (!candidato) return { pais: DEFAULT_PAIS, numeroNacional: limpio }
  return { pais: candidato, numeroNacional: limpio.slice(candidato.dial.length) }
}

export function armarTelefono(pais, numeroNacional) {
  const nums = (numeroNacional || '').replace(/\D/g, '')
  return nums ? `${pais.dial}${nums}` : ''
}

export default function PhoneCountryInput({ value, onChange, placeholder, maxLength = 13 }) {
  const inicial = parseTelefono(value)
  const [pais, setPais]                     = useState(inicial.pais)
  const [numeroNacional, setNumeroNacional] = useState(inicial.numeroNacional)
  const [abierto, setAbierto]               = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const handleClickFuera = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [abierto])

  const elegirPais = (nuevoPais) => {
    setPais(nuevoPais)
    setAbierto(false)
    onChange(armarTelefono(nuevoPais, numeroNacional))
  }

  const handleNumero = (e) => {
    const nums = e.target.value.replace(/\D/g, '').slice(0, maxLength - pais.dial.length)
    setNumeroNacional(nums)
    onChange(armarTelefono(pais, nums))
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button type="button" className={styles.paisBtn} onClick={() => setAbierto(o => !o)}>
        <BanderaPais codigo={pais.codigo} className={styles.bandera} />
        <span>+{pais.dial}</span>
        <span className={styles.caret}>▾</span>
      </button>

      {abierto && (
        <ul className={styles.dropdown} role="listbox">
          {PAISES_TELEFONO.map(p => (
            <li key={p.dial + p.nombre}>
              <button type="button" className={styles.opcion} onClick={() => elegirPais(p)}>
                <BanderaPais codigo={p.codigo} className={styles.bandera} />
                <span className={styles.opcionNombre}>{p.nombre}</span>
                <span className={styles.opcionDial}>+{p.dial}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="text" inputMode="numeric" className={styles.input}
        placeholder={placeholder} value={numeroNacional}
        onChange={handleNumero}
      />
    </div>
  )
}
