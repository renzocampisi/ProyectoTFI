// src/routes/index.js
/**
 * Router central de la API REST.
 *
 * Todas las rutas se montan bajo /api (ver index.js). El layout sigue
 * un patrón consistente:
 *   GET    /recurso                → lista (con filtros via query string)
 *   POST   /recurso                → crear
 *   GET    /recurso/:id            → detalle
 *   PUT    /recurso/:id            → actualizar (reemplazo)
 *   PATCH  /recurso/:id/...        → actualización parcial puntual
 *   DELETE /recurso/:id            → eliminar (lógico en la mayoría)
 *
 * Cada handler delega al controller correspondiente, que a su vez
 * llama al service. Este archivo es SOLO mapping URL → handler;
 * cualquier lógica que aparezca acá es señal de mal lugar.
 */
import { Router } from 'express'
import * as CategoriasCtrl      from '../controllers/categorias.controller.js'
import * as MarcasCtrl          from '../controllers/marcas.controller.js'
import * as HerramientasCtrl    from '../controllers/herramientas.controller.js'
import * as MovimientosCtrl     from '../controllers/movimientos.controller.js'
import * as RemitosCtrl         from '../controllers/remitos.controller.js'
import * as MateriasCtrl        from '../controllers/materiales.controller.js'
import * as ObrasCtrl           from '../controllers/obras.controller.js'
import * as DirectorioCtrl      from '../controllers/directorio.controller.js'
import * as EstanteriasCtrl     from '../controllers/estanterias.controller.js'
import * as NotificacionesCtrl  from '../controllers/notificaciones.controller.js'

const router = Router()

// ── Categorías ────────────────────────────────────────────────
router.get ('/categorias', CategoriasCtrl.getAll)
router.post('/categorias', CategoriasCtrl.create)

// ── Marcas ────────────────────────────────────────────────────
router.get ('/marcas', MarcasCtrl.getAll)
router.post('/marcas', MarcasCtrl.create)

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
router.get   ('/remitos',                                    RemitosCtrl.getAll)
router.post  ('/remitos',                                    RemitosCtrl.create)
router.get   ('/remitos/:id',                                RemitosCtrl.getById)
router.patch ('/remitos/:id',                                RemitosCtrl.updateRemito)
router.post  ('/remitos/:id/avanzar',                        RemitosCtrl.avanzarEstado)
router.post  ('/remitos/:id/volver-borrador',                RemitosCtrl.volverABorrador)
router.post  ('/remitos/:id/confirmar-escaneo',              RemitosCtrl.confirmarEscaneo)
router.post  ('/remitos/:id/reportar-problema',              RemitosCtrl.reportarProblema)
router.delete('/remitos/:id',                                RemitosCtrl.eliminar)
router.post  ('/remitos/:id/items',                          RemitosCtrl.addItem)
router.delete('/remitos/:id/items/:itemId',                  RemitosCtrl.removeItem)
router.patch ('/remitos/:id/items/:itemId/retorno',          RemitosCtrl.updateItemRetorno)
router.post  ('/remitos/:id/materiales',                     RemitosCtrl.addMaterial)
router.delete('/remitos/:id/materiales/:matItemId',          RemitosCtrl.removeMaterial)
router.patch ('/remitos/:id/materiales/:matItemId/retorno',  RemitosCtrl.updateMaterialRetorno)

// ── Obras ─────────────────────────────────────────────────────
router.get   ('/obras',               ObrasCtrl.getAll)
router.post  ('/obras',               ObrasCtrl.create)
router.get   ('/obras/:id',           ObrasCtrl.getById)
router.put   ('/obras/:id',           ObrasCtrl.update)
router.post  ('/obras/:id/finalizar', ObrasCtrl.finalizar)
router.post  ('/obras/:id/reactivar', ObrasCtrl.reactivar)

// ── Directorio ────────────────────────────────────────────────
router.get   ('/transportes',     DirectorioCtrl.getTransportes)
router.post  ('/transportes',     DirectorioCtrl.createTransporte)
router.put   ('/transportes/:id', DirectorioCtrl.updateTransporte)
router.delete('/transportes/:id', DirectorioCtrl.deleteTransporte)

router.get   ('/clientes',     DirectorioCtrl.getClientes)
router.post  ('/clientes',     DirectorioCtrl.createCliente)
router.put   ('/clientes/:id', DirectorioCtrl.updateCliente)
router.delete('/clientes/:id', DirectorioCtrl.deleteCliente)

// ── Estanterías ───────────────────────────────────────────────
router.get   ('/estanterias',                         EstanteriasCtrl.getAll)
router.post  ('/estanterias',                         EstanteriasCtrl.create)
router.get   ('/estanterias/qr/:qr',                  EstanteriasCtrl.getByQR)
router.get   ('/estanterias/:id',                     EstanteriasCtrl.getById)
router.put   ('/estanterias/:id',                     EstanteriasCtrl.update)
router.delete('/estanterias/:id',                     EstanteriasCtrl.remove)
router.post  ('/estanterias/:id/items',               EstanteriasCtrl.addItem)
router.delete('/estanterias/:id/items/:itemId',       EstanteriasCtrl.removeItem)
router.patch ('/estanterias/:id/items/:itemId/mover', EstanteriasCtrl.moverItem)

// ── Notificaciones ────────────────────────────────────────────
router.get  ('/notificaciones',              NotificacionesCtrl.getAll)
router.post ('/notificaciones',              NotificacionesCtrl.create)
router.patch('/notificaciones/:id/leida',    NotificacionesCtrl.marcarLeida)
router.patch('/notificaciones/todas-leidas', NotificacionesCtrl.marcarTodasLeidas)

export default router
