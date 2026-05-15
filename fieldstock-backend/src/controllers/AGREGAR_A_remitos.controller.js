// ─────────────────────────────────────────────────────────────
// AGREGAR AL FINAL de src/controllers/remitos.controller.js
// ─────────────────────────────────────────────────────────────

export async function eliminar(req, res, next) {
  try {
    await RemitosService.eliminar(req.params.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}
