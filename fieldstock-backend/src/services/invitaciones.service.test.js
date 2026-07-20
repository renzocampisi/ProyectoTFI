const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  is:     jest.fn().mockReturnThis(),
  gt:     jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  single:      jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}
mockChain.then = (resolve) => resolve({ data: [], error: null })

jest.mock('../config/supabase.js', () => ({
  supabase: { from: jest.fn(() => mockChain) },
}))

import * as InvitacionesService from './invitaciones.service.js'
import { supabase } from '../config/supabase.js'

beforeEach(() => {
  jest.resetAllMocks()
  mockChain.select.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.update.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.is.mockReturnThis()
  mockChain.gt.mockReturnThis()
  mockChain.order.mockReturnThis()
  mockChain.single.mockResolvedValue({ data: null, error: null })
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
  mockChain.then = (resolve) => resolve({ data: [], error: null })
  supabase.from.mockImplementation(() => mockChain)
})

describe('invitaciones.service.generar', () => {
  it('rechaza role inválido con status 400', async () => {
    await expect(
      InvitacionesService.generar({ role: 'INEXISTENTE', creadoPor: 'u-1' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rechaza DUEÑO — nunca se invita ese rol', async () => {
    await expect(
      InvitacionesService.generar({ role: 'DUEÑO', creadoPor: 'u-1' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('inserta con un código FS-INV-XXXXXX y el creador', async () => {
    mockChain.single.mockResolvedValue({
      data: { id: 'inv-1', codigo: 'FS-INV-ABC123', role: 'OPERARIO', creado_por: 'u-1' },
      error: null,
    })

    const data = await InvitacionesService.generar({ role: 'OPERARIO', creadoPor: 'u-1' })

    expect(supabase.from).toHaveBeenCalledWith('invitaciones')
    const insertArg = mockChain.insert.mock.calls[0][0]
    expect(insertArg.role).toBe('OPERARIO')
    expect(insertArg.creado_por).toBe('u-1')
    expect(insertArg.codigo).toMatch(/^FS-INV-[A-F0-9]{6}$/)
    expect(new Date(insertArg.expira_en).getTime()).toBeGreaterThan(Date.now())
    expect(data.codigo).toBe('FS-INV-ABC123')
  })

  it('propaga el error de Supabase si el insert falla', async () => {
    mockChain.single.mockResolvedValue({ data: null, error: new Error('db down') })
    await expect(
      InvitacionesService.generar({ role: 'ADMIN', creadoPor: 'u-1' })
    ).rejects.toThrow('db down')
  })
})

describe('invitaciones.service.getVigentePorCodigo', () => {
  it('busca por código en mayúsculas, sin usar y no vencida', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: { id: 'inv-1', codigo: 'FS-INV-ABC123', role: 'OPERARIO' },
      error: null,
    })

    const data = await InvitacionesService.getVigentePorCodigo(' fs-inv-abc123 ')

    expect(mockChain.eq).toHaveBeenCalledWith('codigo', 'FS-INV-ABC123')
    expect(mockChain.is).toHaveBeenCalledWith('usado_por', null)
    expect(mockChain.gt).toHaveBeenCalledWith('expira_en', expect.any(String))
    expect(data.codigo).toBe('FS-INV-ABC123')
  })

  it('devuelve null si no hay invitación vigente con ese código', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    const data = await InvitacionesService.getVigentePorCodigo('FS-INV-000000')
    expect(data).toBeNull()
  })

  it('devuelve null si la invitación existe pero venció (filtro gt la excluye)', async () => {
    // El filtro `gt('expira_en', now)` hace que Supabase no devuelva la fila
    // vencida — desde el punto de vista del service, es indistinguible de
    // "no existe": maybeSingle resuelve null.
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    const data = await InvitacionesService.getVigentePorCodigo('FS-INV-VENCIDA')
    expect(mockChain.gt).toHaveBeenCalledWith('expira_en', expect.any(String))
    expect(data).toBeNull()
  })
})

describe('invitaciones.service.marcarUsada', () => {
  it('actualiza usado_por y usado_en', async () => {
    mockChain.then = (resolve) => resolve({ error: null })
    await InvitacionesService.marcarUsada('inv-1', 'u-2')

    expect(supabase.from).toHaveBeenCalledWith('invitaciones')
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ usado_por: 'u-2' })
    )
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'inv-1')
  })

  it('propaga el error de Supabase', async () => {
    mockChain.then = (resolve) => resolve({ error: new Error('update failed') })
    await expect(InvitacionesService.marcarUsada('inv-1', 'u-2')).rejects.toThrow('update failed')
  })
})

describe('invitaciones.service.getAll', () => {
  it('lista ordenado por created_at desc', async () => {
    mockChain.then = (resolve) => resolve({ data: [{ id: 'inv-1' }], error: null })
    const data = await InvitacionesService.getAll()
    expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(data).toEqual([{ id: 'inv-1' }])
  })
})
