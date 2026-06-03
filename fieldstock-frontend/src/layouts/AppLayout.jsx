// src/layouts/AppLayout.jsx
import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { ROLE_LABELS, esDueño } from '@shared/constants/roles'
import styles from './AppLayout.module.css'

// Word #16: "Inicio" suelto arriba del todo, como dashboard general
const INICIO_ITEMS = [
  { to: '/', label: 'Inicio', icon: '🏠', activo: true, end: true },
]

const DEPOSITO_ITEMS = [
  { to: '/herramientas', label: 'Herramientas', icon: '🔧', activo: true },
  { to: '/materiales',   label: 'Materiales',   icon: '📦', activo: true },
  { to: '/estanterias',  label: 'Estanterías',  icon: '🗄️', activo: true },
]

const OPERATIVO_ITEMS = [
  { to: '/remitos', label: 'Remitos',      icon: '📋', activo: true },
  { to: '/obras',   label: 'Obras',        icon: '🏗️', activo: true },
  { to: '/qr',      label: 'Escanear QR',  icon: '▦',  activo: true },
]

const DIRECTORIO_ITEMS = [
  { to: '/directorio/transportes', label: 'Transportes', icon: '🚚', activo: true  },
  { to: '/directorio/clientes',    label: 'Clientes',    icon: '🏢', activo: true  },
  { to: '/directorio/proveedores', label: 'Proveedores', icon: '🏭', activo: false },
]

const SISTEMA_ITEMS = [
  { to: '/compras',     label: 'Compras',     icon: '🛒', activo: false },
  { to: '/facturacion', label: 'Facturación', icon: '💳', activo: false },
]

// Solo visible si el role del usuario logueado es DUEÑO. Se inyecta como
// grupo aparte arriba de Sistema.
const ADMIN_ITEMS = [
  { to: '/usuarios', label: 'Usuarios', icon: '👥', activo: true },
]

function useTema() {
  const [tema, setTema] = useState(() => localStorage.getItem('fs-tema') || 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema === 'light' ? 'light' : '')
    localStorage.setItem('fs-tema', tema)
  }, [tema])
  const toggle = () => setTema(t => t === 'dark' ? 'light' : 'dark')
  return { tema, toggle }
}

function NavGroup({ label, items, collapsed }) {
  return (
    <div className={styles.navGroup}>
      {label && !collapsed && <span className={styles.navGroupLabel}>{label}</span>}
      {items.map(item => (
        <NavLink key={item.to} to={item.to}
          end={item.end}
          /* title siempre presente: aparece como tooltip nativo cuando el
             sidebar está colapsado manualmente (state `collapsed`) o por
             el responsive a media pantalla (<1024px) que oculta las
             labels via CSS sin cambiar el state. En desktop full el label
             ya está visible, el tooltip extra no molesta. */
          title={item.label}
          onClick={e => !item.activo && e.preventDefault()}
          className={({ isActive }) =>
            [styles.navItem, isActive && styles.active, !item.activo && styles.disabled]
              .filter(Boolean).join(' ')
          }>
          <span className={styles.navIcon}>{item.icon}</span>
          {!collapsed && (
            <span className={styles.navLabel}>
              {item.label}
              {!item.activo && <span className={styles.soon}>pronto</span>}
            </span>
          )}
        </NavLink>
      ))}
    </div>
  )
}

// Iniciales de un nombre para el avatar circular.
// "Renzo Campisi" → "RC", "Juan" → "J", "" → "?"
function iniciales(nombre) {
  if (!nombre?.trim()) return '?'
  const partes = nombre.trim().split(/\s+/).slice(0, 2)
  return partes.map(p => p[0]?.toUpperCase() || '').join('')
}

// Menú del usuario en el topbar: avatar + nombre, click despliega
// dropdown con "Mi perfil" + "Cerrar sesión". Cierra con click afuera.
function UserMenu() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (ev) => {
      if (menuRef.current && !menuRef.current.contains(ev.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!profile) return null

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.userMenu} ref={menuRef}>
      <button className={styles.userBtn} onClick={() => setOpen(o => !o)}>
        <span className={styles.avatar}>{iniciales(profile.nombre)}</span>
        <span className={styles.userInfo}>
          <span className={styles.userName}>{profile.nombre}</span>
          <span className={styles.userRole}>{ROLE_LABELS[profile.role] || profile.role}</span>
        </span>
        <span className={styles.userCaret}>▾</span>
      </button>
      {open && (
        <div className={styles.userDropdown}>
          <button className={styles.userDropdownItem}
            onClick={() => { setOpen(false); navigate('/perfil') }}>
            <span>👤</span> Mi perfil
          </button>
          <div className={styles.userDropdownSep} />
          <button className={styles.userDropdownItem} onClick={handleLogout}>
            <span>🚪</span> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { tema, toggle } = useTema()
  const { role } = useAuth()
  const location = useLocation()

  // Mantener `enDirectorio` para futuro toggle expand/collapse del grupo.
  // eslint-disable-next-line no-unused-vars
  const enDirectorio = location.pathname.startsWith('/directorio')

  return (
    <div className={`${styles.shell} ${collapsed ? styles.collapsed : ''}`}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.logo}>{collapsed ? 'FS' : 'FieldStock'}</span>
          {!collapsed && <span className={styles.logoTag}>AI</span>}
        </div>

        <nav className={styles.nav}>

          {/* Inicio (dashboard) */}
          <NavGroup label={null} items={INICIO_ITEMS} collapsed={collapsed} />

          {/* Depósito */}
          <NavGroup label="Depósito" items={DEPOSITO_ITEMS} collapsed={collapsed} />

          {/* Operativo */}
          <NavGroup label={null} items={OPERATIVO_ITEMS} collapsed={collapsed} />

          {/* Directorio */}
          <NavGroup label="Directorio" items={DIRECTORIO_ITEMS} collapsed={collapsed} />

          {/* Administración — solo DUEÑO o ADMIN */}
          {esDueño(role) && (
            <NavGroup label="Administración" items={ADMIN_ITEMS} collapsed={collapsed} />
          )}

          {/* Sistema */}
          <NavGroup label="Sistema" items={SISTEMA_ITEMS} collapsed={collapsed} />

          {/* Panel IA — suelto, siempre visible */}
          {!collapsed && <div className={styles.navSeparator} />}
          <NavLink to="/panel"
            title="Panel IA"
            onClick={e => e.preventDefault()}
            className={({ isActive }) =>
              [styles.navItem, styles.panelIA, isActive && styles.active, styles.disabled]
                .filter(Boolean).join(' ')
            }>
            <span className={styles.navIcon}>✦</span>
            {!collapsed && (
              <span className={styles.navLabel}>
                Panel IA
                <span className={styles.soon}>pronto</span>
              </span>
            )}
          </NavLink>

        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.collapseBtn} onClick={() => setCollapsed(c => !c)}>
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </aside>

      <header className={styles.topbar}>
        {/* Logo en el topbar — visible en mobile (donde el sidebar
            pasa a ser una barra inferior y oculta su propio header).
            En desktop está oculto vía CSS para no duplicar con el del sidebar. */}
        <span className={styles.topbarLogo}>FieldStock <span className={styles.topbarLogoTag}>AI</span></span>
        <div className={styles.topbarRight}>
          <button className={styles.temaBtn} onClick={toggle}
            title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
            {tema === 'dark' ? '☀️' : '🌙'}
          </button>
          <UserMenu />
        </div>
      </header>

      {/* FAB Escanear QR — solo visible en mobile. El sidebar en mobile es
          una barra inferior con scroll horizontal: el item QR puede quedar
          fuera del viewport y obligar a scrollear para encontrarlo. El FAB
          lo hace siempre accesible con un tap, centrado y destacado sobre
          la barra (patrón clásico de apps mobile). En desktop se oculta
          vía CSS — el item del sidebar normal sigue cubriendo el acceso. */}
      <NavLink to="/qr" className={styles.fabQr} title="Escanear QR" aria-label="Escanear QR">
        <span className={styles.fabQrIcon}>▦</span>
      </NavLink>

      <main className={styles.main}><Outlet /></main>
    </div>
  )
}
