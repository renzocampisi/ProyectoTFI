// src/modules/m2-inventario/services/inventario.mock.js
//
// Constantes del dominio M2 — Inventario.
// Nota: el nombre del archivo dice "mock" por motivos históricos (antes
// contenía datos de prueba). Hoy solo expone constantes reales del dominio
// que aún no se sirven desde el backend. Pendiente: mover a shared/constants.js
// y traer CATEGORIAS desde /api/categorias (ver InventarioService.getCategorias).

export const CATEGORIAS = [
  { id: 'cat-1', nombre: 'Herramientas manuales' },
  { id: 'cat-2', nombre: 'Herramientas eléctricas' },
  { id: 'cat-3', nombre: 'Medición y nivel' },
  { id: 'cat-4', nombre: 'Corte y demolición' },
  { id: 'cat-5', nombre: 'Elevación y carga' },
]

// Estados válidos de Herramienta (deben coincidir con la validación del backend
// en herramientas.service.js: updateEstado).
export const ESTADOS = ['DISPONIBLE', 'EN_OBRA', 'EN_MANTENIMIENTO', 'RESERVADA', 'BAJA']
