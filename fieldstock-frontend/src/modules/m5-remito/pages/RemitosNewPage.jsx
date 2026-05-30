// src/modules/m5-remito/pages/RemitosNewPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RemitosService } from '../services/remitos.service'
import { TransportesService, ClientesService } from '@modules/m7-directorio/services/directorio.service'
import { ObrasService } from '@modules/m4-obra/services/obras.service'
import { useAuth } from '@shared/hooks/useAuth'
import styles from './RemitosNewPage.module.css'

export default function RemitosNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const obraIdParam = searchParams.get('obraId') || ''
  // El usuario logueado se carga del AuthProvider y se aplica como
  // responsable default. El nombre queda editable (por si firma otro
  // empleado), pero el responsable_user_id se mantiene apuntando al user
  // logueado para que el PDF muestre su teléfono.
  const { profile } = useAuth()

  const [form, setForm] = useState({
    obraId:         obraIdParam,
    obraNombre:     '',
    // Pre-llenamos con el nombre del user logueado. Si todavía no cargó
    // el profile, queda vacío y el useEffect lo completa al estar disponible.
    responsable:    profile?.nombre || '',
    transporteId:   '',
    fechaEgreso:    new Date().toISOString().split('T')[0],
    observacion:    '',
  })
  const [errores,     setErrores]     = useState({})
  const [loading,     setLoading]     = useState(false)
  const [transportes, setTransportes] = useState([])
  const [obras,       setObras]       = useState([])
  // Cargamos también la lista completa de clientes para poder resolver el
  // cliente_id por nombre cuando se crea el remito. La tabla `obras` guarda
  // el cliente como texto (no como FK), así que tenemos que hacer el match
  // acá en el frontend para que el remito quede vinculado al cliente real
  // y la vista remitos_resumen pueda devolver datos joineados (dirección,
  // teléfono, etc.).
  const [clientes,    setClientes]    = useState([])
  const [loadingDir,  setLoadingDir]  = useState(true)

  useEffect(() => {
    Promise.all([
      TransportesService.getAll(),
      ObrasService.getAll({ estado: 'ACTIVA' }),
      ClientesService.getAll().catch(() => []),
    ]).then(([transp, obrasActivas, clientesAll]) => {
      setTransportes(transp)
      setObras(obrasActivas)
      setClientes(clientesAll)
      if (obraIdParam) {
        const obraObj = obrasActivas.find(o => o.id === obraIdParam)
        if (obraObj) setForm(f => ({ ...f, obraId: obraObj.id, obraNombre: obraObj.nombre }))
      }
    }).catch(() => {})
    .finally(() => setLoadingDir(false))
  }, [])

  // Si el profile carga después del primer render (race con el AuthProvider),
  // completamos el campo responsable acá. Solo si el user no editó nada.
  useEffect(() => {
    if (profile?.nombre && !form.responsable) {
      setForm(f => ({ ...f, responsable: profile.nombre }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.nombre])

  // Helper: dada una obra, devuelve el cliente_id correcto.
  // Camino feliz post-normalización: obras.cliente_id viene de la vista,
  // lo usamos directo. Si por alguna razón no está seteado (obra creada
  // antes de la normalización y nunca editada), caemos a un match por
  // texto contra la lista de clientes.
  const resolverClienteId = (obra) => {
    if (obra?.cliente_id) return obra.cliente_id
    const texto = obra?.cliente?.trim().toLowerCase()
    if (!texto) return null
    return clientes.find(c => c.nombre?.trim().toLowerCase() === texto)?.id || null
  }

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
    const obraObj    = obras.find(o => o.id === form.obraId)
    const clienteId  = resolverClienteId(obraObj)
    setLoading(true)
    try {
      const remito = await RemitosService.create({
        obra:              form.obraNombre,
        // Responsable y user_id vienen siempre del profile del logueado
        // — el campo es read-only en la UI, no hay edición manual.
        responsable:       profile?.nombre || form.responsable,
        responsableUserId: profile?.id || null,
        empresaTransporte: transporte?.nombre || null,
        transporteId:      form.transporteId  || null,
        clienteId,
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
                    {obras.map(o => {
                      // Preferimos cliente_nombre (FK joineado, post-normalización);
                      // si la obra es vieja y no fue editada, caemos al texto legacy.
                      const clienteLabel = o.cliente_nombre || o.cliente
                      return (
                        <option key={o.id} value={o.id}>
                          {clienteLabel ? `${clienteLabel} — ${o.nombre}` : o.nombre}
                        </option>
                      )
                    })}
                  </select>
                  <button type="button" className={styles.btnMasIcono}
                    onClick={() => navigate('/obras/nueva')} title="Nueva obra">+</button>
                </div>
              )}
              {errores.obraId && <span className={styles.error}>{errores.obraId}</span>}
            </div>

            {/* Responsable — viene del usuario logueado, no editable.
                Antes era input libre porque no había sistema de login;
                ahora que profile.nombre es la fuente de verdad y queremos
                que también provea responsable_user_id (para tel del PDF y
                trazabilidad), bloqueamos la edición. */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="responsable">Responsable</label>
              <input id="responsable" type="text"
                className={`${styles.input} ${styles.inputReadonly}`}
                value={form.responsable}
                readOnly
                tabIndex={-1} />
              <span className={styles.hint}>Se toma de tu sesión iniciada.</span>
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
