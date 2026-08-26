// src/modules/m-armado/hooks/useArmado.js
/**
 * Máquina de pasos del asistente "Kits de Montaje".
 *
 *   obra → destino → describir → interpretando → revision → confirmando → exito
 *
 * Encapsula las llamadas a ArmadoService y el estado de las líneas mientras
 * el usuario las corrige. El componente no llama a `api` directo.
 */
import { useState, useCallback } from 'react'
import { ArmadoService } from '../services/armado.service'

function idLocal() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
}

/** Una línea es válida si tiene cantidad > 0 y un material resuelto. */
function lineaValida(l) {
  const cantidad = Number(l.cantidad)
  if (!Number.isFinite(cantidad) || cantidad <= 0) return false
  if (l.modo === 'catalogo') return !!l.materialId
  return !!l.materialNuevoNombre?.trim()
}

export function useArmado() {
  const [paso,    setPaso]    = useState('obra')
  const [error,   setError]   = useState(null)

  // Contexto elegido en los pasos 1 y 2.
  const [obraId,    setObraId]    = useState('')
  const [obraNueva, setObraNueva] = useState(null) // { nombre, direccion, clienteId }
  const [destino,   setDestino]   = useState(null) // 'PRESUPUESTO' | 'REMITO'

  const [texto,  setTexto]  = useState('')
  const [lineas, setLineas] = useState([])
  const [resultado, setResultado] = useState(null)
  const [proveedorId, setProveedorId] = useState('') // '' = decidir después

  const elegirObraExistente = useCallback((id) => {
    setObraId(id); setObraNueva(null); setError(null)
  }, [])

  const elegirObraNueva = useCallback((datos) => {
    setObraNueva(datos); setObraId(''); setError(null)
  }, [])

  const elegirDestino = useCallback((d) => {
    setDestino(d); setPaso('describir'); setError(null)
  }, [])

  const interpretar = useCallback(async () => {
    if (!texto.trim()) return
    setPaso('interpretando'); setError(null)
    try {
      const data = await ArmadoService.interpretar(texto.trim(), destino)
      setLineas((data.lineas || []).map(l => ({
        id:                  idLocal(),
        textoOriginal:       l.textoOriginal,
        confianza:           l.confianza,
        cantidad:            String(l.cantidad ?? ''),
        unidad:              l.unidad || 'unidad',
        modo:                l.materialId ? 'catalogo' : 'nuevo',
        materialId:          l.materialId || '',
        materialNombre:      l.materialNombre || null,
        stockActual:         l.stockActual,
        // Reparto (solo viene con destino REMITO)
        alRemito:            l.alRemito ?? null,
        aComprar:            l.aComprar ?? null,
        motivo:              l.motivo   ?? null,
        materialNuevoNombre: l.materialId ? '' : (l.textoOriginal || ''),
        materialNuevoMarca:  '',
        incluida:            true,
      })))
      setPaso('revision')
    } catch (err) {
      setError(err.message)
      setPaso('describir')
    }
  }, [texto, destino])

  const actualizarLinea = useCallback((id, cambios) => {
    setLineas(prev => prev.map(l => (l.id === id ? { ...l, ...cambios } : l)))
  }, [])

  const alternarLinea = useCallback((id) => {
    setLineas(prev => prev.map(l => (l.id === id ? { ...l, incluida: !l.incluida } : l)))
  }, [])

  const incluidas = lineas.filter(l => l.incluida)
  const puedeConfirmar = incluidas.length > 0 && incluidas.every(lineaValida)
  const hayFaltantes = destino === 'REMITO' && incluidas.some(l => Number(l.aComprar) > 0)

  const confirmar = useCallback(async () => {
    if (!puedeConfirmar) return
    setPaso('confirmando'); setError(null)
    try {
      const payload = {
        destino,
        ...(obraId ? { obraId } : { obraNueva }),
        ...(proveedorId ? { proveedorId } : {}),
        lineas: incluidas.map(l => {
          const base = {
            textoOriginal: l.textoOriginal,
            cantidad:      Number(l.cantidad),
            unidad:        l.unidad,
            materialNombre: l.materialNombre,
          }
          const material = l.modo === 'catalogo'
            ? { materialId: l.materialId }
            : { materialNuevo: {
                  nombre: l.materialNuevoNombre.trim(),
                  marca:  l.materialNuevoMarca.trim() || null,
                  unidad: l.unidad,
                } }
          const reparto = destino === 'REMITO'
            ? { alRemito: Number(l.alRemito) || 0, aComprar: Number(l.aComprar) || 0 }
            : {}
          return { ...base, ...material, ...reparto }
        }),
      }
      const data = await ArmadoService.confirmar(payload)
      setResultado(data)
      setPaso('exito')
    } catch (err) {
      setError(err.message)
      setPaso('revision')
    }
  }, [puedeConfirmar, destino, obraId, obraNueva, proveedorId, incluidas])

  const volverA = useCallback((p) => { setPaso(p); setError(null) }, [])

  return {
    paso, error, resultado,
    obraId, obraNueva, destino, texto, lineas, proveedorId,
    puedeConfirmar, hayFaltantes,
    setTexto, setProveedorId,
    elegirObraExistente, elegirObraNueva, elegirDestino,
    interpretar, actualizarLinea, alternarLinea, confirmar, volverA,
  }
}
