// src/modules/m5-remito/pages/RemitosNewPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RemitosService } from '../services/remitos.service'
import { TransportesService, ClientesService } from '@modules/m7-directorio/services/directorio.service'
import { ObrasService } from '@modules/m4-obra/services/obras.service'
import styles from './RemitosNewPage.module.css'

export default function RemitosNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const obraIdParam = searchParams.get('obraId') || ''

  const [form, setForm] = useState({
    obraId:         obraIdParam,
    obraNombre:     '',
    responsable:    '',
    transporteId:   '',
    fechaEgreso:    new Date().toISOString().split('T')[0],
    observacion:    '',
  })
  const [errores,     setErrores]     = useState({})
  const [loading,     setLoading]     = useState(false)
  const [transportes, setTransportes] = useState([])
  const [obras,       setObras]       = useState([])
  const [loadingDir,  setLoadingDir]  = useState(true)

  useEffect(() => {
    Promise.all([
      TransportesService.getAll(),
      ObrasService.getAll({ estado: 'ACTIVA' }),
    ]).then(([transp, obrasActivas]) => {
      setTransportes(transp)
      setObras(obrasActivas)
      if (obraIdParam) {
        const obraObj = obrasActivas.find(o => o.id === obraIdParam)
        if (obraObj) setForm(f => ({ ...f, obraId: obraObj.id, obraNombre: obraObj.nombre }))
      }
    }).catch(() => {})
    .finally(() => setLoadingDir(false))
  }, [])

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }))
    setErrores(e => ({ ...e, [campo]: undefined }))
  }

  const handleObraChange = (obraId) => {
    const obraObj = obras.find(o => o.id === obraId)
    setForm(f => ({ ...f, obraId, obraNombre: obraObj?.nombre || '' }))
    setErrores(e => ({ ...e, obraId: undefined }))
  }

  const validar = () => {
    const e = {}
    if (!form.obraId)             e.obraId      = 'Seleccioná una obra activa.'
    if (!form.responsable.trim()) e.responsable = 'El responsable es obligatorio.'
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const e2 = validar()
    if (Object.keys(e2).length) { setErrores(e2); return }

    const transporte = transportes.find(t => t.id === form.transporteId)
    setLoading(true)
    try {
      const remito = await RemitosService.create({
        obra:              form.obraNombre,
        responsable:       form.responsable,
        empresaTransporte: transporte?.nombre || null,
        transporteId:      form.transporteId  || null,
        clienteId:         obras.find(o => o.id === form.obraId)?.cliente_id || null,
        fechaEgreso:       form.fechaEgreso,
        observacion:       form.observacion || null,
      })
      navigate(`/remitos/${remito.id}`)
    } catch (err) {
      setErrores({ general: err.message })
    } finally { setLoading(false) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate(-1)}>← Volver</button>
        <div>
          <h1 className={styles.title}>Nuevo remito</h1>
          <p className={styles.subtitle}>El número se genera automáticamente.</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Datos del remito</legend>
          <div className={styles.grid2}>

            {/* Obra */}
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label}>Obra <span className={styles.req}>*</span></label>
              {loadingDir ? (
                <div className={styles.input} style={{ color: 'var(--text-muted)' }}>Cargando obras...</div>
              ) : obras.length === 0 ? (
                <div className={styles.emptyField}>
                  <span className={styles.emptyFieldMsg}>No hay obras activas</span>
                  <button type="button" className={styles.btnMas} onClick={() => navigate('/obras/nueva')}>+ Crear obra</button>
                </div>
              ) : (
                <div className={styles.selectorRow}>
                  <select className={`${styles.input} ${errores.obraId ? styles.inputError : ''}`}
                    value={form.obraId} onChange={e => handleObraChange(e.target.value)}>
                    <option value="">— Seleccioná una obra activa —</option>
                    {obras.map(o => (
                      <option key={o.id} value={o.id}>{o.nombre}{o.cliente ? ` — ${o.cliente}` : ''}</option>
                    ))}
                  </select>
                  <button type="button" className={styles.btnMasIcono}
                    onClick={() => navigate('/obras/nueva')} title="Nueva obra">+</button>
                </div>
              )}
              {errores.obraId && <span className={styles.error}>{errores.obraId}</span>}
            </div>

            {/* Responsable */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="responsable">Responsable <span className={styles.req}>*</span></label>
              <input id="responsable" type="text"
                className={`${styles.input} ${errores.responsable ? styles.inputError : ''}`}
                placeholder="Quien verifica y firma el remito"
                value={form.responsable} onChange={e => set('responsable', e.target.value)} />
              {errores.responsable && <span className={styles.error}>{errores.responsable}</span>}
            </div>

            {/* Transporte */}
            <div className={styles.field}>
              <label className={styles.label}>Empresa de transporte</label>
              {loadingDir ? (
                <div className={styles.input} style={{ color: 'var(--text-muted)' }}>Cargando...</div>
              ) : transportes.length === 0 ? (
                <div className={styles.emptyField}>
                  <span className={styles.emptyFieldMsg}>No hay transportes cargados</span>
                  <button type="button" className={styles.btnMas}
                    onClick={() => navigate('/directorio/transportes')}>+ Agregar transporte</button>
                </div>
              ) : (
                <div className={styles.selectorRow}>
                  <select className={styles.input}
                    value={form.transporteId}
                    onChange={e => set('transporteId', e.target.value)}>
                    <option value="">— Sin transporte —</option>
                    {transportes.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                  <button type="button" className={styles.btnMasIcono}
                    onClick={() => navigate('/directorio/transportes')}
                    title="Gestionar transportes">+</button>
                </div>
              )}
            </div>

            {/* Fecha */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="fechaEgreso">Fecha de egreso</label>
              <input id="fechaEgreso" type="date" className={styles.input}
                value={form.fechaEgreso} onChange={e => set('fechaEgreso', e.target.value)} />
            </div>

            {/* Observacion */}
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor="observacion">
                Observaciones <span className={styles.optional}>(opcional)</span>
              </label>
              <input id="observacion" type="text" className={styles.input}
                placeholder="Notas adicionales..."
                value={form.observacion} onChange={e => set('observacion', e.target.value)} />
            </div>

          </div>
        </fieldset>

        {errores.general && <div className={styles.errorBanner}>⚠ {errores.general}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Creando...' : 'Crear remito →'}
          </button>
        </div>
      </form>
    </div>
  )
}
