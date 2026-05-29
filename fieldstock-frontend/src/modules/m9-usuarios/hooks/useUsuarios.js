// src/modules/m9-usuarios/hooks/useUsuarios.js
/**
 * Hook del listado de usuarios. Patrón consistente con el resto de módulos:
 * state local, función refetch para refrescar después de mutaciones.
 */
import { useState, useEffect, useCallback } from 'react'
import { UsuariosService } from '../services/usuarios.service.js'

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await UsuariosService.getAll()
      setUsuarios(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])
  return { usuarios, loading, error, refetch: cargar }
}
