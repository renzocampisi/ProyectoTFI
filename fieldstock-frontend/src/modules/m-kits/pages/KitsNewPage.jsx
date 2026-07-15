// src/modules/m-kits/pages/KitsNewPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KitsService } from '../services/kits.service'
import KitComposicionPicker from '../components/KitComposicionPicker'
import styles from './KitsNewPage.module.css'

export default function KitsNewPage() {
  const navigate = useNavigate()

  const [nombre,      setNombre]      = useState('')
  const [descripcion, setDescripcion] = useState('')

  const [herrSeleccionadas, setHerrSeleccionadas] = useState(new Set())
  // matCantidades: { [materialId]: cantidad } — la presencia de una key
  // implica "este material está seleccionado".
  const [matCantidades, setMatCantidades] = useState({})

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const totalSeleccionados = herrSeleccionadas.size + Object.keys(matCantidades).length

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre del kit es obligatorio.'); return }
    if (!totalSeleccionados) { setError('Elegí al menos una herramienta o un material.'); return }

    setSaving(true); setError(null)
    try {
      const kit = await KitsService.create({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        herramientaIds: Array.from(herrSeleccionadas),
        materiales: Object.entries(matCantidades).map(([materialId, cantidad]) => ({
          materialId, cantidad: Number(cantidad),
        })),
      })
      navigate(`/kits/${kit.id}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <button className={styles.btnGhost} onClick={() => navigate('/kits')}>← Volver</button>

      <h1 className={styles.title}>Nuevo kit</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Datos del kit</h2>
          <div className={styles.field}>
            <label className={styles.label}>Nombre *</label>
            <input type="text" className={styles.input}
              placeholder="Ej: Kit soldadura"
              value={nombre} onChange={e => setNombre(e.target.value)} autoFocus />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Descripción</label>
            <textarea className={styles.textarea} rows={2}
              placeholder="Para qué se usa este kit (opcional)"
              value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>
        </section>

        <KitComposicionPicker
          herrSeleccionadas={herrSeleccionadas} setHerrSeleccionadas={setHerrSeleccionadas}
          matCantidades={matCantidades}         setMatCantidades={setMatCantidades}
        />

        {error && <div className={styles.errorBanner}>⚠ {error}</div>}

        <div className={styles.formActions}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/kits')}>
            Cancelar
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving ? 'Guardando...' : 'Crear kit'}
          </button>
        </div>
      </form>
    </div>
  )
}
