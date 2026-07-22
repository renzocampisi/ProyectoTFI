// src/modules/m-config/pages/ConfigPage.jsx
/**
 * Página de configuración global del sistema. Acceso restringido a
 * DUEÑO y ADMIN (montada en AppRouter con RequireRole).
 *
 * Expone dos settings, cada uno con su propio <form> independiente
 * (mismo criterio que PerfilPage: datos + password en forms separados
 * para que un submit no dispare el otro):
 *   - Empresa: nombre/teléfono/dirección/email — el nombre se muestra
 *     al lado de "FieldStock AI" en el sidebar/topbar (ver useEmpresa).
 *   - Presupuestos: % de ganancia default.
 */
import { useState, useEffect } from 'react'
import { ConfigService } from '@modules/m-presupuestos/services/presupuestos.service'
import { EmpresaService } from '../services/empresa.service'
import { useEmpresa } from '@shared/hooks/useEmpresa'
import styles from './ConfigPage.module.css'

export default function ConfigPage() {
  // ── Empresa ──────────────────────────────────────────────────
  const { empresa, loading: loadingEmpresa, refetch: refetchEmpresa } = useEmpresa()
  const [form,   setForm]   = useState({ nombre: '', telefono: '', direccion: '', email: '' })
  const [savingEmpresa, setSavingEmpresa] = useState(false)
  const [errEmpresa,    setErrEmpresa]    = useState(null)
  const [savedEmpresa,  setSavedEmpresa]  = useState(false)

  useEffect(() => {
    if (empresa) {
      setForm({
        nombre:    empresa.nombre    || '',
        telefono:  empresa.telefono  || '',
        direccion: empresa.direccion || '',
        email:     empresa.email     || '',
      })
    }
  }, [empresa])

  const handleSaveEmpresa = async (e) => {
    e.preventDefault()
    if (savingEmpresa) return
    if (!form.nombre.trim()) {
      setErrEmpresa('El nombre de la empresa es obligatorio.')
      return
    }
    setSavingEmpresa(true); setErrEmpresa(null); setSavedEmpresa(false)
    try {
      await EmpresaService.set(form)
      await refetchEmpresa()
      setSavedEmpresa(true)
      setTimeout(() => setSavedEmpresa(false), 3000)
    } catch (err) {
      setErrEmpresa(err.message)
    } finally {
      setSavingEmpresa(false)
    }
  }

  // ── Presupuestos ─────────────────────────────────────────────
  const [pctGanancia, setPctGanancia] = useState('')
  const [pctOriginal, setPctOriginal] = useState('')
  const [loadingPct,  setLoadingPct]  = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)
  const [saved,       setSaved]       = useState(false)

  useEffect(() => {
    ConfigService.get('porcentaje_ganancia_default')
      .then(data => {
        const v = data?.value ?? '10'
        setPctGanancia(v); setPctOriginal(v)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoadingPct(false))
  }, [])

  const sinCambios = pctGanancia === pctOriginal

  const handleSave = async (e) => {
    e.preventDefault()
    if (saving || sinCambios) return

    const num = Number(pctGanancia)
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      setError('El % debe estar entre 0 y 100.')
      return
    }

    setSaving(true); setError(null); setSaved(false)
    try {
      await ConfigService.set('porcentaje_ganancia_default', String(num))
      setPctOriginal(pctGanancia)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loadingEmpresa || loadingPct) return (
    <div className={styles.loadingWrapper}>
      <span className={styles.spinner} />Cargando configuración...
    </div>
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Configuración</h1>
        <p className={styles.subtitle}>Ajustes globales del sistema. Solo DUEÑO y ADMIN.</p>
      </header>

      <form className={styles.card} onSubmit={handleSaveEmpresa}>
        <h2 className={styles.cardTitle}>Empresa</h2>
        <p className={styles.cardHint}>
          El nombre aparece al lado de "FieldStock AI" en el menú lateral.
        </p>

        <div className={styles.field}>
          <label htmlFor="empNombre" className={styles.label}>Nombre de la empresa *</label>
          <input id="empNombre" type="text" className={`${styles.input} ${styles.inputFull}`}
            placeholder="Ej: Construcciones Campisi S.A."
            value={form.nombre}
            onChange={e => { setForm(f => ({ ...f, nombre: e.target.value })); setSavedEmpresa(false) }}
            disabled={savingEmpresa} />
        </div>

        <div className={styles.field}>
          <label htmlFor="empTelefono" className={styles.label}>Teléfono</label>
          <input id="empTelefono" type="tel" className={`${styles.input} ${styles.inputFull}`}
            placeholder="+54 9 341 ..."
            value={form.telefono}
            onChange={e => { setForm(f => ({ ...f, telefono: e.target.value })); setSavedEmpresa(false) }}
            disabled={savingEmpresa} />
        </div>

        <div className={styles.field}>
          <label htmlFor="empDireccion" className={styles.label}>Dirección</label>
          <input id="empDireccion" type="text" className={`${styles.input} ${styles.inputFull}`}
            placeholder="Calle, número, ciudad"
            value={form.direccion}
            onChange={e => { setForm(f => ({ ...f, direccion: e.target.value })); setSavedEmpresa(false) }}
            disabled={savingEmpresa} />
        </div>

        <div className={styles.field}>
          <label htmlFor="empEmail" className={styles.label}>Email</label>
          <input id="empEmail" type="email" className={`${styles.input} ${styles.inputFull}`}
            placeholder="contacto@empresa.com"
            value={form.email}
            onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setSavedEmpresa(false) }}
            disabled={savingEmpresa} />
        </div>

        {errEmpresa && <div className={styles.errorBanner}>⚠ {errEmpresa}</div>}
        {savedEmpresa && !errEmpresa && <div className={styles.savedBanner}>✓ Guardado.</div>}

        <div className={styles.actions}>
          <button type="submit" className={styles.btnPrimary} disabled={savingEmpresa}>
            {savingEmpresa ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      <form className={styles.card} onSubmit={handleSave}>
        <h2 className={styles.cardTitle}>Presupuestos</h2>

        <div className={styles.field}>
          <label htmlFor="pct" className={styles.label}>
            % de ganancia por defecto
          </label>
          <input id="pct" type="number" min="0" max="100" step="0.5"
            className={styles.input}
            value={pctGanancia}
            onChange={e => { setPctGanancia(e.target.value); setSaved(false) }}
            disabled={saving} />
          <p className={styles.hint}>
            Se aplica como sugerencia inicial al crear un presupuesto nuevo.
            El operador puede ajustarlo por presupuesto.
            El % aplica solo sobre el subtotal de insumos (los costos extra
            como mano de obra o viáticos van sin markup).
          </p>
        </div>

        {error && <div className={styles.errorBanner}>⚠ {error}</div>}
        {saved && !error && <div className={styles.savedBanner}>✓ Guardado.</div>}

        <div className={styles.actions}>
          <button type="submit" className={styles.btnPrimary}
            disabled={saving || sinCambios}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
