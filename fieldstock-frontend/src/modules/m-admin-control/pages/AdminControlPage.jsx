// src/modules/m-admin-control/pages/AdminControlPage.jsx
/**
 * Panel de control — exclusivo de ADMIN (rol del dueño del sistema, no de
 * la empresa cliente). Mientras no haya chip de datos activado en los
 * dispositivos (ver dispositivo-tracker.service.js, stub), no hay posición
 * ni batería real que mostrar — por eso todavía no hay mapa acá, solo el
 * estado de cupos y el inventario de dispositivos con sus acciones.
 */
import { useState, useEffect } from 'react'
import { useSuscripcion } from '@modules/m-facturacion/hooks/useSuscripcion'
import { useEmpresa } from '@shared/hooks/useEmpresa'
import { UsuariosService } from '@modules/m9-usuarios/services/usuarios.service'
import { useDispositivos } from '../hooks/useDispositivos'
import { useClientesCentrales } from '../hooks/useClientesCentrales'
import { DispositivosService } from '../services/dispositivos.service'
import { ClientesCentralesService } from '../services/clientes-centrales.service'
import styles from './AdminControlPage.module.css'

function formatMinutos(iso) {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  return `hace ${Math.round(minutos / 60)} h`
}

const ESTADO_LABEL = {
  LIBRE:      { texto: 'Libre',      cls: 'estadoLibre' },
  EMPAREJADO: { texto: 'Emparejado', cls: 'estadoEmparejado' },
  BAJA:       { texto: 'Baja',       cls: 'estadoBaja' },
}

export default function AdminControlPage() {
  const { suscripcion, loading: loadingSus } = useSuscripcion()
  const { empresa, loading: loadingEmpresa } = useEmpresa()
  const { dispositivos, loading: loadingDisp, error, refetch } = useDispositivos()
  const { clientes, loading: loadingClientes, error: errClientes, refetch: refetchClientes } = useClientesCentrales()

  const [clienteAccion, setClienteAccion] = useState(null) // cliente elegido para liberar un dispositivo
  const [codigoRemoto, setCodigoRemoto] = useState('')
  const [liberandoRemoto, setLiberandoRemoto] = useState(false)
  const [errRemoto, setErrRemoto] = useState(null)

  const handleLiberarRemoto = async (e) => {
    e.preventDefault()
    if (!codigoRemoto.trim() || !clienteAccion) return
    setLiberandoRemoto(true); setErrRemoto(null)
    try {
      await ClientesCentralesService.liberarDispositivo(clienteAccion.id, codigoRemoto.trim())
      setClienteAccion(null); setCodigoRemoto('')
      refetchClientes()
    } catch (err) {
      setErrRemoto(err.message)
    } finally {
      setLiberandoRemoto(false)
    }
  }

  // Recuerdo importante para quien use este panel: cada instancia de
  // FieldStock es UNA sola empresa cliente (ver architecture.html — un
  // deploy por empresa, no multi-tenant). Esta pantalla nunca va a listar
  // "varios dueños" — siempre representa la única cuenta de esta instancia,
  // por eso el encabezado deja explícito de quién es antes de mostrar
  // números sueltos de plan/cupos.
  const [dueño, setDueño] = useState(null)
  useEffect(() => {
    UsuariosService.getAll()
      .then(lista => setDueño(lista.find(u => u.role === 'DUEÑO') || null))
      .catch(() => setDueño(null))
  }, [])

  const [codigoNuevo, setCodigoNuevo] = useState('')
  const [imeiNuevo, setImeiNuevo] = useState('')
  const [creando, setCreando] = useState(false)
  const [errCrear, setErrCrear] = useState(null)
  const [errAccion, setErrAccion] = useState(null)

  const handleCrear = async (e) => {
    e.preventDefault()
    if (!codigoNuevo.trim()) return
    setCreando(true); setErrCrear(null)
    try {
      await DispositivosService.crear(codigoNuevo.trim(), imeiNuevo.trim() || undefined)
      setCodigoNuevo(''); setImeiNuevo('')
      refetch()
    } catch (err) {
      setErrCrear(err.message)
    } finally {
      setCreando(false)
    }
  }

  const handleLiberar = async (id) => {
    setErrAccion(null)
    try {
      await DispositivosService.liberar(id)
      refetch()
    } catch (err) { setErrAccion(err.message) }
  }

  const handleDarDeBaja = async (id) => {
    setErrAccion(null)
    try {
      await DispositivosService.darDeBaja(id)
      refetch()
    } catch (err) { setErrAccion(err.message) }
  }

  const emparejados = (dispositivos || []).filter(d => d.estado === 'EMPAREJADO').length
  const cupo = suscripcion?.herramientas_seguimiento_cupo || 0

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Panel de control</h1>
        <p className={styles.subtitle}>
          Cada instancia de FieldStock es una sola empresa cliente — este panel es la cuenta de esa empresa,
          no una lista de varias.
        </p>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Mis clientes</h2>
        <p className={styles.textMuted} style={{ marginTop: 0 }}>
          Último estado reportado por cada instancia-cliente (hasta 30 min de desfasaje). Vacío hasta que algún
          cliente reporte acá — ver architecture-multi-cliente.html.
        </p>
        {errClientes && <div className={styles.errorBanner}>⚠ {errClientes}</div>}
        {loadingClientes ? <p className={styles.textMuted}>Cargando...</p> : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Plan</th>
                <th>Herramientas</th>
                <th>Último reporte</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(clientes || []).map(c => (
                <tr key={c.id}>
                  <td>{c.empresa_nombre || '—'}</td>
                  <td>{c.plan_nombre || '— sin elegir —'}</td>
                  <td>{c.herramientas_emparejadas} / {c.herramientas_cupo}</td>
                  <td>
                    <span className={`${styles.badge} ${c.activo ? styles.estadoLibre : styles.estadoBaja}`}>
                      {c.activo ? 'activo' : 'sin reportar'}
                    </span>{' '}
                    {formatMinutos(c.ultimo_reporte_at)}
                  </td>
                  <td>
                    <button className={styles.btnGhost} onClick={() => setClienteAccion(c)}>
                      Liberar dispositivo
                    </button>
                  </td>
                </tr>
              ))}
              {clientes?.length === 0 && (
                <tr><td colSpan={5} className={styles.textMuted}>Todavía no reportó ningún cliente.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {clienteAccion && (
        <div className={styles.errorBanner} style={{ background: 'var(--color-surface)', color: 'inherit' }}>
          <form onSubmit={handleLiberarRemoto} className={styles.formRow}>
            <span>Liberar dispositivo de <strong>{clienteAccion.empresa_nombre}</strong> — código QR:</span>
            <input
              type="text" placeholder="FS-DEV-XXXXXXXX" className={styles.input}
              value={codigoRemoto} onChange={e => setCodigoRemoto(e.target.value)}
              autoFocus
            />
            <button className={styles.btnPrimary} type="submit" disabled={liberandoRemoto || !codigoRemoto.trim()}>
              {liberandoRemoto ? 'Liberando...' : 'Confirmar'}
            </button>
            <button className={styles.btnGhost} type="button" onClick={() => { setClienteAccion(null); setErrRemoto(null) }}>
              Cancelar
            </button>
          </form>
          {errRemoto && <p style={{ color: 'var(--color-danger)' }}>⚠ {errRemoto}</p>}
        </div>
      )}

      <h2 className={styles.cardTitle} style={{ marginTop: 'var(--space-2)' }}>Esta instancia</h2>

      <section className={`${styles.card} ${styles.cardCuenta}`}>
        {(loadingEmpresa) ? <p className={styles.textMuted}>Cargando...</p> : (
          <>
            <span className={styles.cuentaEmpresa}>{empresa?.nombre || 'Empresa sin nombre cargado'}</span>
            {dueño && (
              <span className={styles.cuentaDueño}>Dueño: {dueño.nombre} · {dueño.email}</span>
            )}
          </>
        )}
      </section>

      <section className={styles.card}>
        {loadingSus ? <p className={styles.textMuted}>Cargando...</p> : (
          <>
            <div className={styles.statRow}>
              <span>Plan</span>
              <strong>{suscripcion?.plan?.nombre || '— sin elegir —'}</strong>
            </div>
            <div className={styles.statRow}>
              <span>Empleados extra contratados</span>
              <strong>{suscripcion?.empleados_extra || 0}</strong>
            </div>
            <div className={styles.statRow}>
              <span>Herramientas con seguimiento</span>
              <strong>{emparejados} / {cupo} usadas</strong>
            </div>
          </>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Cargar dispositivo nuevo</h2>
        <form className={styles.formRow} onSubmit={handleCrear}>
          <input
            type="text" placeholder="Código QR (ej: FS-DEV-1ABD152F)"
            value={codigoNuevo} onChange={e => setCodigoNuevo(e.target.value)}
            className={styles.input}
          />
          <input
            type="text" placeholder="IMEI del proveedor (opcional)"
            value={imeiNuevo} onChange={e => setImeiNuevo(e.target.value)}
            className={styles.input}
          />
          <button className={styles.btnPrimary} type="submit" disabled={creando || !codigoNuevo.trim()}>
            {creando ? 'Cargando...' : 'Agregar'}
          </button>
        </form>
        {errCrear && <div className={styles.errorBanner}>⚠ {errCrear}</div>}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Inventario de dispositivos</h2>
        {errAccion && <div className={styles.errorBanner}>⚠ {errAccion}</div>}
        {error && <div className={styles.errorBanner}>⚠ {error}</div>}
        {loadingDisp ? <p className={styles.textMuted}>Cargando...</p> : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Código QR</th>
                <th>Herramienta</th>
                <th>Estado</th>
                <th>Batería</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(dispositivos || []).map(d => {
                const info = ESTADO_LABEL[d.estado] || { texto: d.estado, cls: '' }
                return (
                  <tr key={d.id}>
                    <td>{d.codigo_qr}</td>
                    <td>{d.herramientas?.nombre || '—'}</td>
                    <td><span className={`${styles.badge} ${styles[info.cls]}`}>{info.texto}</span></td>
                    <td>{d.ultima_bateria != null ? `${d.ultima_bateria}%` : 'Sin señal'}</td>
                    <td className={styles.actions}>
                      {d.estado === 'EMPAREJADO' && (
                        <button className={styles.btnGhost} onClick={() => handleLiberar(d.id)}>Liberar</button>
                      )}
                      {d.estado !== 'BAJA' && (
                        <button className={styles.btnDanger} onClick={() => handleDarDeBaja(d.id)}>Dar de baja</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {dispositivos?.length === 0 && (
                <tr><td colSpan={5} className={styles.textMuted}>Todavía no cargaste ningún dispositivo.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
