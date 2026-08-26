// src/modules/m-compras/hooks/useScanMatch.js
/**
 * Máquina de estados del flujo "Scan & Match" — foto/PDF de un remito de
 * proveedor → propuesta de matching contra los items de una compra puntual
 * → revisión/edición → confirmación real (recepción + altas de material si
 * hicieron falta).
 *
 * Pasos: captura → proponiendo → revision → confirmando → exito
 *
 * `cantidadRecibida` en cada línea es siempre "cuánto llegó ahora" (delta),
 * igual criterio que RecepcionModal — el backend hace la conversión a total
 * absoluto contra el estado real de la compra.
 */
import { useState, useCallback } from 'react'
import { ComprasService } from '../services/compras.service'

function idLocal() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
}

function lineaValida(l) {
  const cantidad = Number(l.cantidadRecibida)
  if (!Number.isFinite(cantidad) || cantidad <= 0) return false
  if (l.modo === 'match')      return !!l.compraItemId
  if (l.modo === 'existente')  return !!l.materialIdExistente
  if (l.modo === 'nuevo')      return !!l.materialNuevoNombre?.trim()
  return false
}

export function useScanMatch(compraId, { onSuccess } = {}) {
  const [paso,       setPaso]       = useState('captura') // captura | proponiendo | revision | confirmando | exito
  const [error,      setError]      = useState(null)
  const [candidatos, setCandidatos] = useState([]) // items pendientes de la compra, para reasignar manualmente
  const [lineas,     setLineas]     = useState([])

  const proponer = useCallback(async (file) => {
    setPaso('proponiendo'); setError(null)
    try {
      const data = await ComprasService.scanMatchProponer(compraId, file)
      setCandidatos(data.candidatos || [])
      setLineas((data.items || []).map(it => ({
        id:                  idLocal(),
        textoProveedor:      it.textoProveedor,
        unidadDetectada:     it.unidadDetectada,
        confianza:           it.confianza,
        compraItemId:        it.compraItemId || '',
        // Siempre arranca en 'match' — el <select> de más abajo ya tiene un
        // placeholder "— Elegí un ítem de la orden —" para cuando no vino
        // matcheado (compraItemId ''). Un modo 'sin-match' que no mapea a
        // ninguno de los <option> del selector dejaba la fila sin ningún
        // control visible para resolverla (bug encontrado probando en vivo).
        modo:                'match',
        cantidadRecibida:    String(it.cantidadDetectada || ''),
        materialIdExistente: '',
        materialNuevoNombre: '',
        materialNuevoMarca:  '',
        materialNuevoUnidad: 'unidad',
        incluida:            true,
      })))
      setPaso('revision')
    } catch (err) {
      setError(err.message)
      setPaso('captura')
    }
  }, [compraId])

  const actualizarLinea = useCallback((id, cambios) => {
    setLineas(prev => prev.map(l => (l.id === id ? { ...l, ...cambios } : l)))
  }, [])

  const quitarLinea = useCallback((id) => {
    setLineas(prev => prev.map(l => (l.id === id ? { ...l, incluida: false } : l)))
  }, [])

  const restaurarLinea = useCallback((id) => {
    setLineas(prev => prev.map(l => (l.id === id ? { ...l, incluida: true } : l)))
  }, [])

  const incluidas = lineas.filter(l => l.incluida)
  const puedeConfirmar = incluidas.length > 0 && incluidas.every(lineaValida)

  const confirmar = useCallback(async () => {
    if (!puedeConfirmar) return
    setPaso('confirmando'); setError(null)
    try {
      const items = incluidas.map(l => {
        const cantidadRecibida = Number(l.cantidadRecibida)
        if (l.modo === 'match')     return { compraItemId: l.compraItemId, cantidadRecibida }
        if (l.modo === 'existente') return { materialIdExistente: l.materialIdExistente, cantidadRecibida }
        return {
          materialNuevo: {
            nombre: l.materialNuevoNombre.trim(),
            marca:  l.materialNuevoMarca.trim() || null,
            unidad: l.materialNuevoUnidad || 'unidad',
          },
          cantidadRecibida,
        }
      })
      const data = await ComprasService.scanMatchConfirmar(compraId, items)
      setPaso('exito')
      onSuccess?.(data)
    } catch (err) {
      setError(err.message)
      setPaso('revision')
    }
  }, [compraId, incluidas, puedeConfirmar, onSuccess])

  const reiniciar = useCallback(() => {
    setPaso('captura'); setError(null); setLineas([]); setCandidatos([])
  }, [])

  return {
    paso, error, candidatos, lineas, puedeConfirmar,
    proponer, actualizarLinea, quitarLinea, restaurarLinea, confirmar, reiniciar,
  }
}
