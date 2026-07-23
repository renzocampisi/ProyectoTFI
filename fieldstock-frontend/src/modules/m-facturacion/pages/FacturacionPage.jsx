// src/modules/m-facturacion/pages/FacturacionPage.jsx
/**
 * Estado de la suscripción de esta instancia + elegir/cambiar plan.
 * Lectura abierta a cualquier rol autenticado; elegir plan y cancelar
 * quedan restringidos a DUEÑO/ADMIN (mismo criterio que /usuarios,
 * /configuracion) — el backend ya lo valida, acá solo ocultamos los
 * controles para el resto.
 */
import { useState, useEffect } from 'react'
import { useAuth } from '@shared/hooks/useAuth'
import { esDueño } from '@shared/constants/roles'
import { FacturacionService } from '../services/facturacion.service'
import { useSuscripcion } from '../hooks/useSuscripcion'
import styles from './FacturacionPage.module.css'

const ESTADO_LABEL = {
  PRUEBA:    { texto: 'Prueba gratuita', cls: 'estadoPrueba' },
  ACTIVA:    { texto: 'Activa',          cls: 'estadoActiva' },
  VENCIDA:   { texto: 'Pago pendiente',  cls: 'estadoVencida' },
  BLOQUEADA: { texto: 'Bloqueada',       cls: 'estadoBloqueada' },
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function FacturacionPage() {
  const { role } = useAuth()
  const puedeGestionar = esDueño(role)
  const { suscripcion, loading, error, refetch } = useSuscripcion()

  const [planes, setPlanes] = useState(null)
  const [errPlanes, setErrPlanes] = useState(null)
  const [eligiendo, setEligiendo] = useState(null) // código del plan en curso, o null
  const [errElegir, setErrElegir] = useState(null)
  const [confirmCancelar, setConfirmCancelar] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [errCancelar, setErrCancelar] = useState(null)

  useEffect(() => {
    FacturacionService.getPlanes()
      .then(setPlanes)
      .catch(err => setErrPlanes(err.message))
  }, [])

  const handleElegir = async (codigoPlan) => {
    setEligiendo(codigoPlan); setErrElegir(null)
    try {
      const { initPoint } = await FacturacionService.elegirPlan(codigoPlan)
      window.location.href = initPoint
    } catch (err) {
      setErrElegir(err.message)
      setEligiendo(null)
    }
  }

  const handleCancelar = async () => {
    setCancelando(true); setErrCancelar(null)
    try {
      await FacturacionService.cancelar()
      setConfirmCancelar(false)
      await refetch()
    } catch (err) {
      setErrCancelar(err.message)
    } finally {
      setCancelando(false)
    }
  }

  if (loading) return (
    <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando facturación...</div>
  )

  const estado = suscripcion?.estadoEfectivo
  const estadoInfo = ESTADO_LABEL[estado] || { texto: estado, cls: 'estadoBloqueada' }
  const tieneSuscripcionMP = Boolean(suscripcion?.mp_preapproval_id)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Facturación</h1>
        <p className={styles.subtitle}>Plan y estado de la suscripción de esta instancia.</p>
      </header>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      <section className={styles.card}>
        <div className={styles.estadoRow}>
          <span className={`${styles.estadoBadge} ${styles[estadoInfo.cls]}`}>{estadoInfo.texto}</span>
          {suscripcion?.plan && <span className={styles.planActual}>Plan {suscripcion.plan.nombre}</span>}
        </div>

        {estado === 'PRUEBA' && (
          <p className={styles.estadoTexto}>
            Quedan <strong>{suscripcion.diasRestantesPrueba}</strong> día{suscripcion.diasRestantesPrueba === 1 ? '' : 's'} de
            prueba gratuita. Elegí un plan antes de que termine para no perder el acceso.
          </p>
        )}
        {estado === 'ACTIVA' && (
          <p className={styles.estadoTexto}>Próximo cobro: {formatFecha(suscripcion.fecha_vencimiento)}.</p>
        )}
        {estado === 'VENCIDA' && (
          <p className={styles.estadoTextoWarn}>
            ⚠ No se pudo procesar el último cobro. Tenés unos días de gracia antes de que se bloquee el acceso —
            regularizalo desde Mercado Pago o eligiendo el plan de nuevo abajo.
          </p>
        )}
        {estado === 'BLOQUEADA' && (
          <p className={styles.estadoTextoDanger}>
            🔒 El acceso al sistema está bloqueado. Elegí un plan para reactivarlo.
          </p>
        )}

        {puedeGestionar && tieneSuscripcionMP && (estado === 'ACTIVA' || estado === 'VENCIDA') && !confirmCancelar && (
          <button className={styles.btnGhost} onClick={() => setConfirmCancelar(true)}>
            Cancelar suscripción
          </button>
        )}

        {confirmCancelar && (
          <div className={styles.confirmBlock}>
            <p className={styles.confirmText}>
              ¿Cancelar la suscripción? Vas a perder el acceso en cuanto se corte el período ya pagado.
            </p>
            {errCancelar && <div className={styles.errorBanner}>⚠ {errCancelar}</div>}
            <div className={styles.confirmActions}>
              <button className={styles.btnGhost} onClick={() => setConfirmCancelar(false)} disabled={cancelando}>
                Volver
              </button>
              <button className={styles.btnDanger} onClick={handleCancelar} disabled={cancelando}>
                {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        )}
      </section>

      {errPlanes && <div className={styles.errorBanner}>⚠ {errPlanes}</div>}
      {errElegir && <div className={styles.errorBanner}>⚠ {errElegir}</div>}

      {planes && (
        <section className={styles.planesGrid}>
          {planes.map(plan => {
            const esActual  = suscripcion?.plan?.codigo === plan.codigo
            const aMedida   = plan.precio_mensual == null
            return (
              <div key={plan.codigo} className={`${styles.planCard} ${esActual ? styles.planCardActual : ''}`}>
                {esActual && <span className={styles.planBadge}>Tu plan actual</span>}
                <h2 className={styles.planNombre}>{plan.nombre}</h2>
                <div className={styles.planPrecio}>
                  {aMedida ? <span>A medida</span> : <><strong>USD {plan.precio_mensual}</strong><span> / mes</span></>}
                </div>
                <ul className={styles.planFeatures}>
                  <li>{plan.max_usuarios ? `Hasta ${plan.max_usuarios} usuarios` : 'Usuarios ilimitados'}</li>
                  {plan.incluye_panel_ia && <li>Panel con IA para presupuestos</li>}
                  {plan.incluye_seguimiento && <li>Rastreo GPS de herramientas ("Importante")</li>}
                </ul>
                {puedeGestionar && (
                  aMedida ? (
                    <p className={styles.planContacto}>Escribinos para coordinarlo.</p>
                  ) : (
                    <button className={styles.btnPrimary}
                      onClick={() => handleElegir(plan.codigo)}
                      disabled={esActual || eligiendo === plan.codigo}>
                      {eligiendo === plan.codigo ? 'Redirigiendo...' : esActual ? 'Plan actual' : 'Suscribirme'}
                    </button>
                  )
                )}
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
