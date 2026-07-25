// src/services/dashboard.service.js
/**
 * Service del Dashboard de inicio (Word #16).
 *
 * Endpoint único `GET /dashboard` que agrega en una sola request:
 *  · KPIs:        conteos por entidad (herramientas, obras, remitos, alertas)
 *  · Listas:      últimas notificaciones, materiales con stock bajo, últimos remitos
 *
 * Lo armamos como UN solo endpoint en vez de varios para minimizar
 * round-trips al pintar la home — esta pantalla es la primera que ve el
 * usuario al loguearse, así que la velocidad importa.
 *
 * Las queries van en paralelo con Promise.all — Supabase no tiene un
 * "stats RPC", así que aceptamos N selects pero al menos los disparamos
 * al mismo tiempo.
 */
import { supabase } from '../config/supabase.js'

const LIMITE_LISTAS = 5

/**
 * Conteo por estado de herramientas. Excluye BAJA porque las dadas de
 * baja están "fuera del inventario activo" desde la perspectiva del
 * usuario (sigue existiendo la fila por trazabilidad).
 */
async function getKpisHerramientas() {
  const { data, error } = await supabase
    .from('herramientas')
    .select('estado')
    .neq('estado', 'BAJA')
    .eq('activo', true)

  if (error) throw error

  const porEstado = data.reduce((acc, h) => {
    acc[h.estado] = (acc[h.estado] || 0) + 1
    return acc
  }, {})

  return {
    total:           data.length,
    disponibles:     porEstado.DISPONIBLE       || 0,
    enObra:          porEstado.EN_OBRA          || 0,
    enMantenimiento: porEstado.EN_MANTENIMIENTO || 0,
    reservadas:      porEstado.RESERVADA        || 0,
  }
}

async function getKpiObrasActivas() {
  const { count, error } = await supabase
    .from('obras')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'ACTIVA')
  if (error) throw error
  return count || 0
}

/**
 * Remitos "en curso" = cualquiera que no esté en BORRADOR ni en CERRADO.
 * O sea: la herramienta/material ya salió del depósito y todavía no volvió.
 */
async function getKpiRemitosEnCurso() {
  const { count, error } = await supabase
    .from('remitos')
    .select('*', { count: 'exact', head: true })
    .not('estado', 'in', '(BORRADOR,CERRADO)')
  if (error) throw error
  return count || 0
}

/**
 * Materiales activos donde stock_actual <= stock_minimo (alerta de reposición).
 * Devolvemos los items para reusar el fetch entre el KPI y la lista
 * "stock bajo" — así evitamos una query duplicada.
 */
async function getMaterialesStockBajo() {
  // Supabase JS no soporta column-vs-column comparison en filter() directo;
  // traemos los activos y filtramos en JS. La tabla materiales es chica
  // (~decenas de filas), así que no es un problema de performance.
  const { data, error } = await supabase
    .from('materiales')
    .select('id, nombre, unidad, stock_actual, stock_minimo, marca')
    .eq('activo', true)

  if (error) throw error

  return data
    .filter(m => Number(m.stock_actual) <= Number(m.stock_minimo))
    .sort((a, b) => Number(a.stock_actual) - Number(b.stock_actual))
}

async function getUltimasNotificaciones() {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('id, tipo, titulo, mensaje, leida, created_at, remito_id, remitos(numero, obra)')
    .order('created_at', { ascending: false })
    .limit(LIMITE_LISTAS)
  if (error) throw error
  return data || []
}

/**
 * Top 5 herramientas más despachadas a obra — un EGRESO por movimiento
 * cuenta como "un uso". Igual criterio que getMaterialesStockBajo: se
 * agrega en JS porque Supabase JS no tiene GROUP BY, y la tabla de
 * movimientos es chica para la escala de este sistema.
 */
async function getTopHerramientasUsadas() {
  const { data, error } = await supabase
    .from('movimientos')
    .select('herramienta_id, herramientas(nombre)')
    .eq('tipo', 'EGRESO')
  if (error) throw error

  const porHerramienta = new Map()
  for (const m of data) {
    if (!m.herramienta_id) continue
    const actual = porHerramienta.get(m.herramienta_id) || { nombre: m.herramientas?.nombre || '—', usos: 0 }
    actual.usos++
    porHerramienta.set(m.herramienta_id, actual)
  }

  return [...porHerramienta.entries()]
    .map(([id, v]) => ({ id, nombre: v.nombre, usos: v.usos }))
    .sort((a, b) => b.usos - a.usos)
    .slice(0, LIMITE_LISTAS)
}

/**
 * Top 5 materiales por consumo real (lo que salió menos lo que volvió sin
 * usar) a lo largo de todos los remitos. Mismo criterio de agregación en
 * JS que el resto de este service.
 */
async function getTopMaterialesConsumidos() {
  const { data, error } = await supabase
    .from('remito_materiales')
    .select('material_id, cantidad_egreso, cantidad_retorno, materiales(nombre, unidad, activo)')
  if (error) throw error

  const porMaterial = new Map()
  for (const m of data) {
    // Un material dado de baja no debería seguir apareciendo en el
    // ranking, aunque tenga consumo histórico real en remitos viejos.
    if (!m.material_id || m.materiales?.activo === false) continue
    const consumo = Number(m.cantidad_egreso || 0) - Number(m.cantidad_retorno || 0)
    const actual = porMaterial.get(m.material_id)
      || { nombre: m.materiales?.nombre || '—', unidad: m.materiales?.unidad || '', consumo: 0 }
    actual.consumo += consumo
    porMaterial.set(m.material_id, actual)
  }

  return [...porMaterial.entries()]
    .map(([id, v]) => ({ id, nombre: v.nombre, unidad: v.unidad, consumo: v.consumo }))
    .filter(m => m.consumo > 0)
    .sort((a, b) => b.consumo - a.consumo)
    .slice(0, LIMITE_LISTAS)
}

async function getUltimosRemitos() {
  const { data, error } = await supabase
    .from('remitos_resumen')
    // cliente_nombre se incluye para que el frontend pueda mostrar
    // "Cliente - Obra" en el listado (más útil cuando un mismo cliente
    // tiene varias obras corriendo en paralelo).
    .select('id, numero, obra, cliente_nombre, estado, fecha_egreso, fecha_retorno')
    .order('fecha_egreso', { ascending: false })
    .limit(LIMITE_LISTAS)
  if (error) throw error
  return data || []
}

/**
 * Devuelve TODO lo que necesita la home en una sola response.
 * Las queries van en paralelo; si una falla, falla todo el endpoint
 * (es preferible que el frontend muestre un error claro a que pinte
 * una home a medias con KPIs en blanco).
 */
export async function getResumen() {
  const [
    kpisHerramientas,
    obrasActivas,
    remitosEnCurso,
    materialesStockBajo,
    notificaciones,
    ultimosRemitos,
    topHerramientas,
    topMateriales,
  ] = await Promise.all([
    getKpisHerramientas(),
    getKpiObrasActivas(),
    getKpiRemitosEnCurso(),
    getMaterialesStockBajo(),
    getUltimasNotificaciones(),
    getUltimosRemitos(),
    getTopHerramientasUsadas(),
    getTopMaterialesConsumidos(),
  ])

  return {
    kpis: {
      herramientas: kpisHerramientas,
      obrasActivas,
      remitosEnCurso,
      alertasStockBajo: materialesStockBajo.length,
    },
    notificaciones,
    materialesStockBajo: materialesStockBajo.slice(0, LIMITE_LISTAS),
    ultimosRemitos,
    topHerramientas,
    topMateriales,
  }
}
