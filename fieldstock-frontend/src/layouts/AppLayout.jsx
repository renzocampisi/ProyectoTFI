// src/layouts/AppLayout.jsx
import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { ROLES, ROLE_LABELS } from '@shared/constants/roles'
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
          title={collapsed ? item.label : undefined}
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

          {/* Administración — solo si el user es DUEÑO */}
          {role === ROLES.DUEÑO && (
            <NavGroup label="Administración" items={ADMIN_ITEMS} collapsed={collapsed} />
          )}

          {/* Sistema */}
          <NavGroup label="Sistema" items={SISTEMA_ITEMS} collapsed={collapsed} />

          {/* Panel IA — suelto, siempre visible */}
          {!collapsed && <div className={styles.navSeparator} />}
          <NavLink to="/panel"
            title={collapsed ? 'Panel IA' : undefined}
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
        <span />
        <div className={styles.topbarRight}>
          <button className={styles.temaBtn} onClick={toggle}
            title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
            {tema === 'dark' ? '☀️' : '🌙'}
          </button>
          <UserMenu />
        </div>
      </header>

      <main className={styles.main}><Outlet /></main>
    </div>
  )
}
