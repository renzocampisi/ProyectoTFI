// src/modules/m-config/pages/ConfigPage.jsx
/**
 * Página de configuración global del sistema. Acceso restringido a
 * DUEÑO y ADMIN (montada en AppRouter con RequireRole).
 *
 * Por ahora expone un único setting: % de ganancia default que se
 * usa al crear un nuevo presupuesto. Pensada para crecer (otros
 * settings futuros sin tocar la estructura).
 */
import { useState, useEffect } from 'react'
import { ConfigService } from '@modules/m-presupuestos/services/presupuestos.service'
import styles from './ConfigPage.module.css'

export default function ConfigPage() {
  const [pctGanancia, setPctGanancia] = useState('')
  const [pctOriginal, setPctOriginal] = useState('')
  const [loading,     setLoading]     = useState(true)
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
      .finally(() => setLoading(false))
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

  if (loading) return (
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
