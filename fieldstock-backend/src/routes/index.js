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
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireRole } from '../middlewares/requireRole.js'
import { ROLES }       from '../constants/roles.js'
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
import * as DashboardCtrl       from '../controllers/dashboard.controller.js'
import * as UsuariosCtrl        from '../controllers/usuarios.controller.js'

const router = Router()

// ── Auth global ───────────────────────────────────────────────
// Toda la API /api requiere autenticación. El único endpoint público
// es /health (montado fuera de este router, en index.js). Esto incluye
// los endpoints del QR mobile: el usuario que escanea es siempre un
// empleado logueado (operario / encargado / dueño) — el cliente recibe
// el PDF impreso pero no opera la app.
router.use(requireAuth)

// ── Dashboard ─────────────────────────────────────────────────
// Word #16 — single endpoint que agrega KPIs + listas para la home.
router.get('/dashboard', DashboardCtrl.getResumen)

// ── Usuarios ──────────────────────────────────────────────────
// /me: accesible para cualquier user autenticado (es su propio perfil).
// El resto: solo DUEÑO (gestión de usuarios).
// IMPORTANTE: rutas literales /me antes de las paramétricas /:id para que
// Express no las capture como id.
router.get  ('/usuarios/me', UsuariosCtrl.getMe)
router.patch('/usuarios/me', UsuariosCtrl.updateMe)
router.get   ('/usuarios',     requireRole([ROLES.DUEÑO]), UsuariosCtrl.getAll)
router.post  ('/usuarios',     requireRole([ROLES.DUEÑO]), UsuariosCtrl.create)
router.get   ('/usuarios/:id', requireRole([ROLES.DUEÑO]), UsuariosCtrl.getById)
router.patch ('/usuarios/:id', requireRole([ROLES.DUEÑO]), UsuariosCtrl.update)
router.delete('/usuarios/:id', requireRole([ROLES.DUEÑO]), UsuariosCtrl.desactivar)

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
// IMPORTANTE: rutas literales antes de las paramétricas (ej. /marcas
// antes de /:id) para que Express no las capture como id.
router.get   ('/materiales/marcas',         MateriasCtrl.getMarcas)
router.get   ('/materiales/check-duplicate', MateriasCtrl.checkDuplicate)
router.get   ('/materiales',                MateriasCtrl.getAll)
router.post  ('/materiales',                MateriasCtrl.create)
router.get   ('/materiales/:id',            MateriasCtrl.getById)
router.put   ('/materiales/:id',            MateriasCtrl.update)
router.delete('/materiales/:id',            MateriasCtrl.remove)
router.post  ('/materiales/:id/agregar-stock', MateriasCtrl.agregarStock)

// ── Remitos ───────────────────────────────────────────────────
router.get   ('/remitos',                                    RemitosCtrl.getAll)
router.post  ('/remitos',                                    RemitosCtrl.create)
// IMPORTANTE: rutas literales antes de las paramétricas para que Express
// no las capture como :id (orden de declaración = orden de matching).
router.get   ('/remitos/numero/:numero',                     RemitosCtrl.getByNumero)
router.get   ('/remitos/:id',                                RemitosCtrl.getById)
router.patch ('/remitos/:id',                                RemitosCtrl.update)
// Word: el avance manual de estado depende del estado actual:
//   - BORRADOR → CONFIRMADO: cualquier rol autorizado (encargado/dueño)
//   - el resto de transiciones: solo DUEÑO (encargado/operario usan QR)
// El check granular vive en el controller (necesita leer el estado actual).
//
// "Volver a borrador" sí es solo DUEÑO — deshacer una confirmación es
// decisión gerencial.
router.post  ('/remitos/:id/avanzar',                        RemitosCtrl.avanzarEstado)
router.post  ('/remitos/:id/volver-borrador',   requireRole([ROLES.DUEÑO]), RemitosCtrl.volverABorrador)
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

router.get   ('/proveedores',     DirectorioCtrl.getProveedores)
router.post  ('/proveedores',     DirectorioCtrl.createProveedor)
router.put   ('/proveedores/:id', DirectorioCtrl.updateProveedor)
router.delete('/proveedores/:id', DirectorioCtrl.deleteProveedor)

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
