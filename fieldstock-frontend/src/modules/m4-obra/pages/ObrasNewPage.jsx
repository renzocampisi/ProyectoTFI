// src/modules/m4-obra/pages/ObrasNewPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ObrasService } from '../services/obras.service'
import styles from './ObrasNewPage.module.css'

const INICIAL = { nombre: '', direccion: '', cliente: '', fechaInicio: new Date().toISOString().split('T')[0], fechaFin: '' }

export default function ObrasNewPage() {
  const navigate = useNavigate()
  const [form,    setForm]    = useState(INICIAL)
  const [errores, setErrores] = useState({})
  const [loading, setLoading] = useState(false)
  const [guardado,setGuardado]= useState(null)

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }))
    setErrores(e => ({ ...e, [campo]: undefined }))
  }

  const validar = () => {
    const e = {}
    if (!form.nombre.trim())      e.nombre      = 'El nombre es obligatorio.'
    if (!form.direccion.trim())   e.direccion   = 'La dirección es obligatoria.'
    if (!form.cliente.trim())     e.cliente     = 'El cliente es obligatorio.'
    if (!form.fechaInicio)        e.fechaInicio = 'La fecha de inicio es obligatoria.'
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const e2 = validar()
    if (Object.keys(e2).length) { setErrores(e2); return }
    setLoading(true)
    try {
      const obra = await ObrasService.create({
        nombre:      form.nombre.trim(),
        direccion:   form.direccion.trim(),
        cliente:     form.cliente.trim(),
        fechaInicio: form.fechaInicio,
        fechaFin:    form.fechaFin || null,
      })
      setGuardado(obra)
    } catch (err) {
      setErrores({ general: err.message })
    } finally { setLoading(false) }
  }

  if (guardado) return (
    <div className={styles.exito}>
      <div className={styles.exitoCard}>
        <span className={styles.exitoIcon}>✓</span>
        <h2 className={styles.exitoTitle}>Obra registrada</h2>
        <p className={styles.exitoNombre}>{guardado.nombre}</p>
        <div className={styles.exitoActions}>
          <button className={styles.btnPrimary} onClick={() => navigate(`/obras/${guardado.id}`)}>
            Ver obra
          </button>
          <button className={styles.btnGhost} onClick={() => { setForm(INICIAL); setGuardado(null) }}>
            Registrar otra
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate('/obras')}>← Volver</button>
        <div>
          <h1 className={styles.title}>Nueva obra</h1>
          <p className={styles.subtitle}>Registrá los datos de la obra.</p>
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
                placeholder="Ej: Obra Belgrano — Edificio Torre Norte"
                value={form.nombre} onChange={e => set('nombre', e.target.value)} />
              {errores.nombre && <span className={styles.error}>{errores.nombre}</span>}
            </div>

            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor="direccion">Dirección <span className={styles.req}>*</span></label>
              <input id="direccion" type="text"
                className={`${styles.input} ${errores.direccion ? styles.inputError : ''}`}
                placeholder="Ej: Av. Cabildo 1200, CABA"
                value={form.direccion} onChange={e => set('direccion', e.target.value)} />
              {errores.direccion && <span className={styles.error}>{errores.direccion}</span>}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="cliente">Cliente <span className={styles.req}>*</span></label>
              <input id="cliente" type="text"
                className={`${styles.input} ${errores.cliente ? styles.inputError : ''}`}
                placeholder="Nombre del cliente o empresa"
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
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/obras')}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Guardando...' : 'Registrar obra'}
          </button>
        </div>
      </form>
    </div>
  )
}
