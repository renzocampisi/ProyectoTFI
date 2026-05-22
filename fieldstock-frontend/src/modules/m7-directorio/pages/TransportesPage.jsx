// src/modules/m7-directorio/pages/TransportesPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { TransportesService } from '../services/directorio.service'
import styles from './DirectorioPage.module.css'

const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut',
  'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy',
  'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén',
  'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz',
  'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
]

function formatearCuit(valor) {
  const limpio = (valor || '').replace(/\D/g, '').slice(0, 11)
  if (limpio.length <= 2)  return limpio
  if (limpio.length <= 10) return `${limpio.slice(0, 2)}-${limpio.slice(2)}`
  return `${limpio.slice(0, 2)}-${limpio.slice(2, 10)}-${limpio.slice(10)}`
}

function formatearTelefono(valor) {
  const limpio = (valor || '').replace(/\D/g, '')
  if (!limpio) return ''
  if (limpio.startsWith('54') && limpio.length >= 10) {
    const cuerpo = limpio.slice(2)
    const area   = cuerpo.slice(0, 3)
    const num    = cuerpo.slice(3)
    const p1     = num.slice(0, Math.ceil(num.length / 2))
    const p2     = num.slice(Math.ceil(num.length / 2))
    return `+54 ${area} ${p1}${p2 ? '-' + p2 : ''}`
  }
  if (limpio.length <= 4)  return limpio
  if (limpio.length <= 8)  return `${limpio.slice(0, 4)} ${limpio.slice(4)}`
  const area = limpio.slice(0, 4)
  const num  = limpio.slice(4)
  const p1   = num.slice(0, Math.ceil(num.length / 2))
  const p2   = num.slice(Math.ceil(num.length / 2))
  return `${area} ${p1}${p2 ? '-' + p2 : ''}`
}

function FormattedCell({ valor, formatter }) {
  const [copiado, setCopiado] = useState(false)
  if (!valor) return <span>—</span>
  const limpio     = valor.replace(/\D/g, '')
  const formateado = formatter(valor)
  const handleCopy = () => {
    navigator.clipboard.writeText(limpio)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }
  return (
    <span className={styles.cuitCell} onClick={handleCopy} title={`Copiar: ${limpio}`}>
      {formateado}
      <span className={styles.cuitCopy}>{copiado ? '✓' : '⎘'}</span>
    </span>
  )
}

function abrirMapa(item) {
  const partes = [item.direccion, item.localidad, item.provincia].filter(Boolean)
  if (!partes.length) return
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partes.join(', '))}`,
    '_blank', 'noopener'
  )
}

function DireccionCell({ item }) {
  const partes   = [item.direccion, item.localidad, item.provincia].filter(Boolean)
  const tieneDatos = partes.length > 0
  if (!tieneDatos) return <span>—</span>
  return (
    <span className={styles.direccionCell}>
      <span>
        {item.direccion && <span>{item.direccion}</span>}
        {(item.localidad || item.provincia) && (
          <span className={styles.localidadSub}>
            {[item.localidad, item.provincia].filter(Boolean).join(', ')}
          </span>
        )}
      </span>
      <button className={styles.btnMapa} onClick={() => abrirMapa(item)} title="Ver en Google Maps">📍</button>
    </span>
  )
}

const CAMPOS = [
  { key: 'nombre',    label: 'Nombre de la empresa',  placeholder: 'Ej: Transportes García S.A.', req: true  },
  { key: 'telefono',  label: 'Teléfono',               placeholder: '3410000000',                 req: true,  tipo: 'tel'      },
  { key: 'direccion', label: 'Calle y número',          placeholder: 'Ej: Av. San Martín 1250',   req: true  },
  { key: 'localidad', label: 'Localidad',               placeholder: 'Ej: Rosario',               req: true  },
  { key: 'provincia', label: 'Provincia',               placeholder: '',                           req: true,  tipo: 'provincia'},
  { key: 'cuit',      label: 'CUIT / CUIL',            placeholder: 'Sin guiones: 30123456789',   req: false, tipo: 'cuit'     },
  { key: 'email',     label: 'Email',                   placeholder: 'contacto@empresa.com',       req: false },
  { key: 'contacto',  label: 'Contacto / Responsable', placeholder: 'Nombre del responsable',     req: false },
]

function FormModal({ titulo, inicial, onSave, onClose, saving, error }) {
  const [form, setForm] = useState(inicial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const validar = () => CAMPOS.filter(c => c.req).every(c => form[c.key]?.trim())

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{titulo}</h3>
          <button className={styles.btnClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.fields}>
          {CAMPOS.map(c => (
            <div key={c.key} className={styles.field}>
              <label className={styles.label}>
                {c.label}
                {c.req ? <span className={styles.req}> *</span> : <span className={styles.opcional}> (opcional)</span>}
              </label>

              {c.tipo === 'cuit' && (
                <div className={styles.cuitInputWrapper}>
                  <input type="text" inputMode="numeric" className={styles.input}
                    placeholder={c.placeholder} value={form[c.key] || ''} maxLength={11}
                    onChange={e => set(c.key, e.target.value.replace(/\D/g, '').slice(0, 11))} />
                  {form[c.key] && <span className={styles.cuitPreview}>{formatearCuit(form[c.key])}</span>}
                </div>
              )}

              {c.tipo === 'tel' && (
                <div className={styles.cuitInputWrapper}>
                  <input type="text" inputMode="numeric" className={styles.input}
                    placeholder={c.placeholder} value={form[c.key] || ''} maxLength={13}
                    onChange={e => set(c.key, e.target.value.replace(/\D/g, '').slice(0, 13))} />
                  {form[c.key] && <span className={styles.cuitPreview}>{formatearTelefono(form[c.key])}</span>}
                </div>
              )}

              {c.tipo === 'provincia' && (
                <select className={styles.input} value={form[c.key] || ''}
                  onChange={e => set(c.key, e.target.value)}>
                  <option value="">— Seleccioná una provincia —</option>
                  {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}

              {!c.tipo && (
                <input type="text" className={styles.input}
                  placeholder={c.placeholder} value={form[c.key] || ''}
                  onChange={e => set(c.key, e.target.value)} />
              )}
            </div>
          ))}
        </div>
        {error && <p className={styles.error}>⚠ {error}</p>}
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} disabled={saving || !validar()} onClick={() => onSave(form)}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TransportesPage() {
  const [items,      setItems]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [busqueda,   setBusqueda]   = useState('')
  const [showForm,   setShowForm]   = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true); setError(null)
    try { setItems(await TransportesService.getAll({ q: busqueda || undefined })) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [busqueda])

  useEffect(() => {
    const t = setTimeout(fetchItems, busqueda ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchItems])

  const handleSave = async (form) => {
    const faltantes = CAMPOS.filter(c => c.req && !form[c.key]?.trim())
    if (faltantes.length) { setFormError(`Obligatorios: ${faltantes.map(c => c.label).join(', ')}`); return }
    setSaving(true); setFormError(null)
    try {
      if (editItem) await TransportesService.update(editItem.id, form)
      else          await TransportesService.create(form)
      setShowForm(false); setEditItem(null)
      await fetchItems()
    } catch (err) { setFormError(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirmDel) return
    try { await TransportesService.delete(confirmDel.id); setConfirmDel(null); await fetchItems() }
    catch (err) { setError(err.message) }
  }

  const inicial = CAMPOS.reduce((acc, c) => ({ ...acc, [c.key]: '' }), {})

  return (
    <div className={styles.page}>
      {showForm && (
        <FormModal
          titulo={editItem ? 'Editar transporte' : 'Nuevo transporte'}
          inicial={editItem || inicial}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null); setFormError(null) }}
          saving={saving} error={formError} />
      )}

      {confirmDel && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>¿Eliminar transporte?</h3>
            <p className={styles.confirmText}>Vas a eliminar <strong>{confirmDel.nombre}</strong>. Esta acción no se puede deshacer.</p>
            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className={styles.btnDanger} onClick={handleDelete}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>🚚 Transportes</h1>
          <p className={styles.subtitle}>Empresas de transporte disponibles para remitos</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => { setEditItem(null); setShowForm(true) }}>
          + Nuevo transporte
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input type="search" className={styles.searchInput} placeholder="Buscar transporte..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {loading
        ? <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando...</div>
        : items.length === 0
          ? <div className={styles.empty}>
              <span className={styles.emptyIcon}>🚚</span>
              <p>No hay transportes registrados todavía.</p>
              <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>Agregar primer transporte</button>
            </div>
          : <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead><tr>
                  <th>Nombre</th><th>Teléfono</th><th>Dirección</th>
                  <th>CUIT / CUIL</th><th>Email</th><th>Contacto</th><th></th>
                </tr></thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className={styles.row}>
                      <td className={styles.nombre}>{item.nombre}</td>
                      <td className={styles.celda}><FormattedCell valor={item.telefono} formatter={formatearTelefono} /></td>
                      <td className={styles.celda}><DireccionCell item={item} /></td>
                      <td className={styles.celda}><FormattedCell valor={item.cuit} formatter={formatearCuit} /></td>
                      <td className={styles.celda}>{item.email    || '—'}</td>
                      <td className={styles.celda}>{item.contacto || '—'}</td>
                      <td className={styles.actions}>
                        <button className={styles.btnEdit} onClick={() => { setEditItem(item); setShowForm(true) }}>✎ Editar</button>
                        <button className={styles.btnDelete} onClick={() => setConfirmDel(item)}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }
    </div>
  )
}
