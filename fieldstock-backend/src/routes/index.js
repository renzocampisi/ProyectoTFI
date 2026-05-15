// src/routes/index.js
import { Router } from 'express'
import * as CategoriasCtrl   from '../controllers/categorias.controller.js'
import * as HerramientasCtrl from '../controllers/herramientas.controller.js'
import * as MovimientosCtrl  from '../controllers/movimientos.controller.js'
import * as RemitosCtrl      from '../controllers/remitos.controller.js'
import * as MateriasCtrl     from '../controllers/materiales.controller.js'
import * as ObrasCtrl        from '../controllers/obras.controller.js'

const router = Router()

// ── Categorías ────────────────────────────────────────────────
router.get('/categorias', CategoriasCtrl.getAll)

// ── Herramientas ──────────────────────────────────────────────
router.get   ('/herramientas',               HerramientasCtrl.getAll)
router.post  ('/herramientas',               HerramientasCtrl.create)
router.get   ('/herramientas/:id',           HerramientasCtrl.getById)
router.put   ('/herramientas/:id',           HerramientasCtrl.update)
router.patch ('/herramientas/:id/estado',    HerramientasCtrl.updateEstado)
router.post  ('/herramientas/:id/baja',      HerramientasCtrl.darDeBaja)
router.post  ('/herramientas/:id/reactivar', HerramientasCtrl.reactivar)

// ── Movimientos ───────────────────────────────────────────────
router.get ('/herramientas/:id/movimientos', MovimientosCtrl.getByHerramienta)
router.post('/herramientas/:id/movimientos', MovimientosCtrl.create)

// ── Materiales ────────────────────────────────────────────────
router.get ('/materiales',     MateriasCtrl.getAll)
router.post('/materiales',     MateriasCtrl.create)
router.get ('/materiales/:id', MateriasCtrl.getById)
router.put ('/materiales/:id', MateriasCtrl.update)

// ── Remitos ───────────────────────────────────────────────────
router.get   ('/remitos',                           RemitosCtrl.getAll)
router.post  ('/remitos',                           RemitosCtrl.create)
router.get   ('/remitos/:id',                       RemitosCtrl.getById)
router.post  ('/remitos/:id/avanzar',               RemitosCtrl.avanzarEstado)
router.post  ('/remitos/:id/ingreso',               RemitosCtrl.crearIngreso)
router.delete('/remitos/:id',                       RemitosCtrl.eliminar)
router.post  ('/remitos/:id/items',                 RemitosCtrl.addItem)
router.delete('/remitos/:id/items/:itemId',         RemitosCtrl.removeItem)
router.post  ('/remitos/:id/materiales',            RemitosCtrl.addMaterial)
router.delete('/remitos/:id/materiales/:matItemId', RemitosCtrl.removeMaterial)

// ── Obras ─────────────────────────────────────────────────────
router.get   ('/obras',               ObrasCtrl.getAll)
router.post  ('/obras',               ObrasCtrl.create)
router.get   ('/obras/:id',           ObrasCtrl.getById)
router.put   ('/obras/:id',           ObrasCtrl.update)
router.post  ('/obras/:id/finalizar', ObrasCtrl.finalizar)
router.post  ('/obras/:id/reactivar', ObrasCtrl.reactivar)

export default router
