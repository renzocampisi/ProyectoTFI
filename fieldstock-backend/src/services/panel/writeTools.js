// src/services/panel/writeTools.js
/**
 * Registry de tools de ESCRITURA que el LLM puede proponer en el M1 Panel IA.
 *
 * A diferencia de tools.js (read-only, se ejecutan directo), estas tools
 * NUNCA se ejecutan dentro del loop del orquestador. El flujo es:
 *
 *   1. El LLM pide la tool de escritura → panel.service la detecta y en vez
 *      de correr `execute`, corre `preview` (que NO modifica nada, solo
 *      arma un resumen legible) y devuelve `accionPendiente` al frontend.
 *   2. El usuario confirma explícitamente en la UI (botón "Confirmar").
 *   3. El frontend pega contra POST /panel/ejecutar-accion → recién ahí
 *      se llama `execute`, que hace la escritura real.
 *
 * Ninguna escritura del Panel IA se dispara sin ese click humano de por
 * medio — el LLM propone, nunca ejecuta directamente.
 *
 * Formato de cada entry:
 *   {
 *     name, description, parameters  → igual que tools.js (declaración Gemini)
 *     preview: async (args) => { resumen, detalle }  — NO escribe. `resumen`
 *              es un string en castellano listo para mostrarle al usuario;
 *              `detalle` es la data cruda por si el frontend la quiere pintar.
 *     execute: async (args) => any    — acá sí se escribe. Se llama SOLO
 *              después de la confirmación del usuario.
 *   }
 */
import * as Materiales    from '../materiales.service.js'
import * as Directorio    from '../directorio.service.js'
import * as Notificaciones from '../notificaciones.service.js'
import * as Herramientas  from '../herramientas.service.js'
import * as Obras         from '../obras.service.js'
import * as Presupuestos  from '../presupuestos.service.js'

const ESTADOS_HERRAMIENTA_VALIDOS = ['DISPONIBLE', 'EN_MANTENIMIENTO', 'RESERVADA']

export const WRITE_TOOLS = [
  {
    name: 'sumar_stock_material',
    description:
      'Propone sumar una cantidad al stock_actual de un material existente ' +
      '(ej: "sumá 50 bolsas de cemento", "llegaron 20 caños más"). ' +
      'Esto es una ACCION — no se ejecuta sola, requiere confirmación explícita ' +
      'del usuario en la interfaz antes de aplicarse.',
    parameters: {
      type: 'object',
      properties: {
        materialId: { type: 'string', description: 'UUID del material (obtenido con listar_materiales).' },
        cantidad:   { type: 'number', description: 'Cantidad a sumar al stock actual. Debe ser mayor a 0.' },
      },
      required: ['materialId', 'cantidad'],
    },
    preview: async ({ materialId, cantidad } = {}) => {
      const num = Number(cantidad)
      if (!Number.isFinite(num) || num <= 0) {
        return { error: 'La cantidad a sumar debe ser un número mayor a 0.' }
      }
      // .getById() usa .single() y TIRA (no devuelve null) si el id no
      // existe — sin el .catch() acá, un materialId invalido/alucinado
      // por el modelo devolvia el error crudo de Postgrest en vez de
      // este mensaje legible (confirmado en vivo).
      const mat = await Materiales.getById(materialId).catch(() => null)
      if (!mat) return { error: 'Material no encontrado.' }

      const stockNuevo = Number(mat.stock_actual) + num
      return {
        resumen:
          `Sumar ${num} ${mat.unidad} al stock de "${mat.nombre}"` +
          (mat.marca ? ` (${mat.marca})` : '') +
          `: pasaría de ${mat.stock_actual} a ${stockNuevo} ${mat.unidad}.`,
        detalle: {
          materialId, nombre: mat.nombre, marca: mat.marca, unidad: mat.unidad,
          stockActual: Number(mat.stock_actual), cantidad: num, stockNuevo,
        },
      }
    },
    execute: async ({ materialId, cantidad }) => {
      const data = await Materiales.agregarStock(materialId, cantidad)
      return {
        resumen: `Listo — stock de "${data.nombre}" actualizado a ${data.stock_actual} ${data.unidad}.`,
        detalle: data,
      }
    },
  },

  {
    name: 'actualizar_stock_minimo_material',
    description:
      'Propone cambiar el stock_minimo (umbral de reposicion) de un material existente ' +
      '(ej: "bajale el minimo de cemento a 20", "subile el minimo a las arandelas a 100"). ' +
      'Es una ACCION — requiere confirmación explícita del usuario antes de aplicarse.',
    parameters: {
      type: 'object',
      properties: {
        materialId:  { type: 'string', description: 'UUID del material (obtenido con listar_materiales).' },
        stockMinimo: { type: 'number', description: 'Nuevo umbral de stock minimo. Debe ser 0 o mayor.' },
      },
      required: ['materialId', 'stockMinimo'],
    },
    preview: async ({ materialId, stockMinimo } = {}) => {
      const num = Number(stockMinimo)
      if (!Number.isFinite(num) || num < 0) {
        return { error: 'El stock mínimo debe ser un número mayor o igual a 0.' }
      }
      // .getById() usa .single() y TIRA (no devuelve null) si el id no
      // existe — sin el .catch() acá, un materialId invalido/alucinado
      // por el modelo devolvia el error crudo de Postgrest en vez de
      // este mensaje legible (confirmado en vivo).
      const mat = await Materiales.getById(materialId).catch(() => null)
      if (!mat) return { error: 'Material no encontrado.' }
      return {
        resumen:
          `Cambiar el stock mínimo de "${mat.nombre}"` +
          (mat.marca ? ` (${mat.marca})` : '') +
          `: pasaría de ${mat.stock_minimo} a ${num} ${mat.unidad}.`,
        detalle: { materialId, nombre: mat.nombre, stockMinimoActual: Number(mat.stock_minimo), stockMinimoNuevo: num },
      }
    },
    execute: async ({ materialId, stockMinimo }) => {
      const data = await Materiales.update(materialId, { stockMinimo: Number(stockMinimo) })
      return {
        resumen: `Listo — el stock mínimo de "${data.nombre}" ahora es ${data.stock_minimo} ${data.unidad}.`,
        detalle: data,
      }
    },
  },

  {
    name: 'crear_cliente',
    description:
      'Propone dar de alta un cliente nuevo en el directorio (a quien se le hacen obras). ' +
      'Es una ACCION — requiere confirmación explícita del usuario antes de aplicarse.',
    parameters: {
      type: 'object',
      properties: {
        nombre:    { type: 'string', description: 'Nombre o razón social del cliente.' },
        contacto:  { type: 'string', description: 'Nombre de la persona de contacto.' },
        telefono:  { type: 'string' },
        email:     { type: 'string' },
        direccion: { type: 'string' },
        localidad: { type: 'string' },
        provincia: { type: 'string' },
      },
      required: ['nombre'],
    },
    preview: async (args = {}) => {
      if (!args.nombre?.trim()) return { error: 'El nombre del cliente es obligatorio.' }
      return {
        resumen: `Crear el cliente "${args.nombre.trim()}"` +
          (args.telefono ? ` (tel. ${args.telefono})` : '') + '.',
        detalle: args,
      }
    },
    execute: async (args) => {
      const data = await Directorio.createCliente(args)
      return { resumen: `Listo — cliente "${data.nombre}" creado.`, detalle: data }
    },
  },

  {
    name: 'crear_proveedor',
    description:
      'Propone dar de alta un proveedor nuevo en el directorio (de quien se compran materiales/herramientas). ' +
      'Es una ACCION — requiere confirmación explícita del usuario antes de aplicarse.',
    parameters: {
      type: 'object',
      properties: {
        nombre:    { type: 'string', description: 'Nombre o razón social del proveedor.' },
        rubro:     { type: 'string', description: 'Qué provee, ej. "Herramientas eléctricas".' },
        cuit:      { type: 'string' },
        contacto:  { type: 'string' },
        telefono:  { type: 'string' },
        email:     { type: 'string' },
        direccion: { type: 'string' },
        localidad: { type: 'string' },
        provincia: { type: 'string' },
      },
      required: ['nombre'],
    },
    preview: async (args = {}) => {
      if (!args.nombre?.trim()) return { error: 'El nombre del proveedor es obligatorio.' }
      return {
        resumen: `Crear el proveedor "${args.nombre.trim()}"` +
          (args.rubro ? ` (${args.rubro})` : '') + '.',
        detalle: args,
      }
    },
    execute: async (args) => {
      const data = await Directorio.createProveedor(args)
      return { resumen: `Listo — proveedor "${data.nombre}" creado.`, detalle: data }
    },
  },

  {
    name: 'crear_transporte',
    description:
      'Propone dar de alta un transporte nuevo en el directorio (empresa o particular que mueve remitos). ' +
      'Es una ACCION — requiere confirmación explícita del usuario antes de aplicarse.',
    parameters: {
      type: 'object',
      properties: {
        nombre:    { type: 'string', description: 'Nombre de la empresa o persona.' },
        tipo:      { type: 'string', enum: ['EMPRESA', 'PARTICULAR'], description: 'Default EMPRESA si no se especifica.' },
        cuit:      { type: 'string' },
        direccion: { type: 'string' },
        localidad: { type: 'string' },
        provincia: { type: 'string' },
        telefono:  { type: 'string' },
        email:     { type: 'string' },
        contacto:  { type: 'string' },
      },
      required: ['nombre'],
    },
    preview: async (args = {}) => {
      if (!args.nombre?.trim()) return { error: 'El nombre del transporte es obligatorio.' }
      const tipo = args.tipo === 'PARTICULAR' ? 'PARTICULAR' : 'EMPRESA'
      return {
        resumen: `Crear el transporte "${args.nombre.trim()}" (${tipo}).`,
        detalle: { ...args, tipo },
      }
    },
    execute: async (args) => {
      const data = await Directorio.createTransporte(args)
      return { resumen: `Listo — transporte "${data.nombre}" creado.`, detalle: data }
    },
  },

  {
    name: 'crear_material',
    description:
      'Propone dar de alta un material nuevo en el stock (insumo fungible: cemento, ladrillos, etc.) ' +
      'con su stock inicial. Antes de proponerla, si no estás seguro de que no existe ya, ' +
      'llamá a listar_materiales para chequear — si ya existe, usá sumar_stock_material en vez de ' +
      'duplicarlo. Es una ACCION — requiere confirmación explícita del usuario antes de aplicarse.',
    parameters: {
      type: 'object',
      properties: {
        nombre:       { type: 'string', description: 'Nombre del material.' },
        marca:        { type: 'string' },
        descripcion:  { type: 'string' },
        unidad:       { type: 'string', description: 'Unidad de medida, ej. "bolsa", "kg", "unidad". Default "unidad".' },
        stockActual:  { type: 'number', description: 'Stock inicial. Default 0.' },
        stockMinimo:  { type: 'number', description: 'Umbral de reposición. Default 0.' },
      },
      required: ['nombre'],
    },
    preview: async (args = {}) => {
      if (!args.nombre?.trim()) return { error: 'El nombre del material es obligatorio.' }

      // Mismo chequeo de duplicados que usa el frontend antes de crear —
      // evita que el LLM proponga un alta cuando en realidad correspondía
      // sumar_stock_material sobre el material ya existente.
      const existente = await Materiales.findDuplicate({ nombre: args.nombre, marca: args.marca })
      if (existente) {
        return {
          error:
            `Ya existe un material "${existente.nombre}"` +
            (existente.marca ? ` (${existente.marca})` : '') +
            ` con stock ${existente.stock_actual} ${existente.unidad}. ` +
            'Usá sumar_stock_material para sumarle stock en vez de crear uno nuevo.',
        }
      }

      const stockActual  = Number(args.stockActual)  || 0
      const stockMinimo  = Number(args.stockMinimo)  || 0
      const unidad = args.unidad || 'unidad'
      return {
        resumen:
          `Crear el material "${args.nombre.trim()}"` +
          (args.marca ? ` (${args.marca})` : '') +
          ` con stock inicial ${stockActual} ${unidad} (mínimo ${stockMinimo} ${unidad}).`,
        detalle: { ...args, stockActual, stockMinimo, unidad },
      }
    },
    execute: async (args) => {
      const data = await Materiales.create(args)
      return { resumen: `Listo — material "${data.nombre}" creado con stock ${data.stock_actual} ${data.unidad}.`, detalle: data }
    },
  },

  {
    name: 'cambiar_estado_herramienta',
    description:
      'Propone cambiar el estado de una herramienta entre DISPONIBLE, EN_MANTENIMIENTO y RESERVADA ' +
      '(ej: "mandá el taladro a mantenimiento", "la amoladora ya está disponible de nuevo"). ' +
      'NO sirve para EN_OBRA (eso se maneja con remitos) ni para BAJA (eso requiere un motivo y ' +
      'todavía no tiene tool — decile al usuario que la dé de baja desde el módulo de Herramientas). ' +
      'Es una ACCION — requiere confirmación explícita del usuario antes de aplicarse.',
    parameters: {
      type: 'object',
      properties: {
        herramientaId: { type: 'string', description: 'UUID de la herramienta (obtenido con listar_herramientas).' },
        estado: {
          type: 'string',
          enum: ESTADOS_HERRAMIENTA_VALIDOS,
          description: 'Nuevo estado. Solo DISPONIBLE, EN_MANTENIMIENTO o RESERVADA.',
        },
      },
      required: ['herramientaId', 'estado'],
    },
    preview: async ({ herramientaId, estado } = {}) => {
      if (!ESTADOS_HERRAMIENTA_VALIDOS.includes(estado)) {
        return { error: `Estado inválido para esta acción: ${estado}. Válidos: ${ESTADOS_HERRAMIENTA_VALIDOS.join(', ')}.` }
      }
      // Mismo caso que Materiales.getById: .single() tira si no existe.
      const h = await Herramientas.getById(herramientaId).catch(() => null)
      if (!h) return { error: 'Herramienta no encontrada.' }
      if (h.estado === 'BAJA') {
        return { error: `"${h.nombre}" está de BAJA — hay que reactivarla desde el módulo de Herramientas, no desde acá.` }
      }
      if (h.estado === estado) {
        return { error: `"${h.nombre}" ya está en estado ${estado}.` }
      }
      return {
        resumen: `Cambiar el estado de "${h.nombre}" de ${h.estado} a ${estado}.`,
        detalle: { herramientaId, nombre: h.nombre, estadoActual: h.estado, estadoNuevo: estado },
      }
    },
    execute: async ({ herramientaId, estado }) => {
      const data = await Herramientas.updateEstado(herramientaId, estado)
      return { resumen: `Listo — "${data.nombre}" ahora está ${data.estado}.`, detalle: data }
    },
  },

  {
    name: 'crear_obra',
    description:
      'Propone dar de alta una obra nueva. Necesita el cliente ya existente — si no sabés su ' +
      'clienteId, llamá primero a listar_clientes para resolverlo por nombre. ' +
      'Es una ACCION — requiere confirmación explícita del usuario antes de aplicarse.',
    parameters: {
      type: 'object',
      properties: {
        nombre:      { type: 'string', description: 'Nombre de la obra.' },
        direccion:   { type: 'string', description: 'Dirección de la obra.' },
        clienteId:   { type: 'string', description: 'UUID del cliente (obtenido con listar_clientes).' },
        fechaInicio: { type: 'string', description: 'Fecha de inicio, formato YYYY-MM-DD. Si el usuario no la da, usá la fecha de hoy.' },
      },
      required: ['nombre', 'direccion', 'clienteId', 'fechaInicio'],
    },
    preview: async (args = {}) => {
      if (!args.nombre?.trim())      return { error: 'El nombre de la obra es obligatorio.' }
      if (!args.direccion?.trim())   return { error: 'La dirección es obligatoria.' }
      if (!args.clienteId)           return { error: 'Falta el cliente — resolvé el clienteId con listar_clientes primero.' }
      if (!args.fechaInicio)         return { error: 'Falta la fecha de inicio.' }

      const clientes = await Directorio.getAllClientes({})
      const cliente = clientes.find(c => c.id === args.clienteId)
      if (!cliente) return { error: 'Cliente no encontrado — verificá el clienteId con listar_clientes.' }

      return {
        resumen: `Crear la obra "${args.nombre.trim()}" para ${cliente.nombre}, en ${args.direccion.trim()}, inicio ${args.fechaInicio}.`,
        detalle: { ...args, clienteNombre: cliente.nombre },
      }
    },
    execute: async (args) => {
      const data = await Obras.create(args)
      return { resumen: `Listo — obra "${data.nombre}" creada.`, detalle: data }
    },
  },

  {
    name: 'crear_presupuesto_guiado',
    description:
      'Propone crear un presupuesto completo (materiales + mano de obra) para una obra, armado a lo ' +
      'largo de la conversación: primero se resuelve la obra, despues se van juntando materiales ' +
      'confirmados uno por uno via listar_materiales (nunca inventes un materialId), y por ultimo se ' +
      'preguntan los datos de mano de obra. Llamá a esta tool UNA sola vez, al final, con TODO ya ' +
      'confirmado por el usuario — nunca antes de tener obra + al menos un material + los 3 datos de ' +
      'mano de obra. Es una ACCION — requiere confirmación explícita del usuario antes de aplicarse.',
    parameters: {
      type: 'object',
      properties: {
        obraId: { type: 'string', description: 'UUID de la obra (existente, o recien creada en este mismo turno).' },
        materiales: {
          type: 'array',
          description: 'Lista de materiales a incluir. Cada uno YA resuelto contra el catálogo real (via listar_materiales) o marcado como nuevo si no existe.',
          items: {
            type: 'object',
            properties: {
              materialId: { type: 'string', description: 'UUID si el material ya existe en el catálogo.' },
              materialNuevoNombre:  { type: 'string', description: 'Nombre, solo si el material NO existe y hay que crearlo.' },
              materialNuevoMarca:   { type: 'string' },
              materialNuevoUnidad:  { type: 'string', description: 'Default "unidad".' },
              cantidad: { type: 'number', description: 'Cantidad de este material. Debe ser mayor a 0.' },
            },
            required: ['cantidad'],
          },
        },
        empleados:            { type: 'number', description: 'Cantidad de empleados asignados.' },
        diasEstimados:        { type: 'number', description: 'Cantidad de días de trabajo estimados.' },
        costoPorEmpleadoDia:  { type: 'number', description: 'Costo por empleado por día, en ARS.' },
      },
      required: ['obraId', 'materiales', 'empleados', 'diasEstimados', 'costoPorEmpleadoDia'],
    },
    preview: async ({ obraId, materiales, empleados, diasEstimados, costoPorEmpleadoDia } = {}) => {
      if (!obraId) return { error: 'Falta la obra.' }
      // Igual que Materiales.getById: usa .single() y TIRA si el id no existe
      // en vez de devolver null — capturamos para dar un mensaje legible.
      const obra = await Obras.getById(obraId).catch(() => null)
      if (!obra) return { error: 'Obra no encontrada — verificá el obraId con listar_obras.' }

      if (!Array.isArray(materiales) || materiales.length === 0) {
        return { error: 'El presupuesto necesita al menos un material.' }
      }
      const emp  = Number(empleados)
      const dias = Number(diasEstimados)
      const costoDia = Number(costoPorEmpleadoDia)
      if (!Number.isFinite(emp) || emp <= 0)      return { error: 'La cantidad de empleados debe ser mayor a 0.' }
      if (!Number.isFinite(dias) || dias <= 0)    return { error: 'La cantidad de días debe ser mayor a 0.' }
      if (!Number.isFinite(costoDia) || costoDia < 0) return { error: 'El costo por empleado/día debe ser 0 o mayor.' }

      const items = []
      for (const m of materiales) {
        const cantidad = Number(m?.cantidad)
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
          return { error: `Cantidad inválida para un material: ${m?.cantidad}. Debe ser mayor a 0.` }
        }

        if (m.materialId) {
          // Materiales.getById usa .single() — TIRA (no devuelve null) si el id
          // no existe. Confirmado en vivo: un materialId invalido/alucinado por
          // el modelo hacia explotar esto con el error crudo de Postgrest
          // ("Cannot coerce the result to a single JSON object") en vez de un
          // mensaje legible.
          const mat = await Materiales.getById(m.materialId).catch(() => null)
          if (!mat) return { error: `Material no encontrado (id: ${m.materialId}). Volvé a buscarlo con listar_materiales.` }
          const precioRef = await Materiales.getPrecioReferencia(m.materialId).catch(() => null)
          items.push({
            materialId: m.materialId, esNuevo: false,
            nombre: mat.nombre, marca: mat.marca, unidad: mat.unidad,
            cantidad, precioUnitario: precioRef?.precio ?? 0,
            sinPrecioReferencia: !precioRef,
          })
        } else if (m.materialNuevoNombre?.trim()) {
          const existente = await Materiales.findDuplicate({ nombre: m.materialNuevoNombre, marca: m.materialNuevoMarca })
          if (existente) {
            return {
              error: `Ya existe un material "${existente.nombre}"` +
                (existente.marca ? ` (${existente.marca})` : '') +
                ` — usá materialId: "${existente.id}" en vez de crear uno nuevo.`,
            }
          }
          items.push({
            materialId: null, esNuevo: true,
            nombre: m.materialNuevoNombre.trim(), marca: m.materialNuevoMarca || null,
            unidad: m.materialNuevoUnidad || 'unidad',
            cantidad, precioUnitario: 0, sinPrecioReferencia: true,
          })
        } else {
          return { error: 'Cada material necesita materialId (si existe) o materialNuevoNombre (si hay que crearlo).' }
        }
      }

      const costoManoObra = emp * dias * costoDia
      const lineasMateriales = items.map(i =>
        `· ${i.cantidad} ${i.unidad} de "${i.nombre}"${i.marca ? ` (${i.marca})` : ''}` +
        (i.esNuevo ? ' [material nuevo]' : '') +
        (i.sinPrecioReferencia ? ' — sin precio de referencia, se carga en $0' : ` — $${i.precioUnitario}/u`)
      ).join('\n')

      return {
        resumen:
          `Crear presupuesto para "${obra.nombre}":\n${lineasMateriales}\n` +
          `· Mano de obra: ${emp} empleado${emp === 1 ? '' : 's'} x ${dias} día${dias === 1 ? '' : 's'} ` +
          `x $${costoDia}/día = $${costoManoObra}.`,
        detalle: { obraId, obraNombre: obra.nombre, items, empleados: emp, diasEstimados: dias, costoPorEmpleadoDia: costoDia, costoManoObra },
      }
    },
    execute: async ({ obraId, materiales, empleados, diasEstimados, costoPorEmpleadoDia }) => {
      const presupuesto = await Presupuestos.create({ obraId })

      // Sin transacción: si algo falla a mitad de camino, el presupuesto
      // BORRADOR ya creado (con lo que se haya alcanzado a cargar) queda
      // completamente editable a mano en la UI — no hace falta rollback.
      for (const m of materiales) {
        let materialId = m.materialId
        if (!materialId) {
          const nuevo = await Materiales.create({
            nombre: m.materialNuevoNombre, marca: m.materialNuevoMarca,
            unidad: m.materialNuevoUnidad || 'unidad',
          })
          materialId = nuevo.id
        }
        const precioRef = await Materiales.getPrecioReferencia(materialId).catch(() => null)
        await Presupuestos.addInsumo(presupuesto.id, {
          materialId, cantidad: Number(m.cantidad), precioUnitario: precioRef?.precio ?? 0,
        })
      }

      const emp = Number(empleados), dias = Number(diasEstimados), costoDia = Number(costoPorEmpleadoDia)
      await Presupuestos.addCosto(presupuesto.id, {
        categoria: 'MANO_OBRA',
        descripcion: `Mano de obra (${emp} empleado${emp === 1 ? '' : 's'} x ${dias} día${dias === 1 ? '' : 's'})`,
        cantidad: emp * dias,
        unidad: 'jornal',
        costoUnitario: costoDia,
      })

      return {
        resumen: `Listo — presupuesto Nº ${presupuesto.numero} creado con ${materiales.length} insumo${materiales.length === 1 ? '' : 's'} y mano de obra por $${emp * dias * costoDia}.`,
        detalle: presupuesto,
      }
    },
  },

  {
    name: 'marcar_notificaciones_leidas',
    description:
      'Propone marcar TODAS las notificaciones no leídas del sistema como leídas. ' +
      'Es una ACCION — requiere confirmación explícita del usuario antes de aplicarse.',
    parameters: { type: 'object', properties: {} },
    preview: async () => {
      // Conteo puro — Notificaciones.getAll() trae columnas + join y esta
      // capado a 15 (pensado para la campanita), así que usarlo acá daba un
      // numero que podia no coincidir con lo que marcarTodasLeidas() aplica.
      const cantidad = await Notificaciones.contarNoLeidas()
      if (!cantidad) return { error: 'No hay notificaciones sin leer.' }
      return {
        resumen: `Marcar ${cantidad} notificación${cantidad === 1 ? '' : 'es'} no leída${cantidad === 1 ? '' : 's'} como leída${cantidad === 1 ? '' : 's'}.`,
        detalle: { cantidad },
      }
    },
    execute: async () => {
      await Notificaciones.marcarTodasLeidas()
      return { resumen: 'Listo — todas las notificaciones quedaron marcadas como leídas.', detalle: {} }
    },
  },
]

export function getWriteDeclarations() {
  return WRITE_TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }))
}

export function findWriteTool(name) {
  return WRITE_TOOLS.find(t => t.name === name) || null
}

/** Preview de una tool de escritura — nunca escribe, nunca tira. */
export async function previewWriteTool(name, args) {
  const tool = findWriteTool(name)
  if (!tool) return { error: `Tool de escritura desconocida: ${name}` }
  try {
    return await tool.preview(args || {})
  } catch (err) {
    return { error: err.message || 'Error armando la vista previa' }
  }
}

/** Ejecuta la escritura real — SOLO se debe llamar tras confirmación del usuario. */
export async function executeWriteTool(name, args) {
  const tool = findWriteTool(name)
  if (!tool) {
    const err = new Error(`Tool de escritura desconocida: ${name}`)
    err.status = 400
    throw err
  }
  return tool.execute(args || {})
}
