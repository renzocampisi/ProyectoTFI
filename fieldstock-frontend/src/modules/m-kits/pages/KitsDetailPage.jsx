// src/modules/m-kits/pages/KitsDetailPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { KitsService } from '../services/kits.service'
import KitComposicionPicker from '../components/KitComposicionPicker'
import styles from './KitsDetailPage.module.css'

export default function KitsDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [kit,     setKit]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const [editando,    setEditando]    = useState(false)
  const [nombre,      setNombre]      = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [herrSeleccionadas, setHerrSeleccionadas] = useState(new Set())
  const [matCantidades,     setMatCantidades]     = useState({})
  const [saving, setSaving] = useState(false)
  const [errEdit, setErrEdit] = useState(null)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [eliminando,    setEliminando]    = useState(false)
  const [errAccion,     setErrAccion]     = useState(null)

  const cargar = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const data = await KitsService.getById(id)
      setKit(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  const iniciarEdicion = () => {
    setNombre(kit.nombre)
    setDescripcion(kit.descripcion || '')
    setHerrSeleccionadas(new Set(kit.herramientas.map(h => h.id)))
    setMatCantidades(Object.fromEntries(kit.materiales.map(m => [m.id, m.cantidad])))
    setErrEdit(null)
    setEditando(true)
  }

  const handleGuardar = async () => {
    if (!nombre.trim()) { setErrEdit('El nombre del kit es obligatorio.'); return }
    setSaving(true); setErrEdit(null)
    try {
      await KitsService.update(id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        herramientaIds: Array.from(herrSeleccionadas),
        materiales: Object.entries(matCantidades).map(([materialId, cantidad]) => ({
          materialId, cantidad: Number(cantidad),
        })),
      })
      setEditando(false)
      await cargar()
    } catch (err) {
      setErrEdit(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async () => {
    setEliminando(true); setErrAccion(null)
    try {
      await KitsService.remove(id)
      navigate('/kits')
    } catch (err) {
      setErrAccion(err.message)
      setEliminando(false)
    }
  }

  if (loading) return (
    <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando kit...</div>
  )
  if (error || !kit) return (
    <div className={styles.noEncontrado}>
      <span>🔍</span><h2>{error || 'Kit no encontrado'}</h2>
      <button className={styles.btnGhost} onClick={() => navigate('/kits')}>← Volver</button>
    </div>
  )

  return (
    <div className={styles.page}>
      <button className={styles.btnGhost} onClick={() => navigate('/kits')}>← Volver</button>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{editando ? 'Editar kit' : kit.nombre}</h1>
          {!editando && kit.descripcion && <p className={styles.subtitle}>{kit.descripcion}</p>}
        </div>
        {!editando && !confirmDelete && (
          <div className={styles.headerActions}>
            <button className={styles.btnGhost} onClick={() => setConfirmDelete(true)}>
              🗑 Eliminar
            </button>
            <button className={styles.btnPrimary} onClick={iniciarEdicion}>
              ✎ Editar
            </button>
          </div>
        )}
      </div>

      {errAccion && <div className={styles.errorBanner}>⚠ {errAccion}</div>}

      {confirmDelete && (
        <div className={styles.confirmBlock}>
          <p className={styles.confirmText}>
            ¿Eliminar el kit <strong>{kit.nombre}</strong>? No afecta remitos ya armados con él,
            solo deja de estar disponible para armar nuevos.
          </p>
          <div className={styles.formActions}>
            <button className={styles.btnGhost} onClick={() => setConfirmDelete(false)} disabled={eliminando}>
              Cancelar
            </button>
            <button className={styles.btnDanger} onClick={handleEliminar} disabled={eliminando}>
              {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      )}

      {editando ? (
        <div className={styles.form}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Datos del kit</h2>
            <div className={styles.field}>
              <label className={styles.label}>Nombre *</label>
              <input type="text" className={styles.input}
                value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Descripción</label>
              <textarea className={styles.textarea} rows={2}
                value={descripcion} onChange={e => setDescripcion(e.target.value)} />
            </div>
          </section>

          <KitComposicionPicker
            herrSeleccionadas={herrSeleccionadas} setHerrSeleccionadas={setHerrSeleccionadas}
            matCantidades={matCantidades}         setMatCantidades={setMatCantidades}
          />

          {errEdit && <div className={styles.errorBanner}>⚠ {errEdit}</div>}

          <div className={styles.formActions}>
            <button className={styles.btnGhost} onClick={() => setEditando(false)} disabled={saving}>
              Cancelar
            </button>
            <button className={styles.btnPrimary} onClick={handleGuardar} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.layout}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              Herramientas <span className={styles.cardCount}>{kit.herramientas.length}</span>
            </h2>
            {kit.herramientas.length === 0 ? (
              <div className={styles.empty}>Sin herramientas en este kit.</div>
            ) : (
              <ul className={styles.lista}>
                {kit.herramientas.map(h => (
                  <li key={h.id} className={styles.listaItem}
                    onClick={() => navigate(`/herramientas/${h.id}`)}>
                    <span className={styles.listaNombre}>{h.nombre}</span>
                    <span className={styles.listaSub}>{h.codigo_qr} · {h.estado}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              Materiales <span className={styles.cardCount}>{kit.materiales.length}</span>
            </h2>
            {kit.materiales.length === 0 ? (
              <div className={styles.empty}>Sin materiales en este kit.</div>
            ) : (
              <ul className={styles.lista}>
                {kit.materiales.map(m => (
                  <li key={m.id} className={styles.listaItem}
                    onClick={() => navigate(`/materiales/${m.id}`)}>
                    <span className={styles.listaNombre}>{m.nombre}</span>
                    <span className={styles.listaSub}>{m.cantidad} {m.unidad}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
