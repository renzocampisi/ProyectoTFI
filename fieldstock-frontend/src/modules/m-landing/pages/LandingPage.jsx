// src/modules/m-landing/pages/LandingPage.jsx
/**
 * Landing pública — lo que ve alguien que todavía no inició sesión ni
 * pagó. Ruta pública dedicada (/bienvenida, ver AppRouter.jsx) para no
 * tocar el comportamiento actual de "/" (Dashboard autenticado).
 *
 * Usa el mismo sistema de diseño que el resto de la app (variables de
 * src/styles/global.css, tipografía DM Sans, el mismo hook de tema que
 * AppLayout) para que sea una extensión visual de la app real, no una
 * pieza de marketing aparte con su propia paleta.
 */
import { useNavigate } from 'react-router-dom'
import { LuSun, LuMoon } from 'react-icons/lu'
import { useTema } from '@shared/hooks/useTema'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  const navigate = useNavigate()
  const { tema, toggle } = useTema()

  return (
    <div className={styles.page}>

      <nav className={styles.nav}>
        <div className={styles.navRow}>
          <div className={styles.brand}>
            <img src="/favicon.svg" alt="" className={styles.brandIcon} />
            FieldStock <span className={styles.brandTag}>AI</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#producto">Producto</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#precios">Precios</a>
          </div>
          <div className={styles.navActions}>
            <button className={styles.temaBtn} onClick={toggle}
              title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
              {tema === 'dark' ? <LuSun size={17} color="#fbbf24" /> : <LuMoon size={17} color="#6366f1" />}
            </button>
            <button className={styles.btnGhost} onClick={() => navigate('/login')}>
              Iniciar<span className={styles.navBtnExtra}> sesión</span>
            </button>
            <button className={styles.btnPrimary} onClick={() => navigate('/registro')}>
              Probar<span className={styles.navBtnExtra}> gratis</span>
            </button>
          </div>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Software para obra · sin planillas</span>
            <h1 className={styles.headline}>Control total<br />de cada herramienta.</h1>
            <p className={styles.heroSub}>
              FieldStock&nbsp;AI le pone un código QR a cada herramienta del galpón: escaneás
              y sabés al instante dónde está, quién la tiene y cuándo tiene que volver.
            </p>
            <div className={styles.heroCtas}>
              <button className={styles.btnPrimaryLg} onClick={() => navigate('/registro')}>Probar gratis 14 días</button>
              <button className={styles.btnGhostLg} onClick={() => navigate('/login')}>Iniciar sesión →</button>
            </div>
            <p className={styles.heroFine}>SIN TARJETA · CONFIGURÁS TU PRIMER GALPÓN EN 10 MINUTOS</p>
          </div>

          <div className={styles.mock} aria-hidden="true">
            <div className={styles.mockBar}>
              <span className={styles.mockDot} style={{ background: 'var(--color-primary)' }} />
              <span className={styles.mockDot} style={{ background: 'var(--color-warning)' }} />
              <span className={styles.mockDot} style={{ background: 'var(--color-info)' }} />
              <span className={styles.mockTitle}>fieldstock.ai/herramientas</span>
            </div>
            <div className={styles.mockBody}>
              <div className={styles.mockHead}>
                <h4>Herramientas</h4>
                <span>128 activas</span>
              </div>

              <ToolRow patron={0} nombre="Soldadora MIG 200A" codigo="FS-SOL-8F21" estado="EN_OBRA" />
              <ToolRow patron={1} nombre="Taladro Bosch GSB 13 RE" codigo="FS-TAL-3C09" estado="DISPONIBLE" />
              <ToolRow patron={2} nombre="Amoladora angular 115mm" codigo="FS-AMO-D77A" estado="MANTENIMIENTO" />
            </div>
          </div>
        </div>
      </header>

      <section id="como-funciona" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Cómo funciona</span>
          <h2 className={styles.h2}>Tres escaneos. Cero planillas.</h2>
          <p className={styles.sectionLead}>
            El mismo remito de siempre, pero digital: cada escaneo con el celular actualiza
            el estado de la herramienta para toda la empresa, en el momento.
          </p>
        </div>
        <div className={styles.steps}>
          <Step num="01 · Salida" pct={100} titulo="Sale del galpón"
            texto="Se escanea el QR de cada herramienta al armar el remito. Queda registrada la obra, la fecha y quién se la lleva." />
          <Step num="02 · En obra" pct={66} titulo="Vive en la obra"
            texto={'Aparece como "en obra" para toda la empresa. Nadie más la busca por WhatsApp ni la da por perdida.'} />
          <Step num="03 · Retorno" pct={34} titulo="Vuelve y queda lista"
            texto="Se escanea al llegar al galpón: stock repuesto, mantenimiento marcado si volvió rota, disponible para la próxima obra." />
        </div>
      </section>

      <section id="producto" className={styles.board}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Producto</span>
          <h2 className={styles.h2}>Todo lo que hoy vive en un cuaderno.</h2>
          <p className={styles.sectionLead}>
            Cada tarjeta es una función real de FieldStock AI — pensada para el ida y vuelta
            entre galpón y obra, no para una oficina.
          </p>
        </div>
        <div className={styles.tagGrid}>
          <Tag label="QR" titulo="QR en cada herramienta"
            texto="Código único e inmutable por herramienta. Se imprime, se pega, se escanea con cualquier celular." />
          <Tag label="Remito" titulo="Remitos digitales"
            texto="Firma, geolocalización de llegada y PDF automático. Se acabó el remito de papel perdido en la guantera." />
          <Tag label="Kit" titulo="Kits armados"
            texto={'"Kit soldadura" = máquina + electrodos + careta, en un clic. Si falta algo, avisa antes de salir del galpón.'} />
          <Tag label="Stock" titulo="Reposición predictiva"
            texto="Calcula cuánto vas a necesitar según el consumo real de los últimos 90 días. Avisa antes de que falte." />
          <Tag label="Reserva" titulo="Reservas con fecha"
            texto="Reservá una herramienta para la obra que arranca el mes que viene, sin bloquearla para la de hoy." />
          <Tag label="IA" titulo="Panel con IA"
            texto="Armá un presupuesto charlando por chat: la IA busca precios, arma los ítems y lo deja listo para aprobar." />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead} style={{ marginBottom: 28 }}>
          <span className={styles.eyebrow}>Cobertura</span>
          <h2 className={styles.h2}>Un sistema, toda la operación.</h2>
        </div>
        <div className={styles.modStrip}>
          {['Inventario', 'Escaneo QR', 'Obras', 'Remitos', 'Materiales', 'Directorio', 'Estanterías', 'Kits', 'Panel con IA'].map(m => (
            <span key={m} className={styles.modChip}>{m}</span>
          ))}
        </div>
      </section>

      <section id="precios" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Precios</span>
          <h2 className={styles.h2}>Un plan por el tamaño de tu galpón, no por promesas.</h2>
          <p className={styles.sectionLead}>
            Todos los planes incluyen escaneo QR ilimitado y remitos digitales. Cambiás de
            plan cuando la operación crece.
          </p>
        </div>
        <div className={styles.plans}>
          <Plan nombre="Básico" desc="Para un galpón chico que recién empieza a ordenar el inventario."
            precio="29.99" items={['Herramientas, materiales, remitos y obras', 'Escaneo QR ilimitado', 'Hasta 3 usuarios']}
            cta="Empezar" onClick={() => navigate('/registro')} />
          <Plan destacado nombre="Pro" desc="Para constructoras con varias obras activas al mismo tiempo."
            precio="79.99" items={['Todo lo de Básico, usuarios ilimitados', 'Kits, reservas y reposición predictiva', 'Compras, presupuestos y Panel con IA']}
            cta="Empezar gratis" onClick={() => navigate('/registro')} />
          <Plan nombre="Pro + Seguimiento" desc="Para quienes necesitan controlar sus herramientas más valiosas con rastreo GPS."
            precio="109.99" items={['Todo lo de Pro', 'Marcá herramientas "Importante" con rastreador GPS', 'Prioridad en soporte']}
            cta="Empezar gratis" onClick={() => navigate('/registro')} />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.cta}>
          <h2 className={styles.ctaH2}>El control que<br />tu obra necesita.</h2>
          <p className={styles.ctaSub}>Probalo gratis 14 días. Sin tarjeta, sin instalar nada en la obra.</p>
          <div className={styles.ctaRow}>
            <button className={styles.btnPrimaryLg} onClick={() => navigate('/registro')}>Probar gratis 14 días</button>
            <button className={styles.btnGhostOnDark} onClick={() => navigate('/login')}>Iniciar sesión</button>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footRow}>
          <div className={styles.footGroup}>
            <div className={styles.footBrand}>
              <img src="/favicon.svg" alt="" className={styles.footMark} />
              FieldStock AI<sup className={styles.reg}>®</sup>
            </div>
            <p className={styles.footAuthor}>Renzo Campisi</p>
          </div>
          <div className={styles.footLinks}>
            <a href="#producto">Producto</a>
            <a href="#precios">Precios</a>
            <button className={styles.footLinkBtn} onClick={() => navigate('/login')}>Ingresar</button>
          </div>
          <button className={styles.btnContact} onClick={() => navigate('/login')}>Contacto</button>
        </div>
        <p className={styles.footNote}>FIELDSTOCK AI® © 2026 — HECHO PARA OBRAS QUE NO SE DETIENEN</p>
      </footer>
    </div>
  )
}

// Patrones fijos (no aleatorios) para que el mini-QR decorativo no
// "parpadee" en cada re-render (ej. al togglear el tema).
const QR_PATRONES = [
  [1,1,1,0,1,1,0,1,1,1,1,0,0,0,1,1,1,0,1,1,1,0,1,1,1],
  [1,0,1,1,0,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,1,1,0,1,1],
  [0,1,1,0,1,1,0,0,1,1,1,1,0,1,1,1,0,1,1,0,1,1,1,1,0],
]

function ToolRow({ nombre, codigo, estado, patron = 0 }) {
  const cls = {
    EN_OBRA: styles.pillObra,
    DISPONIBLE: styles.pillDisp,
    MANTENIMIENTO: styles.pillMant,
  }[estado]
  return (
    <div className={styles.toolRow}>
      <span className={styles.qrIcon}>
        {QR_PATRONES[patron].map((on, i) => (
          <i key={i} className={on ? '' : styles.qrOff} />
        ))}
      </span>
      <div className={styles.toolInfo}>
        <div className={styles.toolNombre}>{nombre}</div>
        <div className={styles.toolCodigo}>{codigo}</div>
      </div>
      <span className={`${styles.pill} ${cls}`}>{estado}</span>
    </div>
  )
}

function Step({ num, pct, titulo, texto }) {
  return (
    <div className={styles.step}>
      <div className={styles.stepTrack}><i style={{ width: `${pct}%` }} /></div>
      <span className={styles.stepNum}>{num}</span>
      <h3 className={styles.stepH3}>{titulo}</h3>
      <p className={styles.stepP}>{texto}</p>
    </div>
  )
}

function Tag({ label, titulo, texto }) {
  return (
    <div className={styles.tag}>
      <span className={styles.tagLabel}>TAG · {label}</span>
      <h3 className={styles.tagH3}>{titulo}</h3>
      <p className={styles.tagP}>{texto}</p>
    </div>
  )
}

function Plan({ destacado, nombre, desc, precio, items, cta, onClick }) {
  const esNumero = /^\d+(\.\d+)?$/.test(precio)
  return (
    <div className={`${styles.plan} ${destacado ? styles.planHi : ''}`}>
      {destacado && <span className={styles.planBadge}>Más elegido</span>}
      <div className={styles.planNombre}>{nombre}</div>
      <p className={styles.planDesc}>{desc}</p>
      <div className={styles.planPrecio}>
        {esNumero ? <><b>{precio}</b><span>USD / mes</span></> : <b>{precio}</b>}
      </div>
      <ul className={styles.planList}>
        {items.map(i => <li key={i}>{i}</li>)}
      </ul>
      <button className={destacado ? styles.btnPrimaryBlock : styles.btnGhostBlock} onClick={onClick}>{cta}</button>
    </div>
  )
}
