const mockChain = {
  select: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}
mockChain.then = (resolve) => resolve({ data: [], error: null })

jest.mock('../config/supabase.js', () => ({
  supabase: { from: jest.fn(() => mockChain) },
}))

import * as PlanesService from './planes.service.js'
import { supabase } from '../config/supabase.js'

beforeEach(() => {
  jest.resetAllMocks()
  mockChain.select.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.order.mockReturnThis()
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
  mockChain.then = (resolve) => resolve({ data: [], error: null })
  supabase.from.mockImplementation(() => mockChain)
})

describe('planes.service.getAll', () => {
  it('trae solo planes activos ordenados por precio (nulls al final)', async () => {
    mockChain.then = (resolve) => resolve({
      data: [{ codigo: 'BASICO' }, { codigo: 'PRO' }, { codigo: 'PRO_SEGUIMIENTO', precio_mensual: null }],
      error: null,
    })
    const data = await PlanesService.getAll()
    expect(supabase.from).toHaveBeenCalledWith('planes')
    expect(mockChain.eq).toHaveBeenCalledWith('activo', true)
    expect(mockChain.order).toHaveBeenCalledWith('precio_mensual', { ascending: true, nullsFirst: false })
    expect(data).toHaveLength(3)
  })

  it('propaga el error de Supabase', async () => {
    mockChain.then = (resolve) => resolve({ data: null, error: new Error('db down') })
    await expect(PlanesService.getAll()).rejects.toThrow('db down')
  })
})

describe('planes.service.getByCodigo', () => {
  it('busca por código entre los activos', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: { codigo: 'PRO' }, error: null })
    const data = await PlanesService.getByCodigo('PRO')
    expect(mockChain.eq).toHaveBeenCalledWith('codigo', 'PRO')
    expect(mockChain.eq).toHaveBeenCalledWith('activo', true)
    expect(data.codigo).toBe('PRO')
  })

  it('devuelve null si no existe', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(PlanesService.getByCodigo('INEXISTENTE')).resolves.toBeNull()
  })
})
