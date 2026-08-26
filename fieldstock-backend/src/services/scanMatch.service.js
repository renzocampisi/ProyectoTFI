// src/services/scanMatch.service.js
/**
 * "Scan & Match" — lee un remito/factura de un proveedor (foto o PDF) y
 * propone a qué ítem de una orden de compra puntual corresponde cada línea.
 *
 * Flujo (ver _plans/scan-match-remitos):
 *   1. proponer(): UNA llamada a Gemini con la imagen/PDF + los ítems de esa
 *      compra como contexto. Devuelve la propuesta de matching. NO escribe
 *      nada en la base — es una lectura.
 *   2. confirmar(): el usuario ya revisó/corrigió la propuesta en el
 *      frontend. Por cada línea sin ítem existente (material nuevo, o
 *      material del catálogo que no estaba en esta orden), da de alta el
 *      material si hace falta y lo suma a la compra con
 *      `addItem(..., { skipEstadoCheck: true })` — el mismo bypass que ya
 *      usa `ComprasService.create()`, no uno nuevo. Con todos los ítems ya
 *      resueltos a un itemId real, llama a `ComprasService.recibir()` tal
 *      cual existe hoy.
 *
 * `skipEstadoCheck` queda encapsulado acá adentro — nunca se expone como
 * parámetro controlable desde el body de un endpoint HTTP.
 */
import * as Provider    from './panel/provider.js'
import * as ComprasService from './compras.service.js'
import * as MaterialesService from './materiales.service.js'

const ESTADOS_RECEPTIBLES = ['CONFIRMADA', 'RECIBIDA_PARCIAL']

function bad(msg) { const e = new Error(msg); e.status = 400; return e }

// JSON Schema de la propuesta — mismo subset que ya usa panel/writeTools.js
// para `parameters`. `compraItemId` es un string libre (no enum) porque
// Gemini exige que el enum sea no vacío incluso en el caso de una compra sin
// ítems; se valida el valor devuelto contra la lista real más abajo.
const SCAN_MATCH_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          textoProveedor:    { type: 'string',  description: 'Descripción del ítem tal como aparece escrita en el documento.' },
          cantidadDetectada: { type: 'number',  description: 'Cantidad leída en el documento para esta línea.' },
          unidadDetectada:   { type: 'string',  description: 'Unidad tal como aparece en el documento (puede venir vacía).' },
          compraItemId:      { type: 'string',  description: 'itemId de la lista de candidatos que mejor corresponde a esta línea, o cadena vacía si ninguno matchea.' },
          confianza:         { type: 'string',  enum: ['alta', 'media', 'baja'], description: 'Qué tan seguro estás de este match.' },
        },
        required: ['textoProveedor', 'cantidadDetectada', 'compraItemId', 'confianza'],
      },
    },
  },
  required: ['items'],
}

function construirPrompt(compra, candidatos) {
  const lista = candidatos
    .map(c => `- itemId="${c.itemId}" | ${c.nombre}${c.marca ? ` (${c.marca})` : ''} | unidad: ${c.unidad} | pedido: ${c.cantidadPedida} | ya recibido: ${c.cantidadRecibida}`)
    .join('\n')

  return `Sos un asistente que lee remitos y facturas de proveedores de una
constructora (cañerías, válvulas, materiales de obra) y los matchea contra
una orden de compra puntual ya cargada en el sistema.

ORDEN DE COMPRA: ${compra.numero} — proveedor: ${compra.proveedor_nombre || 'desconocido'}.
ÍTEMS PEDIDOS EN ESTA ORDEN (los únicos candidatos válidos para "compraItemId"):
${lista || '(esta orden no tiene ítems pendientes)'}

Tarea: mirá la imagen o PDF adjunto (remito o factura del proveedor) y por
cada línea de producto que encuentres:
1. Transcribí el texto tal como lo escribió el proveedor (textoProveedor).
2. Leé la cantidad (cantidadDetectada) y la unidad si aparece (unidadDetectada).
3. Elegí, de la lista de ítems pedidos de arriba, cuál corresponde técnicamente
   a esa línea — aunque el proveedor use abreviaturas o nomenclatura distinta
   a la del catálogo (ej: "VÁLV. ESF. BR. INOX DN50 150#" puede corresponder
   a "Válvula esférica bradada AISI 316 2 pulgadas ANSI 150"). Poné el
   "itemId" exacto de la lista en "compraItemId".
4. Si ninguno de los ítems pedidos corresponde a esa línea, dejá
   "compraItemId" como cadena vacía "".
5. Asigná "confianza": "alta" si estás seguro de la equivalencia técnica,
   "media" si es razonable pero no obvio, "baja" si es una suposición débil
   o no encontraste ningún candidato.

No inventes líneas que no estén en el documento. No asumas cantidades que no
puedas leer — si no la ves clara, poné tu mejor estimación y confianza "baja".`
}

/**
 * Extrae los ítems del documento y los matchea contra los ítems pendientes
 * de UNA compra puntual. Pura lectura — no escribe nada en la base.
 */
export async function proponer(compraId, { buffer, mimeType }) {
  if (!buffer || !buffer.length) throw bad('Falta el archivo (field: archivo)')

  const compra = await ComprasService.getById(compraId)
  if (!compra) { const e = new Error('Compra no encontrada'); e.status = 404; throw e }
  if (!ESTADOS_RECEPTIBLES.includes(compra.estado)) {
    throw bad(`No se puede escanear un remito para una compra en estado ${compra.estado}`)
  }

  const candidatos = (compra.items || []).map(it => ({
    itemId:           it.id,
    nombre:           it.material_nombre || it.material?.nombre || '(sin nombre)',
    marca:            it.material?.marca || null,
    unidad:           it.material_unidad || it.material?.unidad || 'unidad',
    cantidadPedida:   Number(it.cantidad),
    cantidadRecibida: Number(it.cantidad_recibida) || 0,
  }))

  const { text } = await Provider.chat({
    system: construirPrompt(compra, candidatos),
    contents: [{
      role: 'user',
      parts: [
        { text: 'Extraé y matcheá los ítems de este remito/factura.' },
        { inlineData: { mimeType, data: buffer.toString('base64') } },
      ],
    }],
    responseSchema: SCAN_MATCH_SCHEMA,
  })

  if (!text) {
    throw Object.assign(new Error('No se pudo leer el documento. Probá con otra foto o con el PDF.'), { status: 502 })
  }

  let propuesta
  try {
    propuesta = JSON.parse(text)
  } catch {
    throw Object.assign(new Error('No se pudo interpretar la respuesta del modelo. Probá de nuevo.'), { status: 502 })
  }

  const idsValidos = new Set(candidatos.map(c => c.itemId))
  const items = (propuesta.items || []).map(it => ({
    textoProveedor:    it.textoProveedor || '',
    cantidadDetectada: Number(it.cantidadDetectada) || 0,
    unidadDetectada:   it.unidadDetectada || null,
    // Defensivo: si el modelo alucina un itemId que no está en la lista de
    // candidatos, lo tratamos como "sin match" en vez de propagar un id roto.
    compraItemId:      idsValidos.has(it.compraItemId) ? it.compraItemId : null,
    confianza:         ['alta', 'media', 'baja'].includes(it.confianza) ? it.confianza : 'baja',
  }))

  return { compraId, compraNumero: compra.numero, items, candidatos }
}

/**
 * Aplica la propuesta ya revisada/corregida por el usuario.
 *
 * @param {string} compraId
 * @param {Array}  itemsConfirmados  Cada línea trae exactamente UNO de:
 *   - compraItemId: string           → ya matcheaba un ítem existente
 *   - materialIdExistente: string    → el usuario eligió del catálogo (no estaba en esta orden)
 *   - materialNuevo: { nombre, marca?, unidad } → hay que crearlo
 *   más `cantidadRecibida: number` — SIEMPRE "cuánto llegó ahora" (delta),
 *   igual criterio que RecepcionModal. Acá se convierte a total absoluto
 *   contra el `cantidad_recibida` real de cada item antes de llamar a
 *   `recibir()` — no confiamos en un absoluto pre-calculado por el
 *   frontend, evita carreras con datos desactualizados.
 */
export async function confirmar(compraId, itemsConfirmados) {
  if (!Array.isArray(itemsConfirmados) || !itemsConfirmados.length) {
    throw bad('No se enviaron items para confirmar')
  }

  const compra = await ComprasService.getById(compraId)
  if (!compra) { const e = new Error('Compra no encontrada'); e.status = 404; throw e }
  const recibidoPrevioPorItem = new Map(
    (compra.items || []).map(it => [it.id, Number(it.cantidad_recibida) || 0])
  )

  const itemsParaRecibir = []

  for (const linea of itemsConfirmados) {
    const recibidoAhora = Number(linea.cantidadRecibida)
    if (!Number.isFinite(recibidoAhora) || recibidoAhora <= 0) {
      throw bad('cantidadRecibida debe ser un número mayor a 0 en todas las líneas')
    }

    let itemId = linea.compraItemId || null
    let recibidoPrevio = itemId ? (recibidoPrevioPorItem.get(itemId) ?? 0) : 0

    if (!itemId) {
      let materialId = linea.materialIdExistente || null

      if (!materialId) {
        if (!linea.materialNuevo?.nombre?.trim()) {
          throw bad('Cada línea sin match necesita compraItemId, materialIdExistente o materialNuevo')
        }
        const nuevo = await MaterialesService.create({
          nombre: linea.materialNuevo.nombre,
          marca:  linea.materialNuevo.marca || null,
          unidad: linea.materialNuevo.unidad || 'unidad',
        })
        materialId = nuevo.id
      }

      // El remito no suele traer precio (eso lo trae la factura) — se
      // carga en 0 y se corrige después desde el detalle de la compra,
      // que ya soporta editar el precio de un ítem. `cantidad` (lo
      // "pedido") se completa igual a lo recibido — nunca se pidió
      // formalmente, así que no hay otro valor razonable.
      const nuevoItem = await ComprasService.addItem(
        compraId,
        { materialId, cantidad: recibidoAhora, precioUnitario: 0 },
        { skipEstadoCheck: true }
      )
      itemId = nuevoItem.id
      recibidoPrevio = 0
    }

    itemsParaRecibir.push({ itemId, cantidadRecibida: recibidoPrevio + recibidoAhora })
  }

  return ComprasService.recibir(compraId, { items: itemsParaRecibir })
}
