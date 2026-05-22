// src/modules/m7-directorio/pages/DirectorioPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { TransportesService, ClientesService } from '../services/directorio.service'
import styles from './DirectorioPage.module.css'

const CAMPOS_TRANSPORTE = [
  { key: 'nombre',   label: 'Nombre',   placeholder: 'Ej: Transportes García S.A.', req: true },
  { key: 'contacto', label: 'Contacto', placeholder: 'Nombre del responsable' },
  { key: 'telefono', label: 'Teléfono', placeholder: '+54 341 000-0000' },
  { key: 'email',    label: 'Email',    placeholder: 'contacto@empresa.com' },
  { key: 'notas',    label: 'Notas',    placeholder: 'Observaciones adicionales' },
]

const CAMPOS_CLIENTE = [
  { key: 'nombre',    label: 'Nombre',    placeholder: 'Ej: Constructora Norte S.A.', req: true },
  { key: 'contacto',  label: 'Contacto',  placeholder: 'Nombre del responsable' },
  { key: 'telefono',  label: 'Teléfono',  placeholder: '+54 341 000-0000' },
  { key: 'email',     label: 'Email',     placeholder: 'contacto@empresa.com' },
  { key: 'direccion', label: 'Dirección', placeholder: 'Dirección principal' },
  { key: 'notas',     label: 'Notas',     placeholder: 'Observaciones adicionales' },
]

function FormModal({ titulo, campos, inicial, onSave, onClose, saving, error }) {
  const [form, setForm] = useState(inicial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{titulo}</h3>
          <button className={styles.btnClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.fields}>
          {campos.map(c => (
            <div key={c.key} className={styles.field}>
              <label className={styles.label}>
                {c.label} {c.req && <span className={styles.req}>*</span>}
              </label>
              <input type="text" className={styles.input}
                placeholder={c.placeholder}
                value={form[c.key] || ''}
                onChange={e => set(c.key, e.target.value)} />
            </div>
          ))}
        </div>
        {error && <p className={styles.error}>⚠ {error}</p>}
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} disabled={saving}
            onClick={() => onSave(form)}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TablaDirectorio({ items, campos, onEdit, onDelete }) {
  if (!items.length) return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>📋</span>
      <p>No hay registros todavía.</p>
    </div>
  )

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {campos.filter(c => c.key !== 'notas').map(c => (
              <th key={c.key}>{c.label}</th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className={styles.row}>
              {campos.filter(c => c.key !== 'notas').map(c => (
                <td key={c.key} className={c.key === 'nombre' ? styles.nombre : styles.celda}>
                  {item[c.key] || '—'}
                </td>
              ))}
              <td className={styles.actions}>
                <button className={styles.btnEdit} onClick={() => onEdit(item)}>✎ Editar</button>
                <button className={styles.btnDelete} onClick={() => onDelete(item)}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DirectorioPage({ tab: tabInicial = 'transportes' }) {
  const [tab,      setTab]      = useState(tabInicial)
  const [busqueda, setBusqueda] = useState('')
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const [showForm,    setShowForm]    = useState(false)
  const [editItem,    setEditItem]    = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [formError,   setFormError]   = useState(null)
  const [confirmDel,  setConfirmDel]  = useState(null)

  const Service = tab === 'transportes' ? TransportesService : ClientesService
  const campos  = tab === 'transportes' ? CAMPOS_TRANSPORTE : CAMPOS_CLIENTE

  const fetchItems = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await Service.getAll({ q: busqueda || undefined })
      setItems(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [tab, busqueda])

  useEffect(() => {
    const t = setTimeout(fetchItems, busqueda ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchItems])

  const handleSave = async (form) => {
    if (!form.nombre?.trim()) { setFormError('El nombre es obligatorio.'); return }
    setSaving(true); setFormError(null)
    try {
      if (editItem) {
        await Service.update(editItem.id, form)
      } else {
        await Service.create(form)
      }
      setShowForm(false); setEditItem(null)
      await fetchItems()
    } catch (err) { setFormError(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirmDel) return
    try {
      await Service.delete(confirmDel.id)
      setConfirmDel(null)
      await fetchItems()
    } catch (err) { setError(err.message) }
  }

  const inicial = campos.reduce((acc, c) => ({ ...acc, [c.key]: '' }), {})

  return (
    <div className={styles.page}>

      {showForm && (
        <FormModal
          titulo={editItem
            ? `Editar ${tab === 'transportes' ? 'transporte' : 'cliente'}`
            : `Nuevo ${tab === 'transportes' ? 'transporte' : 'cliente'}`}
          campos={campos}
          inicial={editItem || inicial}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null); setFormError(null) }}
          saving={saving}
          error={formError}
        />
      )}

      {confirmDel && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>¿Eliminar?</h3>
            <p className={styles.confirmText}>
              Vas a eliminar <strong>{confirmDel.nombre}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className={styles.btnDanger} onClick={handleDelete}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Directorio</h1>
          <p className={styles.subtitle}>Empresas y contactos externos</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => { setEditItem(null); setShowForm(true) }}>
          + Nuevo {tab === 'transportes' ? 'transporte' : 'cliente'}
        </button>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'transportes' ? styles.tabActive : ''}`}
          onClick={() => { setTab('transportes'); setBusqueda('') }}>
          🚚 Transportes
        </button>
        <button className={`${styles.tab} ${tab === 'clientes' ? styles.tabActive : ''}`}
          onClick={() => { setTab('clientes'); setBusqueda('') }}>
          🏢 Clientes
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input type="search" className={styles.searchInput}
            placeholder={`Buscar ${tab === 'transportes' ? 'transporte' : 'cliente'}...`}
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {loading
        ? <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando...</div>
        : <TablaDirectorio
            items={items}
            campos={campos}
            onEdit={item => { setEditItem(item); setShowForm(true) }}
            onDelete={item => setConfirmDel(item)}
          />
      }

    </div>
  )
}
