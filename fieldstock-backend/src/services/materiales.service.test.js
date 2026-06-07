// ── Mock de Supabase (mockChainable) ──────────────────────────────
// Patrón idéntico al de remitos/herramientas tests: chain de fns que devuelven
// `this` para encadenar y un `then` configurable que resuelve la query final
// (cuando no termina en `.single()`). Esto último nos permite mockear queries
// con `{ count: 'exact', head: true }` simplemente cambiando el then a que
// resuelva `{ count: N, error: null }`.
const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  neq:    jest.fn().mockReturnThis(),
  ilike:  jest.fn().mockReturnThis(),
  not:    jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
}
mockChain.then = (resolve) => resolve({ data: [], error: null })

jest.mock('../config/supabase.js', () => ({
  supabase: {
    from: jest.fn(() => mockChain),
    rpc:  jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}))

import * as MaterialesService from './materiales.service.js'
import { supabase } from '../config/supabase.js'

beforeEach(() => {
  jest.clearAllMocks()
  mockChain.select.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.update.mockReturnThis()
  mockChain.delete.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.neq.mockReturnThis()
  mockChain.ilike.mockReturnThis()
  mockChain.not.mockReturnThis()
  mockChain.order.mockReturnThis()
  mockChain.single.mockResolvedValue({ data: null, error: null })
  mockChain.then = (resolve) => resolve({ data: [], error: null })
  supabase.from.mockImplementation(() => mockChain)
})

describe('materiales.service.remove (issue #49)', () => {
  it('hace soft-delete (UPDATE activo=false) cuando no hay remitos abiertos', async () => {
    // 1ra await: pre-check de uso en remitos → count=0
    // 2da await: UPDATE final → ok
    let call = 0
    mockChain.then = (resolve) => {
      call++
      if (call === 1) return resolve({ count: 0, error: null })
      return resolve({ data: null, error: null })
    }

    await MaterialesService.remove('mat-1')

    // Verifica que se consultó la tabla join con el filtro correcto
    expect(supabase.from).toHaveBeenCalledWith('remito_materiales')
    expect(mockChain.eq).toHaveBeenCalledWith('material_id', 'mat-1')
    expect(mockChain.neq).toHaveBeenCalledWith('remitos.estado', 'CERRADO')

    // Y que se hizo el UPDATE soft-delete a materiales
    expect(supabase.from).toHaveBeenCalledWith('materiales')
    expect(mockChain.update).toHaveBeenCalledWith({ activo: false })
  })

  it('lanza 409 si el material está en uso en al menos un remito abierto', async () => {
    // Pre-check devuelve count > 0 → debe abortar antes del UPDATE
    mockChain.then = (resolve) => resolve({ count: 3, error: null })

    await expect(MaterialesService.remove('mat-1')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('3 remito(s) abierto(s)'),
    })

    // No debe haber llegado al UPDATE
    expect(mockChain.update).not.toHaveBeenCalled()
  })

  it('propaga error de Supabase si el pre-check falla', async () => {
    mockChain.then = (resolve) =>
      resolve({ count: null, error: new Error('connection lost') })

    await expect(MaterialesService.remove('mat-1'))
      .rejects.toThrow('connection lost')

    expect(mockChain.update).not.toHaveBeenCalled()
  })
})
