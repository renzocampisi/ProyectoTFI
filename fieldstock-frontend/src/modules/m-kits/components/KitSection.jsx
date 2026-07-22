// src/modules/m-kits/components/KitSection.jsx
/**
 * Sección "Kit" en la ficha de una herramienta (InventarioDetailPage).
 * Reemplaza al viejo módulo standalone de Kits (listado propio + rutas
 * /kits/*): armar y editar kits pasa a hacerse siempre desde acá, con esta
 * herramienta como punto de partida. El picker de composición se sigue
 * reusando de KitComposicionPicker.
 *
 * Una herramienta puede en teoría pertenecer a más de un kit (el modelo lo
 * permite), así que listamos todos los que la incluyan — en la práctica
 * casi siempre va a ser cero o uno.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { KitsService } from '../services/kits.service'
import KitComposicionPicker from './KitComposicionPicker'
import styles from './KitSection.module.css'

const formVacio = { nombre: '', descripcion: '' }

export default function KitSection({ herramientaId }) {
  const navigate = useNavigate()
  const [kits,    setKits]    = useState(null) // null = cargando
  const [error,   setError]   = useState(null)

  const [creando,  setCreando]  = useState(false)
  const [editando, setEditando] = useState(null) // kit.id en edición, o null
  const [form,     setForm]     = useState(formVacio)
  const [herrSeleccionadas, setHerrSeleccionadas] = useState(new Set())
  const [matCantidades,     setMatCantidades]     = useState({})
  const [saving,  setSaving]  = useState(false)
  const [errForm, setErrForm] = useState(null)

  const [confirmDelete, setConfirmDelete] = useState(null) // kit.id, o null
  const [eliminando,    setEliminando]    = useState(false)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const data = await KitsService.getByHerramienta(herramientaId)
      setKits(data)
    } catch (err) { setError(err.message) }
  }, [herramientaId])

  useEffect(() => { cargar() }, [cargar])

  const iniciarCreacion = () => {
    setForm(formVacio)
    setHerrSeleccionadas(new Set([herramientaId]))
    setMatCantidades({})
    setErrForm(null)
    setCreando(true)
  }

  const iniciarEdicion = (kit) => {
    setForm({ nombre: kit.nombre, descripcion: kit.descripcion || '' })
    setHerrSeleccionadas(new Set(kit.herramientas.map(h => h.id)))
    setMatCantidades(Object.fromEntries(kit.materiales.map(m => [m.id, m.cantidad])))
    setErrForm(null)
    setEditando(kit.id)
  }

  const cancelarForm = () => { setCreando(false); setEditando(null) }

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setErrForm('El nombre del kit es obligatorio.'); return }
    setSaving(true); setErrForm(null)
    try {
      const body = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        herramientaIds: Array.from(herrSeleccionadas),
        materiales: Object.entries(matCantidades).map(([materialId, cantidad]) => ({
          materialId, cantidad: Number(cantidad),
        })),
      }
      if (editando) await KitsService.update(editando, body)
      else          await KitsService.create(body)
      setCreando(false); setEditando(null)
      await cargar()
    } catch (err) {
      setErrForm(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async (kitId) => {
    setEliminando(true)
    try {
      await KitsService.remove(kitId)
      setConfirmDelete(null)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminando(false)
    }
  }

  const mostrandoForm = creando || Boolean(editando)

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          Kit {kits && <span className={styles.cardCount}>{kits.length}</span>}
        </h2>
        {!mostrandoForm && (
          <button className={styles.btnSecondary} onClick={iniciarCreacion}>
            + Armar kit
          </button>
        )}
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {kits === null && !error && (
        <div className={styles.loadingWrapper}>
          <span className={styles.spinner} />Cargando kit...
        </div>
      )}

      {mostrandoForm && (
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Nombre *</label>
            <input type="text" className={styles.input}
              placeholder="Ej: Kit soldadura"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              autoFocus />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Descripción</label>
            <textarea className={styles.textarea} rows={2}
              placeholder="Para qué se usa este kit (opcional)"
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          </div>

          <KitComposicionPicker
            herrSeleccionadas={herrSeleccionadas} setHerrSeleccionadas={setHerrSeleccionadas}
            matCantidades={matCantidades}         setMatCantidades={setMatCantidades}
          />

          {errForm && <div className={styles.errorBanner}>⚠ {errForm}</div>}

          <div className={styles.formActions}>
            <button className={styles.btnGhost} onClick={cancelarForm} disabled={saving}>
              Cancelar
            </button>
            <button className={styles.btnPrimary} onClick={handleGuardar} disabled={saving}>
              {saving ? 'Guardando...' : (editando ? 'Guardar cambios' : 'Crear kit')}
            </button>
          </div>
        </div>
      )}

      {!mostrandoForm && kits !== null && kits.length === 0 && (
        <div className={styles.empty}>
          Esta herramienta no es parte de ningún kit todavía.
        </div>
      )}

      {!mostrandoForm && kits !== null && kits.map(kit => (
        <div key={kit.id} className={styles.kit}>
          <div className={styles.kitHeader}>
            <div>
              <span className={styles.kitNombre}>{kit.nombre}</span>
              {kit.descripcion && <p className={styles.kitDesc}>{kit.descripcion}</p>}
            </div>
            {confirmDelete !== kit.id && (
              <div className={styles.kitActions}>
                <button className={styles.btnGhost} onClick={() => iniciarEdicion(kit)}>
                  Editar
                </button>
                <button className={styles.btnGhost} onClick={() => setConfirmDelete(kit.id)}>
                  Eliminar
                </button>
              </div>
            )}
          </div>

          {confirmDelete === kit.id && (
            <div className={styles.confirmBlock}>
              <p className={styles.confirmText}>
                ¿Eliminar el kit <strong>{kit.nombre}</strong>? No afecta remitos ya armados con él,
                solo deja de estar disponible para armar nuevos.
              </p>
              <div className={styles.formActions}>
                <button className={styles.btnGhost} onClick={() => setConfirmDelete(null)} disabled={eliminando}>
                  Cancelar
                </button>
                <button className={styles.btnDanger} onClick={() => handleEliminar(kit.id)} disabled={eliminando}>
                  {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          )}

          <ul className={styles.lista}>
            {kit.herramientas.filter(h => h.id !== herramientaId).map(h => (
              <li key={h.id} className={styles.listaItem} onClick={() => navigate(`/herramientas/${h.id}`)}>
                <span className={styles.listaNombre}>{h.nombre}</span>
                <span className={styles.listaSub}>{h.codigo_qr} · {h.estado}</span>
              </li>
            ))}
            {kit.materiales.map(m => (
              <li key={m.id} className={styles.listaItem} onClick={() => navigate(`/materiales/${m.id}`)}>
                <span className={styles.listaNombre}>{m.nombre}</span>
                <span className={styles.listaSub}>{m.cantidad} {m.unidad}</span>
              </li>
            ))}
            {kit.herramientas.length <= 1 && kit.materiales.length === 0 && (
              <li className={styles.empty}>Solo esta herramienta — sumale más componentes editando el kit.</li>
            )}
          </ul>
        </div>
      ))}
    </section>
  )
}
