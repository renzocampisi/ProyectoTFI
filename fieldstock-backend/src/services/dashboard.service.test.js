// Mock por tabla: dashboard.service agrega de 8 tablas distintas en
// getResumen(), así que el mock de `from` resuelve según el nombre de
// tabla en vez de compartir una única mockChain genérica.
function chainResolvingTo(payload) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    neq:    jest.fn().mockReturnThis(),
    not:    jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
    limit:  jest.fn().mockReturnThis(),
  }
  chain.then = (resolve) => resolve(payload)
  return chain
}

const tablas = {
  herramientas:            () => chainResolvingTo({ data: [], error: null }),
  obras:                   () => chainResolvingTo({ data: [], error: null, count: 0 }),
  remitos:                 () => chainResolvingTo({ data: [], error: null, count: 0 }),
  materiales:              () => chainResolvingTo({ data: [], error: null }),
  notificaciones:          () => chainResolvingTo({ data: [], error: null }),
  remitos_resumen:         () => chainResolvingTo({ data: [], error: null }),
  movimientos:             () => chainResolvingTo({ data: [], error: null }),
  remito_materiales:       () => chainResolvingTo({ data: [], error: null }),
}

jest.mock('../config/supabase.js', () => ({
  supabase: { from: jest.fn((tabla) => tablas[tabla]()) },
}))

import * as DashboardService from './dashboard.service.js'

beforeEach(() => { jest.clearAllMocks() })

describe('dashboard.service.getResumen — top herramientas usadas', () => {
  it('cuenta un EGRESO por movimiento y devuelve el top 5 ordenado desc', async () => {
    tablas.movimientos = () => chainResolvingTo({
      data: [
        { herramienta_id: 'h-1', herramientas: { nombre: 'Taladro' } },
        { herramienta_id: 'h-1', herramientas: { nombre: 'Taladro' } },
        { herramienta_id: 'h-2', herramientas: { nombre: 'Amoladora' } },
      ],
      error: null,
    })

    const data = await DashboardService.getResumen()

    expect(data.topHerramientas).toEqual([
      { id: 'h-1', nombre: 'Taladro', usos: 2 },
      { id: 'h-2', nombre: 'Amoladora', usos: 1 },
    ])
  })
})

describe('dashboard.service.getResumen — top materiales consumidos', () => {
  it('resta el retorno del egreso y filtra los que quedaron en 0 o negativo', async () => {
    tablas.remito_materiales = () => chainResolvingTo({
      data: [
        { material_id: 'm-1', cantidad_egreso: 10, cantidad_retorno: 2, materiales: { nombre: 'Cemento', unidad: 'bolsa' } },
        { material_id: 'm-1', cantidad_egreso: 5,  cantidad_retorno: 0, materiales: { nombre: 'Cemento', unidad: 'bolsa' } },
        { material_id: 'm-2', cantidad_egreso: 3,  cantidad_retorno: 3, materiales: { nombre: 'Arena', unidad: 'kg' } },
      ],
      error: null,
    })

    const data = await DashboardService.getResumen()

    expect(data.topMateriales).toEqual([
      { id: 'm-1', nombre: 'Cemento', unidad: 'bolsa', consumo: 13 },
    ])
  })

  it('excluye materiales dados de baja aunque tengan consumo histórico', async () => {
    tablas.remito_materiales = () => chainResolvingTo({
      data: [
        { material_id: 'm-1', cantidad_egreso: 10, cantidad_retorno: 0, materiales: { nombre: 'Cemento', unidad: 'bolsa', activo: true } },
        { material_id: 'm-2', cantidad_egreso: 1000, cantidad_retorno: 0, materiales: { nombre: 'Test Bulones M12', unidad: 'unidad', activo: false } },
      ],
      error: null,
    })

    const data = await DashboardService.getResumen()

    expect(data.topMateriales).toEqual([
      { id: 'm-1', nombre: 'Cemento', unidad: 'bolsa', consumo: 10 },
    ])
  })
})

describe('dashboard.service.getResumen — insumos con menos stock', () => {
  const materialesFixture = [
    { id: 'm-1', nombre: 'Cemento',  unidad: 'bolsa', stock_actual: 2,  stock_minimo: 10 }, // en alerta, buffer -8
    { id: 'm-2', nombre: 'Arena',    unidad: 'kg',    stock_actual: 50, stock_minimo: 20 }, // sin alerta, buffer +30
    { id: 'm-3', nombre: 'Cal',      unidad: 'bolsa', stock_actual: 15, stock_minimo: 10 }, // sin alerta, buffer +5
  ]

  it('el KPI de alertas solo cuenta stock_actual <= stock_minimo', async () => {
    tablas.materiales = () => chainResolvingTo({ data: materialesFixture, error: null })
    const data = await DashboardService.getResumen()
    expect(data.kpis.alertasStockBajo).toBe(1)
  })

  it('insumosMenorStock siempre devuelve filas (ordenadas por menor margen) aunque no estén en alerta', async () => {
    tablas.materiales = () => chainResolvingTo({ data: materialesFixture, error: null })
    const data = await DashboardService.getResumen()
    expect(data.insumosMenorStock.map(m => m.id)).toEqual(['m-1', 'm-3', 'm-2'])
  })
})
