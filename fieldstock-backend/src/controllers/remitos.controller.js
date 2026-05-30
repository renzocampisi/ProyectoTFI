// src/controllers/remitos.controller.js
/**
 * Controllers del M5 — Remitos.
 *
 * El controller más grande del proyecto porque cubre toda la máquina de
 * estados + items de herramientas + items de materiales. La lógica real
 * vive en remitos.service.js; acá hay req/res y validación de body.
 *
 * Un handler se sale del patrón thin estándar:
 *  - confirmarEscaneo: lee estado actual ANTES de avanzar para reportar
 *    si fue SALIDA o LLEGADA al cliente que escanea el QR.
 *
 * (reportarProblema antes encadenaba 3 escrituras en el controller — issue
 * #7 lo movió a RemitosService.reportarProblema para respetar la convención
 * controller→service y arreglar un bug de validación en el camino.)
 */
import * as RemitosService from '../services/remitos.service.js'
import { ROLES } from '../constants/roles.js'

export async function getAll(req, res, next) {
  try {
    const { estado, q } = req.query
    const data = await RemitosService.getAll({ estado, q })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getById(req, res, next) {
  try {
    const data = await RemitosService.getById(req.params.id)
    if (!data) return res.status(404).json({ ok: false, error: 'Remito no encontrado' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

// ── Lookup por número (issue #11 — scanner QR) ────────────────
// El QR físico del remito codifica su `numero` (ej: FS-00018), no su UUID.
// Esta función traduce número → registro para que el scanner pueda redirigir.
export async function getByNumero(req, res, next) {
  try {
    const data = await RemitosService.getByNumero(req.params.numero)
    if (!data) return res.status(404).json({ ok: false, error: 'Remito no encontrado' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const { obra, responsable } = req.body
    if (!obra || !responsable)
      return res.status(400).json({ ok: false, error: 'obra y responsable son obligatorios' })
    const data = await RemitosService.create(req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function update(req, res, next) {
  try {
    const data = await RemitosService.update(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function volverABorrador(req, res, next) {
  try {
    const data = await RemitosService.volverABorrador(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

// ── Confirmar escaneo QR del remito (M3 — flujo mobile) ───────
// Endpoint que invoca el escaneo del QR desde el celular. Hace DOBLE uso
// del avance de estado:
//   1er escaneo: CONFIRMADO → EN_TRANSITO (la carga sale del galpón)
//   2do escaneo: EN_TRANSITO → EN_OBRA    (la carga llegó a la obra)
// La respuesta incluye `accion: 'SALIDA' | 'LLEGADA'` para que la app
// mobile pueda mostrar el mensaje correcto.
export async function confirmarEscaneo(req, res, next) {
  try {
    // El service ahora encapsula la validación (estado, conductor obligatorio
    // en SALIDA) y la persistencia del conductor. Mantenemos la respuesta con
    // `accion` arriba del objeto para no romper a la app mobile.
    const { data, accion } = await RemitosService.confirmarEscaneo(
      req.params.id,
      { conductor: req.body?.conductor }
    )
    res.json({ ok: true, data, accion })
  } catch (err) { next(err) }
}

// ── Reportar problema al llegar a la obra ────────────────────
// Variante del 2° escaneo del QR (la carga llegó con un problema). La
// orquestación de las 3 escrituras (update remito + notif + avanzar) vive
// en RemitosService.reportarProblema — ver issue #7 para el contexto del
// refactor + bug fix.
export async function reportarProblema(req, res, next) {
  try {
    // El body acepta { descripcion?, items?, materiales? } — el service
    // valida que al menos algo venga y rechaza con 400 si todo está vacío.
    const data = await RemitosService.reportarProblema(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function addItem(req, res, next) {
  try {
    const { herramientaId } = req.body
    if (!herramientaId)
      return res.status(400).json({ ok: false, error: 'herramientaId es obligatorio' })
    const data = await RemitosService.addItem(req.params.id, req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function removeItem(req, res, next) {
  try {
    await RemitosService.removeItem(req.params.id, req.params.itemId)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function addMaterial(req, res, next) {
  try {
    const { cantidad } = req.body
    if (!cantidad)
      return res.status(400).json({ ok: false, error: 'cantidad es obligatoria' })
    const data = await RemitosService.addMaterial(req.params.id, req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function removeMaterial(req, res, next) {
  try {
    await RemitosService.removeMaterial(req.params.id, req.params.matItemId)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function updateItemRetorno(req, res, next) {
  try {
    const { estadoRetorno } = req.body
    if (!estadoRetorno)
      return res.status(400).json({ ok: false, error: 'estadoRetorno es obligatorio' })
    const data = await RemitosService.updateItemRetorno(req.params.id, req.params.itemId, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function updateMaterialRetorno(req, res, next) {
  try {
    const { cantidadRetorno } = req.body
    if (cantidadRetorno === undefined)
      return res.status(400).json({ ok: false, error: 'cantidadRetorno es obligatorio' })
    const data = await RemitosService.updateMaterialRetorno(req.params.id, req.params.matItemId, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function avanzarEstado(req, res, next) {
  try {
    // Permisos granulares por estado actual:
    //   - BORRADOR → CONFIRMADO: cualquier rol autenticado (encargado puede
    //     confirmar un remito que él mismo cargó).
    //   - resto de transiciones manuales: solo DUEÑO desde la web; los
    //     demás roles usan el QR mobile que va por /confirmar-escaneo.
    //
    // Lookup del estado actual ANTES de avanzar, así el rechazo es claro
    // y no llegamos al service para que tire un error genérico.
    const actual = await RemitosService.getById(req.params.id)
    if (!actual) return res.status(404).json({ ok: false, error: 'Remito no encontrado' })

    if (actual.estado !== 'BORRADOR' && req.user.role !== ROLES.DUEÑO) {
      return res.status(403).json({
        ok: false,
        error: 'Solo el dueño puede avanzar este estado desde la web. Usá el QR del celular.'
      })
    }

    const data = await RemitosService.avanzarEstado(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function eliminar(req, res, next) {
  try {
    await RemitosService.eliminar(req.params.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}
