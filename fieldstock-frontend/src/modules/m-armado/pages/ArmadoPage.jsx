// src/modules/m-armado/pages/ArmadoPage.jsx
/**
 * "Kits de Montaje" — asistente de 4 pasos que arma un presupuesto o un
 * remito a partir de una descripción en lenguaje natural.
 *
 *   1· obra (existente o nueva)  2· destino  3· describir  4· revisar
 *
 * Es una página y no un modal porque la revisión es una tabla de varias
 * líneas editables y necesita el ancho.
 *
 * La IA solo interpreta la frase y matchea contra el catálogo — nunca
 * estima cantidades. Ver _plans/kits-montaje/.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useArmado } from '../hooks/useArmado'
import { ObrasService } from '@modules/m4-obra/services/obras.service'
import { ClientesService, ProveedoresService } from '@modules/m7-directorio/services/directorio.service'
import { MaterialesService } from '@modules/m6-materiales/services/materiales.service'
import styles from './ArmadoPage.module.css'

const EJEMPLO = '3 metros de caño de 2 pulgadas, 2 codos de 90 y una válvula esférica'

const MOTIVO_LABEL = {
  OK:        { texto: 'Sale del depósito',   clase: 'motivoOk' },
  PARCIAL:   { texto: 'Alcanza en parte',    clase: 'motivoParcial' },
  SIN_STOCK: { texto: 'Sin stock',           clase: 'motivoFalta' },
  SIN_MATCH: { texto: 'No está en catálogo', clase: 'motivoFalta' },
}

/** Reparte una cantidad entre lo que hay en depósito y lo que hay que comprar. */
function repartir(cantidad, stockActual, tieneMaterial) {
  const cant = Number(cantidad) || 0
  if (!tieneMaterial) return { alRemito: 0, aComprar: cant, motivo: 'SIN_MATCH' }
  const stock = Number(stockActual) || 0
  if (stock <= 0)      return { alRemito: 0, aComprar: cant, motivo: 'SIN_STOCK' }
  if (stock >= cant)   return { alRemito: cant, aComprar: 0, motivo: 'OK' }
  return { alRemito: stock, aComprar: cant - stock, motivo: 'PARCIAL' }
}

/** Buscador de materiales del catálogo, para reasignar una línea a mano. */
function BuscadorMaterial({ onElegir }) {
  const [query,      setQuery]      = useState('')
  const [resultados, setResultados] = useState([])
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResultados([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await MaterialesService.getAll({ q: query.trim() })
        setResultados(Array.isArray(data) ? data.slice(0, 6) : [])
      } catch { setResultados([]) }
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  return (
    <div className={styles.buscador}>
      <input type="text" className={styles.inputChico} placeholder="Buscar en el catálogo..."
        value={query} onChange={e => setQuery(e.target.value)} />
      {resultados.length > 0 && (
        <ul className={styles.buscadorResultados}>
          {resultados.map(m => (
            <li key={m.id}>
              <button type="button" onClick={() => { onElegir(m); setQuery(''); setResultados([]) }}>
                {m.nombre}{m.marca ? ` (${m.marca})` : ''} — stock {m.stock_actual} {m.unidad}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ArmadoPage() {
  const navigate = useNavigate()
  const a = useArmado()

  const [obras,       setObras]       = useState([])
  const [clientes,    setClientes]    = useState([])
  const [proveedores, setProveedores] = useState([])
  const [modoObra,    setModoObra]    = useState('existente')
  const [formObra,    setFormObra]    = useState({ nombre: '', direccion: '', clienteId: '' })

  useEffect(() => {
    ObrasService.getAll().then(d => setObras(Array.isArray(d) ? d : [])).catch(() => {})
    ClientesService.getAll().then(d => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // Los proveedores recién hacen falta si hay faltantes que comprar.
  useEffect(() => {
    if (!a.hayFaltantes || proveedores.length) return
    ProveedoresService.getAll().then(d => setProveedores(Array.isArray(d) ? d : [])).catch(() => {})
  }, [a.hayFaltantes, proveedores.length])

  // ── Dictado por voz ──────────────────────────────────────────
  // API nativa del navegador: anda en Chrome/Android, no en todos. Si no
  // está, el botón no se muestra y escribir sigue funcionando igual.
  const [dictando, setDictando] = useState(false)
  const recognitionRef = useRef(null)
  const hayDictado = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  const toggleDictado = useCallback(() => {
    if (dictando) { recognitionRef.current?.stop(); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'es-AR'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (ev) => {
      const dicho = Array.from(ev.results).map(r => r[0].transcript).join(' ')
      a.setTexto(dicho)
    }
    rec.onend   = () => setDictando(false)
    rec.onerror = () => setDictando(false)
    recognitionRef.current = rec
    rec.start()
    setDictando(true)
  }, [dictando, a])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const obraElegida = a.obraId
    ? obras.find(o => o.id === a.obraId)
    : (a.obraNueva ? { nombre: a.obraNueva.nombre } : null)

  const continuarDesdeObra = () => {
    if (modoObra === 'existente') {
      if (!a.obraId) return
    } else {
      if (!formObra.nombre.trim()) return
      a.elegirObraNueva({ ...formObra, clienteId: formObra.clienteId || null })
    }
    a.volverA('destino')
  }

  const cambiarCantidad = (linea, valor) => {
    const cambios = { cantidad: valor }
    if (a.destino === 'REMITO') {
      Object.assign(cambios, repartir(valor, linea.stockActual, linea.modo === 'catalogo' && !!linea.materialId))
    }
    a.actualizarLinea(linea.id, cambios)
  }

  const elegirMaterial = (linea, material) => {
    const cambios = {
      modo: 'catalogo', materialId: material.id,
      materialNombre: material.nombre, stockActual: material.stock_actual,
      unidad: material.unidad || linea.unidad,
    }
    if (a.destino === 'REMITO') {
      Object.assign(cambios, repartir(linea.cantidad, material.stock_actual, true))
    }
    a.actualizarLinea(linea.id, cambios)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Kits de Montaje</h1>
          <p className={styles.subtitle}>
            Describí el tramo y el sistema arma el desglose contra tu catálogo.
          </p>
        </div>
      </header>

      {/* ── Indicador de pasos ──────────────────────────────── */}
      <ol className={styles.pasos}>
        {[
          { id: 'obra',      label: 'Obra' },
          { id: 'destino',   label: 'Destino' },
          { id: 'describir', label: 'Describir' },
          { id: 'revision',  label: 'Revisar' },
        ].map((p, i) => {
          const orden = ['obra', 'destino', 'describir', 'interpretando', 'revision', 'confirmando', 'exito']
          const actualIdx = orden.indexOf(a.paso)
          const propioIdx = orden.indexOf(p.id)
          const estado = actualIdx > propioIdx ? styles.pasoHecho
            : actualIdx === propioIdx ? styles.pasoActual : ''
          return (
            <li key={p.id} className={`${styles.paso} ${estado}`}>
              <span className={styles.pasoNum}>{i + 1}</span> {p.label}
            </li>
          )
        })}
      </ol>

      {a.error && <div className={styles.errorBanner}>⚠ {a.error}</div>}

      {/* ── Paso 1: obra ────────────────────────────────────── */}
      {a.paso === 'obra' && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>¿Para qué obra es?</h2>
          <div className={styles.tabs}>
            <button type="button"
              className={`${styles.tab} ${modoObra === 'existente' ? styles.tabActivo : ''}`}
              onClick={() => setModoObra('existente')}>
              Obra existente
            </button>
            <button type="button"
              className={`${styles.tab} ${modoObra === 'nueva' ? styles.tabActivo : ''}`}
              onClick={() => setModoObra('nueva')}>
              Obra nueva
            </button>
          </div>

          {modoObra === 'existente' ? (
            <select className={styles.input} value={a.obraId}
              onChange={e => a.elegirObraExistente(e.target.value)}>
              <option value="">— Elegí una obra —</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>
                  {o.nombre}{o.cliente ? ` · ${o.cliente}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <div className={styles.formGrid}>
              <label className={styles.campo}>
                <span className={styles.campoLabel}>Nombre de la obra *</span>
                <input type="text" className={styles.input} placeholder="Ej: Planta Norte"
                  value={formObra.nombre}
                  onChange={e => setFormObra(f => ({ ...f, nombre: e.target.value }))} />
              </label>
              <label className={styles.campo}>
                <span className={styles.campoLabel}>Dirección</span>
                <input type="text" className={styles.input} placeholder="Ej: Ruta 9 km 3"
                  value={formObra.direccion}
                  onChange={e => setFormObra(f => ({ ...f, direccion: e.target.value }))} />
              </label>
              <label className={styles.campo}>
                <span className={styles.campoLabel}>Cliente</span>
                <select className={styles.input} value={formObra.clienteId}
                  onChange={e => setFormObra(f => ({ ...f, clienteId: e.target.value }))}>
                  <option value="">— Sin cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className={styles.acciones}>
            <button type="button" className={styles.btnPrimary} onClick={continuarDesdeObra}
              disabled={modoObra === 'existente' ? !a.obraId : !formObra.nombre.trim()}>
              Continuar
            </button>
          </div>
        </section>
      )}

      {/* ── Paso 2: destino ─────────────────────────────────── */}
      {a.paso === 'destino' && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>¿Qué querés armar?</h2>
          <p className={styles.cardHint}>Obra: <strong>{obraElegida?.nombre}</strong></p>
          <div className={styles.opciones}>
            <button type="button" className={styles.opcion} onClick={() => a.elegirDestino('PRESUPUESTO')}>
              <span className={styles.opcionIcono}>📋</span>
              <span className={styles.opcionTitulo}>Presupuesto</span>
              <span className={styles.opcionTexto}>
                Para cotizar antes de mover material. Cuando lo aprobás, el
                remito se genera solo con estos materiales.
              </span>
            </button>
            <button type="button" className={styles.opcion} onClick={() => a.elegirDestino('REMITO')}>
              <span className={styles.opcionIcono}>🚚</span>
              <span className={styles.opcionTitulo}>Remito</span>
              <span className={styles.opcionTexto}>
                El material sale ya. Lo que no haya en depósito queda
                separado para comprar.
              </span>
            </button>
          </div>
          <div className={styles.acciones}>
            <button type="button" className={styles.btnGhost} onClick={() => a.volverA('obra')}>
              ← Volver
            </button>
          </div>
        </section>
      )}

      {/* ── Paso 3: describir ───────────────────────────────── */}
      {(a.paso === 'describir' || a.paso === 'interpretando') && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Describí lo que necesitás</h2>
          <p className={styles.cardHint}>
            Poné las cantidades vos — el sistema no las inventa. Ejemplo:
            <em> "{EJEMPLO}"</em>
          </p>
          <textarea className={styles.textarea} rows={4}
            placeholder={EJEMPLO}
            value={a.texto} onChange={e => a.setTexto(e.target.value)}
            disabled={a.paso === 'interpretando'} />

          <div className={styles.acciones}>
            <button type="button" className={styles.btnGhost}
              onClick={() => a.volverA('destino')} disabled={a.paso === 'interpretando'}>
              ← Volver
            </button>
            {hayDictado && (
              <button type="button"
                className={`${styles.btnGhost} ${dictando ? styles.btnDictando : ''}`}
                onClick={toggleDictado} disabled={a.paso === 'interpretando'}>
                {dictando ? '⏹ Detener' : '🎙 Dictar'}
              </button>
            )}
            <button type="button" className={styles.btnPrimary}
              onClick={a.interpretar}
              disabled={!a.texto.trim() || a.paso === 'interpretando'}>
              {a.paso === 'interpretando' ? 'Interpretando...' : 'Armar desglose'}
            </button>
          </div>
        </section>
      )}

      {/* ── Paso 4: revisión ────────────────────────────────── */}
      {(a.paso === 'revision' || a.paso === 'confirmando') && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Revisá el desglose</h2>
          <p className={styles.cardHint}>
            Esto entendimos. Corregí lo que haga falta — nada se guarda todavía.
          </p>

          <div className={styles.tablaWrapper}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th></th>
                  <th>Leído</th>
                  <th>Material</th>
                  <th className={styles.thNum}>Cantidad</th>
                  {a.destino === 'REMITO' && <th>Destino</th>}
                </tr>
              </thead>
              <tbody>
                {a.lineas.map(l => (
                  <tr key={l.id} className={l.incluida ? '' : styles.filaExcluida}>
                    <td>
                      <input type="checkbox" checked={l.incluida}
                        onChange={() => a.alternarLinea(l.id)} />
                    </td>
                    <td className={styles.celdaTexto}>
                      <div className={styles.textoOriginal}>{l.textoOriginal}</div>
                      <span className={`${styles.badge} ${styles[`conf_${l.confianza}`]}`}>
                        {l.confianza}
                      </span>
                    </td>
                    <td className={styles.celdaMaterial} data-label="Material">
                      {l.modo === 'catalogo' ? (
                        <>
                          <div className={styles.materialNombre}>{l.materialNombre}</div>
                          <div className={styles.materialMeta}>
                            stock {l.stockActual} {l.unidad}
                            {' · '}
                            <button type="button" className={styles.btnLink}
                              onClick={() => a.actualizarLinea(l.id, { modo: 'buscar' })}>
                              cambiar
                            </button>
                          </div>
                        </>
                      ) : l.modo === 'buscar' ? (
                        <BuscadorMaterial onElegir={m => elegirMaterial(l, m)} />
                      ) : (
                        <div className={styles.materialNuevo}>
                          <input type="text" className={styles.inputChico}
                            placeholder="Nombre del material nuevo"
                            value={l.materialNuevoNombre}
                            onChange={e => a.actualizarLinea(l.id, { materialNuevoNombre: e.target.value })} />
                          <button type="button" className={styles.btnLink}
                            onClick={() => a.actualizarLinea(l.id, { modo: 'buscar' })}>
                            buscar en catálogo
                          </button>
                        </div>
                      )}
                    </td>
                    <td className={styles.celdaNum} data-label="Cantidad">
                      <input type="number" min="0.01" step="any" className={styles.inputNum}
                        value={l.cantidad}
                        onChange={e => cambiarCantidad(l, e.target.value)} />
                      <span className={styles.unidad}>{l.unidad}</span>
                    </td>
                    {a.destino === 'REMITO' && (
                      <td className={styles.celdaDestino} data-label="Destino">
                        <span className={`${styles.badge} ${styles[MOTIVO_LABEL[l.motivo]?.clase || '']}`}>
                          {MOTIVO_LABEL[l.motivo]?.texto || '—'}
                        </span>
                        {Number(l.aComprar) > 0 && Number(l.alRemito) > 0 && (
                          <div className={styles.materialMeta}>
                            {l.alRemito} al remito · {l.aComprar} a comprar
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {a.hayFaltantes && (
            <div className={styles.proveedorBox}>
              <span className={styles.campoLabel}>¿A qué proveedor le comprás lo que falta?</span>
              <select className={styles.input} value={a.proveedorId}
                onChange={e => a.setProveedorId(e.target.value)}>
                <option value="">Decidir después (no crea la orden)</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          )}

          <div className={styles.acciones}>
            <button type="button" className={styles.btnGhost}
              onClick={() => a.volverA('describir')} disabled={a.paso === 'confirmando'}>
              ← Volver
            </button>
            <button type="button" className={styles.btnPrimary}
              onClick={a.confirmar}
              disabled={!a.puedeConfirmar || a.paso === 'confirmando'}>
              {a.paso === 'confirmando' ? 'Guardando...'
                : a.destino === 'PRESUPUESTO' ? 'Crear presupuesto' : 'Crear remito'}
            </button>
          </div>
        </section>
      )}

      {/* ── Éxito ───────────────────────────────────────────── */}
      {a.paso === 'exito' && a.resultado && (
        <section className={styles.card}>
          <div className={styles.exito}>
            <span className={styles.exitoIcono}>✓</span>
            <h2 className={styles.cardTitle}>Listo</h2>
          </div>

          {a.resultado.presupuestoId && (
            <p className={styles.cardHint}>
              Se creó el presupuesto con {a.resultado.insumos} insumo(s). Cuando
              lo apruebes, el remito se genera solo con estos materiales.
            </p>
          )}
          {a.resultado.remitoId && (
            <p className={styles.cardHint}>
              Se creó el remito en BORRADOR con {a.resultado.materialesAlRemito} material(es).
              Acordate de completar el responsable y anexar las herramientas.
            </p>
          )}
          {a.resultado.compraId && (
            <p className={styles.cardHint}>También se creó la orden de compra con los faltantes.</p>
          )}
          {!a.resultado.compraId && a.resultado.faltantes?.length > 0 && (
            <div className={styles.faltantesBox}>
              <strong>Falta comprar (no se creó orden):</strong>
              <ul>
                {a.resultado.faltantes.map((f, i) => (
                  <li key={i}>{f.nombre} — {f.cantidad} {f.unidad}</li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.acciones}>
            <button type="button" className={styles.btnGhost} onClick={() => window.location.reload()}>
              Armar otro
            </button>
            {a.resultado.presupuestoId && (
              <button type="button" className={styles.btnPrimary}
                onClick={() => navigate(`/presupuestos/${a.resultado.presupuestoId}`)}>
                Ver presupuesto
              </button>
            )}
            {a.resultado.remitoId && (
              <button type="button" className={styles.btnPrimary}
                onClick={() => navigate(`/remitos/${a.resultado.remitoId}`)}>
                Ver remito
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
