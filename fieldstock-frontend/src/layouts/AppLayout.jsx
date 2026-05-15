// src/layouts/AppLayout.jsx
import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import styles from './AppLayout.module.css'

const NAV_ITEMS = [
  { to: '/herramientas', label: 'Herramientas', icon: '🔧', activo: true  },
  { to: '/materiales',   label: 'Materiales',   icon: '📦', activo: true  },
  { to: '/obras',        label: 'Obras',        icon: '🏗️', activo: true  },
  { to: '/remitos',      label: 'Remitos',      icon: '📋', activo: true  },
  { to: '/qr',           label: 'Códigos QR',   icon: '⬛', activo: false },
  { to: '/proveedores',  label: 'Proveedores',  icon: '🏭', activo: false },
  { to: '/compras',      label: 'Compras',      icon: '🛒', activo: false },
  { to: '/facturacion',  label: 'Facturación',  icon: '💳', activo: false },
  { to: '/panel',        label: 'Panel IA',     icon: '✦',  activo: false },
]

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`${styles.shell} ${collapsed ? styles.collapsed : ''}`}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.logo}>{collapsed ? 'FS' : 'FieldStock'}</span>
          {!collapsed && <span className={styles.logoTag}>AI</span>}
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to}
              title={collapsed ? item.label : undefined}
              onClick={e => !item.activo && e.preventDefault()}
              className={({ isActive }) =>
                [styles.navItem, isActive && styles.active, !item.activo && styles.disabled]
                  .filter(Boolean).join(' ')
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {!collapsed && (
                <span className={styles.navLabel}>
                  {item.label}
                  {!item.activo && <span className={styles.soon}>pronto</span>}
                </span>
              )}
            </NavLink>
          ))}
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
          <span className={styles.userEmail}>modo desarrollo</span>
        </div>
      </header>
      <main className={styles.main}><Outlet /></main>
    </div>
  )
}
