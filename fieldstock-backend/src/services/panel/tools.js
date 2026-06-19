// src/services/panel/tools.js
/**
 * Registry de tools que el LLM puede invocar en el M1 Panel IA.
 *
 * Todas read-only. Cada tool es un wrapper delgado sobre un service
 * ya existente, con dos responsabilidades adicionales:
 *   1. Limitar el payload (LIMIT 50) para no inflar el contexto del LLM.
 *   2. Proyectar solo los campos relevantes (saca timestamps de auditoria,
 *      flags internos, etc. que gastan tokens sin aportar).
 *
 * Agregar una tool nueva: push al array TOOLS abajo. El orquestador
 * la descubre sola via getDeclarations() y runTool().
 *
 * Formato de cada entry:
 *   {
 *     name:        string identico al function name en `parameters`,
 *     description: ESPANOL explicando que devuelve y cuando usarla,
 *     parameters:  JSON Schema (subset compatible con Gemini),
 *     handler:     async (args) => any  — el resultado se serializa
 *                  como JSON al LLM,
 *   }
 */
import * as Obras         from '../obras.service.js'
import * as Herramientas  from '../herramientas.service.js'
import * as Materiales    from '../materiales.service.js'
import * as Remitos       from '../remitos.service.js'
import * as Presupuestos  from '../presupuestos.service.js'
import * as Compras       from '../compras.service.js'
import * as Directorio    from '../directorio.service.js'

const HARD_LIMIT = 50

/** Devuelve un objeto con solo las keys pedidas (sin undefined). */
function pick(obj, keys) {
  if (!obj) return obj
  const out = {}
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k]
  }
  return out
}

/** Aplica pick() a cada item y trunca a HARD_LIMIT. */
function project(rows, keys) {
  if (!Array.isArray(rows)) return rows
  return rows.slice(0, HARD_LIMIT).map(r => pick(r, keys))
}

// ── Definiciones ────────────────────────────────────────────────

export const TOOLS = [
  {
    name: 'listar_obras',
    description:
      'Lista las obras de la empresa. Opcionalmente filtra por estado. ' +
      'Estados validos: PENDIENTE_PRESUPUESTO, EN_APROBACION, ACTIVA, FINALIZADA, RECHAZADA. ' +
      'Devuelve hasta 50 obras con id, nombre, cliente, estado y fechas.',
    parameters: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          enum: ['PENDIENTE_PRESUPUESTO', 'EN_APROBACION', 'ACTIVA', 'FINALIZADA', 'RECHAZADA'],
          description: 'Filtrar solo obras con este estado.',
        },
        q: { type: 'string', description: 'Busqueda parcial por nombre de obra.' },
      },
    },
    handler: async ({ estado, q } = {}) => {
      const rows = await Obras.getAll({ estado, q })
      return {
        total: rows.length,
        items: project(rows, [
          'id', 'nombre', 'cliente', 'cliente_nombre', 'direccion',
          'estado', 'fecha_inicio', 'fecha_fin', 'cantidad_remitos',
        ]),
      }
    },
  },

  {
    name: 'obra_por_id',
    description:
      'Devuelve el detalle completo de una obra: datos generales + lista de remitos asociados. ' +
      'Usar cuando el usuario pregunta por una obra puntual o quiere saber sus remitos.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: 'UUID de la obra.' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const obra = await Obras.getById(id)
      if (!obra) return { error: 'Obra no encontrada' }
      return obra
    },
  },

  {
    name: 'listar_herramientas',
    description:
      'Lista las herramientas del inventario. Estados validos: ' +
      'DISPONIBLE, EN_OBRA, EN_MANTENIMIENTO, RESERVADA, BAJA. ' +
      'Devuelve hasta 50 con id, nombre, codigo_qr, estado, categoria, marca.',
    parameters: {
      type: 'object',
      properties: {
        estado:       { type: 'string', enum: ['DISPONIBLE', 'EN_OBRA', 'EN_MANTENIMIENTO', 'RESERVADA', 'BAJA'] },
        categoriaId:  { type: 'string', description: 'UUID de categoria.' },
        q:            { type: 'string', description: 'Busqueda parcial por nombre.' },
      },
    },
    handler: async ({ estado, categoriaId, q } = {}) => {
      const rows = await Herramientas.getAll({ estado, categoriaId, q })
      return {
        total: rows.length,
        items: project(rows, [
          'id', 'nombre', 'codigo_qr', 'estado',
          'categoria_nombre', 'marca_nombre', 'ubicacion_actual',
        ]),
      }
    },
  },

  {
    name: 'herramienta_por_id',
    description:
      'Detalle completo de una herramienta (incluye categoria, marca, ubicacion y estado). ' +
      'Usar cuando el usuario pregunta por una herramienta especifica.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const h = await Herramientas.getById(id)
      if (!h) return { error: 'Herramienta no encontrada' }
      return h
    },
  },

  {
    name: 'listar_materiales',
    description:
      'Lista materiales (insumos fungibles: cemento, ladrillos, arena, etc.) con su stock actual ' +
      'y stock minimo configurado. Devuelve hasta 50.',
    parameters: {
      type: 'object',
      properties: { q: { type: 'string', description: 'Busqueda parcial por nombre.' } },
    },
    handler: async ({ q } = {}) => {
      const rows = await Materiales.getAll({ q })
      return {
        total: rows.length,
        items: project(rows, [
          'id', 'nombre', 'marca', 'unidad', 'stock_actual', 'stock_minimo',
        ]),
      }
    },
  },

  {
    name: 'materiales_bajo_stock',
    description:
      'Devuelve los materiales cuyo stock actual es menor o igual al stock minimo configurado ' +
      '(necesitan reposicion). Ordenados de mas critico a menos. Usar para preguntas como ' +
      '"que materiales tengo que pedir" o "cuales estan por agotarse".',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const rows = await Materiales.getAll()
      const bajos = rows
        .filter(m => Number(m.stock_actual) <= Number(m.stock_minimo))
        .sort((a, b) => Number(a.stock_actual) - Number(b.stock_actual))
      return {
        total: bajos.length,
        items: project(bajos, [
          'id', 'nombre', 'marca', 'unidad', 'stock_actual', 'stock_minimo',
        ]),
      }
    },
  },

  {
    name: 'listar_remitos',
    description:
      'Lista remitos (movimientos de herramientas/materiales entre la empresa y obras). ' +
      'Tipo: EGRESO (envio a obra) o INGRESO (vuelta a la empresa). ' +
      'Estados: BORRADOR, CONFIRMADO, EN_TRANSITO, RECIBIDO_EN_OBRA, CERRADO.',
    parameters: {
      type: 'object',
      properties: {
        estado: { type: 'string', enum: ['BORRADOR', 'CONFIRMADO', 'EN_TRANSITO', 'RECIBIDO_EN_OBRA', 'CERRADO'] },
        q:      { type: 'string', description: 'Busqueda parcial por numero o nombre de obra.' },
      },
    },
    handler: async ({ estado, q } = {}) => {
      const rows = await Remitos.getAll({ estado, q })
      return {
        total: rows.length,
        items: project(rows, [
          'id', 'numero', 'tipo', 'estado', 'fecha',
          'obra_id', 'obra_nombre',
          'cantidad_herramientas', 'cantidad_materiales',
        ]),
      }
    },
  },

  {
    name: 'listar_presupuestos',
    description:
      'Lista presupuestos cargados en el sistema. Estados: BORRADOR, EN_APROBACION, APROBADO, RECHAZADO. ' +
      'Cada presupuesto tiene insumos (materiales con cantidad y precio) + costos extra (ej. mano de obra).',
    parameters: {
      type: 'object',
      properties: {
        obraId: { type: 'string', description: 'Filtrar por obra (UUID).' },
        estado: { type: 'string', enum: ['BORRADOR', 'EN_APROBACION', 'APROBADO', 'RECHAZADO'] },
      },
    },
    handler: async ({ obraId, estado } = {}) => {
      const rows = await Presupuestos.getAll({ obraId, estado })
      return {
        total: rows.length,
        items: project(rows, [
          'id', 'numero', 'obra_id', 'obra_nombre', 'estado',
          'monto_total', 'fecha_creacion', 'fecha_aprobacion',
        ]),
      }
    },
  },

  {
    name: 'presupuesto_por_id',
    description:
      'Detalle completo de un presupuesto: cabecera + insumos (materiales con cantidad y precio) + ' +
      'costos extra (mano de obra, fletes, etc.). Usar cuando el usuario pregunta el detalle ' +
      'de un presupuesto puntual.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const p = await Presupuestos.getById(id)
      if (!p) return { error: 'Presupuesto no encontrado' }
      return p
    },
  },

  {
    name: 'listar_compras',
    description:
      'Lista ordenes de compra a proveedores. Estados: BORRADOR, CONFIRMADA, RECIBIDA, CANCELADA. ' +
      'Una compra recibida suma stock automaticamente.',
    parameters: {
      type: 'object',
      properties: {
        estado:      { type: 'string', enum: ['BORRADOR', 'CONFIRMADA', 'RECIBIDA', 'CANCELADA'] },
        proveedorId: { type: 'string' },
      },
    },
    handler: async ({ estado, proveedorId } = {}) => {
      const rows = await Compras.getAll({ estado, proveedorId })
      return {
        total: rows.length,
        items: project(rows, [
          'id', 'numero', 'proveedor_id', 'proveedor_nombre',
          'estado', 'monto_total', 'fecha',
        ]),
      }
    },
  },

  {
    name: 'listar_clientes',
    description: 'Lista los clientes de la empresa (a quienes se hacen las obras).',
    parameters: {
      type: 'object',
      properties: { q: { type: 'string', description: 'Busqueda parcial.' } },
    },
    handler: async ({ q } = {}) => {
      const rows = await Directorio.getAllClientes({ q })
      return {
        total: rows.length,
        items: project(rows, ['id', 'nombre', 'email', 'telefono']),
      }
    },
  },

  {
    name: 'listar_proveedores',
    description: 'Lista los proveedores de la empresa (de quienes se compran materiales).',
    parameters: {
      type: 'object',
      properties: { q: { type: 'string' } },
    },
    handler: async ({ q } = {}) => {
      const rows = await Directorio.getAllProveedores({ q })
      return {
        total: rows.length,
        items: project(rows, ['id', 'nombre', 'email', 'telefono']),
      }
    },
  },
]

// ── API publica del registry ────────────────────────────────────

/** Function declarations en formato Gemini para pasarle al modelo. */
export function getDeclarations() {
  return TOOLS.map(({ name, description, parameters }) => ({
    name, description, parameters,
  }))
}

/**
 * Ejecuta una tool por nombre. Si la tool no existe o el handler tira,
 * devuelve un objeto `{ error }` en vez de propagar la excepcion — el
 * LLM puede leer el error y decidir si reintenta o reporta al usuario.
 */
export async function runTool(name, args) {
  const tool = TOOLS.find(t => t.name === name)
  if (!tool) return { error: `Tool desconocida: ${name}` }
  try {
    return await tool.handler(args || {})
  } catch (err) {
    return { error: err.message || 'Error ejecutando la tool' }
  }
}
