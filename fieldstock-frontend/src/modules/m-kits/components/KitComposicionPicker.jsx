// src/modules/m-kits/components/KitComposicionPicker.jsx
/**
 * Selector de herramientas + materiales para armar/editar un kit.
 * Compartido por KitsNewPage y el modo edición de KitsDetailPage —
 * ambos necesitan exactamente el mismo picker con buscador y cantidad
 * por material.
 *
 * Controlado por el padre: recibe los sets/mapas de selección actuales
 * y sus setters, no tiene estado propio de selección (solo el de
 * búsqueda, que es puramente de UI).
 */
import { useState, useEffect, useMemo } from 'react'
import { InventarioService } from '@modules/m2-inventario/services/inventario.service'
import { MaterialesService } from '@modules/m6-materiales/services/materiales.service'
import styles from './KitComposicionPicker.module.css'

export default function KitComposicionPicker({
  herrSeleccionadas, setHerrSeleccionadas,
  matCantidades,     setMatCantidades,
}) {
  const [herramientas,    setHerramientas]    = useState([])
  const [materiales,      setMateriales]      = useState([])
  const [loadingCatalogo, setLoadingCatalogo] = useState(true)
  const [error,           setError]           = useState(null)

  const [busquedaHerr, setBusquedaHerr] = useState('')
  const [busquedaMat,  setBusquedaMat]  = useState('')

  useEffect(() => {
    Promise.all([
      InventarioService.getAll().then(data => data.filter(h => h.estado !== 'BAJA')),
      MaterialesService.getAll(),
    ])
      .then(([h, m]) => { setHerramientas(h); setMateriales(m) })
      .catch(err => setError(err.message))
      .finally(() => setLoadingCatalogo(false))
  }, [])

  const herrFiltradas = useMemo(() =>
    herramientas.filter(h => h.nombre.toLowerCase().includes(busquedaHerr.toLowerCase())),
    [herramientas, busquedaHerr])

  const matFiltrados = useMemo(() =>
    materiales.filter(m => m.nombre.toLowerCase().includes(busquedaMat.toLowerCase())),
    [materiales, busquedaMat])

  const toggleHerr = (id) => {
    const next = new Set(herrSeleccionadas)
    next.has(id) ? next.delete(id) : next.add(id)
    setHerrSeleccionadas(next)
  }

  const toggleMat = (id) => {
    setMatCantidades(prev => {
      const next = { ...prev }
      if (id in next) delete next[id]
      else             next[id] = 1
      return next
    })
  }

  const setCantidad = (id, cantidad) => {
    setMatCantidades(prev => ({ ...prev, [id]: cantidad }))
  }

  if (error) return <div className={styles.errorBanner}>⚠ {error}</div>
  if (loadingCatalogo) return (
    <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando catálogo...</div>
  )

  return (
    <>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          Herramientas <span className={styles.cardCount}>{herrSeleccionadas.size}</span>
        </h2>
        <input type="search" className={styles.input}
          placeholder="Buscar herramienta..."
          value={busquedaHerr} onChange={e => setBusquedaHerr(e.target.value)} />
        <ul className={styles.checkLista}>
          {herrFiltradas.map(h => (
            <li key={h.id}
              className={`${styles.checkItem} ${herrSeleccionadas.has(h.id) ? styles.checkItemSelected : ''}`}
              onClick={() => toggleHerr(h.id)}>
              <input type="checkbox" checked={herrSeleccionadas.has(h.id)}
                onChange={() => toggleHerr(h.id)} onClick={e => e.stopPropagation()} />
              <div className={styles.checkInfo}>
                <span className={styles.checkNombre}>{h.nombre}</span>
                <span className={styles.checkSub}>{h.codigo_qr} · {h.estado}</span>
              </div>
            </li>
          ))}
          {herrFiltradas.length === 0 && (
            <li className={styles.checkEmpty}>Sin resultados.</li>
          )}
        </ul>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          Materiales <span className={styles.cardCount}>{Object.keys(matCantidades).length}</span>
        </h2>
        <input type="search" className={styles.input}
          placeholder="Buscar material..."
          value={busquedaMat} onChange={e => setBusquedaMat(e.target.value)} />
        <ul className={styles.checkLista}>
          {matFiltrados.map(m => {
            const seleccionado = m.id in matCantidades
            return (
              <li key={m.id}
                className={`${styles.checkItem} ${seleccionado ? styles.checkItemSelected : ''}`}
                onClick={() => toggleMat(m.id)}>
                <input type="checkbox" checked={seleccionado}
                  onChange={() => toggleMat(m.id)} onClick={e => e.stopPropagation()} />
                <div className={styles.checkInfo}>
                  <span className={styles.checkNombre}>{m.nombre}</span>
                  <span className={styles.checkSub}>{m.unidad}</span>
                </div>
                {seleccionado && (
                  <input type="number" min="0.01" step="any"
                    className={styles.cantidadInput}
                    value={matCantidades[m.id]}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setCantidad(m.id, e.target.value)} />
                )}
              </li>
            )
          })}
          {matFiltrados.length === 0 && (
            <li className={styles.checkEmpty}>Sin resultados.</li>
          )}
        </ul>
      </section>
    </>
  )
}
