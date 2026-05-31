// src/modules/m3-qr/pages/RemitoQRPage.jsx
// Página mobile-first para escaneo del QR de remitos
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@shared/utils/api'
import styles from './RemitoQRPage.module.css'

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const ESTADO_LABEL = {
  CONFIRMADO:          { texto: 'Listo para salir',     color: '#2dd4a0' },
  EN_TRANSITO:         { texto: 'En camino a la obra',  color: '#f5a623' },
  EN_RETORNO:          { texto: 'Listo para volver',    color: '#2dd4a0' },
  EN_TRANSITO_RETORNO: { texto: 'Volviendo al galpón',  color: '#f5a623' },
}

// Mapa estado del remito → acción del responsable al escanear.
// Espejo del backend (ESTADOS_QR_ACCION en remitos.service.js).
const ESTADO_ACCION = {
  CONFIRMADO:          'SALIDA',
  EN_TRANSITO:         'LLEGADA',
  EN_RETORNO:          'SALIDA_OBRA',
  EN_TRANSITO_RETORNO: 'LLEGADA_GALPON',
}

export default function RemitoQRPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [remito,       setRemito]       = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [accion,       setAccion]       = useState(null) // 'SALIDA' | 'LLEGADA'
  const [procesando,   setProcesando]   = useState(false)
  const [showProblema, setShowProblema] = useState(false)
  // Word C + C2: reporte de problema granular por ítem.
  //   - descGeneral: descripción general del incidente (opcional)
  //   - itemsProblema:     { [remitoItemId]:     { descripcion, extraviado } }
  //   - materialesProblema:{ [remitoMaterialId]: { descripcion, extraviado } }
  // La presencia de una key en el objeto = "este ítem tuvo problema".
  // El sub-flag `extraviado` distingue "llegó con problema" (false) vs
  // "no llegó / se perdió" (true). Si TODOS los ítems quedan extraviados,
  // el backend cierra el remito directo en vez de avanzar a EN_OBRA.
  const [descGeneral,         setDescGeneral]         = useState('')
  const [itemsProblema,       setItemsProblema]       = useState({})
  const [materialesProblema,  setMaterialesProblema]  = useState({})

  // Word REMITOS: en SALIDA_OBRA (3er escaneo, EN_RETORNO → EN_TRANSITO_RETORNO)
  // el encargado define qué herramientas vuelven y qué cantidad de cada material.
  // Inicializamos con defaults razonables al cargar el remito:
  //   - Herramientas: VUELVE (lo más común)
  //   - Materiales: cantidad_egreso completa (asumimos "todo vuelve" como default)
  const [retornoItems,      setRetornoItems]      = useState({})  // { [id]: 'VUELVE'|'ROTA'|'PERDIDA'|'QUEDA_EN_OBRA' }
  const [retornoMateriales, setRetornoMateriales] = useState({})  // { [id]: number }

  const [confirmado,   setConfirmado]   = useState(false)
  // Conductor / persona que realiza el traslado. Se pide únicamente en
  // SALIDA (1er escaneo) y queda guardado en el remito para mostrarse
  // después en el PDF y en la llegada.
  const [conductor,    setConductor]    = useState('')

  // Word REMITOS — LLEGADA_GALPON (4to escaneo): el encargado verifica que
  // todo llegó al galpón como se declaró en SALIDA_OBRA. Si hay
  // discrepancias (volvió rota, se perdió en el viaje, cantidad distinta),
  // entra a la pantalla de "reportar problema del galpón" que reusa la
  // misma UI de pills/cantidades, pero pre-cargada con lo declarado.
  const [showProblemaGalpon, setShowProblemaGalpon] = useState(false)
  const [obsRetornoGeneral,  setObsRetornoGeneral]  = useState('')

  useEffect(() => {
    api.get(`/remitos/${id}`)
      .then(data => {
        setRemito(data)
        // Determinar qué acción corresponde según el estado.
        // Cualquier estado no presente en el mapa → no se puede confirmar
        // por QR (el render de abajo muestra mensaje "no requiere
        // confirmación por QR en este momento").
        setAccion(ESTADO_ACCION[data.estado] || null)

        // Pre-cargar defaults para SALIDA_OBRA y también para LLEGADA_GALPON.
        // En SALIDA_OBRA el encargado decide qué vuelve. En LLEGADA_GALPON
        // el encargado verifica/ajusta lo que se declaró antes (si hay
        // discrepancias al descargar). Los items extraviados se omiten en
        // ambos casos — quedaron marcados desde la LLEGADA y no participan
        // del flow de retorno.
        if (data.estado === 'EN_RETORNO' || data.estado === 'EN_TRANSITO_RETORNO') {
          const itDef = {}
          for (const it of (data.items || [])) {
            if (it.extraviado) continue
            // Si el dueño ya cargó algo desde la web (o se cargó en SALIDA_OBRA),
            // lo respetamos como valor por defecto.
            itDef[it.id] = it.estado_retorno || 'VUELVE'
          }
          setRetornoItems(itDef)

          const matDef = {}
          for (const m of (data.materiales || [])) {
            if (m.extraviado) continue
            matDef[m.id] = m.cantidad_retorno != null
              ? Number(m.cantidad_retorno)
              : Number(m.cantidad_egreso ?? 0)
          }
          setRetornoMateriales(matDef)
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleConfirmar = async () => {
    // En SALIDA el conductor es obligatorio. Doble guarda: el botón ya
    // queda disabled, pero validamos también acá por si llega un click
    // duplicado o un autocompletar raro.
    if (accion === 'SALIDA' && !conductor.trim()) {
      setError('Ingresá el nombre del conductor o persona a cargo del traslado.')
      return
    }

    // Armar body según la acción. SALIDA_OBRA lleva los retornos definidos
    // arriba; el resto de acciones van vacías o solo con conductor.
    // LLEGADA_GALPON solo manda body cuando viene desde la pantalla de
    // "reportar problema" (showProblemaGalpon) — el botón "Todo OK" cierra
    // con lo que ya estaba sin tocar nada.
    let body = {}
    if (accion === 'SALIDA') {
      body = { conductor: conductor.trim() }
    } else if (accion === 'SALIDA_OBRA') {
      body = {
        items: Object.entries(retornoItems).map(([remitoItemId, estadoRetorno]) => ({
          remitoItemId, estadoRetorno,
        })),
        materiales: Object.entries(retornoMateriales).map(([remitoMaterialId, cantidadRetorno]) => ({
          remitoMaterialId, cantidadRetorno,
        })),
      }
    } else if (accion === 'LLEGADA_GALPON' && showProblemaGalpon) {
      body = {
        items: Object.entries(retornoItems).map(([remitoItemId, estadoRetorno]) => ({
          remitoItemId, estadoRetorno,
        })),
        materiales: Object.entries(retornoMateriales).map(([remitoMaterialId, cantidadRetorno]) => ({
          remitoMaterialId, cantidadRetorno,
        })),
        observacionRetorno: obsRetornoGeneral.trim() || null,
      }
    }

    setProcesando(true)
    setError(null)
    try {
      await api.post(`/remitos/${id}/confirmar-escaneo`, body)
      setConfirmado(true)
    } catch (err) { setError(err.message) }
    finally { setProcesando(false) }
  }

  // Helpers para marcar/desmarcar ítems y editar su descripción/extravío
  const toggleItem = (itemId) => {
    setItemsProblema(prev => {
      const next = { ...prev }
      if (itemId in next) delete next[itemId]
      else                next[itemId] = { descripcion: '', extraviado: false }
      return next
    })
  }
  const setItemDesc = (itemId, desc) =>
    setItemsProblema(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || { extraviado: false }), descripcion: desc },
    }))
  const setItemExtraviado = (itemId, ext) =>
    setItemsProblema(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || { descripcion: '' }), extraviado: ext },
    }))

  const toggleMaterial = (matId) => {
    setMaterialesProblema(prev => {
      const next = { ...prev }
      if (matId in next) delete next[matId]
      else               next[matId] = { descripcion: '', extraviado: false }
      return next
    })
  }
  const setMaterialDesc = (matId, desc) =>
    setMaterialesProblema(prev => ({
      ...prev,
      [matId]: { ...(prev[matId] || { extraviado: false }), descripcion: desc },
    }))
  const setMaterialExtraviado = (matId, ext) =>
    setMaterialesProblema(prev => ({
      ...prev,
      [matId]: { ...(prev[matId] || { descripcion: '' }), extraviado: ext },
    }))

  // Atajo "Todo se perdió" — marca todos los ítems como extraviados con
  // una descripción genérica común. Útil para el caso extremo donde el
  // remito completo no llegó a destino y no tiene sentido tildar uno a uno.
  const marcarTodoExtraviado = () => {
    const todoItems = {}
    remito.items?.forEach(it => {
      todoItems[it.id] = { descripcion: 'Extravío total del remito', extraviado: true }
    })
    const todoMats = {}
    remito.materiales?.forEach(m => {
      todoMats[m.id] = { descripcion: 'Extravío total del remito', extraviado: true }
    })
    setItemsProblema(todoItems)
    setMaterialesProblema(todoMats)
  }

  // Para el botón submit y mensajes informativos
  const totalAfectados = Object.keys(itemsProblema).length +
                         Object.keys(materialesProblema).length
  const totalExtraviados = Object.values(itemsProblema).filter(v => v?.extraviado).length +
                           Object.values(materialesProblema).filter(v => v?.extraviado).length
  const totalRemito = (remito?.items?.length || 0) + (remito?.materiales?.length || 0)
  const seraCerrado = totalRemito > 0 && totalExtraviados === totalRemito && totalAfectados === totalRemito
  const puedeReportar = totalAfectados > 0 || descGeneral.trim().length > 0

  const handleReportarProblema = async () => {
    if (!puedeReportar) return
    setProcesando(true)
    setError(null)
    try {
      await api.post(`/remitos/${id}/reportar-problema`, {
        descripcion: descGeneral.trim() || null,
        items: Object.entries(itemsProblema).map(([remitoItemId, val]) => ({
          remitoItemId,
          descripcion: val?.descripcion?.trim() || null,
          extraviado:  !!val?.extraviado,
        })),
        materiales: Object.entries(materialesProblema).map(([remitoMaterialId, val]) => ({
          remitoMaterialId,
          descripcion: val?.descripcion?.trim() || null,
          extraviado:  !!val?.extraviado,
        })),
      })
      setConfirmado(true)
    } catch (err) { setError(err.message) }
    finally { setProcesando(false) }
  }

  // ── Pantalla de carga ────────────────────────────────────────
  if (loading) return (
    <div className={styles.fullPage}>
      <div className={styles.spinner} />
      <p className={styles.loadingText}>Cargando remito...</p>
    </div>
  )

  // ── Error ────────────────────────────────────────────────────
  if (error || !remito) return (
    <div className={styles.fullPage}>
      <span className={styles.icon}>⚠</span>
      <p className={styles.errorText}>{error || 'Remito no encontrado'}</p>
      <button className={styles.btnSecondary} onClick={() => navigate('/')}>
        Ir al inicio
      </button>
    </div>
  )

  // ── Estado no válido para escaneo ────────────────────────────
  // Solo CONFIRMADO, EN_TRANSITO y EN_TRANSITO_RETORNO se pueden
  // confirmar por QR. El resto se ignora con mensaje informativo.
  if (!ESTADO_ACCION[remito.estado]) return (
    <div className={styles.fullPage}>
      <span className={styles.icon}>ℹ</span>
      <p className={styles.infoTitle}>{remito.numero}</p>
      <p className={styles.infoText}>
        Este remito está en estado <strong>{remito.estado.replace(/_/g, ' ')}</strong> y no requiere confirmación por QR en este momento.
      </p>
      <button className={styles.btnSecondary} onClick={() => navigate(`/remitos/${id}`)}>
        Ver remito completo
      </button>
    </div>
  )

  // ── Confirmado exitosamente ───────────────────────────────────
  if (confirmado) {
    const okMsg = {
      SALIDA:         { titulo: '¡Salida confirmada!',     sub: `El remito ${remito.numero} salió del depósito.` },
      LLEGADA:        { titulo: '¡Llegada confirmada!',    sub: `El remito ${remito.numero} llegó a la obra.` },
      SALIDA_OBRA:    { titulo: '¡Salida de obra registrada!', sub: `El remito ${remito.numero} arrancó el viaje de vuelta al galpón.` },
      LLEGADA_GALPON: { titulo: '¡Remito cerrado!',        sub: `El remito ${remito.numero} volvió al galpón y se cerró.` },
    }[accion] || { titulo: '¡Confirmado!', sub: '' }

    return (
      <div className={styles.fullPage}>
        <div className={styles.successCircle}>✓</div>
        <p className={styles.successTitle}>{okMsg.titulo}</p>
        <p className={styles.successSub}>{okMsg.sub}</p>
        <button className={styles.btnSecondary} onClick={() => navigate(`/remitos/${id}`)}>
          Ver remito
        </button>
      </div>
    )
  }

  // ── Pantalla de problema (Word C: por ítem) ──────────────────
  if (showProblema) return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => setShowProblema(false)}>← Volver</button>
        <span className={styles.headerNumero}>{remito.numero}</span>
      </div>
      <div className={styles.problemaSection}>
        <span className={styles.problemaIcon}>⚠</span>
        <h2 className={styles.problemaTitle}>Reportar problema</h2>
        <p className={styles.problemaDesc}>
          Marcá los ítems con problema y/o agregá una descripción general.
          Si un ítem no llegó, tildá <strong>"Se extravió"</strong>. El sistema
          avisa al encargado y al dueño automáticamente.
        </p>

        {/* Atajo para el caso extremo: TODO se perdió. Marca todos los
            ítems como extraviados con descripción genérica. Útil para
            evitar tener que tildar uno por uno cuando el remito completo
            no llegó. */}
        {totalRemito > 0 && (
          <button type="button" className={styles.btnExtravioTotal}
            onClick={marcarTodoExtraviado}>
            ✕ Todo se perdió (extravío total)
          </button>
        )}

        {/* Aviso especial cuando va a cerrar directo el remito */}
        {seraCerrado && (
          <div className={styles.avisoCierre}>
            ⚠ Al confirmar, el remito se cerrará directamente (no pasa por
            "En obra" porque no hay nada para retornar).
          </div>
        )}

        {/* Herramientas */}
        {remito.items?.length > 0 && (
          <div className={styles.checkSection}>
            <p className={styles.checkSectionTitle}>🔧 Herramientas</p>
            {remito.items.map(item => {
              const marcada = item.id in itemsProblema
              const valor = itemsProblema[item.id] || { descripcion: '', extraviado: false }
              return (
                <div key={item.id} className={`${styles.checkRow} ${marcada ? styles.checkRowActive : ''} ${valor.extraviado ? styles.checkRowExtraviado : ''}`}>
                  <label className={styles.checkLabel}>
                    <input type="checkbox" checked={marcada}
                      onChange={() => toggleItem(item.id)} />
                    <div className={styles.checkInfo}>
                      <span className={styles.checkNombre}>{item.herramienta_nombre}</span>
                      <span className={styles.checkSub}>{item.herramienta_qr}</span>
                    </div>
                  </label>
                  {marcada && (
                    <>
                      <textarea
                        className={styles.checkDescripcion}
                        placeholder="¿Qué le pasó? (opcional)"
                        value={valor.descripcion}
                        onChange={e => setItemDesc(item.id, e.target.value)}
                        rows={2}
                      />
                      <label className={styles.subToggle}>
                        <input type="checkbox" checked={valor.extraviado}
                          onChange={e => setItemExtraviado(item.id, e.target.checked)} />
                        <span>Se extravió (no llegó)</span>
                      </label>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Materiales */}
        {remito.materiales?.length > 0 && (
          <div className={styles.checkSection}>
            <p className={styles.checkSectionTitle}>📦 Materiales / insumos</p>
            {remito.materiales.map(m => {
              const marcado = m.id in materialesProblema
              const valor = materialesProblema[m.id] || { descripcion: '', extraviado: false }
              return (
                <div key={m.id} className={`${styles.checkRow} ${marcado ? styles.checkRowActive : ''} ${valor.extraviado ? styles.checkRowExtraviado : ''}`}>
                  <label className={styles.checkLabel}>
                    <input type="checkbox" checked={marcado}
                      onChange={() => toggleMaterial(m.id)} />
                    <div className={styles.checkInfo}>
                      <span className={styles.checkNombre}>{m.material_nombre || m.descripcion_libre}</span>
                      <span className={styles.checkSub}>{m.cantidad_egreso} {m.unidad}</span>
                    </div>
                  </label>
                  {marcado && (
                    <>
                      <textarea
                        className={styles.checkDescripcion}
                        placeholder="¿Qué le pasó? (opcional)"
                        value={valor.descripcion}
                        onChange={e => setMaterialDesc(m.id, e.target.value)}
                        rows={2}
                      />
                      <label className={styles.subToggle}>
                        <input type="checkbox" checked={valor.extraviado}
                          onChange={e => setMaterialExtraviado(m.id, e.target.checked)} />
                        <span>Se extravió (no llegó)</span>
                      </label>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Descripción general — opcional, agrega contexto si nada específico */}
        <div className={styles.checkSection}>
          <label className={styles.checkSectionTitle} htmlFor="descGeneral">
            Descripción general <span className={styles.opt}>(opcional)</span>
          </label>
          <textarea id="descGeneral"
            className={styles.problemaTextarea}
            placeholder="Contexto general del problema, situación en obra..."
            value={descGeneral}
            onChange={e => setDescGeneral(e.target.value)}
            rows={3}
          />
        </div>

        {error && <div className={styles.errorBox}>⚠ {error}</div>}

        <button
          className={styles.btnDanger}
          onClick={handleReportarProblema}
          disabled={procesando || !puedeReportar}>
          {procesando
            ? 'Enviando...'
            : totalAfectados > 0
              ? `⚠ Confirmar (${totalAfectados} ítem${totalAfectados !== 1 ? 's' : ''} afectado${totalAfectados !== 1 ? 's' : ''})`
              : '⚠ Confirmar y reportar problema'
          }
        </button>

        {!puedeReportar && (
          <p className={styles.problemaHint}>
            Marcá al menos un ítem o escribí una descripción general para continuar.
          </p>
        )}
      </div>
    </div>
  )

  // ── Pantalla de problema en LLEGADA_GALPON (4to escaneo) ────────
  // El encargado descubrió que algo no coincide con lo declarado en
  // SALIDA_OBRA (volvió rota, no llegó al galpón, cantidad distinta).
  // Reutilizamos la UI de pills/cantidades de SALIDA_OBRA pero
  // pre-poblada con los valores ya cargados. El encargado solo modifica
  // lo que cambió y agrega una observación general opcional.
  if (showProblemaGalpon) {
    const itemsRetorno = remito.items?.filter(i => !i.extraviado) || []
    const matsRetorno  = remito.materiales?.filter(m => !m.extraviado) || []
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <button className={styles.btnBack} onClick={() => setShowProblemaGalpon(false)}>← Volver</button>
          <span className={styles.headerNumero}>{remito.numero}</span>
        </div>
        <div className={styles.problemaSection}>
          <span className={styles.problemaIcon}>⚠</span>
          <h2 className={styles.problemaTitle}>Ajustar retorno al galpón</h2>
          <p className={styles.problemaDesc}>
            Modificá lo que no coincida con lo declarado al salir de obra.
            Por ejemplo: una herramienta volvió rota, otra no llegó, o un
            material volvió en cantidad distinta.
          </p>

          {itemsRetorno.length > 0 && (
            <div className={styles.retornoSeccion}>
              <p className={styles.retornoTitulo}>🔧 Herramientas</p>
              {itemsRetorno.map(item => (
                <div key={item.id} className={styles.retornoRow}>
                  <div className={styles.retornoInfo}>
                    <span className={styles.retornoNombre}>{item.herramienta_nombre}</span>
                    <span className={styles.retornoSub}>{item.herramienta_qr}</span>
                  </div>
                  <div className={styles.retornoPills}>
                    {[
                      { v: 'VUELVE',        label: 'Vuelve',   cls: styles.pillOk },
                      { v: 'ROTA',          label: 'Rota',     cls: styles.pillWarn },
                      { v: 'PERDIDA',       label: 'No llegó', cls: styles.pillDanger },
                      { v: 'QUEDA_EN_OBRA', label: 'Queda',    cls: styles.pillInfo },
                    ].map(opt => (
                      <button key={opt.v} type="button"
                        className={`${styles.retornoPill} ${retornoItems[item.id] === opt.v ? opt.cls : ''}`}
                        onClick={() => setRetornoItems(prev => ({ ...prev, [item.id]: opt.v }))}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {matsRetorno.length > 0 && (
            <div className={styles.retornoSeccion}>
              <p className={styles.retornoTitulo}>📦 Materiales</p>
              {matsRetorno.map(m => (
                <div key={m.id} className={styles.retornoRow}>
                  <div className={styles.retornoInfo}>
                    <span className={styles.retornoNombre}>{m.material_nombre || m.descripcion_libre}</span>
                    <span className={styles.retornoSub}>Salida: {m.cantidad_egreso} {m.unidad}</span>
                  </div>
                  <div className={styles.retornoCant}>
                    <input type="number" min="0" max={m.cantidad_egreso} step="any"
                      className={styles.retornoCantInput}
                      value={retornoMateriales[m.id] ?? 0}
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value)
                        setRetornoMateriales(prev => ({ ...prev, [m.id]: val }))
                      }} />
                    <span className={styles.retornoUnidad}>{m.unidad}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.checkSection}>
            <label className={styles.checkSectionTitle} htmlFor="obsRetornoGeneral">
              Observación del retorno <span className={styles.opt}>(opcional)</span>
            </label>
            <textarea id="obsRetornoGeneral"
              className={styles.problemaTextarea}
              placeholder="Contexto general: qué pasó, qué se ajustó, etc."
              value={obsRetornoGeneral}
              onChange={e => setObsRetornoGeneral(e.target.value)}
              rows={3}
            />
          </div>

          {error && <div className={styles.errorBox}>⚠ {error}</div>}

          <button className={styles.btnDanger} onClick={handleConfirmar} disabled={procesando}>
            {procesando ? 'Cerrando remito...' : '✓ Confirmar cierre con ajustes'}
          </button>
        </div>
      </div>
    )
  }

  // ── Pantalla principal ────────────────────────────────────────
  const esSalida        = accion === 'SALIDA'
  const esLlegada       = accion === 'LLEGADA'
  const esSalidaObra    = accion === 'SALIDA_OBRA'
  const esLlegadaGalpon = accion === 'LLEGADA_GALPON'
  const estadoInfo = ESTADO_LABEL[remito.estado] || { texto: remito.estado, color: '#888' }

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerLogo}>FieldStock AI</span>
        <span className={styles.headerNumero}>{remito.numero}</span>
      </div>

      {/* Estado badge */}
      <div className={styles.estadoBadge} style={{ borderColor: estadoInfo.color, color: estadoInfo.color }}>
        {estadoInfo.texto}
      </div>

      {/* Datos principales */}
      <div className={styles.card}>
        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>Obra</span>
          <span className={styles.cardValue}>
            {remito.cliente_nombre ? `${remito.cliente_nombre} - ${remito.obra}` : remito.obra}
          </span>
        </div>
        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>Responsable</span>
          <span className={styles.cardValue}>{remito.responsable}</span>
        </div>
        {remito.empresa_transporte && (
          <div className={styles.cardRow}>
            <span className={styles.cardLabel}>Transporte</span>
            <span className={styles.cardValue}>{remito.empresa_transporte}</span>
          </div>
        )}
        {/* En LLEGADA mostramos quién hizo el traslado (cargado en SALIDA) */}
        {remito.conductor && (
          <div className={styles.cardRow}>
            <span className={styles.cardLabel}>Conductor</span>
            <span className={styles.cardValue}>{remito.conductor}</span>
          </div>
        )}
        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>Fecha egreso</span>
          <span className={styles.cardValue}>{formatFecha(remito.fecha_egreso)}</span>
        </div>
      </div>

      {/* Resumen de ítems */}
      <div className={styles.resumen}>
        <div className={styles.resumenItem}>
          <span className={styles.resumenNum}>{remito.items?.length ?? 0}</span>
          <span className={styles.resumenLabel}>Herramientas</span>
        </div>
        <div className={styles.resumenDivider} />
        <div className={styles.resumenItem}>
          <span className={styles.resumenNum}>{remito.materiales?.length ?? 0}</span>
          <span className={styles.resumenLabel}>Materiales</span>
        </div>
      </div>

      {/* Lista de herramientas — en LLEGADA verificás lo que salió;
          en LLEGADA_GALPON verificás lo que vuelve (excluye extraviados
          que nunca llegaron, y muestra el estado_retorno declarado para
          contexto). */}
      {esLlegada && remito.items?.length > 0 && (
        <div className={styles.lista}>
          <p className={styles.listaTitle}>🔧 Herramientas a verificar</p>
          {remito.items.map((item, idx) => (
            <div key={item.id} className={styles.listaRow}>
              <span className={styles.listaIdx}>{idx + 1}</span>
              <div className={styles.listaInfo}>
                <span className={styles.listaNombre}>{item.herramienta_nombre}</span>
                <span className={styles.listaCodigo}>{item.herramienta_qr}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {esLlegadaGalpon && (remito.items?.filter(i => !i.extraviado).length > 0) && (
        <div className={styles.lista}>
          <p className={styles.listaTitle}>🔧 Herramientas que deberían volver</p>
          {remito.items.filter(i => !i.extraviado).map((item, idx) => {
            const er = item.estado_retorno
            const erLabel =
              er === 'VUELVE'        ? { txt: 'Vuelve',   cls: styles.pillOk } :
              er === 'ROTA'          ? { txt: 'Rota',     cls: styles.pillWarn } :
              er === 'PERDIDA'       ? { txt: 'Perdida',  cls: styles.pillDanger } :
              er === 'QUEDA_EN_OBRA' ? { txt: 'Queda',    cls: styles.pillInfo } :
                                       null
            return (
              <div key={item.id} className={styles.listaRow}>
                <span className={styles.listaIdx}>{idx + 1}</span>
                <div className={styles.listaInfo}>
                  <span className={styles.listaNombre}>{item.herramienta_nombre}</span>
                  <span className={styles.listaCodigo}>{item.herramienta_qr}</span>
                </div>
                {erLabel && (
                  <span className={`${styles.retornoPill} ${erLabel.cls}`} style={{ pointerEvents: 'none' }}>
                    {erLabel.txt}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Lista de materiales — en LLEGADA verificás los enviados,
          en LLEGADA_GALPON verificás cantidades que vuelven. */}
      {esLlegada && remito.materiales?.length > 0 && (
        <div className={styles.lista}>
          <p className={styles.listaTitle}>📦 Materiales a verificar</p>
          {remito.materiales.map((m, idx) => (
            <div key={m.id} className={styles.listaRow}>
              <span className={styles.listaIdx}>{idx + 1}</span>
              <div className={styles.listaInfo}>
                <span className={styles.listaNombre}>{m.material_nombre || m.descripcion_libre}</span>
                <span className={styles.listaCodigo}>{m.cantidad_egreso} {m.unidad}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {esLlegadaGalpon && (remito.materiales?.filter(m => !m.extraviado).length > 0) && (
        <div className={styles.lista}>
          <p className={styles.listaTitle}>📦 Materiales que deberían volver</p>
          {remito.materiales.filter(m => !m.extraviado).map((m, idx) => (
            <div key={m.id} className={styles.listaRow}>
              <span className={styles.listaIdx}>{idx + 1}</span>
              <div className={styles.listaInfo}>
                <span className={styles.listaNombre}>{m.material_nombre || m.descripcion_libre}</span>
                <span className={styles.listaCodigo}>
                  Vuelven: {m.cantidad_retorno ?? m.cantidad_egreso} {m.unidad}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Problema registrado */}
      {remito.observacion_llegada && (
        <div className={styles.problemaRegistrado}>
          <span>⚠ Problema registrado:</span> {remito.observacion_llegada}
        </div>
      )}

      {/* Conductor — solo en SALIDA. Obligatorio para confirmar. */}
      {esSalida && (
        <div className={styles.conductorBox}>
          <label className={styles.conductorLabel} htmlFor="conductor">
            Conductor / persona a cargo del traslado <span className={styles.req}>*</span>
          </label>
          <input id="conductor" type="text"
            className={styles.conductorInput}
            placeholder="Nombre y apellido"
            value={conductor}
            onChange={e => setConductor(e.target.value)}
            autoComplete="off"
            autoCapitalize="words" />
          <p className={styles.conductorHint}>
            Queda registrado en el remito y se muestra en el PDF.
          </p>
        </div>
      )}

      {/* Word REMITOS: en SALIDA_OBRA el encargado define qué vuelve antes
          de arrancar el viaje de regreso. Items extraviados ya quedaron
          marcados desde la LLEGADA — no aparecen acá. */}
      {esSalidaObra && (
        <>
          {(remito.items?.filter(i => !i.extraviado).length > 0) && (
            <div className={styles.retornoSeccion}>
              <p className={styles.retornoTitulo}>🔧 ¿Qué pasa con cada herramienta?</p>
              {remito.items.filter(i => !i.extraviado).map(item => (
                <div key={item.id} className={styles.retornoRow}>
                  <div className={styles.retornoInfo}>
                    <span className={styles.retornoNombre}>{item.herramienta_nombre}</span>
                    <span className={styles.retornoSub}>{item.herramienta_qr}</span>
                  </div>
                  <div className={styles.retornoPills}>
                    {[
                      { v: 'VUELVE',        label: 'Vuelve',   cls: styles.pillOk },
                      { v: 'ROTA',          label: 'Rota',     cls: styles.pillWarn },
                      { v: 'PERDIDA',       label: 'Perdida',  cls: styles.pillDanger },
                      { v: 'QUEDA_EN_OBRA', label: 'Queda',    cls: styles.pillInfo },
                    ].map(opt => (
                      <button key={opt.v} type="button"
                        className={`${styles.retornoPill} ${retornoItems[item.id] === opt.v ? opt.cls : ''}`}
                        onClick={() => setRetornoItems(prev => ({ ...prev, [item.id]: opt.v }))}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(remito.materiales?.filter(m => !m.extraviado).length > 0) && (
            <div className={styles.retornoSeccion}>
              <p className={styles.retornoTitulo}>📦 ¿Cuánto vuelve de cada material?</p>
              {remito.materiales.filter(m => !m.extraviado).map(m => (
                <div key={m.id} className={styles.retornoRow}>
                  <div className={styles.retornoInfo}>
                    <span className={styles.retornoNombre}>{m.material_nombre || m.descripcion_libre}</span>
                    <span className={styles.retornoSub}>Salida: {m.cantidad_egreso} {m.unidad}</span>
                  </div>
                  <div className={styles.retornoCant}>
                    <input type="number" min="0" max={m.cantidad_egreso} step="any"
                      className={styles.retornoCantInput}
                      value={retornoMateriales[m.id] ?? 0}
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value)
                        setRetornoMateriales(prev => ({ ...prev, [m.id]: val }))
                      }} />
                    <span className={styles.retornoUnidad}>{m.unidad}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Aviso si hay items extraviados — ya no entran al retorno */}
          {((remito.items?.some(i => i.extraviado)) || (remito.materiales?.some(m => m.extraviado))) && (
            <p className={styles.retornoHint}>
              ⚠ Los items marcados como extraviados en la llegada no se incluyen acá.
            </p>
          )}
        </>
      )}

      {/* Acciones */}
      <div className={styles.acciones}>
        {esSalida && (
          <button className={styles.btnPrimary} onClick={handleConfirmar}
            disabled={procesando || !conductor.trim()}>
            {procesando ? 'Procesando...' : '✓ Confirmar salida del depósito'}
          </button>
        )}

        {esLlegada && (
          <>
            <button className={styles.btnPrimary} onClick={handleConfirmar} disabled={procesando}>
              {procesando ? 'Procesando...' : '✓ Todo llegó correctamente'}
            </button>
            <button className={styles.btnDangerOutline} onClick={() => setShowProblema(true)} disabled={procesando}>
              ⚠ Reportar problema
            </button>
          </>
        )}

        {/* SALIDA_OBRA: el responsable escanea para confirmar que arranca
            el viaje de vuelta al galpón. Asume que el retorno ya está
            cargado (cada item tiene su estado_retorno definido desde la
            web por el dueño/encargado). Si faltan datos, el backend
            rechaza con error claro. */}
        {esSalidaObra && (
          <button className={styles.btnPrimary} onClick={handleConfirmar} disabled={procesando}>
            {procesando ? 'Procesando...' : '✓ Confirmar salida de obra'}
          </button>
        )}

        {/* LLEGADA_GALPON: escaneo de retorno al depósito (4to escaneo).
            Verificación item-por-item de lo que efectivamente llegó.
            - "Todo OK" → cierra el remito con lo declarado en SALIDA_OBRA
            - "Ajustar/Reportar problema" → permite cambiar estado_retorno
              o cantidades antes de cerrar (volvió rota, no llegó, etc.) */}
        {esLlegadaGalpon && (
          <>
            <button className={styles.btnPrimary} onClick={handleConfirmar} disabled={procesando}>
              {procesando ? 'Procesando...' : '✓ Todo llegó correctamente'}
            </button>
            <button className={styles.btnDangerOutline} onClick={() => setShowProblemaGalpon(true)} disabled={procesando}>
              ⚠ Ajustar / reportar problema
            </button>
          </>
        )}
      </div>

      <button className={styles.btnLink} onClick={() => navigate(`/remitos/${id}`)}>
        Ver remito completo en el sistema →
      </button>

    </div>
  )
}
