const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  single:      jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}
mockChain.then = (resolve) => resolve({ data: [], error: null, count: 0 })

jest.mock('../config/supabase.js', () => ({
  supabase: { from: jest.fn(() => mockChain) },
}))

import * as EstanteriasService from './estanterias.service.js'
import { supabase } from '../config/supabase.js'

beforeEach(() => {
  jest.clearAllMocks()
  mockChain.select.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.update.mockReturnThis()
  mockChain.delete.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.order.mockReturnThis()
  mockChain.single.mockResolvedValue({ data: null, error: null })
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
  mockChain.then = (resolve) => resolve({ data: [], error: null, count: 0 })
  supabase.from.mockImplementation(() => mockChain)
})

describe('estanterias.service.getByQR', () => {
  it('filtra por activa=true para no romper si el código fue reusado por una estantería borrada', async () => {
    mockChain.single.mockResolvedValue({ data: { id: 'e-1', codigo_qr: 'FS-EST-002', activa: true }, error: null })
    await EstanteriasService.getByQR('FS-EST-002')
    expect(mockChain.eq).toHaveBeenCalledWith('codigo_qr', 'FS-EST-002')
    expect(mockChain.eq).toHaveBeenCalledWith('activa', true)
  })
})

describe('estanterias.service.create — numeración', () => {
  it('usa el número 1 si no hay ninguna estantería activa', async () => {
    mockChain.then = (resolve) => resolve({ data: [], error: null })
    mockChain.single.mockResolvedValue({ data: { id: 'e-1', numero: 1, codigo_qr: 'FS-EST-001' }, error: null })

    const data = await EstanteriasService.create({})

    expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({ numero: 1, codigo_qr: 'FS-EST-001' }))
    expect(data.numero).toBe(1)
  })

  it('rellena el primer hueco entre las activas en vez de seguir al máximo', async () => {
    // Activas: 1 y 3 (la 2 está inactiva/borrada) — el próximo número debe ser 2.
    mockChain.then = (resolve) => resolve({ data: [{ numero: 1 }, { numero: 3 }], error: null })
    mockChain.single.mockResolvedValue({ data: { id: 'e-2', numero: 2, codigo_qr: 'FS-EST-002' }, error: null })

    await EstanteriasService.create({})

    expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({ numero: 2, codigo_qr: 'FS-EST-002' }))
  })

  it('sigue al máximo si no hay huecos', async () => {
    mockChain.then = (resolve) => resolve({ data: [{ numero: 1 }, { numero: 2 }], error: null })
    mockChain.single.mockResolvedValue({ data: { id: 'e-3', numero: 3, codigo_qr: 'FS-EST-003' }, error: null })

    await EstanteriasService.create({})

    expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({ numero: 3 }))
  })
})

describe('estanterias.service.remove', () => {
  it('rechaza con 409 si la estantería todavía tiene items', async () => {
    mockChain.then = (resolve) => resolve({ count: 2, error: null })
    await expect(EstanteriasService.remove('e-1')).rejects.toMatchObject({ status: 409 })
    expect(mockChain.update).not.toHaveBeenCalled()
  })

  it('la borra (soft) si está vacía', async () => {
    mockChain.then = (resolve) => resolve({ count: 0, error: null })
    await EstanteriasService.remove('e-1')
    expect(mockChain.update).toHaveBeenCalledWith({ activa: false })
  })
})

describe('estanterias.service.addItem', () => {
  it('rechaza si no viene ni herramientaId ni materialId', async () => {
    await expect(EstanteriasService.addItem('e-1', {})).rejects.toMatchObject({ status: 400 })
  })

  it('rechaza con 409 si el material ya está en otra estantería', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: { estanteria_id: 'e-9', estanterias: { numero: 5 } }, error: null,
    })
    await expect(
      EstanteriasService.addItem('e-1', { materialId: 'm-1' })
    ).rejects.toMatchObject({ status: 409 })
    expect(mockChain.insert).not.toHaveBeenCalled()
  })

  it('agrega el item si el material no está en ninguna estantería todavía', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    mockChain.single.mockResolvedValue({ data: { id: 'i-1', material_id: 'm-1' }, error: null })

    const data = await EstanteriasService.addItem('e-1', { materialId: 'm-1' })

    expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({ estanteria_id: 'e-1', material_id: 'm-1' }))
    expect(data.id).toBe('i-1')
  })
})
