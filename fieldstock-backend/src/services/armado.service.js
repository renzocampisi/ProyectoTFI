// src/services/armado.service.js
/**
 * "Kits de Montaje" — arma un presupuesto o un remito a partir de una
 * descripción en lenguaje natural.
 *
 * El usuario dicta o escribe algo como "3 metros de caño Sch 40 de 2
 * pulgadas, 2 codos de 90, una válvula esférica". La IA SOLO interpreta la
 * frase y resuelve cada ítem contra el catálogo — nunca decide cuánto lleva
 * algo. Ver _plans/kits-montaje/ para el porqué de esa separación (no existe
 * una fórmula estándar de cañería que se pueda aplicar sin inventar datos).
 *
 * Flujo:
 *   1. interpretar(): una llamada a Gemini con el catálogo como universo de
 *      candidatos. Si el destino es REMITO, clasifica cada línea según el
 *      stock disponible. NO escribe nada.
 *   2. confirmar(): con la propuesta ya revisada por el usuario, compone los
 *      services existentes (obras / presupuestos / remitos / compras /
 *      materiales). Revalida TODO antes de escribir la primera fila, mismo
 *      criterio que kits.agregarARemito.
 *
 * Si el destino es PRESUPUESTO no hace falta puente hacia el remito: la RPC
 * `aprobar_presupuesto` ya crea el remito en BORRADOR y le copia los insumos
 * cuando el presupuesto se aprueba.
 */
import * as Provider     from './panel/provider.js'
import * as Materiales   from './materiales.service.js'
import * as Obras        from './obras.service.js'
import * as Presupuestos from './presupuestos.service.js'
import * as Remitos      from './remitos.service.js'
import * as Compras      from './compras.service.js'

export const DESTINOS = ['PRESUPUESTO', 'REMITO']

// Tope de materiales que se mandan como contexto al modelo. Hoy el catálogo
// real ronda las decenas y entra cómodo. Si crece por encima de esto, el
// prompt se infla y el matcheo empeora — habría que prefiltrar por palabras
// del texto antes de llamar al modelo (ver riesgos en el plan).
const CAP_CATALOGO = 200

// Placeholder de responsable, igual al que usa la RPC aprobar_presupuesto
// al generar un remito. Así los dos caminos se comportan igual y el usuario
// lo completa después desde el detalle del remito.
const RESPONSABLE_PLACEHOLDER = '-- por completar --'

function bad(msg, status = 400) { const e = new Error(msg); e.status = status; return e }

const ARMADO_SCHEMA = {
  type: 'object',
  properties: {
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          textoOriginal: { type: 'string', description: 'El fragmento de la frase del que salió esta línea.' },
          cantidad:      { type: 'number', description: 'Cantidad que el usuario enunció. Nunca la estimes vos.' },
          unidad:        { type: 'string', description: 'Unidad enunciada (metros, unidad, caja...). Vacío si no la dijo.' },
          materialId:    { type: 'string', description: 'id del material del catálogo que corresponde, o cadena vacía si ninguno.' },
          confianza:     { type: 'string', enum: ['alta', 'media', 'baja'] },
        },
        required: ['textoOriginal', 'cantidad', 'materialId', 'confianza'],
      },
    },
  },
  required: ['lineas'],
}

function construirPrompt(catalogo) {
  const lista = catalogo
    .map(m => `- id="${m.id}" | ${m.nombre}${m.marca ? ` (${m.marca})` : ''} | unidad: ${m.unidad}`)
    .join('\n')

  return `Sos un asistente de una empresa constructora que interpreta pedidos de
material dictados o escritos por el encargado de depósito.

CATÁLOGO DE MATERIALES (único universo válido para "materialId"):
${lista || '(el catálogo está vacío)'}

Tarea: leé la frase del usuario y devolvé UNA LÍNEA por cada material que
mencione, con:
1. "textoOriginal": el fragmento de la frase del que sacaste esa línea.
2. "cantidad": el número que el usuario dijo para ese ítem.
3. "unidad": la unidad que dijo, si la dijo.
4. "materialId": el id EXACTO del catálogo de arriba que corresponde
   técnicamente a lo que describió, aunque use abreviaturas o nomenclatura
   distinta (ej: "caño inox de 2" puede corresponder a "Caño Inoxidable").
   Si ninguno del catálogo corresponde, dejá "materialId" como "".
5. "confianza": "alta" si la equivalencia es clara, "media" si es razonable
   pero no obvia, "baja" si es una suposición débil o no encontraste
   candidato.

REGLA CRÍTICA: no inventes NUNCA cantidades. Devolvé solo lo que el usuario
enunció explícitamente. Si dice "un ramal de 18 metros" sin detallar piezas,
devolvés esa sola línea — no agregues codos, cuplas ni bulones que no
mencionó. Tampoco agregues líneas "sugeridas" ni completes un kit típico.`
}

/**
 * Interpreta la frase y arma la propuesta. Pura lectura.
 *
 * @param {object} params
 * @param {string} params.texto   Frase dictada o escrita.
 * @param {string} params.destino 'PRESUPUESTO' | 'REMITO'
 */
export async function interpretar({ texto, destino }) {
  if (!texto || !texto.trim()) throw bad('Escribí o dictá qué materiales necesitás')
  if (!DESTINOS.includes(destino)) throw bad(`destino inválido: ${destino}`)

  const catalogoCompleto = await Materiales.getAll()
  const catalogo = (catalogoCompleto || []).slice(0, CAP_CATALOGO)

  const { text } = await Provider.chat({
    system:   construirPrompt(catalogo),
    contents: [{ role: 'user', parts: [{ text: texto.trim() }] }],
    responseSchema: ARMADO_SCHEMA,
  })

  if (!text) {
    throw bad('No se pudo interpretar el pedido. Probá reformularlo.', 502)
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw bad('No se pudo interpretar la respuesta del modelo. Probá de nuevo.', 502)
  }

  const porId = new Map(catalogo.map(m => [m.id, m]))

  const lineas = (parsed.lineas || []).map(l => {
    // Defensivo: un materialId alucinado que no esté en el catálogo se trata
    // como "sin match" en vez de propagar un id roto (igual que Scan & Match).
    const material = porId.get(l.materialId) || null
    const cantidad = Number(l.cantidad) || 0

    const base = {
      textoOriginal:  l.textoOriginal || '',
      cantidad,
      unidad:         l.unidad || material?.unidad || 'unidad',
      materialId:     material?.id ?? null,
      materialNombre: material?.nombre ?? null,
      stockActual:    material ? Number(material.stock_actual) : null,
      confianza:      ['alta', 'media', 'baja'].includes(l.confianza) ? l.confianza : 'baja',
    }

    // En un presupuesto no se mira stock: es una cotización, no mueve
    // material. El reparto recién aplica si el destino es un remito.
    if (destino === 'PRESUPUESTO') return base

    return { ...base, ...repartirPorStock(base) }
  })

  return { destino, lineas }
}

/** Decide cuánto de una línea sale del depósito y cuánto hay que comprar. */
function repartirPorStock({ materialId, cantidad, stockActual }) {
  if (!materialId) {
    return { alRemito: 0, aComprar: cantidad, motivo: 'SIN_MATCH' }
  }
  const stock = Number(stockActual) || 0
  if (stock <= 0)        return { alRemito: 0, aComprar: cantidad, motivo: 'SIN_STOCK' }
  if (stock >= cantidad) return { alRemito: cantidad, aComprar: 0, motivo: 'OK' }
  return { alRemito: stock, aComprar: cantidad - stock, motivo: 'PARCIAL' }
}

/**
 * Aplica la propuesta ya revisada por el usuario.
 *
 * @param {object} payload
 * @param {string} payload.destino     'PRESUPUESTO' | 'REMITO'
 * @param {string=} payload.obraId     Obra existente.
 * @param {object=} payload.obraNueva  { nombre, direccion, clienteId?, fechaInicio } si es obra nueva.
 * @param {Array}  payload.lineas      Cada una con cantidad + UNO de: materialId | materialNuevo.
 *                                     Si destino REMITO, además alRemito / aComprar.
 * @param {string=} payload.proveedorId Para la orden de compra de faltantes.
 *                                     Sin esto no se crea orden (opción "decidir después").
 */
export async function confirmar(payload = {}) {
  const { destino, obraId, obraNueva, lineas, proveedorId } = payload

  if (!DESTINOS.includes(destino)) throw bad(`destino inválido: ${destino}`)
  if (!Array.isArray(lineas) || !lineas.length) throw bad('No hay líneas para confirmar')
  if (!obraId && !obraNueva?.nombre?.trim()) {
    throw bad('Elegí una obra existente o completá los datos de la obra nueva')
  }

  // ── Validación previa de TODAS las líneas ────────────────────
  // Se valida todo antes de escribir la primera fila para no dejar un
  // remito/presupuesto a medio armar (mismo criterio que kits.agregarARemito).
  for (const l of lineas) {
    const cantidad = Number(l.cantidad)
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw bad(`Cantidad inválida en "${l.textoOriginal || 'una línea'}"`)
    }
    if (!l.materialId && !l.materialNuevo?.nombre?.trim()) {
      throw bad(`"${l.textoOriginal || 'Una línea'}" no tiene material asignado`)
    }
    if (destino === 'REMITO') {
      const alRemito = Number(l.alRemito) || 0
      const aComprar = Number(l.aComprar) || 0
      if (alRemito + aComprar > cantidad) {
        throw bad(`El reparto de "${l.textoOriginal}" supera la cantidad pedida`)
      }
      // El stock pudo cambiar entre interpretar() y confirmar(). Revalidamos
      // acá para fallar limpio en vez de a mitad de la carga.
      if (alRemito > 0 && l.materialId) {
        const mat = await Materiales.getById(l.materialId).catch(() => null)
        if (!mat) throw bad(`Material no encontrado (id: ${l.materialId})`, 404)
        if (Number(mat.stock_actual) < alRemito) {
          throw bad(
            `Cambió el stock de "${mat.nombre}": querías sacar ${alRemito} y ahora hay ${mat.stock_actual}. ` +
            'Volvé a interpretar el pedido.',
            409
          )
        }
      }
    }
  }

  // ── Obra ─────────────────────────────────────────────────────
  let obra
  if (obraId) {
    obra = await Obras.getById(obraId).catch(() => null)
    if (!obra) throw bad('Obra no encontrada', 404)
  } else {
    obra = await Obras.create({
      nombre:      obraNueva.nombre.trim(),
      direccion:   obraNueva.direccion || null,
      clienteId:   obraNueva.clienteId || null,
      fechaInicio: obraNueva.fechaInicio || new Date().toISOString().split('T')[0],
    })
  }

  // Da de alta los materiales que no existían en el catálogo. Se hace acá,
  // después de validar todo, para no crear materiales sueltos si algo falla.
  const resueltas = []
  for (const l of lineas) {
    let materialId = l.materialId || null
    if (!materialId) {
      const nuevo = await Materiales.create({
        nombre: l.materialNuevo.nombre,
        marca:  l.materialNuevo.marca  || null,
        unidad: l.materialNuevo.unidad || l.unidad || 'unidad',
      })
      materialId = nuevo.id
    }
    resueltas.push({ ...l, materialId, cantidad: Number(l.cantidad) })
  }

  return destino === 'PRESUPUESTO'
    ? confirmarPresupuesto(obra, resueltas)
    : confirmarRemito(obra, resueltas, proveedorId)
}

async function confirmarPresupuesto(obra, lineas) {
  const presupuesto = await Presupuestos.create({ obraId: obra.id })

  for (const l of lineas) {
    // El texto dictado no trae precio. Lo tomamos del histórico de compras
    // (o del precio de referencia del material) y caemos a 0 si nunca se
    // compró — el usuario lo corrige en el presupuesto, que ya lo permite.
    const ref = await Materiales.getPrecioReferencia(l.materialId).catch(() => null)
    await Presupuestos.addInsumo(presupuesto.id, {
      materialId:     l.materialId,
      cantidad:       l.cantidad,
      precioUnitario: Number(ref?.precio) || 0,
    })
  }

  return {
    destino:       'PRESUPUESTO',
    obraId:        obra.id,
    presupuestoId: presupuesto.id,
    insumos:       lineas.length,
  }
}

async function confirmarRemito(obra, lineas, proveedorId) {
  const aRemito  = lineas.filter(l => (Number(l.alRemito) || 0) > 0)
  const aComprar = lineas.filter(l => (Number(l.aComprar) || 0) > 0)

  let remitoId = null
  if (aRemito.length) {
    const remito = await Remitos.create({
      obra:        obra.nombre,
      responsable: RESPONSABLE_PLACEHOLDER,
      observacion: 'Generado desde Kits de Montaje',
    })
    remitoId = remito.id

    for (const l of aRemito) {
      await Remitos.addMaterial(remitoId, {
        materialId: l.materialId,
        cantidad:   Number(l.alRemito),
        unidad:     l.unidad,
      })
    }
  }

  // Sin proveedor no se crea la orden — es la opción "decidir después".
  // Los faltantes vuelven en la respuesta para que el usuario los tenga a
  // mano cuando sepa a quién comprarle.
  let compraId = null
  if (aComprar.length && proveedorId) {
    const compra = await Compras.create({
      proveedorId,
      observaciones: `Faltantes de Kits de Montaje — obra ${obra.nombre}`,
      items: aComprar.map(l => ({
        materialId:     l.materialId,
        cantidad:       Number(l.aComprar),
        precioUnitario: 0,
      })),
    })
    compraId = compra.id
  }

  return {
    destino:   'REMITO',
    obraId:    obra.id,
    remitoId,
    compraId,
    materialesAlRemito: aRemito.length,
    faltantes: aComprar.map(l => ({
      materialId: l.materialId,
      nombre:     l.materialNombre || l.materialNuevo?.nombre || l.textoOriginal,
      cantidad:   Number(l.aComprar),
      unidad:     l.unidad,
    })),
  }
}
