// src/modules/m5-remito/pages/RemitosNewPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RemitosService } from '../services/remitos.service'
import styles from './RemitosNewPage.module.css'

const INICIAL = {
  tipo: 'EGRESO', obra: '', responsable: '',
  empresaTransporte: '',
  fecha: new Date().toISOString().split('T')[0],
  observacion: '',
}

export default function RemitosNewPage() {
  const navigate = useNavigate()
  const [form,    setForm]    = useState(INICIAL)
  const [errores, setErrores] = useState({})
  const [loading, setLoading] = useState(false)

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }))
    setErrores(e => ({ ...e, [campo]: undefined }))
  }

  const validar = () => {
    const e = {}
    if (!form.obra.trim())        e.obra        = 'La obra es obligatoria.'
    if (!form.responsable.trim()) e.responsable = 'El responsable es obligatorio.'
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const e2 = validar()
    if (Object.keys(e2).length) { setErrores(e2); return }
    setLoading(true)
    try {
      const remito = await RemitosService.create(form)
      navigate(`/remitos/${remito.id}`)
    } catch (err) {
      setErrores({ general: err.message })
    } finally { setLoading(false) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate('/remitos')}>← Volver</button>
        <div>
          <h1 className={styles.title}>Nuevo remito</h1>
          <p className={styles.subtitle}>El número se genera automáticamente.</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>

        {/* Tipo */}
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Tipo de remito</legend>
          <div className={styles.tipoSelector}>
            {['EGRESO','INGRESO'].map(t => (
              <button key={t} type="button"
                className={`${styles.tipoBtn} ${form.tipo === t ? styles.tipoBtnActive : ''}`}
                onClick={() => set('tipo', t)}
              >
                <span className={styles.tipoIcon}>{t === 'EGRESO' ? '↑' : '↓'}</span>
                <span className={styles.tipoLabel}>{t === 'EGRESO' ? 'Egreso a obra' : 'Ingreso desde obra'}</span>
                <span className={styles.tipoDesc}>
                  {t === 'EGRESO' ? 'Herramientas y materiales que salen del depósito' : 'Herramientas y materiales que vuelven de obra'}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Datos */}
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Datos del remito</legend>
          <div className={styles.grid2}>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="obra">Obra <span className={styles.req}>*</span></label>
              <input id="obra" type="text"
                className={`${styles.input} ${errores.obra ? styles.inputError : ''}`}
                placeholder="Ej: Obra Belgrano — Av. Cabildo 1200"
                value={form.obra} onChange={e => set('obra', e.target.value)} />
              {errores.obra && <span className={styles.error}>{errores.obra}</span>}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="responsable">Responsable <span className={styles.req}>*</span></label>
              <input id="responsable" type="text"
                className={`${styles.input} ${errores.responsable ? styles.inputError : ''}`}
                placeholder="Quien verifica y firma el remito"
                value={form.responsable} onChange={e => set('responsable', e.target.value)} />
              {errores.responsable && <span className={styles.error}>{errores.responsable}</span>}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="empresaTransporte">Empresa de transporte</label>
              <input id="empresaTransporte" type="text"
                className={styles.input}
                placeholder="Ej: Transportes García S.A."
                value={form.empresaTransporte} onChange={e => set('empresaTransporte', e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="fecha">Fecha</label>
              <input id="fecha" type="date" className={styles.input}
                value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>

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
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/remitos')}>
            Cancelar
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Creando...' : 'Crear remito y agregar ítems →'}
          </button>
        </div>

      </form>
    </div>
  )
}
