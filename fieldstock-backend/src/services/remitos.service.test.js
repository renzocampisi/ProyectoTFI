// ── Mock de Supabase (chainable) ──────────────────────────────
// Patrón: cada llamada a `.from(tabla)` devuelve un chain configurable.
// Usamos un dispatcher para que distintas tablas devuelvan datos distintos
// en la misma corrida del test (ej. avanzarEstado lee de varias tablas).
const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  in:     jest.fn().mockReturnThis(),
  is:     jest.fn().mockReturnThis(),
  not:    jest.fn().mockReturnThis(),
  gt:     jest.fn().mockReturnThis(),
  ilike:  jest.fn().mockReturnThis(),
  or:     jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}
// Para queries que no terminan en .single() (devuelven array): el chain
// es awaitable y resuelve a { data: [], error: null } por defecto.
mockChain.then = (resolve) => resolve({ data: [], error: null })

jest.mock('../config/supabase.js', () => ({
  supabase: {
    // Closures lazy: capturan mockChain en su scope pero solo lo leen al
    // llamarse, cuando el módulo ya está inicializado (fix del hoisting
    // de jest.mock vs const).
    from: jest.fn(() => mockChain),
    rpc:  jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}))

// updateStock vive en materiales.service; lo mockeamos para que no toque
// el chain de Supabase en estos tests (es responsabilidad de su propio test).
jest.mock('./materiales.service.js', () => ({
  updateStock: jest.fn().mockResolvedValue(undefined),
}))

import * as RemitosService from './remitos.service.js'
import { supabase } from '../config/supabase.js'

beforeEach(() => {
  jest.clearAllMocks()
  // Restaurar el chain (clearAllMocks borra los mockReturnThis)
  mockChain.select.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.update.mockReturnThis()
  mockChain.delete.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.in.mockReturnThis()
  mockChain.is.mockReturnThis()
  mockChain.not.mockReturnThis()
  mockChain.gt.mockReturnThis()
  mockChain.ilike.mockReturnThis()
  mockChain.or.mockReturnThis()
  mockChain.order.mockReturnThis()
  mockChain.single.mockResolvedValue({ data: null, error: null })
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
  mockChain.then = (resolve) => resolve({ data: [], error: null })
  // Restaurar el `from` lazy a su comportamiento por defecto
  supabase.from.mockImplementation(() => mockChain)
})

describe('remitos.service.avanzarEstado', () => {
  describe('BORRADOR → CONFIRMADO (issue #1)', () => {
    /**
     * Helper: configura el mock para simular el escenario completo de la
     * transición BORRADOR → CONFIRMADO con N items de herramientas.
     */
    function setupBorradorConItems(items, remitoData = {}) {
      const remito = {
        id:          'r-1',
        numero:      'R-2026-0001',
        estado:      'BORRADOR',
        obra:        'Obra Belgrano',
        responsable: 'Juan Pérez',
        ...remitoData,
      }

      // single() es la primera lectura (cabecera del remito)
      mockChain.single.mockResolvedValueOnce({ data: remito, error: null })

      // Las dos queries del Promise.all (items + mats) y la query de matsConId
      // resuelven via .then() (awaitable chain). Usamos un contador para
      // devolver distintas respuestas según la posición de la llamada.
      let callCount = 0
      mockChain.then = (resolve) => {
        callCount++
        if (callCount === 1) return resolve({ data: items, error: null })       // remito_items
        if (callCount === 2) return resolve({ data: [],    error: null })       // remito_materiales
        if (callCount === 3) return resolve({ data: [],    error: null })       // matsConId (filtrado)
        return resolve({ data: [], error: null })
      }

      // El último UPDATE devuelve el remito con su nuevo estado vía .single()
      // (segunda llamada a single() en esta corrida)
      mockChain.single.mockResolvedValueOnce({
        data: { ...remito, estado: 'CONFIRMADO' },
        error: null,
      })

      return remito
    }

    it('inserta un movimiento EGRESO por cada herramienta del remito', async () => {
      const items = [
        { id: 'i-1', herramienta_id: 'h-1' },
        { id: 'i-2', herramienta_id: 'h-2' },
        { id: 'i-3', herramienta_id: 'h-3' },
      ]
      setupBorradorConItems(items)

      await RemitosService.avanzarEstado('r-1')

      // El insert a `movimientos` debe haberse llamado con un array de 3 filas
      const insertCalls = mockChain.insert.mock.calls
      const movimientosInsert = insertCalls.find(call =>
        Array.isArray(call[0]) && call[0][0]?.tipo === 'EGRESO'
      )

      expect(movimientosInsert).toBeDefined()
      expect(movimientosInsert[0]).toHaveLength(3)
    })

    it('cada movimiento autogenerado tiene tipo EGRESO', async () => {
      const items = [{ id: 'i-1', herramienta_id: 'h-1' }]
      setupBorradorConItems(items)

      await RemitosService.avanzarEstado('r-1')

      const movInsert = mockChain.insert.mock.calls.find(c =>
        Array.isArray(c[0]) && c[0][0]?.tipo
      )
      expect(movInsert[0][0].tipo).toBe('EGRESO')
    })

    it('hereda responsable y obra del remito en cada movimiento', async () => {
      const items = [
        { id: 'i-1', herramienta_id: 'h-1' },
        { id: 'i-2', herramienta_id: 'h-2' },
      ]
      setupBorradorConItems(items, {
        obra:        'Obra Palermo',
        responsable: 'Laura Giménez',
      })

      await RemitosService.avanzarEstado('r-1')

      const movInsert = mockChain.insert.mock.calls.find(c =>
        Array.isArray(c[0]) && c[0][0]?.tipo === 'EGRESO'
      )
      expect(movInsert[0]).toEqual([
        expect.objectContaining({
          herramienta_id: 'h-1',
          tipo:           'EGRESO',
          obra:           'Obra Palermo',
          responsable:    'Laura Giménez',
        }),
        expect.objectContaining({
          herramienta_id: 'h-2',
          tipo:           'EGRESO',
          obra:           'Obra Palermo',
          responsable:    'Laura Giménez',
        }),
      ])
    })

    it('incluye observación con referencia al número de remito (auditoría)', async () => {
      const items = [{ id: 'i-1', herramienta_id: 'h-1' }]
      setupBorradorConItems(items, { numero: 'R-2026-0042' })

      await RemitosService.avanzarEstado('r-1')

      const movInsert = mockChain.insert.mock.calls.find(c =>
        Array.isArray(c[0]) && c[0][0]?.tipo === 'EGRESO'
      )
      expect(movInsert[0][0].observacion).toContain('R-2026-0042')
    })

    it('usa fecha de hoy (YYYY-MM-DD) en el movimiento', async () => {
      const items = [{ id: 'i-1', herramienta_id: 'h-1' }]
      setupBorradorConItems(items)

      await RemitosService.avanzarEstado('r-1')

      const movInsert = mockChain.insert.mock.calls.find(c =>
        Array.isArray(c[0]) && c[0][0]?.tipo === 'EGRESO'
      )
      const hoy = new Date().toISOString().split('T')[0]
      expect(movInsert[0][0].fecha).toBe(hoy)
    })

    it('NO inserta movimientos si el remito no tiene herramientas (solo materiales)', async () => {
      // Items vacío, pero hay materiales (no fallaría la validación del service)
      const remito = {
        id:          'r-1',
        numero:      'R-2026-0001',
        estado:      'BORRADOR',
        obra:        'Obra X',
        responsable: 'Pepe',
      }

      mockChain.single.mockResolvedValueOnce({ data: remito, error: null })

      let callCount = 0
      mockChain.then = (resolve) => {
        callCount++
        if (callCount === 1) return resolve({ data: [], error: null })           // sin items
        if (callCount === 2) return resolve({ data: [{ id: 'mi-1' }], error: null }) // con materiales
        if (callCount === 3) return resolve({ data: [], error: null })
        return resolve({ data: [], error: null })
      }

      mockChain.single.mockResolvedValueOnce({
        data: { ...remito, estado: 'CONFIRMADO' },
        error: null,
      })

      await RemitosService.avanzarEstado('r-1')

      // Ningún insert con tipo: 'EGRESO' debería haberse hecho
      const movInsert = mockChain.insert.mock.calls.find(c =>
        Array.isArray(c[0]) && c[0][0]?.tipo === 'EGRESO'
      )
      expect(movInsert).toBeUndefined()
    })
  })
})
