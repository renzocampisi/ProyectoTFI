// src/shared/hooks/useEmpresa.js
/**
 * Datos de la empresa (nombre, teléfono, dirección, email) — usado por
 * AppLayout para mostrar el nombre al lado de "FieldStock AI" en el
 * sidebar/topbar. `empresa.nombre` es null hasta que el DUEÑO lo carga
 * desde /configuracion (ver ConfigPage.jsx).
 */
import { useState, useEffect, useCallback } from 'react'
import { EmpresaService } from '@modules/m-config/services/empresa.service'

export function useEmpresa() {
  const [empresa, setEmpresa] = useState(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    try {
      setEmpresa(await EmpresaService.get())
    } catch {
      setEmpresa(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { empresa, loading, refetch: cargar }
}
