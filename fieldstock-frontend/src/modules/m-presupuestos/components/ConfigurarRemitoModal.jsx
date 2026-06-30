// src/modules/m-presupuestos/components/ConfigurarRemitoModal.jsx
/**
 * Modal que aparece despues de aprobar un presupuesto. Permite asignar
 * el transporte y el responsable del remito generado automaticamente
 * por la RPC `aprobar_presupuesto`.
 *
 * El remito recien generado nace con:
 *   - transporte_id = null
 *   - responsable_user_id = null
 *   - responsable = '-- por completar --'
 *
 * Sin este modal el operador tenia que entrar al remito desde otro
 * lugar y completar todo a mano. Ahora se completa en el flujo de
 * aprobacion, que es el momento natural para definir "como y quien".
 *
 * Saltable: el boton "Configurar despues" solo cierra el modal sin
 * tocar el remito. Se puede completar mas tarde desde el detalle del
 * remito.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TransportesService } from '@modules/m7-directorio/services/directorio.service'
import { UsuariosService } from '@modules/m9-usuarios/services/usuarios.service'
import { RemitosService } from '@modules/m5-remito/services/remitos.service'
import styles from './ConfigurarRemitoModal.module.css'

export default function ConfigurarRemitoModal({ remitoId, onClose }) {
  const navigate = useNavigate()
  const [transportes,  setTransportes]  = useState([])
  const [encargados,   setEncargados]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [transporteId, setTransporteId] = useState('')
  const [responsableId, setResponsableId] = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState(null)

  useEffect(() => {
    let mounted = true
    Promise.all([
      TransportesService.getAll().catch(() => []),
      UsuariosService.getEncargadosDisponibles().catch(() => []),
    ]).then(([t, e]) => {
      if (!mounted) return
      setTransportes(t || [])
      setEncargados(e || [])
    }).finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  const responsableSeleccionado = encargados.find(e => e.id === responsableId)

  const handleGuardar = async () => {
    if (saving) return
    setSaving(true); setError(null)
    try {
      const body = {}
      if (transporteId) body.transporteId = transporteId
      if (responsableSeleccionado) {
        body.responsableUserId = responsableSeleccionado.id
        body.responsable       = responsableSeleccionado.nombre
      }
      // Si no se eligio ni transporte ni responsable, no llamamos al
      // backend — equivale a "saltar".
      if (Object.keys(body).length > 0) {
        await RemitosService.update(remitoId, body)
      }
      onClose({ ok: true })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const handleIrAlRemito = () => {
    // Navega al detalle del remito generado sin tocarlo (lo va a
    // configurar desde alli).
    onClose({ ok: false })
    navigate(`/remitos/${remitoId}`)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Configurar remito generado</h3>
          <p className={styles.subtitle}>
            El remito se creó en BORRADOR con los insumos del presupuesto.
            Asigná transporte y responsable, o saltá este paso y completá después.
          </p>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loading}>Cargando opciones...</div>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Transporte</label>
                <select className={styles.input}
                  value={transporteId}
                  onChange={e => setTransporteId(e.target.value)}>
                  <option value="">— Elegir transporte —</option>
                  {transportes.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}{t.tipo ? ` (${t.tipo})` : ''}
                    </option>
                  ))}
                </select>
                {transportes.length === 0 && (
                  <span className={styles.hint}>No hay transportes cargados. Agregá uno en Directorio.</span>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Responsable / Encargado</label>
                <select className={styles.input}
                  value={responsableId}
                  onChange={e => setResponsableId(e.target.value)}>
                  <option value="">— Elegir responsable —</option>
                  {encargados.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}{u.ocupado ? '  · ocupado' : ''}
                    </option>
                  ))}
                </select>
                {responsableSeleccionado?.ocupado && (
                  <span className={styles.hintOcupado}>
                    ⚠ {responsableSeleccionado.nombre} ya está como responsable de
                    otro remito en curso. Igual podés asignarlo si querés.
                  </span>
                )}
              </div>
            </>
          )}

          {error && <div className={styles.error}>⚠ {error}</div>}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btnLink} onClick={handleIrAlRemito} disabled={saving}>
            Ir al remito →
          </button>
          <div className={styles.actionsRight}>
            <button type="button" className={styles.btnGhost} onClick={() => onClose({ ok: false })} disabled={saving}>
              Configurar después
            </button>
            <button type="button" className={styles.btnPrimary} onClick={handleGuardar} disabled={saving || loading}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
