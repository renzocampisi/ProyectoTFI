// ── Mock de Supabase (chainable, igual patrón que remitos.service.test) ──
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
  single:      jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}
mockChain.then = (resolve) => resolve({ data: [], error: null })

jest.mock('../config/supabase.js', () => ({
  supabase: {
    from: jest.fn(() => mockChain),
    rpc:  jest.fn().mockResolvedValue({ data: 'OC-00001', error: null }),
  },
}))

jest.mock('./materiales.service.js', () => ({
  updateStock: jest.fn().mockResolvedValue(undefined),
}))

import * as ComprasService from './compras.service.js'
import { supabase } from '../config/supabase.js'
import { updateStock } from './materiales.service.js'

beforeEach(() => {
  // Usamos resetAllMocks (no clearAllMocks) para que también se vacíe el
  // queue de mockResolvedValueOnce — sin esto, los `mockResolvedValueOnce`
  // no consumidos en un test fugan al siguiente y producen resultados raros.
  jest.resetAllMocks()
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
  supabase.from.mockImplementation(() => mockChain)
  supabase.rpc.mockResolvedValue({ data: 'OC-00001', error: null })
})

// ─────────────────────────────────────────────────────────────
describe('compras.service.create', () => {
  it('rechaza si no viene proveedorId', async () => {
    await expect(ComprasService.create({})).rejects.toThrow('proveedorId')
  })

  it('rechaza medio_pago inválido', async () => {
    await expect(
      ComprasService.create({ proveedorId: 'p-1', medioPago: 'BITCOIN' })
    ).rejects.toThrow('medioPago')
  })

  it('genera número OC-NNNNN via RPC', async () => {
    // Mock: insert.select.single devuelve la compra recién creada
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'c-1', numero: 'OC-00001', estado: 'BORRADOR' },
      error: null,
    })
    // El segundo single() es el de getById dentro de create — devolvemos algo válido
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'c-1', numero: 'OC-00001', estado: 'BORRADOR' },
      error: null,
    })

    await ComprasService.create({ proveedorId: 'p-1' })

    expect(supabase.rpc).toHaveBeenCalledWith('generar_numero_compra')
  })
})

// ─────────────────────────────────────────────────────────────
describe('compras.service.avanzarEstado (BORRADOR → CONFIRMADA)', () => {
  it('rechaza si la compra no está en BORRADOR', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { estado: 'CONFIRMADA' },
      error: null,
    })
    await expect(ComprasService.avanzarEstado('c-1'))
      .rejects.toThrow(/CONFIRMADA/)
  })

  it('rechaza si no hay items', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { estado: 'BORRADOR' },
      error: null,
    })
    // Query de items resuelve [] via .then()
    mockChain.then = (resolve) => resolve({ data: [], error: null })

    await expect(ComprasService.avanzarEstado('c-1'))
      .rejects.toThrow(/al menos un item/)
  })

  it('avanza a CONFIRMADA y setea fecha_pedido cuando hay items', async () => {
    mockChain.single
      // 1ª lectura: estado actual
      .mockResolvedValueOnce({ data: { estado: 'BORRADOR' }, error: null })
      // 2ª lectura: UPDATE...select().single() devuelve la compra confirmada
      .mockResolvedValueOnce({
        data: { id: 'c-1', estado: 'CONFIRMADA', fecha_pedido: '2026-06-07T10:00:00Z' },
        error: null,
      })
    // Items presentes
    mockChain.then = (resolve) => resolve({ data: [{ id: 'i-1' }], error: null })

    const result = await ComprasService.avanzarEstado('c-1')

    expect(result.estado).toBe('CONFIRMADA')
    // El UPDATE incluyó fecha_pedido
    const updateCall = mockChain.update.mock.calls.find(c => c[0]?.estado === 'CONFIRMADA')
    expect(updateCall).toBeDefined()
    expect(updateCall[0].fecha_pedido).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────
describe('compras.service.cancelar', () => {
  it('rechaza si la compra ya está RECIBIDA', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { estado: 'RECIBIDA', observaciones: null },
      error: null,
    })
    await expect(ComprasService.cancelar('c-1', 'sin motivo'))
      .rejects.toThrow(/recibida/i)
  })

  it('rechaza si ya está CANCELADA', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { estado: 'CANCELADA', observaciones: null },
      error: null,
    })
    await expect(ComprasService.cancelar('c-1'))
      .rejects.toThrow(/cancelada/i)
  })

  it('cancela una compra BORRADOR y anexa motivo a observaciones', async () => {
    mockChain.single
      .mockResolvedValueOnce({
        data: { estado: 'BORRADOR', observaciones: 'Nota previa' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'c-1', estado: 'CANCELADA' },
        error: null,
      })

    const result = await ComprasService.cancelar('c-1', 'Proveedor sin stock')
    expect(result.estado).toBe('CANCELADA')

    // Buscar el UPDATE que tiene observaciones (no el que solo cambia estado)
    const updateCall = mockChain.update.mock.calls.find(c => c[0]?.observaciones)
    expect(updateCall).toBeDefined()
    expect(updateCall[0].observaciones).toContain('Nota previa')
    expect(updateCall[0].observaciones).toContain('Proveedor sin stock')
  })
})

// ─────────────────────────────────────────────────────────────
describe('compras.service.recibir', () => {
  function setupCompra({ estado, items }) {
    // 1ª lectura: estado de la compra
    mockChain.single.mockResolvedValueOnce({ data: { estado }, error: null })

    // .then() awaitable para las queries de items: usamos call count.
    let call = 0
    mockChain.then = (resolve) => {
      call++
      if (call === 1) return resolve({ data: items, error: null })  // items actuales
      if (call === 2) return resolve({ data: items, error: null })  // items finales (re-lectura)
      return resolve({ data: [], error: null })
    }
  }

  it('rechaza si la compra está en BORRADOR (todavía no se confirmó)', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { estado: 'BORRADOR' }, error: null })
    await expect(
      ComprasService.recibir('c-1', { items: [{ itemId: 'i-1', cantidadRecibida: 1 }] })
    ).rejects.toThrow(/BORRADOR/)
  })

  it('rechaza con 409 si cantidadRecibida excede la cantidad pedida', async () => {
    setupCompra({
      estado: 'CONFIRMADA',
      items: [{ id: 'i-1', material_id: 'm-1', cantidad: 5, cantidad_recibida: 0 }],
    })

    const promise = ComprasService.recibir('c-1', {
      items: [{ itemId: 'i-1', cantidadRecibida: 10 }],
    })

    await expect(promise).rejects.toMatchObject({ status: 409 })
    await expect(promise).rejects.toThrow(/excede/)
  })

  it('rechaza si cantidadRecibida es menor a lo ya recibido (no des-recibir)', async () => {
    setupCompra({
      estado: 'RECIBIDA_PARCIAL',
      items: [{ id: 'i-1', material_id: 'm-1', cantidad: 10, cantidad_recibida: 5 }],
    })
    await expect(
      ComprasService.recibir('c-1', { items: [{ itemId: 'i-1', cantidadRecibida: 3 }] })
    ).rejects.toThrow(/des-recibir/i)
  })

  it('recibe todo y pasa a RECIBIDA con fecha_recepcion', async () => {
    // items: pedido 5, recibido 0 → recibo 5 → completo
    let call = 0
    mockChain.then = (resolve) => {
      call++
      // Call 1: items actuales (antes)
      if (call === 1) return resolve({
        data: [{ id: 'i-1', material_id: 'm-1', cantidad: 5, cantidad_recibida: 0 }],
        error: null,
      })
      // Call 2: UPDATE del item (await chain)
      if (call === 2) return resolve({ data: null, error: null })
      // Call 3: items finales — todo recibido
      if (call === 3) return resolve({
        data: [{ cantidad: 5, cantidad_recibida: 5 }],
        error: null,
      })
      return resolve({ data: [], error: null })
    }
    mockChain.single
      // 1ª lectura: estado actual
      .mockResolvedValueOnce({ data: { estado: 'CONFIRMADA' }, error: null })
      // 2ª lectura: UPDATE final de compra
      .mockResolvedValueOnce({
        data: { id: 'c-1', estado: 'RECIBIDA' },
        error: null,
      })

    const result = await ComprasService.recibir('c-1', {
      items: [{ itemId: 'i-1', cantidadRecibida: 5 }],
    })

    expect(result.estado).toBe('RECIBIDA')
    expect(updateStock).toHaveBeenCalledWith('m-1', 5, 'reponer')
    const updateCall = mockChain.update.mock.calls.find(c => c[0]?.estado === 'RECIBIDA')
    expect(updateCall).toBeDefined()
    expect(updateCall[0].fecha_recepcion).toBeDefined()
  })

  it('recibe solo parcial y pasa a RECIBIDA_PARCIAL sin fecha_recepcion', async () => {
    let call = 0
    // OJO: el UPDATE del item via .eq().eq() también es awaitable y consume
    // un .then() — por eso el contador suma una posición intermedia.
    mockChain.then = (resolve) => {
      call++
      // Call 1: items actuales (antes de recibir) — pedido 10, recibido 0
      if (call === 1) return resolve({
        data: [{ id: 'i-1', material_id: 'm-1', cantidad: 10, cantidad_recibida: 0 }],
        error: null,
      })
      // Call 2: UPDATE del item (await chain) — devuelve algo OK
      if (call === 2) return resolve({ data: null, error: null })
      // Call 3: items finales (post-recibir) — recibido 4 < pedido 10 → parcial
      if (call === 3) return resolve({
        data: [{ cantidad: 10, cantidad_recibida: 4 }],
        error: null,
      })
      return resolve({ data: [], error: null })
    }
    mockChain.single
      .mockResolvedValueOnce({ data: { estado: 'CONFIRMADA' }, error: null })
      .mockResolvedValueOnce({
        data: { id: 'c-1', estado: 'RECIBIDA_PARCIAL' },
        error: null,
      })

    const result = await ComprasService.recibir('c-1', {
      items: [{ itemId: 'i-1', cantidadRecibida: 4 }],
    })

    expect(result.estado).toBe('RECIBIDA_PARCIAL')
    expect(updateStock).toHaveBeenCalledWith('m-1', 4, 'reponer')

    // El UPDATE final de la compra debe ser RECIBIDA_PARCIAL SIN fecha_recepcion.
    const updateEstado = mockChain.update.mock.calls.find(
      c => c[0]?.estado === 'RECIBIDA_PARCIAL'
    )
    expect(updateEstado).toBeDefined()
    expect(updateEstado[0].fecha_recepcion).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
describe('compras.service.update (bloqueo de edición)', () => {
  it('rechaza editar una compra CONFIRMADA', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { estado: 'CONFIRMADA' },
      error: null,
    })
    await expect(
      ComprasService.update('c-1', { observaciones: 'nueva' })
    ).rejects.toThrow(/BORRADOR/)
  })

  it('rechaza editar una compra RECIBIDA', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { estado: 'RECIBIDA' },
      error: null,
    })
    await expect(
      ComprasService.update('c-1', { observaciones: 'cambio' })
    ).rejects.toThrow(/BORRADOR/)
  })
})

// ─────────────────────────────────────────────────────────────
describe('compras.service.addItem (validaciones)', () => {
  it('rechaza cantidad <= 0', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { estado: 'BORRADOR' },
      error: null,
    })
    await expect(
      ComprasService.addItem('c-1', { materialId: 'm-1', cantidad: 0, precioUnitario: 10 })
    ).rejects.toThrow(/cantidad/)
  })

  it('rechaza precioUnitario negativo', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { estado: 'BORRADOR' },
      error: null,
    })
    await expect(
      ComprasService.addItem('c-1', { materialId: 'm-1', cantidad: 5, precioUnitario: -1 })
    ).rejects.toThrow(/precioUnitario/)
  })

  it('rechaza agregar item si la compra no está en BORRADOR', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { estado: 'CONFIRMADA' },
      error: null,
    })
    await expect(
      ComprasService.addItem('c-1', { materialId: 'm-1', cantidad: 5, precioUnitario: 10 })
    ).rejects.toThrow(/BORRADOR/)
  })
})
