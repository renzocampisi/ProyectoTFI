// src/modules/m4-obra/pages/ObrasNewPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ObrasService } from '../services/obras.service'
import { ClientesService } from '@modules/m7-directorio/services/directorio.service'
import styles from './ObrasNewPage.module.css'

// Estado del form: ahora trackeamos `clienteId` (FK real) y solo derivamos
// `cliente` (nombre) para mostrar en el select. La normalización del modelo
// elimina el matching por texto que generaba bugs cuando había typos.
const INICIAL = {
  nombre: '', direccion: '',
  clienteId: '', cliente: '',
  fechaInicio: new Date().toISOString().split('T')[0],
  fechaFin: '',
}

export default function ObrasNewPage() {
  const navigate = useNavigate()
  const [form,       setForm]       = useState(INICIAL)
  const [errores,    setErrores]    = useState({})
  const [loading,    setLoading]    = useState(false)
  const [guardado,   setGuardado]   = useState(null)
  const [clientes,   setClientes]   = useState([])
  const [loadingDir, setLoadingDir] = useState(true)

  useEffect(() => {
    ClientesService.getAll()
      .then(data => setClientes(data))
      .catch(() => {})
      .finally(() => setLoadingDir(false))
  }, [])

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }))
    setErrores(e => ({ ...e, [campo]: undefined }))
  }

  // Al seleccionar cliente → guardar el ID + autocompletar dirección.
  // Trackeamos también el nombre por si el form viejo lo necesita en algún
  // lugar (aunque el backend resuelve el nombre desde el FK).
  const handleClienteChange = (clienteId) => {
    const clienteObj = clientes.find(c => c.id === clienteId)
    setForm(f => ({
      ...f,
      clienteId,
      cliente:   clienteObj?.nombre    || '',
      direccion: clienteObj?.direccion || f.direccion,
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
    setLoading(true)
    try {
      const obra = await ObrasService.create({
        nombre:      form.nombre.trim(),
        direccion:   form.direccion.trim(),
        clienteId:   form.clienteId,
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
          <button className={styles.btnPrimary} onClick={() => navigate(`/obras/${guardado.id}`)}>Ver obra</button>
          <button className={styles.btnGhost} onClick={() => { setForm(INICIAL); setGuardado(null) }}>Registrar otra</button>
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

            {/* Nombre — manual */}
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor="nombre">
                Nombre de la obra <span className={styles.req}>*</span>
              </label>
              <input id="nombre" type="text"
                className={`${styles.input} ${errores.nombre ? styles.inputError : ''}`}
                placeholder="Ej: Edificio Torre Norte — Planta 3"
                value={form.nombre} onChange={e => set('nombre', e.target.value)} />
              {errores.nombre && <span className={styles.error}>{errores.nombre}</span>}
            </div>

            {/* Cliente — selector */}
            <div className={styles.field}>
              <label className={styles.label}>Cliente <span className={styles.req}>*</span></label>
              {loadingDir ? (
                <div className={styles.input} style={{ color: 'var(--text-muted)' }}>Cargando...</div>
              ) : clientes.length === 0 ? (
                <div className={styles.emptyField}>
                  <span className={styles.emptyFieldMsg}>No hay clientes cargados</span>
                  <button type="button" className={styles.btnMas}
                    onClick={() => navigate('/directorio/clientes')}>
                    + Agregar cliente
                  </button>
                </div>
              ) : (
                <div className={styles.selectorRow}>
                  <select
                    className={`${styles.input} ${errores.clienteId ? styles.inputError : ''}`}
                    value={form.clienteId}
                    onChange={e => handleClienteChange(e.target.value)}>
                    <option value="">— Seleccioná un cliente —</option>
                    {clientes.map(c => (
                      // value = id (FK), label = nombre legible
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <button type="button" className={styles.btnMasIcono}
                    onClick={() => navigate('/directorio/clientes')}
                    title="Gestionar clientes">+</button>
                </div>
              )}
              {errores.clienteId && <span className={styles.error}>{errores.clienteId}</span>}
            </div>

            {/* Dirección — auto-completada, editable */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="direccion">
                Dirección <span className={styles.req}>*</span>
                {form.cliente && form.direccion && (
                  <span className={styles.autoCompletado}> — completada del cliente</span>
                )}
              </label>
              <input id="direccion" type="text"
                className={`${styles.input} ${errores.direccion ? styles.inputError : ''}`}
                placeholder="Se completa al seleccionar el cliente"
                value={form.direccion} onChange={e => set('direccion', e.target.value)} />
              {errores.direccion && <span className={styles.error}>{errores.direccion}</span>}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="fechaInicio">
                Fecha de inicio <span className={styles.req}>*</span>
              </label>
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
