// src/modules/m5-remito/pages/RemitoEditModal.jsx
import { useState } from 'react'
import { RemitosService } from '../services/remitos.service'
import styles from './RemitoEditModal.module.css'

export default function RemitoEditModal({ remito, onClose, onSaved }) {
  const [form, setForm] = useState({
    obra:              remito.obra              || '',
    responsable:       remito.responsable       || '',
    empresaTransporte: remito.empresa_transporte || '',
    fechaEgreso:       remito.fecha_egreso?.split('T')[0] || '',
    observacion:       remito.observacion       || '',
  })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!form.obra.trim() || !form.responsable.trim()) {
      setError('Obra y responsable son obligatorios.')
      return
    }
    setSaving(true); setError(null)
    try {
      await RemitosService.update(remito.id, form)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Editar remito {remito.numero}</h3>
          <button className={styles.btnClose} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.fields}>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="obra">Obra <span className={styles.req}>*</span></label>
              <input id="obra" type="text" className={styles.input}
                value={form.obra} onChange={e => set('obra', e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="responsable">Responsable <span className={styles.req}>*</span></label>
              <input id="responsable" type="text" className={styles.input}
                value={form.responsable} onChange={e => set('responsable', e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="empresaTransporte">Empresa de transporte</label>
              <input id="empresaTransporte" type="text" className={styles.input}
                placeholder="Ej: Transportes García S.A."
                value={form.empresaTransporte} onChange={e => set('empresaTransporte', e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="fechaEgreso">Fecha de egreso</label>
              <input id="fechaEgreso" type="date" className={styles.input}
                value={form.fechaEgreso} onChange={e => set('fechaEgreso', e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="observacion">Observaciones</label>
              <input id="observacion" type="text" className={styles.input}
                placeholder="Notas adicionales..."
                value={form.observacion} onChange={e => set('observacion', e.target.value)} />
            </div>

          </div>

          {error && <p className={styles.error}>⚠ {error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
