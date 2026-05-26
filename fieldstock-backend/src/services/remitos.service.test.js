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

// NotifService.create se mockea para verificar que reportarProblema lo
// invoca con el payload correcto (issue #7).
jest.mock('./notificaciones.service.js', () => ({
  create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
}))

import * as RemitosService from './remitos.service.js'
import { supabase } from '../config/supabase.js'
import * as NotifService from './notificaciones.service.js'

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

describe('remitos.service.getByNumero (issue #11)', () => {
  it('busca el remito por numero usando maybeSingle', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'r-1', numero: 'FS-00018', estado: 'EN_TRANSITO' },
      error: null,
    })

    const result = await RemitosService.getByNumero('FS-00018')

    expect(supabase.from).toHaveBeenCalledWith('remitos')
    expect(mockChain.eq).toHaveBeenCalledWith('numero', 'FS-00018')
    expect(result).toEqual({ id: 'r-1', numero: 'FS-00018', estado: 'EN_TRANSITO' })
  })

  it('devuelve null cuando el numero no existe (no tira 404)', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await RemitosService.getByNumero('FS-99999')
    expect(result).toBeNull()
  })

  it('propaga errores de Supabase', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('connection lost'),
    })
    await expect(RemitosService.getByNumero('FS-00018'))
      .rejects.toThrow('connection lost')
  })
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

  describe('EN_TRANSITO_RETORNO → CERRADO con VUELVE (issue #1 step 2)', () => {
    /**
     * Helper: configura el mock para simular el cierre de un remito con
     * items que vuelven con distintos estados de retorno.
     */
    function setupCierreRemito(items, remitoData = {}) {
      const remito = {
        id:          'r-1',
        numero:      'R-2026-0001',
        estado:      'EN_TRANSITO_RETORNO',
        obra:        'Obra Belgrano',
        responsable: 'Juan Pérez',
        ...remitoData,
      }

      // Primer single(): cabecera del remito
      mockChain.single.mockResolvedValueOnce({ data: remito, error: null })

      // El bloque EN_TRANSITO_RETORNO hace estas queries via `.then` (awaitable):
      // 1) remito_items (items que vuelven)
      // 2) remito_materiales del catálogo (mats)
      // 3) remito_materiales libres (matsLibres)
      let callCount = 0
      mockChain.then = (resolve) => {
        callCount++
        if (callCount === 1) return resolve({ data: items, error: null })
        if (callCount === 2) return resolve({ data: [],    error: null })  // mats catálogo
        if (callCount === 3) return resolve({ data: [],    error: null })  // mats libres
        return resolve({ data: [], error: null })
      }

      // UPDATE final del remito a CERRADO
      mockChain.single.mockResolvedValueOnce({
        data: { ...remito, estado: 'CERRADO' },
        error: null,
      })

      return remito
    }

    // Helper: encontrar todos los inserts a movimientos (por tipo)
    function getMovimientosInsertados(tipo) {
      return mockChain.insert.mock.calls
        .filter(c => !Array.isArray(c[0]) && c[0]?.tipo === tipo)
        .map(c => c[0])
    }

    it('inserta movimiento INGRESO por cada herramienta que vuelve con estado_retorno=VUELVE', async () => {
      setupCierreRemito([
        { herramienta_id: 'h-1', estado_retorno: 'VUELVE' },
        { herramienta_id: 'h-2', estado_retorno: 'VUELVE' },
      ])

      await RemitosService.avanzarEstado('r-1')

      const ingresos = getMovimientosInsertados('INGRESO')
      expect(ingresos).toHaveLength(2)
    })

    it('hereda responsable y obra del remito', async () => {
      setupCierreRemito(
        [{ herramienta_id: 'h-1', estado_retorno: 'VUELVE' }],
        { obra: 'Obra Palermo', responsable: 'Laura Giménez' }
      )

      await RemitosService.avanzarEstado('r-1')

      const ingresos = getMovimientosInsertados('INGRESO')
      expect(ingresos[0]).toMatchObject({
        herramienta_id: 'h-1',
        tipo:           'INGRESO',
        obra:           'Obra Palermo',
        responsable:    'Laura Giménez',
      })
    })

    it('observación incluye el número de remito (auditoría)', async () => {
      setupCierreRemito(
        [{ herramienta_id: 'h-1', estado_retorno: 'VUELVE' }],
        { numero: 'R-2026-0042' }
      )

      await RemitosService.avanzarEstado('r-1')

      const ingresos = getMovimientosInsertados('INGRESO')
      expect(ingresos[0].observacion).toContain('R-2026-0042')
    })

    it('fecha = hoy (YYYY-MM-DD)', async () => {
      setupCierreRemito([{ herramienta_id: 'h-1', estado_retorno: 'VUELVE' }])

      await RemitosService.avanzarEstado('r-1')

      const ingresos = getMovimientosInsertados('INGRESO')
      const hoy = new Date().toISOString().split('T')[0]
      expect(ingresos[0].fecha).toBe(hoy)
    })

    it('NO inserta INGRESO para items con estado_retorno=ROTA, PERDIDA o QUEDA_EN_OBRA', async () => {
      setupCierreRemito([
        { herramienta_id: 'h-1', estado_retorno: 'ROTA' },
        { herramienta_id: 'h-2', estado_retorno: 'PERDIDA' },
        { herramienta_id: 'h-3', estado_retorno: 'QUEDA_EN_OBRA' },
      ])

      await RemitosService.avanzarEstado('r-1')

      const ingresos = getMovimientosInsertados('INGRESO')
      expect(ingresos).toHaveLength(0)
    })

    it('en un remito mixto, solo los VUELVE generan INGRESO', async () => {
      setupCierreRemito([
        { herramienta_id: 'h-1', estado_retorno: 'VUELVE' },
        { herramienta_id: 'h-2', estado_retorno: 'ROTA' },
        { herramienta_id: 'h-3', estado_retorno: 'VUELVE' },
        { herramienta_id: 'h-4', estado_retorno: 'PERDIDA' },
      ])

      await RemitosService.avanzarEstado('r-1')

      const ingresos = getMovimientosInsertados('INGRESO')
      expect(ingresos).toHaveLength(2)
      expect(ingresos.map(m => m.herramienta_id).sort()).toEqual(['h-1', 'h-3'])
    })

    // ── Helper local para los tests del step 3 ─────────────────
    function setupCierreRemitoConRota(items, remitoData = {}) {
      // Reutiliza setupCierreRemito (mismo flujo de mocks)
      return setupCierreRemito(items, remitoData)
    }

    describe('MANTENIMIENTO al volver rota (issue #1 step 3)', () => {
      it('inserta MANTENIMIENTO por cada herramienta con estado_retorno=ROTA', async () => {
        setupCierreRemitoConRota([
          { herramienta_id: 'h-1', estado_retorno: 'ROTA' },
          { herramienta_id: 'h-2', estado_retorno: 'ROTA' },
        ])

        await RemitosService.avanzarEstado('r-1')

        const mantenimientos = getMovimientosInsertados('MANTENIMIENTO')
        expect(mantenimientos).toHaveLength(2)
      })

      it('hereda responsable y obra del remito', async () => {
        setupCierreRemitoConRota(
          [{ herramienta_id: 'h-1', estado_retorno: 'ROTA' }],
          { obra: 'Obra Recoleta', responsable: 'Diego Torres' }
        )

        await RemitosService.avanzarEstado('r-1')

        const mantenimientos = getMovimientosInsertados('MANTENIMIENTO')
        expect(mantenimientos[0]).toMatchObject({
          herramienta_id: 'h-1',
          tipo:           'MANTENIMIENTO',
          obra:           'Obra Recoleta',
          responsable:    'Diego Torres',
        })
      })

      it('observación distingue claramente que vino rota (referencia al remito)', async () => {
        setupCierreRemitoConRota(
          [{ herramienta_id: 'h-1', estado_retorno: 'ROTA' }],
          { numero: 'R-2026-0099' }
        )

        await RemitosService.avanzarEstado('r-1')

        const mantenimientos = getMovimientosInsertados('MANTENIMIENTO')
        expect(mantenimientos[0].observacion).toMatch(/rota/i)
        expect(mantenimientos[0].observacion).toContain('R-2026-0099')
      })

      it('NO inserta MANTENIMIENTO para VUELVE / PERDIDA / QUEDA_EN_OBRA', async () => {
        setupCierreRemitoConRota([
          { herramienta_id: 'h-1', estado_retorno: 'VUELVE' },
          { herramienta_id: 'h-2', estado_retorno: 'PERDIDA' },
          { herramienta_id: 'h-3', estado_retorno: 'QUEDA_EN_OBRA' },
        ])

        await RemitosService.avanzarEstado('r-1')

        const mantenimientos = getMovimientosInsertados('MANTENIMIENTO')
        expect(mantenimientos).toHaveLength(0)
      })

      it('en un remito mixto convive con INGRESO sin pisarse', async () => {
        setupCierreRemitoConRota([
          { herramienta_id: 'h-1', estado_retorno: 'VUELVE' },
          { herramienta_id: 'h-2', estado_retorno: 'ROTA' },
          { herramienta_id: 'h-3', estado_retorno: 'ROTA' },
          { herramienta_id: 'h-4', estado_retorno: 'VUELVE' },
        ])

        await RemitosService.avanzarEstado('r-1')

        const ingresos       = getMovimientosInsertados('INGRESO')
        const mantenimientos = getMovimientosInsertados('MANTENIMIENTO')
        expect(ingresos).toHaveLength(2)
        expect(mantenimientos).toHaveLength(2)
        expect(ingresos.map(m => m.herramienta_id).sort()).toEqual(['h-1', 'h-4'])
        expect(mantenimientos.map(m => m.herramienta_id).sort()).toEqual(['h-2', 'h-3'])
      })
    })
  })
})

describe('remitos.service.reportarProblema (issue #7)', () => {
  /**
   * Helper: simula un remito en estado EN_TRANSITO (única transición
   * válida para reportar problema) que después avanza a EN_OBRA.
   */
  function setupRemitoEnTransito(remitoData = {}) {
    const remito = {
      id:          'r-1',
      numero:      'R-2026-0001',
      estado:      'EN_TRANSITO',
      obra:        'Obra Belgrano',
      responsable: 'Juan Pérez',
      ...remitoData,
    }

    // 1° single(): el read inicial del remito
    mockChain.single.mockResolvedValueOnce({ data: remito, error: null })
    // 2° single(): el read DENTRO de avanzarEstado al final
    mockChain.single.mockResolvedValueOnce({ data: remito, error: null })
    // 3° single(): el UPDATE final de avanzarEstado al cambiar a EN_OBRA
    mockChain.single.mockResolvedValueOnce({
      data: { ...remito, estado: 'EN_OBRA' },
      error: null,
    })

    return remito
  }

  it('rechaza descripción vacía con error 400', async () => {
    await expect(
      RemitosService.reportarProblema('r-1', '   ')
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('descripción') })
  })

  it('rechaza descripción undefined con error 400', async () => {
    await expect(
      RemitosService.reportarProblema('r-1', undefined)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('devuelve 404 si el remito no existe', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: null })

    await expect(
      RemitosService.reportarProblema('inexistente', 'algún problema')
    ).rejects.toMatchObject({ status: 404 })
  })

  it('rechaza si el estado del remito no es EN_TRANSITO', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'r-1', estado: 'BORRADOR', numero: 'R-1' },
      error: null,
    })

    await expect(
      RemitosService.reportarProblema('r-1', 'algún problema')
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('BORRADOR') })
  })

  it('guarda observacion_llegada en el remito con el texto trimmed', async () => {
    setupRemitoEnTransito()

    await RemitosService.reportarProblema('r-1', '   falta un destornillador   ')

    // Buscar el UPDATE específico a observacion_llegada
    const updateLlegada = mockChain.update.mock.calls.find(c =>
      c[0]?.observacion_llegada !== undefined
    )
    expect(updateLlegada).toBeDefined()
    expect(updateLlegada[0].observacion_llegada).toBe('falta un destornillador')
  })

  it('crea una notificación PROBLEMA_LLEGADA con título y mensaje correctos', async () => {
    setupRemitoEnTransito({
      numero: 'R-2026-0042',
      obra:   'Obra Palermo',
    })

    await RemitosService.reportarProblema('r-1', 'rotura del nivel láser')

    expect(NotifService.create).toHaveBeenCalledTimes(1)
    expect(NotifService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo:     'PROBLEMA_LLEGADA',
        titulo:   expect.stringContaining('R-2026-0042'),
        mensaje:  expect.stringContaining('Obra Palermo'),
        remitoId: 'r-1',
      })
    )
    // El mensaje también debe incluir la descripción reportada
    expect(NotifService.create.mock.calls[0][0].mensaje).toContain('rotura del nivel láser')
  })

  it('avanza el remito de EN_TRANSITO a EN_OBRA y retorna el resultado', async () => {
    setupRemitoEnTransito()

    const result = await RemitosService.reportarProblema('r-1', 'problema X')

    // El último UPDATE debe haberse hecho con estado: 'EN_OBRA'
    const updateEstado = mockChain.update.mock.calls.find(c => c[0]?.estado === 'EN_OBRA')
    expect(updateEstado).toBeDefined()
    expect(result.estado).toBe('EN_OBRA')
  })
})
