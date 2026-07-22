// src/modules/m9-usuarios/components/InvitarModal.jsx
/**
 * Genera un código de invitación de un solo uso para que un empleado se
 * autoregistre en /registro con un rol pre-asignado (nunca DUEÑO — ese rol
 * solo sale del registro bootstrap, ver auth-publico.service.js backend).
 *
 * Dos pasos en el mismo modal:
 *   1) Elegir rol → generar.
 *   2) Mostrar el link UNA SOLA VEZ (mismo espíritu que PasswordRevealModal)
 *      con botón "Copiar" para pasárselo al empleado por WhatsApp.
 */
import { useState } from 'react'
import { ROLES, ROLE_LABELS } from '@shared/constants/roles'
import { InvitacionesService } from '../services/invitaciones.service'
import stylesForm   from './UsuarioFormModal.module.css'
import stylesReveal from './PasswordRevealModal.module.css'

const ROLES_INVITABLES = [
  { value: ROLES.ADMIN,     label: ROLE_LABELS.ADMIN },
  { value: ROLES.ENCARGADO, label: ROLE_LABELS.ENCARGADO },
  { value: ROLES.OPERARIO,  label: ROLE_LABELS.OPERARIO },
]

export default function InvitarModal({ onClose }) {
  const [role, setRole] = useState(ROLES.OPERARIO)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState(null)
  const [invitacion, setInvitacion] = useState(null)
  const [copiado, setCopiado] = useState(false)

  const link = invitacion
    ? `${window.location.origin}/registro?codigo=${invitacion.codigo}`
    : ''

  const handleGenerar = async (ev) => {
    ev.preventDefault()
    if (generando) return
    setGenerando(true); setError(null)
    try {
      const data = await InvitacionesService.generar(role)
      setInvitacion(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerando(false)
    }
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      alert('No se pudo copiar automáticamente. Seleccioná el link y copialo manualmente.')
    }
  }

  if (invitacion) {
    return (
      <div className={stylesReveal.overlay} onClick={onClose}>
        <div className={stylesReveal.card} onClick={e => e.stopPropagation()}>
          <div className={stylesReveal.icon}>✓</div>
          <h2 className={stylesReveal.title}>Invitación generada</h2>
          <p className={stylesReveal.who}>
            Rol: <strong>{ROLE_LABELS[invitacion.role] || invitacion.role}</strong>
          </p>

          <div className={stylesReveal.passSection}>
            <span className={stylesReveal.passLabel}>Link de invitación</span>
            <div className={stylesReveal.passBox}>
              <span className={stylesReveal.passText} style={{ fontSize: 'var(--text-xs)', letterSpacing: 0 }}>
                {link}
              </span>
              <button type="button" className={stylesReveal.btnCopy} onClick={copiar}>
                {copiado ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          <p className={stylesReveal.warn}>
            ⚠ <strong>Este link no se vuelve a mostrar.</strong> Copialo ahora
            y pasáselo al empleado por WhatsApp — es de un solo uso y vence
            en 24 horas.
          </p>

          <button className={stylesReveal.btnPrimary} onClick={onClose}>
            Listo, ya lo copié
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={stylesForm.overlay} onClick={onClose}>
      <form className={stylesForm.card} onClick={e => e.stopPropagation()} onSubmit={handleGenerar} noValidate>
        <h2 className={stylesForm.title}>Invitar empleado</h2>

        <div className={stylesForm.field}>
          <label className={stylesForm.label} htmlFor="inv-role">Rol <span className={stylesForm.req}>*</span></label>
          <select id="inv-role" className={stylesForm.input}
            value={role} onChange={e => setRole(e.target.value)}>
            {ROLES_INVITABLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {error && <div className={stylesForm.errorBanner}>⚠ {error}</div>}

        <p className={stylesForm.helper}>
          Se genera un link de un solo uso con el rol ya asignado, válido
          por 24 horas — el empleado lo abre y completa su registro en
          /registro.
        </p>

        <div className={stylesForm.actions}>
          <button type="button" className={stylesForm.btnGhost} onClick={onClose}>Cancelar</button>
          <button type="submit" className={stylesForm.btnPrimary} disabled={generando}>
            {generando ? 'Generando...' : 'Generar invitación'}
          </button>
        </div>
      </form>
    </div>
  )
}
