// src/controllers/remitos.controller.js
import * as RemitosService from '../services/remitos.service.js'
import * as NotifService   from '../services/notificaciones.service.js'

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

export async function create(req, res, next) {
  try {
    const { obra, responsable } = req.body
    if (!obra || !responsable)
      return res.status(400).json({ ok: false, error: 'obra y responsable son obligatorios' })
    const data = await RemitosService.create(req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function updateRemito(req, res, next) {
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

// ── Confirmar escaneo QR del remito ──────────────────────────
// 1er escaneo (CONFIRMADO → EN_TRANSITO)
// 2do escaneo (EN_TRANSITO → EN_OBRA)
export async function confirmarEscaneo(req, res, next) {
  try {
    const { id } = req.params
    const remito = await RemitosService.getById(id)
    if (!remito) return res.status(404).json({ ok: false, error: 'Remito no encontrado' })

    if (!['CONFIRMADO', 'EN_TRANSITO'].includes(remito.estado)) {
      return res.status(400).json({
        ok: false,
        error: `El remito está en estado ${remito.estado} y no puede confirmarse por QR.`
      })
    }

    const data = await RemitosService.avanzarEstado(id)
    res.json({ ok: true, data, accion: remito.estado === 'CONFIRMADO' ? 'SALIDA' : 'LLEGADA' })
  } catch (err) { next(err) }
}

// ── Reportar problema al llegar a la obra ────────────────────
export async function reportarProblema(req, res, next) {
  try {
    const { id } = req.params
    const { descripcion } = req.body
    if (!descripcion?.trim())
      return res.status(400).json({ ok: false, error: 'La descripción del problema es obligatoria' })

    const remito = await RemitosService.getById(id)
    if (!remito) return res.status(404).json({ ok: false, error: 'Remito no encontrado' })

    // Guardar observación en el remito
    await RemitosService.update(id, { observacionLlegada: descripcion.trim() })

    // Crear notificación en el sistema
    await NotifService.create({
      tipo:     'PROBLEMA_LLEGADA',
      titulo:   `Problema en remito ${remito.numero}`,
      mensaje:  `Obra: ${remito.obra}. Problema reportado: ${descripcion.trim()}`,
      remitoId: id,
    })

    // Avanzar igual a EN_OBRA (llegó pero con problema)
    const data = await RemitosService.avanzarEstado(id)
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
