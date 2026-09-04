// src/modules/m5-remito/pages/RemitoEditModal.jsx
import { useState, useEffect } from 'react'
import { RemitosService } from '../services/remitos.service'
import { ObrasService } from '@modules/m4-obra/services/obras.service'
import styles from './RemitoEditModal.module.css'

export default function RemitoEditModal({ remito, onClose, onSaved }) {
  const [form, setForm] = useState({
    obraId:            remito.obra_id            || '',
    responsable:       remito.responsable       || '',
    empresaTransporte: remito.empresa_transporte || '',
    fechaEgreso:       remito.fecha_egreso?.split('T')[0] || '',
    observacion:       remito.observacion       || '',
  })
  const [obras,   setObras]   = useState(null) // null = sin cargar todavía
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  // Carga la lista completa de obras (sin filtrar por ACTIVA — el remito
  // pudo haberse creado para una obra que hoy ya está FINALIZADA, y tiene
  // que seguir apareciendo como opción para no perder la selección actual).
  // Si el remito es de antes del FK (obra_id null), intentamos preseleccionar
  // por coincidencia de nombre — es solo una sugerencia, el usuario confirma.
  useEffect(() => {
    ObrasService.getAll().then(lista => {
      setObras(lista)
      if (!form.obraId && remito.obra) {
        const match = lista.find(o => o.nombre === remito.obra)
        if (match) set('obraId', match.id)
      }
    }).catch(() => setObras([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!form.obraId || !form.responsable.trim()) {
      setError('Obra y responsable son obligatorios.')
      return
    }
    setSaving(true); setError(null)
    try {
      const obraObj = obras?.find(o => o.id === form.obraId)
      await RemitosService.update(remito.id, {
        obraId:            form.obraId,
        obra:              obraObj?.nombre || remito.obra,
        responsable:       form.responsable,
        empresaTransporte: form.empresaTransporte,
        fechaEgreso:       form.fechaEgreso,
        observacion:       form.observacion,
      })
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
              {obras === null ? (
                <div className={styles.input} style={{ color: 'var(--text-muted)' }}>Cargando obras...</div>
              ) : (
                <select id="obra" className={styles.input}
                  value={form.obraId} onChange={e => set('obraId', e.target.value)}>
                  <option value="">— Seleccioná una obra —</option>
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>
                      {(o.cliente_nombre || o.cliente) ? `${o.cliente_nombre || o.cliente} — ${o.nombre}` : o.nombre}
                    </option>
                  ))}
                </select>
              )}
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
