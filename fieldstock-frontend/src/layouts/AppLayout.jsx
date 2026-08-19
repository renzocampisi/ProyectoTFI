// src/layouts/AppLayout.jsx
import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom'
import {
  LuHouse, LuWrench, LuPackage, LuArchive, LuClipboardList, LuConstruction,
  LuQrCode, LuTruck, LuBuilding2, LuFactory, LuShoppingCart, LuCreditCard,
  LuSparkles, LuUsers, LuSettings, LuSun, LuMoon, LuUser, LuLogOut, LuChevronDown,
  LuRadar,
} from 'react-icons/lu'
import { useAuth } from '@shared/hooks/useAuth'
import { useTema } from '@shared/hooks/useTema'
import { useEmpresa } from '@shared/hooks/useEmpresa'
import { useSuscripcion } from '@modules/m-facturacion/hooks/useSuscripcion'
import { ROLE_LABELS, esDueño, esAdminEstricto } from '@shared/constants/roles'
import NotificacionesBell from '@shared/components/NotificacionesBell'
import DraggableFAB from '@shared/components/DraggableFAB'
import SuscripcionBanner from '@shared/components/SuscripcionBanner'
import styles from './AppLayout.module.css'

// Iconos unificados via react-icons/lu (Lucide). Antes eran emojis que
// renderizaban distinto en cada OS (Windows / macOS / Linux) y en temas
// oscuros perdían contraste (Word B).
const INICIO_ITEMS = [
  { to: '/', label: 'Inicio', icon: LuHouse, activo: true, end: true },
]

const DEPOSITO_ITEMS = [
  { to: '/herramientas', label: 'Herramientas', icon: LuWrench,  activo: true },
  { to: '/materiales',   label: 'Materiales',   icon: LuPackage, activo: true },
  { to: '/estanterias',  label: 'Estanterías',  icon: LuArchive, activo: true },
]

const OPERATIVO_ITEMS = [
  { to: '/remitos', label: 'Remitos',     icon: LuClipboardList, activo: true },
  { to: '/obras',   label: 'Obras',       icon: LuConstruction,  activo: true },
  { to: '/qr',      label: 'Escanear QR', icon: LuQrCode,        activo: true },
]

const DIRECTORIO_ITEMS = [
  { to: '/directorio/transportes', label: 'Transportes', icon: LuTruck,     activo: true },
  { to: '/directorio/clientes',    label: 'Clientes',    icon: LuBuilding2, activo: true },
  { to: '/directorio/proveedores', label: 'Proveedores', icon: LuFactory,   activo: true },
]

const SISTEMA_ITEMS = [
  { to: '/compras',     label: 'Compras',     icon: LuShoppingCart, activo: true },
  { to: '/facturacion', label: 'Facturación', icon: LuCreditCard,   activo: true },
]

// El label del primer ítem depende del rol: el DUEÑO administra a su propio
// equipo ("Empleados"); el ADMIN (dueño del sistema) ve "Usuarios" — a la
// espera de la vista cross-empresa todavía no implementada.
function getAdminItems(role) {
  return [
    { to: '/usuarios', label: esAdminEstricto(role) ? 'Usuarios' : 'Empleados', icon: LuUsers, activo: true },
    // Volvió al sidebar (issue "datos de la empresa"): antes solo tenía el
    // % de ganancia default y no ameritaba un ítem propio; ahora también
    // vive acá el nombre/teléfono/dirección/email de la empresa.
    { to: '/configuracion', label: 'Configuración', icon: LuSettings, activo: true },
  ]
}

// Exclusivo del rol ADMIN (dueño del sistema) — a diferencia de ADMIN_ITEMS
// de arriba, que también ve DUEÑO. Primera vez que la jerarquía se separa
// de verdad (ver roles.js).
const SUPERADMIN_ITEMS = [
  { to: '/admin/control', label: 'Panel de control', icon: LuRadar, activo: true },
]

function NavGroup({ label, items, collapsed }) {
  return (
    <div className={styles.navGroup}>
      {label && !collapsed && <span className={styles.navGroupLabel}>{label}</span>}
      {items.map(item => {
        // item.icon es un componente de react-icons (no un string).
        const Icono = item.icon
        return (
          <NavLink key={item.to} to={item.to}
            end={item.end}
            title={item.label}
            onClick={e => !item.activo && e.preventDefault()}
            className={({ isActive }) =>
              [styles.navItem, isActive && styles.active, !item.activo && styles.disabled]
                .filter(Boolean).join(' ')
            }>
            <span className={styles.navIcon}><Icono size={18} /></span>
            {!collapsed && (
              <span className={styles.navLabel}>
                {item.label}
                {!item.activo && <span className={styles.soon}>pronto</span>}
              </span>
            )}
          </NavLink>
        )
      })}
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
        <span className={styles.userCaret}><LuChevronDown size={14} /></span>
      </button>
      {open && (
        <div className={styles.userDropdown}>
          <button className={styles.userDropdownItem}
            onClick={() => { setOpen(false); navigate('/perfil') }}>
            <LuUser size={16} /> Mi perfil
          </button>
          <div className={styles.userDropdownSep} />
          <button className={styles.userDropdownItem} onClick={handleLogout}>
            <LuLogOut size={16} /> Cerrar sesión
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
  const { empresa } = useEmpresa()
  const { suscripcion } = useSuscripcion()
  const location = useLocation()

  // Mantener `enDirectorio` para futuro toggle expand/collapse del grupo.
  // eslint-disable-next-line no-unused-vars
  const enDirectorio = location.pathname.startsWith('/directorio')

  // Suscripción vencida más allá del período de gracia: se corta el acceso
  // entero salvo la pantalla de Facturación, para que pueda regularizarlo.
  const bloqueada = suscripcion?.estadoEfectivo === 'BLOQUEADA'
  if (bloqueada && location.pathname !== '/facturacion') {
    return <Navigate to="/facturacion" replace />
  }

  return (
    <div className={`${styles.shell} ${collapsed ? styles.collapsed : ''}`}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <img src="/favicon.svg" alt="" className={styles.brandIcon} />
          <span className={styles.brandText}>
            FieldStock <span className={styles.brandTextTag}>AI</span>
          </span>
          {!collapsed && empresa?.nombre && (
            <span className={styles.brandEmpresa}>{empresa.nombre}</span>
          )}
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
            <NavGroup label="Administración" items={getAdminItems(role)} collapsed={collapsed} />
          )}

          {/* Panel de control — exclusivo de ADMIN (dueño del sistema) */}
          {esAdminEstricto(role) && (
            <NavGroup label={null} items={SUPERADMIN_ITEMS} collapsed={collapsed} />
          )}

          {/* Sistema */}
          <NavGroup label="Sistema" items={SISTEMA_ITEMS} collapsed={collapsed} />

          {/* Panel IA — suelto, siempre visible. Va con su propio NavLink
              fuera de NavGroup para poder estilar el icono ✨ destacado. */}
          {!collapsed && <div className={styles.navSeparator} />}
          <NavLink to="/panel"
            title="Panel IA"
            className={({ isActive }) =>
              [styles.navItem, styles.panelIA, isActive && styles.active]
                .filter(Boolean).join(' ')
            }>
            <span className={styles.navIcon}><LuSparkles size={18} /></span>
            {!collapsed && <span className={styles.navLabel}>Panel IA</span>}
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
        <span className={styles.topbarLogo}>
          <img src="/favicon.svg" alt="" className={styles.topbarLogoIcon} />
          FieldStock <span className={styles.topbarLogoTag}>AI</span>
        </span>
        <div className={styles.topbarRight}>
          <NotificacionesBell />
          <button className={styles.temaBtn} onClick={toggle}
            title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
            {tema === 'dark'
              ? <LuSun  size={18} color="#fbbf24" />
              : <LuMoon size={18} color="#6366f1" />}
          </button>
          <UserMenu />
        </div>
      </header>

      {/* FAB Escanear QR — solo visible en mobile/tablet. El user puede
          arrastrarlo a la posición que quiera (persistida en localStorage).
          Default: esquina inferior derecha. En desktop el sidebar lateral
          ya tiene el item "Escanear QR" normal — el FAB no se muestra. */}
      <DraggableFAB />

      <main className={styles.main}>
        <SuscripcionBanner suscripcion={suscripcion} />
        <Outlet />
      </main>
    </div>
  )
}
