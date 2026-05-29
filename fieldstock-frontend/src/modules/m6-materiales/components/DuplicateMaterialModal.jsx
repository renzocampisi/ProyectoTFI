// src/modules/m6-materiales/components/DuplicateMaterialModal.jsx
/**
 * Modal que aparece en el form de "Nuevo material" cuando el backend
 * detecta un material existente con mismo nombre + marca (Word B —
 * "redundancia de datos").
 *
 * Le ofrece al usuario dos opciones:
 *   1. Sumar el stock que iba a cargar al material existente.
 *   2. Cancelar para diferenciar el nombre (ej. agregar marca, tamaño).
 *
 * Mostramos el material existente con todos los datos relevantes (marca,
 * stock actual, unidad) para que el usuario pueda comparar y decidir.
 * Especialmente importante mostrar la UNIDAD — si la unidad difiere
 * (existente="kg", nuevo="unidad"), seguro es otro material y debería
 * cancelar.
 */
import { useState } from 'react'
import styles from './DuplicateMaterialModal.module.css'

export default function DuplicateMaterialModal({
  existente,         // material existente devuelto por checkDuplicate
  cantidadASumar,    // cantidad de stock que iba a cargar en el form
  unidadNueva,       // unidad que ingresó en el form (puede diferir)
  onConfirm,         // () => Promise — el parent llama agregarStock
  onCancel,          // () => void   — cierra el modal, vuelve al form
}) {
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState(null)

  const unidadesCoinciden = existente.unidad === unidadNueva

  const handleConfirm = async () => {
    setProcesando(true); setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err.message)
      setProcesando(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <div className={styles.icon}>⚠️</div>
        <h2 className={styles.title}>Este material ya existe</h2>

        <p className={styles.body}>
          Encontramos un material con el mismo nombre y marca en el catálogo:
        </p>

        <div className={styles.matCard}>
          <div className={styles.matNombre}>{existente.nombre}</div>
          {existente.marca && <div className={styles.matMarca}>{existente.marca}</div>}
          <div className={styles.matStats}>
            <span>Stock actual:</span>
            <strong>{existente.stock_actual} {existente.unidad}</strong>
          </div>
          {existente.descripcion && (
            <div className={styles.matDesc}>{existente.descripcion}</div>
          )}
        </div>

        {!unidadesCoinciden && (
          <div className={styles.warnUnidades}>
            ⚠ Atención: la unidad del existente es <strong>{existente.unidad}</strong> pero
            estás cargando en <strong>{unidadNueva}</strong>. Si son materiales distintos,
            cancelá y diferenciá el nombre.
          </div>
        )}

        <p className={styles.pregunta}>
          ¿Querés sumarle <strong>{cantidadASumar} {existente.unidad}</strong> al stock del existente?
          (quedará en <strong>{Number(existente.stock_actual) + Number(cantidadASumar)} {existente.unidad}</strong>)
        </p>

        {error && <div className={styles.error}>⚠ {error}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost}
            onClick={onCancel} disabled={procesando}>
            No, cambio el nombre
          </button>
          <button type="button" className={styles.btnPrimary}
            onClick={handleConfirm} disabled={procesando}>
            {procesando ? 'Sumando...' : '✓ Sumar al existente'}
          </button>
        </div>
      </div>
    </div>
  )
}
