// src/layouts/AppLayout.jsx
import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import styles from './AppLayout.module.css'

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

export default function AppLayout() {
  const [collapsed,   setCollapsed]   = useState(false)
  const [dirExpanded, setDirExpanded] = useState(false)
  const { tema, toggle } = useTema()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname.startsWith('/directorio')) setDirExpanded(true)
  }, [location.pathname])

  const enDirectorio = location.pathname.startsWith('/directorio')

  return (
    <div className={`${styles.shell} ${collapsed ? styles.collapsed : ''}`}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.logo}>{collapsed ? 'FS' : 'FieldStock'}</span>
          {!collapsed && <span className={styles.logoTag}>AI</span>}
        </div>

        <nav className={styles.nav}>

          {/* Depósito */}
          <NavGroup label="Depósito" items={DEPOSITO_ITEMS} collapsed={collapsed} />

          {/* Operativo */}
          <NavGroup label={null} items={OPERATIVO_ITEMS} collapsed={collapsed} />

          {/* Directorio */}
<NavGroup label="Directorio" items={DIRECTORIO_ITEMS} collapsed={collapsed} />

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
          <span className={styles.userEmail}>modo desarrollo</span>
        </div>
      </header>

      <main className={styles.main}><Outlet /></main>
    </div>
  )
}
