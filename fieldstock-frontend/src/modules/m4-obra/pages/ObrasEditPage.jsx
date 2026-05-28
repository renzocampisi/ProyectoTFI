// src/modules/m4-obra/pages/ObrasEditPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ObrasService } from '../services/obras.service'
import { ClientesService } from '@modules/m7-directorio/services/directorio.service'
import styles from './ObrasNewPage.module.css'

export default function ObrasEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [form,    setForm]    = useState(null)
  const [errores, setErrores] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [guardado,setGuardado]= useState(false)
  const [clientes,setClientes]= useState([])

  useEffect(() => {
    Promise.all([
      ObrasService.getById(id),
      ClientesService.getAll().catch(() => []),
    ])
      .then(([obra, clientesAll]) => {
        setClientes(clientesAll)
        setForm({
          nombre:      obra.nombre     || '',
          direccion:   obra.direccion  || '',
          // cliente_id (FK) es la fuente de verdad post-normalización.
          // Si el remito viejo no tiene FK, intentamos matchearlo por
          // nombre para que el select muestre la opción correcta.
          clienteId:   obra.cliente_id
                       || clientesAll.find(c => c.nombre?.toLowerCase() === obra.cliente?.toLowerCase())?.id
                       || '',
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

  const handleClienteChange = (clienteId) => {
    const clienteObj = clientes.find(c => c.id === clienteId)
    setForm(f => ({
      ...f,
      clienteId,
      // Si el cliente nuevo tiene dirección y el campo está vacío,
      // lo pre-llenamos. No pisamos si ya editaron manualmente.
      direccion: f.direccion || clienteObj?.direccion || '',
    }))
    setErrores(e => ({ ...e, clienteId: undefined }))
  }

  const validar = () => {
    const e = {}
    if (!form.nombre.trim())    e.nombre      = 'El nombre es obligatorio.'
    if (!form.direccion.trim()) e.direccion   = 'La dirección es obligatoria.'
    if (!form.clienteId)        e.clienteId   = 'El cliente es obligatorio.'
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
        clienteId:   form.clienteId,
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
              <label className={styles.label}>Cliente <span className={styles.req}>*</span></label>
              <select
                className={`${styles.input} ${errores.clienteId ? styles.inputError : ''}`}
                value={form.clienteId}
                onChange={e => handleClienteChange(e.target.value)}>
                <option value="">— Seleccioná un cliente —</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              {errores.clienteId && <span className={styles.error}>{errores.clienteId}</span>}
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
