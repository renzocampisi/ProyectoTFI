// src/shared/hooks/useOrdenAlfabetico.js
import { useState, useMemo } from 'react'
import { LuArrowDownAZ, LuArrowUpAZ, LuArrowUpDown } from 'react-icons/lu'

// Ciclo del botón de orden alfabético: sin ordenar (orden del backend) →
// A→Z → Z→A → vuelve a sin ordenar.
const SIGUIENTE_ORDEN = { ninguno: 'asc', asc: 'desc', desc: 'ninguno' }
const ICONO_ORDEN = { ninguno: LuArrowUpDown, asc: LuArrowDownAZ, desc: LuArrowUpAZ }
const LABEL_ORDEN = { ninguno: 'Ordenar A-Z', asc: 'A → Z', desc: 'Z → A' }

// `campo` extrae el string a comparar de cada item (ej. item => item.nombre).
export function useOrdenAlfabetico(lista, campo) {
  const [orden, setOrden] = useState('ninguno')

  const listaOrdenada = useMemo(() => {
    if (orden === 'ninguno') return lista
    const signo = orden === 'asc' ? 1 : -1
    return [...lista].sort((a, b) => signo * (campo(a) || '').localeCompare(campo(b) || '', 'es'))
  }, [lista, orden, campo])

  return {
    listaOrdenada,
    orden,
    toggleOrden: () => setOrden(o => SIGUIENTE_ORDEN[o]),
    IconoOrden: ICONO_ORDEN[orden],
    labelOrden: LABEL_ORDEN[orden],
  }
}
