// src/modules/m4-obra/pages/ObrasEditPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ObrasService } from '../services/obras.service'
import styles from './ObrasNewPage.module.css'

export default function ObrasEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [form,    setForm]    = useState(null)
  const [errores, setErrores] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [guardado,setGuardado]= useState(false)

  useEffect(() => {
    ObrasService.getById(id)
      .then(obra => {
        setForm({
          nombre:      obra.nombre     || '',
          direccion:   obra.direccion  || '',
          cliente:     obra.cliente    || '',
          fechaInicio: obra.fecha_inicio?.split('T')[0] || '',
          fechaFin:    obra.fecha_fin?.split('T')[0]    || '',
        })
        setLoading(false)
      })
      .catch(() => navigate('/obras'))
  }, [id])

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }))
    setErrores(e => ({ ...e, [campo]: undefined }))
  }

  const validar = () => {
    const e = {}
    if (!form.nombre.trim())    e.nombre    = 'El nombre es obligatorio.'
    if (!form.direccion.trim()) e.direccion = 'La dirección es obligatoria.'
    if (!form.cliente.trim())   e.cliente   = 'El cliente es obligatorio.'
    if (!form.fechaInicio)      e.fechaInicio = 'La fecha de inicio es obligatoria.'
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const e2 = validar()
    if (Object.keys(e2).length) { setErrores(e2); return }
    setSaving(true)
    try {
      await ObrasService.update(id, {
        nombre:      form.nombre.trim(),
        direccion:   form.direccion.trim(),
        cliente:     form.cliente.trim(),
        fechaInicio: form.fechaInicio,
        fechaFin:    form.fechaFin || null,
      })
      setGuardado(true)
      setTimeout(() => navigate(`/obras/${id}`), 1200)
    } catch (err) {
      setErrores({ general: err.message })
    } finally { setSaving(false) }
  }

  if (loading) return <div className={styles.page}><p style={{ color: 'var(--text-secondary)' }}>Cargando...</p></div>

  if (guardado) return (
    <div className={styles.exito}>
      <div className={styles.exitoCard}>
        <span className={styles.exitoIcon}>✓</span>
        <h2 className={styles.exitoTitle}>Cambios guardados</h2>
        <p className={styles.exitoNombre}>Redirigiendo...</p>
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate(`/obras/${id}`)}>← Volver</button>
        <div>
          <h1 className={styles.title}>Editar obra</h1>
          <p className={styles.subtitle}>Modificá los datos de la obra.</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Datos de la obra</legend>
          <div className={styles.grid2}>

            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor="nombre">Nombre <span className={styles.req}>*</span></label>
              <input id="nombre" type="text"
                className={`${styles.input} ${errores.nombre ? styles.inputError : ''}`}
                value={form.nombre} onChange={e => set('nombre', e.target.value)} />
              {errores.nombre && <span className={styles.error}>{errores.nombre}</span>}
            </div>

            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor="direccion">Dirección <span className={styles.req}>*</span></label>
              <input id="direccion" type="text"
                className={`${styles.input} ${errores.direccion ? styles.inputError : ''}`}
                value={form.direccion} onChange={e => set('direccion', e.target.value)} />
              {errores.direccion && <span className={styles.error}>{errores.direccion}</span>}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="cliente">Cliente <span className={styles.req}>*</span></label>
              <input id="cliente" type="text"
                className={`${styles.input} ${errores.cliente ? styles.inputError : ''}`}
                value={form.cliente} onChange={e => set('cliente', e.target.value)} />
              {errores.cliente && <span className={styles.error}>{errores.cliente}</span>}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="fechaInicio">Fecha de inicio <span className={styles.req}>*</span></label>
              <input id="fechaInicio" type="date"
                className={`${styles.input} ${errores.fechaInicio ? styles.inputError : ''}`}
                value={form.fechaInicio} onChange={e => set('fechaInicio', e.target.value)} />
              {errores.fechaInicio && <span className={styles.error}>{errores.fechaInicio}</span>}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="fechaFin">
                Fecha de fin <span className={styles.optional}>(estimada)</span>
              </label>
              <input id="fechaFin" type="date" className={styles.input}
                value={form.fechaFin} onChange={e => set('fechaFin', e.target.value)} />
            </div>

          </div>
        </fieldset>

        {errores.general && <div className={styles.errorBanner}>⚠ {errores.general}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate(`/obras/${id}`)}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
