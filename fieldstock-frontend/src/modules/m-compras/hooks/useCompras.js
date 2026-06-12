// src/modules/m-compras/hooks/useCompras.js
/**
 * Hooks del módulo Compras — wrappers de ComprasService con state de
 * carga/error.
 *
 * useCompras({estado, proveedorId, q}): hook de LISTA con filtros.
 * useCompra(id): hook de DETALLE — incluye items con material expandido.
 *
 * Las mutaciones (avanzar, cancelar, recibir, etc.) NO viven en estos
 * hooks — se llaman directo desde el componente y luego se hace refetch()
 * para actualizar la vista. Mismo patrón que useRemitos.
 *
 * No hay polling todavía — el flujo de Compras no tiene actor externo
 * actualizando estado en segundo plano (a diferencia de Remitos donde el
 * QR del celular dispara cambios). Si en el futuro se suma "el proveedor
 * confirma desde otro lado", se agrega acá el mismo patrón de polling.
 */
import { useState, useEffect, useCallback } from 'react'
import { ComprasService } from '../services/compras.service.js'

export function useCompras({ estado, proveedorId, q } = {}) {
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await ComprasService.getAll({ estado, proveedorId, q })
      setCompras(Array.isArray(data) ? data : [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [estado, proveedorId, q])

  useEffect(() => { cargar() }, [cargar])
  return { compras, loading, error, refetch: cargar }
}

export function useCompra(id) {
  const [compra,  setCompra]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const cargar = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const data = await ComprasService.getById(id)
      setCompra(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { cargar() }, [cargar])
  return { compra, loading, error, refetch: cargar }
}
